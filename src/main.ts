import "./style.css";
import { selectionUrl, updateLocation } from "./location";
import {
  BLOCKS,
  DEFAULT_SELECTION,
  blockCorners,
  clamp,
  getBlock,
  parseSelection,
  positionFor,
  selectionLabel,
  type Selection,
} from "./model";

const icons: Record<string, string> = {
  arrow: '<path d="M5 19 19 5M5 5h14v14"/>',
  chevron: '<path d="m8 10 4 4 4-4"/>',
  pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  reset: '<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',
  expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  share: '<path d="M12 15V3m-4 4 4-4 4 4M5 12v8h14v-8"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
  seat: '<path d="M5 12V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7M3 11v6h18v-6M6 17v4m12-4v4M4 13h16"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
};
const icon = (name: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] ?? ""}</svg>`;
const $ = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;

let selection = parseSelection(location.search);
let seated: Extract<Selection, { mode: "seat" }> =
  selection.mode === "seat"
    ? { ...selection }
    : ({ ...DEFAULT_SELECTION } as Extract<Selection, { mode: "seat" }>);
let standing: Extract<Selection, { mode: "standing" }> =
  selection.mode === "standing"
    ? { ...selection }
    : { mode: "standing", pen: "A", u: 0.5, v: 0.3 };
let scene: import("./scene").SeatScene | undefined;
let sceneFailed = false;
let toastTimer: ReturnType<typeof setTimeout>;

$("#app").innerHTML = `
  <header class="topbar">
    <a class="brand" href="./" aria-label="LANY seat preview home"><span class="brand-mark">l.</span><span>BEFORE THE ENCORE<span class="brand-sub">a fan-made seat explorer</span></span></a>
    <button class="about-button" id="about-button">About this preview ${icon("info")}</button>
  </header>
  <main>
    <section class="event-heading" aria-labelledby="event-title">
      <div class="event-title"><div class="eyebrow"><span class="live-dot"></span> ONE NIGHT IN SINGAPORE</div><h1 id="event-title">LANY <span>soft world tour</span><span class="title-star" aria-hidden="true">✳</span></h1></div>
      <div class="event-details"><div><span class="date-day">04</span><span>NOVEMBER<br><strong>2026 · WEDNESDAY</strong></span></div><p>SINGAPORE INDOOR STADIUM ${icon("arrow")}</p></div>
    </section>

    <div class="explorer">
      <aside class="location-panel" aria-label="Choose your location">
        <div class="panel-title"><span class="section-number">01 /</span><h2>Find your perspective.</h2></div>
        <p class="panel-intro">Your ticket. Your spot. A little closer to the night.</p>
        <div class="mode-switch" role="group" aria-label="Ticket type">
          <button id="seated-mode" aria-pressed="true">${icon("seat")} Seated</button>
          <button id="standing-mode" aria-pressed="false">${icon("pin")} Standing</button>
        </div>
        <form id="seat-form">
          <label class="field-label" for="block">BLOCK <span id="tier-label">MAIN TIER</span></label>
          <div class="select-wrap"><select id="block" name="block" aria-describedby="model-note">${[
            "Lower",
            "Main",
            "Upper",
          ]
            .map(
              (tier) =>
                `<optgroup label="${tier} tier">${BLOCKS.filter(
                  (b) => b.tier === tier,
                )
                  .map((b) => `<option value="${b.id}">Block ${b.id}</option>`)
                  .join("")}</optgroup>`,
            )
            .join("")}</select>${icon("chevron")}</div>
          <div class="seat-fields">
            <div><label class="field-label" for="row">ROW</label><div class="number-field"><button type="button" data-step="row:-1" aria-label="Previous row">−</button><input id="row" name="row" type="number" min="1" max="35" value="14" required inputmode="numeric" /><button type="button" data-step="row:1" aria-label="Next row">+</button></div></div>
            <div><label class="field-label" for="seat">SEAT</label><div class="number-field"><button type="button" data-step="seat:-1" aria-label="Previous seat">−</button><input id="seat" name="seat" type="number" min="1" max="30" value="12" required inputmode="numeric" /><button type="button" data-step="seat:1" aria-label="Next seat">+</button></div></div>
          </div>
          <p id="model-note" class="model-note">Broad estimate · rows 1–35, seats 1–30</p>
        </form>
        <div id="standing-picker" hidden>
          <div class="field-label">STANDING PEN <span>CHOOSE YOUR SPOT</span></div>
          <div class="pen-switch" role="group" aria-label="Standing pen"><button id="pen-a" aria-pressed="true">Pen A</button><button id="pen-b" aria-pressed="false">Pen B</button></div>
          <div id="pin-map" class="pin-map"></div>
          <p class="pin-instructions">${icon("pin")} Tap the floor to drop your pin.<br><span>Use arrow keys to fine-tune your spot.</span></p>
        </div>
        <details class="map-details" id="map-details" ${matchMedia("(min-width: 900px)").matches ? "open" : ""}>
          <summary><span>THE ROOM AT A GLANCE</span>${icon("chevron")}</summary>
          <p class="map-subtitle">Pick a block to explore its view.</p>
          <div id="block-map" class="block-map"></div>
          <div class="map-legend"><span><i></i> Available blocks</span><span><i class="selected-dot"></i> Your block</span></div>
        </details>
      </aside>

      <section class="view-panel" aria-label="Seat preview">
        <div class="viewport" id="viewport">
          <div id="scene" class="scene"><div class="loading-state"><span class="loader"></span><p>Setting the stage…</p></div></div>
          <div class="view-topline"><span class="view-tag"><span class="live-dot"></span> YOUR PERSPECTIVE</span><span class="approx-tag">APPROXIMATE 3D</span></div>
          <div class="view-bottomline"><div class="view-caption"><div class="eyebrow" id="view-tier">MAIN TIER / SEATED</div><h2 id="view-block">Block 211<span class="caption-dot">.</span></h2><p id="view-seat">Row 14 <span>·</span> Seat 12</p></div><button id="fullscreen" class="icon-button" aria-label="Expand preview" title="Expand preview">${icon("expand")}</button></div>
          <div class="look-hint" id="look-hint">${icon("eye")} Drag to look around</div>
        </div>
        <div class="view-toolbar">
          <button id="reset-view" class="text-button">${icon("reset")} Face the stage</button>
          <div class="zoom-control"><label for="zoom">ZOOM</label><input type="range" id="zoom" min="42" max="80" value="68" aria-label="Field of view" /><output id="zoom-value" for="zoom">1.0×</output></div>
          <button id="share-view" class="text-button" aria-label="Share view">${icon("share")} <span>Share view</span></button>
        </div>
        <div class="view-stats"><div><span class="stat-label">YOUR LOCATION</span><strong id="stat-location">East side</strong></div><div><span class="stat-label">STAGE DISTANCE <span title="Estimated from conceptual geometry">≈</span></span><strong id="stat-distance">45 <small>m</small></strong></div><div><span class="stat-label">EYE LEVEL <span title="Estimated from conceptual geometry">≈</span></span><strong id="stat-height">9 <small>m</small></strong></div><div class="stat-note">A feeling for the view.<br>A head start on the memories.</div></div>
        <div class="estimate-note">${icon("info")}<p>This is an illustrative preview. Row numbering, sightlines, stage design and distances are estimated. <button id="learn-more">How it works ${icon("arrow")}</button></p></div>
      </section>
    </div>
    <div class="below-explorer"><span>GOOD NIGHTS START WITH A GOOD VIEW.</span><p>Made for fans, by a fan. <span class="little-star">✳</span> See you in Singapore.</p></div>
  </main>
  <footer><span>UNOFFICIAL · NOT AFFILIATED WITH LANY OR THE VENUE</span><a href="https://github.com/cerealbox39/concert-seat-preview" target="_blank" rel="noopener noreferrer">Built in the open ${icon("arrow")}</a></footer>
  <div id="announcement" class="sr-only" role="status" aria-live="polite"></div>
  <div id="toast" class="toast" role="status" hidden></div>
  <dialog id="about-dialog" aria-labelledby="about-title"><button class="dialog-close icon-button" aria-label="Close information">${icon("close")}</button><span class="eyebrow">A NOTE BEFORE THE LIGHTS GO DOWN</span><h2 id="about-title">A preview.<br><em>Not a promise.</em></h2><p>This fan-made explorer imagines LANY’s soft world tour at Singapore Indoor Stadium on <strong>4 November 2026</strong>, using the event and block plan supplied for this project.</p><p>The block IDs and standing pen arrangement follow that plan. The plan is not to scale: stadium dimensions, row and seat counts, seat numbering direction, elevations, crowd, screens and stage design are <strong>illustrative estimates</strong>. They are not verified sightlines or an official production layout.</p><p>Ticket row labels are treated as restarting within each numbered block. The selector accepts rows 1–35 as a broad input estimate, then maps the chosen row proportionally onto the simplified 3D terraces. Seat numbers run across each block and are estimated from its width. Real limits can differ, and a ticket outside these ranges is not invalid. Distances are measured to the centre of the modelled stage; eye level is height above the arena floor.</p><p>Standing pens have no assigned positions. Your pin is a hypothetical spot; crowd density, people in front of you and access arrangements will change your real view.</p><div class="source-note"><strong>Reference notes</strong><p>Primary reference: the supplied LANY event seating diagram. No authoritative public block-by-block row and seat inventory was available to verify these estimates. Singapore National Stadium is a different venue.</p><a href="https://aviewfrommyseat.com/venue/Singapore+Indoor+Stadium/" target="_blank" rel="noopener noreferrer">Explore Indoor Stadium fan photos ${icon("arrow")}</a><span>External, user-contributed photos; not used to calibrate this model.</span></div><button class="primary-button dialog-done">Got it. Let’s find my view ${icon("arrow")}</button></dialog>
  <dialog id="share-dialog" aria-labelledby="share-title"><button class="dialog-close icon-button" aria-label="Close share dialog">${icon("close")}</button><span class="eyebrow">SAVE YOUR PERSPECTIVE</span><h2 id="share-title">Pass it on.</h2><p>Copy this link to reopen the same seat or standing position.</p><label class="field-label" for="share-url">YOUR VIEW LINK</label><input id="share-url" class="share-url" readonly /><button class="primary-button dialog-done">Done ${icon("arrow")}</button></dialog>
