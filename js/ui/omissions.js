// Section 11 (surprises and omissions) and section 12 (the Pressure XI).
import { $, h, s, f1, f2, f3, fmt, pct, signed, note, ord } from "../util.js";
import { D, get, P } from "../data.js";
import { avatar, stumps } from "../art.js";
import { openPlayer } from "./card.js";

const ordinal = (n) => { const v = n % 100; return n + (["th", "st", "nd", "rd"][(v - 20) % 10] || ["th", "st", "nd", "rd"][v] || "th"); };

export async function initOmissions() {
  const root = $("#omit-ui"); if (!root) return;
  const om = await get("omissions.json");
  if (!om) { note(root, "The omissions file is unavailable, so this section is hidden."); return; }
  const cards = [], AY = D.meta.eligibility.active_years;
  for (const role of ["batters", "bowlers"]) {
    const bat = role === "batters", code = bat ? "bt" : "bw", noun = bat ? "batter" : "bowler";
    for (const sx of om.surprises[role]) {
      const p = D.byKey[code + sx.id]; if (!p) continue;
      cards.push({ p, tag: `Surprise in the ${noun}s' top 10`, why: `Listed #${p.listed}, but finishes in the top 10 in only ${pct(p.p_top10, 0)} of ${P().bootstrap_n} resamples of the matches. The rating is ${f3(p.rating)} but the floor is ${f3(p.floor)}, and the baseline is only ${ordinal(p.baseline_rank)} best in the active pool.` });
    }
    for (const o of om.omissions[role]) {
      const p = D.byKey[code + o.id]; if (!p) continue;
      let why;
      if (o.why === "removed") why = `${ordinal(o.baseline_rank)} best baseline (${f3(o.baseline)}) among active ${noun}s, but the pressure shift is reliably negative (its ${ord(P().neg_shift_pct)} percentile is ${signed(o.shift_p90, 4)}), so the player is removed from the ranking.`;
      else if (o.why === "inactive") why = `A strong baseline (${f3(o.baseline)}), but no appearance in ${AY.join(" or ")} puts this player outside the active pool.`;
      else why = `${ordinal(o.baseline_rank)} best baseline (${f3(o.baseline)}) but ranked ${o.rank} overall: the floor is ${f3(o.floor)} against ${f3(o.tenth_floor)} for the #10 spot, and the player reaches the top 10 in ${pct(o.p_top10, 0)} of resamples.`;
      cards.push({ p, tag: `Missing from the ${noun}s' top 10`, why });
    }
  }
  root.replaceChildren(h("p", { class: "rule" }, om.rule), h("div", { class: "cards-row", style: { marginTop: "16px" } }, cards.map((c) => h("div", { class: "ocard" }, h("div", { class: "tag" }, c.tag), h("div", { class: "top" }, avatar(c.p, 56), h("div", {}, h("h3", {}, c.p.name), h("div", { class: "note" }, c.p.teams))), h("p", { class: "why" }, c.why), h("button", { class: "btn ghost small open", onclick: () => openPlayer(c.p) }, "Open the card")))));
}

// ---------------- section 12 ----------------
const SPOTS = [["Wicketkeeper", 50, 78], ["First slip", 60, 72], ["Point", 78, 62], ["Cover", 80, 42], ["Mid-off", 66, 24], ["Bowler", 50, 30], ["Mid-on", 34, 24], ["Midwicket", 20, 42], ["Square leg", 22, 62], ["Fine leg", 38, 88], ["Long-on", 50, 10]];
export async function initXI() {
  const root = $("#xi-ui"); if (!root) return;
  const xi = await get("xi.json");
  if (!xi) { note(root, "The Pressure XI file is unavailable, so this section is hidden."); return; }
  const bats = xi.batters.map((id) => D.byKey["bt" + id]), bowls = xi.bowlers.map((id) => D.byKey["bw" + id]);
  const keeper = bats.find((p) => xi.keeper_ids.includes(p.id)) || null, restBats = bats.filter((p) => p !== keeper);
  // assign: keeper to spot 0, bowlers to bowling-end spots, remaining batters to the rest
  const assign = new Array(11).fill(null); if (keeper) assign[0] = { p: keeper, kind: "bat" };
  const bowlSpots = [5, 4, 6, 10, 3], batSpots = [1, 2, 7, 8, 9, 3, 4, 6, 10, 0];
  bowls.forEach((p, i) => (assign[bowlSpots[i]] = { p, kind: "bowl" }));
  restBats.forEach((p) => { const sp = batSpots.find((i) => !assign[i]); assign[sp] = { p, kind: "bat" }; });
  const W = 760, H = 560, svg = s("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "The Pressure XI placed on a cricket field", class: "xi-field" });
  svg.append(s("ellipse", { cx: W / 2, cy: H / 2, rx: 350, ry: 262, fill: "#0E2263", stroke: "#EA1A85", "stroke-width": 3 }), s("ellipse", { cx: W / 2, cy: H / 2, rx: 220, ry: 165, fill: "none", stroke: "#254AA5", "stroke-width": 2, "stroke-dasharray": "6 6" }),
    s("rect", { x: W / 2 - 18, y: H / 2 - 92, width: 36, height: 184, fill: "#16296A", stroke: "#FF8CC6", "stroke-width": 1.5, rx: 4 }));
  for (let a = 0; a < 360; a += 30) { const r = (a * Math.PI) / 180; svg.append(s("line", { x1: W / 2, y1: H / 2, x2: W / 2 + Math.cos(r) * 350, y2: H / 2 + Math.sin(r) * 262, stroke: "#FF8CC6", "stroke-opacity": 0.12 })); }
  assign.forEach((a, i) => {
    if (!a) return; const [name, px, py] = SPOTS[i], cx = (px / 100) * (W - 120) + 60, cy = (py / 100) * (H - 110) + 40;
    const g = s("g", { transform: `translate(${cx - 32},${cy - 32})`, tabindex: "0", role: "button", style: { cursor: "pointer" }, "aria-label": `${a.p.name}, ${a.kind === "bat" ? "batter" : "bowler"}. Open player card.` });
    const av = avatar(a.p, 64); av.setAttribute("x", 0); av.setAttribute("y", 0); g.append(av, s("text", { x: 32, y: 82, "text-anchor": "middle", fill: "#fff", "font-size": 12, "font-weight": 600, "paint-order": "stroke", stroke: "#0B1740", "stroke-width": 3 }, a.p.name.split(" ").slice(-1)[0]));
    g.addEventListener("click", () => openPlayer(a.p)); g.addEventListener("keydown", (e) => { if (e.key === "Enter") openPlayer(a.p); });
    svg.append(g);
  });
  root.replaceChildren(h("div", { class: "panel" }, h("h3", { class: "chart-title" }, `${bats.length} batters, ${bowls.length} bowlers: the model's XI, built only from the two official lists.`), h("p", { class: "how" }, "How to read this: ring fill on each badge shows the player's pressure rating within their list. Tap a badge to open the card. Field positions are decorative; the data hold no fielding information."), svg,
    h("div", { class: "xi-names" }, [...bats.map((p) => [p, "Batter"]), ...bowls.map((p) => [p, "Bowler"])].map(([p, k]) => h("button", { onclick: () => openPlayer(p) }, h("b", {}, p.name), h("div", { class: "note" }, `${k}, official #${p.listed}${p.keeper ? ", wicketkeeper" : ""}${p.role ? ", " + p.role : ""}`))))),
    h("p", { class: "rule", style: { marginTop: "14px" } }, xi.rule));
}
