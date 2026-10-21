import { describe, expect, it } from "vitest";
import {
  BLOCKS,
  DEFAULT_SELECTION,
  STAGE,
  getBlock,
  parseSelection,
  positionFor,
  seatPosition,
  selectionQuery,
  standingPosition,
  type Selection,
} from "./model";

describe("event seating model", () => {
  it("includes all 55 numbered blocks from the supplied plan without duplicates", () => {
    expect(BLOCKS).toHaveLength(55);
    expect(new Set(BLOCKS.map((b) => b.id)).size).toBe(55);
    for (let id = 209; id <= 233; id++)
      expect(getBlock(String(id)).tier).toBe("Main");
    for (const id of ["109", "114", "128", "133"])
      expect(getBlock(id).tier).toBe("Lower");
    for (const id of ["309", "314", "318", "320", "322", "324", "328", "333"])
      expect(getBlock(id).tier).toBe("Upper");
  });
  it("places later rows higher and farther away from the floor", () => {
    for (const b of BLOCKS) {
      const front = seatPosition(b, b.firstRow, 1),
        back = seatPosition(b, b.lastRow, 1);
      expect(back.y).toBeGreaterThan(front.y);
      expect(
        (back.x - front.x) * b.normal.x + (back.z - front.z) * b.normal.z,
      ).toBeGreaterThan(0);
      const otherSeat = seatPosition(b, b.firstRow, b.seats);
      expect(otherSeat.y).toBe(front.y);
      expect(
        Math.hypot(otherSeat.x - front.x, otherSeat.z - front.z),
      ).toBeGreaterThan(4);
    }
  });
  it("places all seats above ground and in front of the stage plane", () => {
    for (const b of BLOCKS)
      for (const row of [b.firstRow, b.lastRow])
        for (const seat of [1, b.seats]) {
          const p = seatPosition(b, row, seat);
          expect(p.y).toBeGreaterThan(0);
          expect(p.z).toBeGreaterThan(STAGE.z);
          expect(Object.values(p).every(Number.isFinite)).toBe(true);
        }
  });
  it("keeps standing pins inside the chosen pen, separated by the central aisle", () => {
    for (const pen of ["A", "B"] as const)
      for (const u of [-1, 0, 0.5, 1, 2])
        for (const v of [-1, 0, 0.5, 1, 2]) {
          const p = standingPosition(pen, u, v);
          expect(p.x).toBeGreaterThanOrEqual(pen === "A" ? 1.5 : -20);
          expect(p.x).toBeLessThanOrEqual(pen === "A" ? 20 : -1.5);
          expect(p.z).toBeGreaterThanOrEqual(-27);
          expect(p.z).toBeLessThanOrEqual(20);
          expect(p.y).toBe(1.65);
        }
  });
});

describe("shareable locations", () => {
  it("round-trips seats and standing positions, including exact pen edges", () => {
    const locations: Selection[] = [
      { mode: "seat", block: "333", row: 38, seat: 30 },
      { mode: "seat", block: "324", row: 29, seat: 22 },
      { mode: "standing", pen: "B", u: 0, v: 1 },
      { mode: "standing", pen: "A", u: 0.31356, v: 0.52912 },
    ];
    for (const s of locations) {
      expect(parseSelection(selectionQuery(s))).toEqual(s);
      expect(positionFor(parseSelection(selectionQuery(s)))).toEqual(
        positionFor(s),
      );
    }
  });
  it("validates unknown blocks, malformed numbers and out-of-range ticket inputs", () => {
    expect(parseSelection("?block=999")).toEqual(DEFAULT_SELECTION);
    expect(parseSelection("?block=109&row=999&seat=-8")).toEqual({
      mode: "seat",
      block: "109",
      row: 8,
      seat: 1,
    });
    expect(parseSelection("?block=211&row=abc&seat=Infinity")).toEqual({
      mode: "seat",
      block: "211",
      row: 9,
      seat: 1,
    });
    expect(parseSelection("?mode=standing&pen=Z&u=NaN&v=-2")).toEqual({
      mode: "standing",
      pen: "A",
      u: 0.5,
      v: 0,
    });
    expect(parseSelection("?mode=standing&pen=B")).toEqual({
      mode: "standing",
      pen: "B",
      u: 0.5,
      v: 0.5,
    });
  });
  it("uses continuous estimated row labels across stacked tiers", () => {
    expect(getBlock("109")).toMatchObject({ firstRow: 1, lastRow: 8 });
    expect(getBlock("209")).toMatchObject({ firstRow: 9, lastRow: 26 });
    expect(getBlock("309")).toMatchObject({ firstRow: 27, lastRow: 38 });
    expect(getBlock("224")).toMatchObject({ firstRow: 1, lastRow: 18 });
    expect(getBlock("324")).toMatchObject({ firstRow: 19, lastRow: 30 });
    expect(parseSelection("?block=324&row=29&seat=1")).toEqual({
      mode: "seat",
      block: "324",
      row: 29,
      seat: 1,
    });
  });
});