`;

function makeBlockMap() {
  // Flat top-down projection: stage at the top, west on the left and the
  // 209–214 / 309–314 east stacks on the right.
  const projectedPoint = (x: number, z: number) => {
    return {
      x: 140 - x * 2.35,
      y: 35 + (z + 35) * 1.95,
    };
  };
  const project = (x: number, z: number) => {
    const p = projectedPoint(x, z);
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  };
  const floorPolygon = (minX: number, maxX: number) =>
    [
      [minX, -27],
      [maxX, -27],
      [maxX, 20],
      [minX, 20],
    ]
      .map(([x, z]) => project(x, z))
      .join(" ");
  const foh = projectedPoint(0, 22.5);
  $("#block-map").innerHTML =
    `<svg viewBox="0 0 280 255" role="group" aria-label="Flat top-down seating map. Stage at the top; east blocks including 310 are on the right.">
    <rect x="105" y="5" width="70" height="19" rx="2" class="map-stage"/><text x="140" y="18" class="stage-label">STAGE</text>
    <polygon points="${floorPolygon(1.5, 20)}" class="map-pen"/><polygon points="${floorPolygon(-20, -1.5)}" class="map-pen"/>
    <text x="114" y="100" class="pen-label"><tspan x="114">STANDING</tspan><tspan x="114" dy="8">PEN B</tspan></text><text x="166" y="100" class="pen-label"><tspan x="166">STANDING</tspan><tspan x="166" dy="8">PEN A</tspan></text>
    <rect x="${(foh.x - 5).toFixed(1)}" y="${(foh.y - 4).toFixed(1)}" width="10" height="8" rx="1" class="map-foh"/><text x="${foh.x.toFixed(1)}" y="${(foh.y + 11).toFixed(1)}" class="foh-label">FOH</text>
    ${BLOCKS.map((b) => {
      const points = blockCorners(b)
        .map((p) => project(p.x, p.z))
        .join(" ");
      const label = project(
        b.center.x + b.normal.x * b.depth * 0.5,
        b.center.z + b.normal.z * b.depth * 0.5,
      ).split(",");
      return `<g class="map-block tier-${b.tier.toLowerCase()}" data-block="${b.id}" tabindex="0" role="button" aria-label="Block ${b.id}, ${b.tier.toLowerCase()} tier"><polygon class="map-block-face" points="${points}"/><text x="${label[0]}" y="${Number(label[1]) + 2}">${b.id}</text></g>`;
    }).join("")}
    <text x="13" y="135" class="direction-label" transform="rotate(-90 13 135)">WEST</text><text x="267" y="135" class="direction-label" transform="rotate(90 267 135)">EAST</text><text x="140" y="248" class="direction-label">NORTH</text>
  </svg>`;
  document.querySelectorAll<SVGGElement>("[data-block]").forEach((element) => {
    const choose = () => {
      seated.block = element.dataset.block!;
      limitSeat();
      setMode("seat");
      applySelection(seated);
      element.setAttribute("aria-label", `Block ${seated.block}, selected`);
    };
    element.addEventListener("click", choose);
    element.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        choose();
      }
    });
  });
}

function makePinMap() {
  $("#pin-map").innerHTML =
    `<svg viewBox="0 0 280 228" role="group" aria-label="Standing pen map. Stage at top. Tap a pen to choose a position.">
    <rect x="58" y="6" width="164" height="23" rx="3" class="map-stage"/><text x="140" y="21" class="stage-label">STAGE</text>
    <path d="M33 38h214" stroke="#5b6256" stroke-dasharray="3 4"/><text x="140" y="50" class="foh-label">FRONT BARRIER</text>
    <rect data-pen="B" x="25" y="59" width="109" height="138" rx="4" class="pin-pen" tabindex="0" role="button" aria-label="Pen B. Press Enter to select; use arrow keys to move the pin."/>
    <rect data-pen="A" x="146" y="59" width="109" height="138" rx="4" class="pin-pen" tabindex="0" role="button" aria-label="Pen A. Press Enter to select; use arrow keys to move the pin."/>
    <text x="79" y="127" class="pin-pen-label">B</text><text x="201" y="127" class="pin-pen-label">A</text>
    <text x="79" y="144" class="foh-label">STANDING</text><text x="201" y="144" class="foh-label">STANDING</text>
    <rect x="123" y="204" width="34" height="17" rx="2" class="map-foh"/><text x="140" y="216" class="foh-label">FOH</text>
    <g id="standing-pin" pointer-events="none"><circle r="13" class="pin-halo"/><circle r="5" class="pin-core"/><path d="M0 -19v-5M0 19v5M-19 0h-5M19 0h5" stroke="currentColor" stroke-width="1.2"/></g>
  </svg>`;
  const svg = $("#pin-map").querySelector("svg")!;
  let dragging = false;
  const place = (e: PointerEvent) => {
    const point = new DOMPoint(e.clientX, e.clientY).matrixTransform(
      svg.getScreenCTM()!.inverse(),
    );
    const pen = point.x < 140 ? "B" : "A";
    if (point.y < 55 || point.y > 201 || point.x < 20 || point.x > 260) return;
    standing = {
      mode: "standing",
      pen,
      u: clamp((point.x - (pen === "A" ? 146 : 25)) / 109, 0, 1),
      v: clamp((point.y - 59) / 138, 0, 1),
    };
    updatePin();
    applySelection(standing);
  };
  svg.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    dragging = true;
    svg.setPointerCapture(e.pointerId);
    place(e);
  });
  svg.addEventListener("pointermove", (e) => {
    if (dragging) place(e);
  });
  const release = () => {
    dragging = false;
  };
  svg.addEventListener("pointerup", release);
  svg.addEventListener("pointercancel", release);
  svg.addEventListener("lostpointercapture", release);
  svg.querySelectorAll<SVGRectElement>("[data-pen]").forEach((pen) =>
    pen.addEventListener("keydown", (e) => {
      if (
        ![
          "Enter",
          " ",
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
        ].includes(e.key)
      )
        return;
      e.preventDefault();
      standing.pen = pen.dataset.pen as "A" | "B";
      if (e.key === "ArrowUp") standing.v = clamp(standing.v - 0.04, 0, 1);
      if (e.key === "ArrowDown") standing.v = clamp(standing.v + 0.04, 0, 1);
      if (e.key === "ArrowLeft") standing.u = clamp(standing.u - 0.04, 0, 1);
      if (e.key === "ArrowRight") standing.u = clamp(standing.u + 0.04, 0, 1);
      updatePin();
      applySelection(standing);
    }),
  );
}

function updatePin() {
  $("#pen-a").setAttribute("aria-pressed", String(standing.pen === "A"));
  $("#pen-b").setAttribute("aria-pressed", String(standing.pen === "B"));
  document
    .querySelectorAll<SVGRectElement>("[data-pen]")
    .forEach((p) =>
      p.classList.toggle("active", p.dataset.pen === standing.pen),
    );
  const x = (standing.pen === "A" ? 146 : 25) + standing.u * 109;
  $("#standing-pin").setAttribute(
    "transform",
    `translate(${x},${59 + standing.v * 138})`,
  );
}

function limitSeat() {
  const b = getBlock(seated.block);
  seated.row = clamp(seated.row, b.firstRow, b.lastRow);
  seated.seat = clamp(seated.seat, 1, b.seats);
}

function syncForm() {
  const b = getBlock(seated.block);
  $<HTMLSelectElement>("#block").value = seated.block;
  $<HTMLInputElement>("#row").value = String(seated.row);
  $<HTMLInputElement>("#row").min = String(b.firstRow);
  $<HTMLInputElement>("#row").max = String(b.lastRow);
  $<HTMLInputElement>("#seat").value = String(seated.seat);
  $<HTMLInputElement>("#seat").max = String(b.seats);
  $("#tier-label").textContent = `${b.tier.toUpperCase()} TIER`;
  $("#model-note").textContent =
    `Broad estimate · rows ${b.firstRow}–${b.lastRow}, seats 1–${b.seats}`;
  for (const field of ["row", "seat"] as const) {
    const min = field === "row" ? b.firstRow : 1;
    const max = field === "row" ? b.lastRow : b.seats;
    $<HTMLButtonElement>(`[data-step="${field}:-1"]`).disabled =
      seated[field] <= min;
    $<HTMLButtonElement>(`[data-step="${field}:1"]`).disabled =
      seated[field] >= max;
  }
}

function setMode(mode: Selection["mode"]) {
  $("#seated-mode").setAttribute("aria-pressed", String(mode === "seat"));
  $("#standing-mode").setAttribute("aria-pressed", String(mode === "standing"));
  $("#seat-form").hidden = mode !== "seat";
  $("#standing-picker").hidden = mode !== "standing";
  $("#map-details").hidden = mode !== "seat";
  syncForm();
  updatePin();
}

function applySelection(next: Selection, animate = true) {
  selection = { ...next };
  const current = selection;
  if (selection.mode === "seat") seated = { ...selection };
  else standing = { ...selection };
  const p = positionFor(current);
  const isSeat = current.mode === "seat";
  const b = isSeat ? getBlock(current.block) : null;
  $("#view-tier").textContent = isSeat
    ? `${b!.tier.toUpperCase()} TIER / SEATED`
    : "ON THE FLOOR / STANDING";
  $("#view-block").innerHTML =
    `${isSeat ? `Block ${current.block}` : `Pen ${current.pen}`}<span class="caption-dot">.</span>`;
  $("#view-seat").innerHTML = isSeat
    ? `Row ${current.row} <span>·</span> Seat ${current.seat}`
    : "Your pin <span>·</span> Unassigned standing";
  $("#stat-location").textContent = isSeat
    ? p.z > 25
      ? "Rear bowl"
      : p.x < 0
        ? "East · right of stage"
        : "West · left of stage"
    : `Pen ${current.pen} · ${current.v < 0.33 ? "Front" : current.v < 0.66 ? "Middle" : "Rear"}`;
  $("#stat-distance").innerHTML =
    `${Math.round(Math.hypot(p.x, p.z + 35))} <small>m</small>`;
  $("#stat-height").innerHTML = `${p.y.toFixed(1)} <small>m</small>`;
  document.querySelectorAll<SVGGElement>("[data-block]").forEach((el) => {
    const active = isSeat && el.dataset.block === current.block;
    el.classList.toggle("active", active);
    el.setAttribute("aria-pressed", String(active));
  });
  scene?.setSelection(selection, animate);
  $("#look-hint").classList.remove("dismissed");
  updateLocation(selectionUrl(selection, location.href));
  $("#announcement").textContent =
    `${selectionLabel(selection)}. Approximate preview${sceneFailed ? " unavailable in this browser" : " updated"}.`;
  syncForm();
}

makeBlockMap();
makePinMap();
setMode(selection.mode);
applySelection(selection, false);

$("#seated-mode").addEventListener("click", () => {
  setMode("seat");
  applySelection(seated);
});
$("#standing-mode").addEventListener("click", () => {
  setMode("standing");
  applySelection(standing);
});
$("#block").addEventListener("change", () => {
  seated.block = $<HTMLSelectElement>("#block").value;
  limitSeat();
  syncForm();
  applySelection(seated);
});
function updateSeatFromInputs() {
  if (!$<HTMLFormElement>("#seat-form").checkValidity()) return;
  seated.row = Number($<HTMLInputElement>("#row").value);
  seated.seat = Number($<HTMLInputElement>("#seat").value);
  applySelection(seated);
}
$("#seat-form").addEventListener("submit", (e) => {
  e.preventDefault();
  updateSeatFromInputs();
});
for (const field of ["row", "seat"]) {
  $(`#${field}`).addEventListener("input", updateSeatFromInputs);
  $(`#${field}`).addEventListener("change", () => {
    $<HTMLInputElement>(`#${field}`).reportValidity();
  });
  $(`#${field}`).addEventListener("keydown", (e) => {
    // No native form submission is needed; sandboxed HTML viewers may block it.
    if (e.key === "Enter") {
      e.preventDefault();
      updateSeatFromInputs();
    }
  });
}
document.querySelectorAll<HTMLButtonElement>("[data-step]").forEach((button) =>
  button.addEventListener("click", () => {
    const [field, step] = button.dataset.step!.split(":") as [
      "row" | "seat",
      string,
    ];
    const input = $<HTMLInputElement>(`#${field}`);
    const min = Number(input.min);
    seated[field] = clamp(
      Math.round(Number(input.value) || min) + Number(step),
      min,
      Number(input.max),
    );
    syncForm();
    applySelection(seated);
  }),
);
for (const pen of ["A", "B"] as const)
  $(`#pen-${pen.toLowerCase()}`).addEventListener("click", () => {
    standing.pen = pen;
    updatePin();
    applySelection(standing);
  });
