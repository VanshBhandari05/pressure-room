// Section 4 (where pressure lives) and section 5 (pressure changes the game).
import { $, h, f1, f2, pct, fmt, tableToggle, note, esc, signed } from "../util.js";
import { get, D, P } from "../data.js";
import { heatmap, heatLegend, histogram } from "../charts/heatmap.js";
import { pairedBars, forest } from "../charts/bars.js";

export async function initWhere() {
  const root = $("#where-ui"); if (!root) return;
  const [grid, dist, meta] = await Promise.all([get("pressure_grid.json"), get("pressure_distribution.json"), get("meta.json")]);
  if (!grid || !dist) { note(root, "The pressure grid files are unavailable, so this section is hidden."); return; }
  const cut = dist.cutoff;
  const share = (k) => { const a = grid[`innings${k}_by_over`]; const b = a.reduce((x, r) => x + r[1], 0), p = a.reduce((x, r) => x + r[3], 0); return p / b; };
  const tot = (k) => grid[`innings${k}_by_over`].reduce((x, r) => x + r[3], 0);
  const peakOver = (k) => grid[`innings${k}_by_over`].map((r) => [r[0], r[3] / r[1]]).sort((a, b) => b[1] - a[1])[0];
  let inn = 2, which = "all";
  const heatBox = h("div", { class: "chart-box" }), histBox = h("div", { class: "chart-box" });
  const title = h("h3", { class: "chart-title" }), htitle = h("h3", { class: "chart-title" });
  const tblHost = h("div", {}), histTbl = h("div", {});
  const innSeg = h("div", { class: "seg", role: "group", "aria-label": "Innings" }, ...[[2, "2nd innings (chase)"], [1, "1st innings"]].map(([v, l]) => h("button", { "aria-pressed": String(v === inn), "data-v": v }, l)));
  const hSeg = h("div", { class: "seg", role: "group", "aria-label": "Balls shown" }, ...[["all", "All live balls"], ["innings2", "2nd innings"], ["innings1", "1st innings"]].map(([v, l]) => h("button", { "aria-pressed": String(v === which), "data-v": v }, l)));
  const drawHeat = () => {
    heatBox.replaceChildren(); heatmap(heatBox, grid, inn, cut);
    title.textContent = inn === 2 ? `In a chase, ${pct(share(2), 0)} of all balls are pressure balls, and the squeeze builds as wickets fall and overs run out.` : `In the first innings pressure is almost absent: only ${fmt(tot(1))} balls in the whole dataset reach the cutoff.`;
    innSeg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.v === inn)));
    const rows = grid[`innings${inn}_by_over`].map((r) => [r[0], fmt(r[1]), fmt(r[2]), fmt(r[3]), pct(r[3] / r[1], 1)]);
    tblHost.replaceChildren(tableToggle(["Over", "Balls", "Live balls", "Pressure balls", "Share pressure"], rows, "View the by-over numbers as a table"));
  };
  innSeg.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { inn = +b.dataset.v; drawHeat(); } });
  const drawHist = () => {
    histBox.replaceChildren(); histogram(histBox, dist, which);
    const c = dist[which], total = c.reduce((a, b) => a + b, 0), idx = dist.edges.findIndex((e) => e >= cut - 1e-9), above = c.slice(idx - 1).reduce((a, b) => a + b, 0);
    htitle.textContent = `Most balls are ordinary: the typical live ball scores ${f2(dist.median)}, and only the top fifth reach the ${f2(cut)} cutoff.`;
    hSeg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === which)));
    histTbl.replaceChildren(tableToggle(["Leverage from", "to", "Balls", "Share of balls"], c.map((n, i) => [f2(dist.edges[i]), i === c.length - 1 ? "and above" : f2(dist.edges[i + 1]), fmt(n), pct(n / total, 1)]), "View the histogram as a table"));
  };
  hSeg.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { which = b.dataset.v; drawHist(); } });
  root.replaceChildren(h("div", { class: "grid2" },
    h("div", { class: "panel", role: "group" }, title, h("p", { class: "how" }, "How to read this: each square is one over and one number of wickets down. Blue squares are ordinary on average; pink squares average above the pressure cutoff. Grey squares have too few balls."), h("div", { class: "chart-tools" }, innSeg), heatBox, heatLegend(cut), tblHost),
    h("div", { class: "panel", role: "group" }, htitle, h("p", { class: "how" }, "How to read this: balls are grouped by how much the next delivery could move the win probability. Everything right of the white line is a pressure ball."), h("div", { class: "chart-tools" }, hSeg), histBox, histTbl,
      h("div", { class: "legend" }, h("span", {}, h("span", { class: "sw n" }), "Normal balls"), h("span", {}, h("span", { class: "sw p" }), "Pressure balls")),
      h("p", { class: "note" }, `Median ${f2(dist.median)}, 95th percentile ${f2(dist.p95)}. The last bin collects every score of 3.9 and above.`))));
  drawHeat(); drawHist();
  const peak2 = peakOver(2), tx = $("#where-facts");
  if (tx) tx.textContent = `Overall, ${pct(meta.share_pressure_of_live_rated, 0)} of live balls in the rated matches are pressure balls (${fmt(meta.pressure_balls_rated)} balls). Only ${fmt(meta.pressure_balls_innings1_rated)} of them fall in the first innings, so the ratings are, in practice, ratings of performance in live chases.`;
}

