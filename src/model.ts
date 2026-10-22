/** Conceptual geometry derived from the supplied event block diagram.
 * All measurements, rows and seat counts are estimates, not venue survey data.
 * Stage is toward negative Z; east/right of the supplied plan is negative X. */
export type Point = { x: number; y: number; z: number };
export type Block = {
  id: string;
  tier: "Lower" | "Main" | "Upper";
  /** Number of simplified terraces rendered in the 3D model. */
  rows: number;
  /** Estimated ticket labels for the first and last terrace. */
  firstRow: number;
  lastRow: number;
  seats: number;
  center: Point;
  normal: { x: number; z: number };
  tangent: { x: number; z: number };
  width: number;
  depth: number;
  rise: number;
};
export type Selection =
  | { mode: "seat"; block: string; row: number; seat: number }
  | { mode: "standing"; pen: "A" | "B"; u: number; v: number };

export const STAGE: Point = { x: 0, y: 4.2, z: -35 };
/** Calibrated against the supplied Block 310, Row 33 fan photo. */
export const DEFAULT_FOV = 52;
export const DEFAULT_SELECTION: Selection = {
  mode: "seat",
  block: "211",
  row: 14,
  seat: 12,
};
export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

function mainBlock(number: number): Block {
  let x: number, z: number, nx: number, nz: number, width: number;
  if (number <= 214) {
    x = 28;
    z = -24 + (number - 209) * 8.4;
    nx = 1;
    nz = 0;
    width = 7.5;
  } else if (number >= 228) {
    x = -28;
    z = 18 - (number - 228) * 8.4;
    nx = -1;
    nz = 0;
    width = 7.5;
  } else {
    const angle = ((number - 214.5) / 13) * Math.PI;
    x = 28 * Math.cos(angle);
    z = 22 + 22 * Math.sin(angle);
    nx = Math.cos(angle);
    nz = Math.sin(angle);
    width = 5.4;
  }
  // Mirror the bowl to match the supplied event plan: the 209–214 stack is
  // east/right of the stage and the 228–233 stack is west/left.
  x = -x;
  nx = -nx;
  return {
    id: String(number),
    tier: "Main",
    rows: 18,
    firstRow: 1,
    lastRow: 35,
    seats: number >= 215 && number <= 227 ? 22 : 30,
    center: { x, y: 5.5, z },
    normal: { x: nx, z: nz },
    tangent: { x: -nz, z: nx },
    width,
    depth: 9,
    rise: 0.44,
  };
}

const mainBlocks = Array.from({ length: 25 }, (_, i) => mainBlock(209 + i));
const lowerIds = [109, 110, 111, 112, 113, 114, 128, 129, 130, 131, 132, 133];
const upperIds = [
  309, 310, 311, 312, 313, 314, 318, 319, 320, 322, 323, 324, 328, 329, 330,
  331, 332, 333,
];

export const BLOCKS: Block[] = [
  ...lowerIds.map((id) => {
    const b = mainBlock(id + 100);
    return {
      ...b,
      id: String(id),
      tier: "Lower" as const,
      rows: 8,
      firstRow: 1,
      lastRow: 35,
      seats: 24,
      center: {
        x: b.center.x - b.normal.x * 5.3,
        y: 0.7,
        z: b.center.z - b.normal.z * 5.3,
      },
      depth: 4,
      rise: 0.42,
    };
  }),
  ...mainBlocks,
  ...upperIds.map((id) => {
    const b = mainBlock(id - 100);
    return {
      ...b,
      id: String(id),
      tier: "Upper" as const,
      rows: 12,
      firstRow: 1,
      lastRow: 35,
      seats: b.seats,
      center: {
        x: b.center.x + b.normal.x * 11,
        y: 15.4,
        z: b.center.z + b.normal.z * 11,
      },
      width: b.width * 1.12,
      depth: 6.5,
      rise: 0.48,
    };
  }),
];

export function getBlock(id: string): Block {
  const b = BLOCKS.find((b) => b.id === id);
  if (!b) throw new Error(`Unknown block: ${id}`);
  return b;
}

export function seatPosition(block: Block, row: number, seat: number): Point {
  const rowProgress =
    (clamp(row, block.firstRow, block.lastRow) - block.firstRow) /
    (block.lastRow - block.firstRow);
  const modelRow = rowProgress * (block.rows - 1);
  const back = ((modelRow + 0.5) / block.rows) * block.depth;
  const across = ((seat - 0.5) / block.seats - 0.5) * block.width;
  return {
    x: block.center.x + block.normal.x * back + block.tangent.x * across,
    y: block.center.y + modelRow * block.rise + 1.18,
    z: block.center.z + block.normal.z * back + block.tangent.z * across,
  };
}

export function standingPosition(pen: "A" | "B", u: number, v: number): Point {
  return {
    x: (pen === "A" ? -20 : 1.5) + clamp(u, 0, 1) * 18.5,
    y: 1.65,
    z: -27 + clamp(v, 0, 1) * 47,
  };
}

export function positionFor(selection: Selection): Point {
  return selection.mode === "seat"
    ? seatPosition(getBlock(selection.block), selection.row, selection.seat)
    : standingPosition(selection.pen, selection.u, selection.v);
}

export function selectionLabel(selection: Selection): string {
  return selection.mode === "seat"
    ? `Block ${selection.block} · Row ${selection.row} · Seat ${selection.seat}`
    : `Standing pen ${selection.pen}`;
}

export function parseSelection(search: string): Selection {
  const params = new URLSearchParams(search);
  if (params.get("mode") === "standing") {
    const coordinate = (key: string) => {
      const raw = params.get(key);
      const n = raw === null || raw.trim() === "" ? 0.5 : Number(raw);
      return Number.isFinite(n) ? clamp(n, 0, 1) : 0.5;
    };
    return {
      mode: "standing",
      pen: params.get("pen") === "B" ? "B" : "A",
      u: coordinate("u"),
      v: coordinate("v"),
    };
  }
  const block = BLOCKS.find((b) => b.id === params.get("block"));
  if (!block) return { ...DEFAULT_SELECTION };
  const boundedInt = (key: string, min: number, max: number) => {
    const n = Number(params.get(key) ?? min);
    return Number.isFinite(n) ? clamp(Math.round(n), min, max) : min;
  };
  return {
    mode: "seat",
    block: block.id,
    row: boundedInt("row", block.firstRow, block.lastRow),
    seat: boundedInt("seat", 1, block.seats),
  };
}

export function selectionQuery(selection: Selection): string {
  return selection.mode === "seat"
    ? new URLSearchParams({
        block: selection.block,
        row: String(selection.row),
        seat: String(selection.seat),
      }).toString()
    : new URLSearchParams({
        mode: "standing",
        pen: selection.pen,
        u: String(selection.u),
        v: String(selection.v),
      }).toString();
}

export function blockCorners(block: Block): { x: number; z: number }[] {
  return [
    [-0.5, 0],
    [0.5, 0],
    [0.5, 1],
    [-0.5, 1],
  ].map(([side, back]) => ({
    x:
      block.center.x +
      block.tangent.x * block.width * side +
      block.normal.x * block.depth * back,
    z:
      block.center.z +
      block.tangent.z * block.width * side +
      block.normal.z * block.depth * back,
  }));
}