$("#reset-view").addEventListener("click", () => {
  scene?.reset();
  $<HTMLInputElement>("#zoom").value = "68";
  $("#zoom-value").textContent = "1.0×";
  $("#look-hint").classList.remove("dismissed");
});
$("#zoom").addEventListener("input", () => {
  const value = Number($<HTMLInputElement>("#zoom").value);
  scene?.setFov(value);
  $("#zoom-value").textContent =
    `${(Math.tan((68 * Math.PI) / 360) / Math.tan((value * Math.PI) / 360)).toFixed(1)}×`;
});

function toast(message: string) {
  clearTimeout(toastTimer);
  $("#toast").textContent = message;
  $("#toast").hidden = false;
  toastTimer = setTimeout(() => {
    $("#toast").hidden = true;
  }, 3500);
}

$("#fullscreen").addEventListener("click", async () => {
  const viewport = $("#viewport");
  if (document.fullscreenEnabled) {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await viewport.requestFullscreen();
    } catch {
      toast("Fullscreen is unavailable in this browser.");
    }
  } else {
    viewport.classList.toggle("expanded");
    document.body.classList.toggle(
      "preview-expanded",
      viewport.classList.contains("expanded"),
    );
    $("#fullscreen").setAttribute(
      "aria-label",
      viewport.classList.contains("expanded")
        ? "Close expanded preview"
        : "Expand preview",
    );
  }
});
document.addEventListener("fullscreenchange", () =>
  $("#fullscreen").setAttribute(
    "aria-label",
    document.fullscreenElement ? "Close expanded preview" : "Expand preview",
  ),
);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    $("#viewport").classList.remove("expanded");
    document.body.classList.remove("preview-expanded");
    $("#fullscreen").setAttribute("aria-label", "Expand preview");
  }
});