// ---------------- section 5 ----------------
const METRICS = [
  ["sr", "Strike rate", "runs per 100 balls", f1, "Batters score faster when the ball matters", false],
  ["dismissal_pct", "Dismissal rate", "% of balls faced", (v) => f2(v), "", false],
  ["dot_pct", "Dot balls", "% of balls faced", f1, "", false],
  ["boundary_pct", "Boundaries", "% of balls faced", f1, "", false],
  ["economy", "Economy", "runs per over", f2, "", true],
  ["balls_per_wicket", "Balls per wicket", "legal balls", f1, "", true],
];
export async function initChanges() {
  const root = $("#changes-ui"); if (!root) return;
  const lg = await get("league_split.json");
  if (!lg) { note(root, "The league comparison file is unavailable, so this section is hidden."); return; }
  let phase = "all", comp = "all", chase = false;
  const seg = (label, opts, get_, set_) => { const el = h("div", { class: "seg", role: "group", "aria-label": label }, opts.map(([v, l]) => h("button", { "aria-pressed": String(get_() === v), "data-v": v }, l)));
    el.addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; set_(b.dataset.v); el.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.v === get_()))); paint(); }); return el; };
  const pick = () => {
    if (comp !== "all") return lg.by_competition[comp];
    if (phase !== "all") return (chase ? lg.by_phase_innings2 : lg.by_phase)[phase];
    return chase ? lg.innings2_only : lg.overall;
  };
  const host = h("div", { class: "pb-grid" }), ttl = h("h3", { class: "chart-title" }), tbl = h("div", {});
  const tools = h("div", { class: "chart-tools" },
    seg("Phase", [["all", "Whole innings"], ["powerplay", "Powerplay"], ["middle", "Middle"], ["death", "Death"]], () => phase, (v) => { phase = v; if (v !== "all") comp = "all"; refreshSegs(); }),
    seg("Competition", [["all", "IPL + T20I"], ["IPL", "IPL"], ["T20I", "T20I"]], () => comp, (v) => { comp = v; if (v !== "all") phase = "all"; refreshSegs(); }),
    seg("Innings", [["false", "Both innings"], ["true", "2nd innings only"]], () => String(chase), (v) => { chase = v === "true"; }));
  const refreshSegs = () => { [...tools.children].forEach((sg) => sg.querySelectorAll("button").forEach((b) => { const g = sg.getAttribute("aria-label"); const cur = g === "Phase" ? phase : g === "Competition" ? comp : String(chase); b.setAttribute("aria-pressed", String(b.dataset.v === cur)); })); };
  function paint() {
    const d = pick(), n = d.normal, p = d.pressure;
    ttl.textContent = `Under pressure batters hit ${p.sr >= n.sr ? "harder" : "softer"} (${f1(n.sr)} to ${f1(p.sr)} strike rate), and ${n.economy < p.economy ? "bowlers leak more" : "bowlers tighten up"} (economy ${f2(n.economy)} to ${f2(p.economy)}) in this slice.`;
    pairedBars(host, METRICS.map(([k, label, hint, fm, , lb]) => ({ label, hint: " " + hint, n: n[k], p: p[k], fmt: fm, sub: `${fmt(n.balls)} normal and ${fmt(p.balls)} pressure balls${lb ? "" : ""}` })));
    tbl.replaceChildren(tableToggle(["Metric", "Normal", "Pressure", "Normal balls", "Pressure balls"], METRICS.map(([k, label, , fm]) => [label, fm(n[k]), fm(p[k]), fmt(n.balls), fmt(p.balls)]), "View as table"));
  }
  const sep = lg.separation, byM = (m) => ["powerplay (1-6)", "middle (7-15)", "death (16-20)"].map((ph) => sep.find((x) => x.metric === m && x.phase === ph)).filter(Boolean).map((x) => ({ label: x.phase.replace(" (", " ("), diff: x.diff, lo: x.lo, hi: x.hi, sig: x.excludes_zero }));
  const runsAllUp = byM("runs").length === 3 && byM("runs").every((x) => x.sig && x.diff > 0);
  const fBox = (id, ttlText, m, unit, scale, dg) => { const b = h("div", { class: "chart-box" }); setTimeout(() => forest(b, byM(m), unit, dg, scale), 0); return h("div", { class: "panel pad-s" }, h("h4", { class: "chart-title", style: { fontSize: "1.25rem" } }, ttlText), b); };
  root.replaceChildren(h("div", { class: "panel" }, ttl, h("p", { class: "how" }, "How to read this: for each measure, the blue bar is the average over normal live balls and the pink hatched bar is the average over pressure balls. Raw rates, not adjusted for who was playing."), tools, host, tbl,
    h("div", { class: "legend" }, h("span", {}, h("span", { class: "sw n" }), "Normal"), h("span", {}, h("span", { class: "sw p" }), "Pressure"))),
    h("h3", { class: "chart-title", style: { margin: "26px 0 8px", fontSize: "1.8rem" } }, runsAllUp ? "The difference is real, not noise: pressure balls produce more runs in every phase, with intervals that exclude zero." : "Pressure balls differ from ordinary balls, but not in every phase: some intervals include zero."),
    h("p", { class: "how" }, `How to read this: each marker is the gap (pressure minus ordinary balls in the same innings, phase and wickets band). Filled pink circles have a 95% interval that excludes zero; hollow grey diamonds do not. Whisker = interval from ${P().bootstrap_n} resamples of whole matches.`),
    h("div", { class: "grid2" }, fBox("f1", "Boundary share (percentage points)", "boundary", "points", 100, 1), fBox("f2", "Dot-ball share (percentage points)", "dot", "points", 100, 1), fBox("f3", "Dismissal rate (percentage points)", "dismissal", "points", 100, 1), fBox("f4", "Runs per ball", "runs", "runs per ball", 1, 2)),
    tableToggle(["Phase", "Measure", "Pressure minus normal", "Interval low", "Interval high", "Excludes zero"], lg.separation.filter((x) => ["boundary", "dot", "dismissal", "runs"].includes(x.metric)).map((x) => [x.phase, x.metric, x.diff.toFixed(4), x.lo.toFixed(4), x.hi.toFixed(4), x.excludes_zero ? "yes" : "no"]), "View the differences as a table"));
  paint();
}
