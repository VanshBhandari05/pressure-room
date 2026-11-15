// Section 9: the full map (scatter of baseline against pressure performance). Driven by the global filters.
import { $, h, f1, f2, f3, fmt, pct, signed, tableToggle, mean } from "../util.js";
import { D, F, onFilter, slice, filterIsDefault, loadCells, years } from "../data.js";
import { scatter } from "../charts/scatter.js";
import { searchSelect } from "./search.js";
import { openPlayer } from "./card.js";

export async function initMap() {
  const root = $("#map-ui"); if (!root) return;
  await loadCells();
  let view = "rating", hl = null;
  const box = h("div", { class: "chart-box" }), ttl = h("h3", { class: "chart-title" }), legend = h("div", { class: "quad-legend" }), tbl = h("div", {}), info = h("p", { class: "note", "aria-live": "polite" });
  const seg = h("div", { class: "seg", role: "group", "aria-label": "Map view" }, h("button", { "aria-pressed": "true", "data-v": "rating" }, "Rating against baseline"), h("button", { "aria-pressed": "false", "data-v": "shift" }, "Zoom on the shift"));
  const search = searchSelect({ label: "Find a player on the map", placeholder: "Find a player ..", getOptions: () => D.pool[F.role].map((p) => ({ key: p.key, label: p.name, sub: p.teams })), onSelect: (o) => { hl = o.key; paint(); } });
  const clear = h("button", { class: "btn ghost small", onclick: () => { hl = null; search.set(""); paint(); } }, "Clear");
  seg.addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; view = b.dataset.v; seg.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); paint(); });

  function points() {
    const def = filterIsDefault(), bat = F.role === "batters";
    return D.pool[F.role].map((p) => {
      if (def) return (p.n_P >= F.minP) ? { p, x: p.baseline, y: p.rating, r: p.n_P } : null;
      const sl = slice(p); if (!sl || sl.m0 == null || sl.m1 == null || sl.n1 < Math.max(1, F.minP)) return null;
      return { p, x: sl.m0, y: sl.m1, r: sl.n1 };
    }).filter(Boolean);
  }
  function paint() {
    const bat = F.role === "batters", def = filterIsDefault(), pts = points(), yrs = years();
    root.querySelector("#map-mode").textContent = def ? "Official ridge-regression ratings (every eligible player, whole period)." : `Filtered view (${F.comp === "all" ? "IPL and T20I" : F.comp}, ${yrs[F.y0]}-${yrs[F.y1]}): plain average ball value on normal balls (x) and pressure balls (y) in that slice, with no regression adjustment, so thin samples are noisy.`;
    const xs = pts.map((d) => d.x).sort((a, b) => a - b), med = xs.length ? xs[Math.floor(xs.length / 2)] : 0;
    const shift = (d) => d.y - d.x, quad = (d) => (d.x >= med ? (shift(d) >= 0 ? "Rocks" : "Faders") : (shift(d) >= 0 ? "Risers" : "Flat-track"));
    const cnt = { Rocks: 0, Faders: 0, Risers: 0, "Flat-track": 0 }; pts.forEach((d) => cnt[quad(d)]++);
    const mapped = pts.map((d) => { const p = d.p, top = !!p.listed, shv = shift(d);
      return { id: p.key, x: d.x, y: view === "shift" ? shv : d.y, r: d.r, top, hl: p.key === hl, label: p.name, short: p.name.split(" ").slice(-1)[0], player: p,
        aria: `${p.name}: baseline ${f3(d.x)}, ${def ? "rating" : "pressure value"} ${f3(d.y)}, ${fmt(d.r)} pressure balls${top ? ", official top 10" : ""}`,
        tip: `<b>${p.name}</b>${top ? ` (official #${p.listed})` : ""}<br>Normal ${f3(d.x)}, pressure ${f3(d.y)}, shift ${signed(shv, 3)}<br>${fmt(d.r)} pressure balls<br>${quad(d)}` }; });
    ttl.textContent = !pts.length ? "No players match these filters." : (cnt.Rocks + cnt.Risers) >= pts.length * 0.5
      ? `${cnt.Rocks + cnt.Risers} of ${pts.length} ${bat ? "batters" : "bowlers"} sit above the no-change line: they do slightly better when it matters, though the shifts are small.`
      : `${cnt.Faders + cnt["Flat-track"]} of ${pts.length} ${bat ? "batters" : "bowlers"} sit below the no-change line: they do slightly worse when it matters, though the shifts are small.`;
    box.replaceChildren();
    if (pts.length) scatter(box, { points: mapped, xLabel: def ? "Baseline: rating on normal balls" : "Mean ball value on normal balls", yLabel: view === "shift" ? (def ? "Pressure rating minus baseline (shift)" : "Pressure minus normal value") : (def ? "Pressure rating" : "Mean ball value on pressure balls"),
      diag: view === "rating", vline: med, hline: view === "shift" ? 0 : null, hlineDraw: view === "shift", yInclude: view === "shift" ? [0] : [], quads: view === "shift" ? [{ text: "RISERS", ax: "l", ay: "t" }, { text: "ROCKS", ax: "r", ay: "t" }, { text: "FLAT-TRACK", ax: "l", ay: "b" }, { text: "FADERS", ax: "r", ay: "b" }] : [],
      onClick: (pt) => openPlayer(pt.player), xFmt: f2, yFmt: view === "shift" ? (v) => signed(v, 3) : f2 });
    legend.replaceChildren(...[["Rocks", "Above-median baseline, no drop under pressure"], ["Faders", "Above-median baseline, but lower under pressure"], ["Risers", "Below-median baseline, better under pressure"], ["Flat-track", "Below-median baseline, and lower under pressure"]].map(([n, d]) => h("div", {}, h("b", {}, `${n}: ${cnt[n]}`), d)));
    info.textContent = hl && D.byKey[hl] ? (() => { const d = pts.find((x) => x.p.key === hl); return d ? `${D.byKey[hl].name}: ${quad(d)}. Baseline ${f3(d.x)}, ${def ? "rating" : "pressure value"} ${f3(d.y)}, shift ${signed(shift(d), 4)}.` : `${D.byKey[hl].name} is hidden by the current filters.`; })() : "";
    tbl.replaceChildren(tableToggle(["Player", "Normal", "Pressure", "Shift", "Pressure balls", "Quadrant"], [...pts].sort((a, b) => b.y - a.y).map((d) => [d.p.name, f3(d.x), f3(d.y), signed(shift(d), 4), fmt(d.r), quad(d)]), "View every point as a table"));
  }
  root.replaceChildren(h("div", { class: "panel" }, ttl, h("p", { class: "how" }, "How to read this: each dot is a player. Left to right is how good the player is on normal balls; up is how good they are under pressure. Dot size is the number of pressure balls. Pink dots with names are the official top 10. Above the dashed line = better under pressure than their own baseline."),
    h("p", { class: "note", id: "map-mode" }), h("div", { class: "chart-tools" }, seg, search, clear), box, legend, info, tbl));
  paint(); onFilter(paint);
  window.__mapRepaint = paint;
}