for (const id of ["about-button", "learn-more"])
  $(`#${id}`).addEventListener("click", () =>
    $<HTMLDialogElement>("#about-dialog").showModal(),
  );
document.querySelectorAll<HTMLDialogElement>("dialog").forEach((dialog) => {
  dialog
    .querySelectorAll("button.dialog-close, button.dialog-done")
    .forEach((button) =>
      button.addEventListener("click", () => dialog.close()),
    );
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) {
      const r = dialog.getBoundingClientRect();
      if (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      )
        dialog.close();
    }
  });
});
$("#share-view").addEventListener("click", async () => {
  const explicitBase =
    document.querySelector<HTMLBaseElement>("base[href]")?.href ?? "";
  const url = selectionUrl(selection, location.href, explicitBase);
  if (!url) {
    toast(
      "Share links are available when this app is opened from its website.",
    );
    return;
  }
  try {
    if (!navigator.clipboard?.writeText)
      throw new Error("Clipboard unavailable");
    await navigator.clipboard.writeText(url);
    toast("Link copied. Same seat, same perspective.");
  } catch {
    $<HTMLInputElement>("#share-url").value = url;
    $<HTMLDialogElement>("#share-dialog").showModal();
    $<HTMLInputElement>("#share-url").select();
  }
});
window.addEventListener("popstate", () => {
  const next = parseSelection(location.search);
  if (next.mode === "seat") seated = next;
  else standing = next;
  setMode(next.mode);
  applySelection(next);
});

async function loadScene() {
  try {
    const { SeatScene } = await import("./scene");
    $("#scene").replaceChildren();
    scene = new SeatScene($("#scene"), selection, () =>
      $("#look-hint").classList.add("dismissed"),
    );
    $("#viewport").classList.add("is-ready");
  } catch (error) {
    sceneFailed = true;
    $("#scene").innerHTML =
      '<div class="scene-error" role="status"><strong>Your seat is saved. The 3D view is unavailable.</strong><p>Try reloading with a current browser and hardware acceleration enabled. This preview needs WebGL. You can still pick a location and share its link.</p></div>';
    $("#look-hint").hidden = true;
    for (const id of ["reset-view", "zoom"])
      $<HTMLButtonElement>(`#${id}`).disabled = true;
    console.warn("WebGL preview unavailable:", error);
  }
}
void loadScene();
