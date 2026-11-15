// Section 3: what is pressure? Definition, inputs, formula and the live pressure meter.
import { $, h, s, f1, f2, pct, fmt, term, clamp } from "../util.js";
import { get } from "../data.js";
import * as PR from "../pressure.js";
import { stumps } from "../art.js";

const MAXLI = 4;
const overs = (b) => { const used = 120 - b; return `${Math.floor(used / 6)}.${used % 6}`; };

function gaugeSvg() {
  const svg = s("svg", { viewBox: "0 0 300 175", role: "img", "aria-label": "Pressure gauge" });
  svg.append(s("defs", {}, s("linearGradient", { id: "gg", x1: 0, y1: 0, x2: 1, y2: 0 }, s("stop", { offset: "0", "stop-color": "#254AA5" }), s("stop", { offset: ".3", "stop-color": "#7C9DF0" }), s("stop", { offset: ".31", "stop-color": "#FFC4E2" }), s("stop", { offset: "1", "stop-color": "#EA1A85" }))));
  const cx = 150, cy = 150, r = 120;
  const pt = (t, rad = r) => { const a = Math.PI * (1 - t); return [cx + Math.cos(a) * rad, cy - Math.sin(a) * rad]; };
  const arc = (t0, t1, rad = r) => { const [x0, y0] = pt(t0, rad), [x1, y1] = pt(t1, rad); return `M${x0} ${y0} A${rad} ${rad} 0 0 1 ${x1} ${y1}`; };
  svg.append(s("path", { d: arc(0, 1), stroke: "rgba(154,166,207,.2)", "stroke-width": 22, fill: "none", "stroke-linecap": "round" }),
    s("path", { id: "g-fill", d: arc(0, 0.001), stroke: "url(#gg)", "stroke-width": 22, fill: "none", "stroke-linecap": "round" }),
    s("g", { id: "g-needle" }, s("line", { x1: cx, y1: cy, x2: cx - r + 14, y2: cy, stroke: "#fff", "stroke-width": 4, "stroke-linecap": "round" }), s("circle", { cx, cy, r: 9, fill: "#fff" })),
    s("text", { id: "g-val", x: cx, y: cy - 38, "text-anchor": "middle", fill: "#fff", "font-family": "Teko,sans-serif", "font-size": 54, "font-weight": 600 }, "0.00"),
    s("text", { x: cx, y: cy - 16, "text-anchor": "middle", fill: "#9AA6CF", "font-size": 11 }, "pressure score (leverage)"),
    s("text", { x: 20, y: 170, fill: "#9AA6CF", "font-size": 11, "text-anchor": "middle" }, "0"), s("text", { x: 282, y: 170, fill: "#9AA6CF", "font-size": 11, "text-anchor": "middle" }, `${MAXLI}+`));
  svg._set = (li, cut) => {
    const t = clamp(li / MAXLI, 0.004, 1); svg.querySelector("#g-fill").setAttribute("d", arc(0, t));
    svg.querySelector("#g-needle").setAttribute("transform", `rotate(${t * 180} ${cx} ${cy})`);
    svg.querySelector("#g-val").textContent = f2(li);
  };
  const [tx0, ty0] = pt(1.207 / MAXLI, r - 17), [tx1, ty1] = pt(1.207 / MAXLI, r + 17);
  svg._cut = (cut) => { const [a, b] = pt(cut / MAXLI, r - 17), [c, d] = pt(cut / MAXLI, r + 17); const ln = s("line", { x1: a, y1: b, x2: c, y2: d, stroke: "#fff", "stroke-width": 3, "stroke-dasharray": "3 2" }), tx = pt(cut / MAXLI, r + 30);
    svg.append(ln, s("text", { x: tx[0], y: tx[1], "text-anchor": "middle", fill: "#fff", "font-size": 11 }, `cutoff ${f2(cut)}`)); };
  return svg;
}

export async function initMeter() {
  const root = $("#meter-ui"); if (!root) return;
  let model;
  try { model = await PR.load(); } catch (e) { root.replaceChildren(h("div", { class: "fail" }, "The pressure tables could not be loaded here (" + e.message + "), so the live meter is unavailable. The rest of the page is unaffected.")); return; }
  const rg = model.tables.ranges, cut = model.cutoff_LI;
  const st = { inn: 2, need: 150, balls: 60, hand: 7, score: 90 };
  const innSeg = h("div", { class: "seg", role: "group", "aria-label": "Innings" }, h("button", { "aria-pressed": "true", "data-i": "2" }, "Chase (2nd innings)"), h("button", { "aria-pressed": "false", "data-i": "1" }, "1st innings"));
  const mk = (id, label, min, max, key, extra) => { const inp = h("input", { type: "range", id, min, max, step: 1, value: st[key], "aria-label": label }), val = h("span", { class: "val" });
    const row = h("div", { class: "ctrl" }, h("div", { class: "row" }, h("label", { for: id }, label), val), inp); inp.addEventListener("input", () => { st[key] = +inp.value; draw(); }); return { row, inp, val, label }; };
  const need = mk("m-need", "Runs needed", 1, rg.runs_required[1], "need"), score = mk("m-score", "Score so far", 0, rg.score_innings1[1], "score"),
    balls = mk("m-balls", "Balls left", 1, 120, "balls"), hand = mk("m-hand", "Wickets in hand", 1, 10, "hand");
  const gauge = gaugeSvg(); gauge._cut(cut);
  const verdict = h("div", { class: "verdict", "aria-live": "polite" }), info = h("div", { class: "note" }), wk = h("div", { style: { margin: "8px 0" } });
  const presets = h("div", { class: "presets" }, model.presets.map((p) => h("button", { class: "btn ghost small", title: p.rule, onclick: () => { st.inn = 2; st.need = p.runs_required; st.balls = p.balls_left; st.hand = 10 - p.wickets_lost; sync(); draw(); } }, p.label)));
  function sync() { need.inp.value = st.need; balls.inp.value = st.balls; hand.inp.value = st.hand; score.inp.value = st.score; innSeg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.i === st.inn))); }
  function draw() {
    const chase = st.inn === 2; need.row.hidden = !chase; score.row.hidden = chase;
    const r = PR.evaluate(st.inn, st.balls, 10 - st.hand, chase ? st.need : st.score);
    gauge._set(r.li, cut);
    need.val.textContent = fmt(st.need); score.val.textContent = fmt(st.score); balls.val.textContent = `${fmt(st.balls)} (over ${overs(st.balls)} bowled)`; hand.val.textContent = `${st.hand} (${10 - st.hand} down)`;
    verdict.className = "verdict " + (r.pressure ? "hot" : "cool");
    verdict.textContent = !r.live ? "Decided: this ball is out of play for pressure" : r.pressure ? "Pressure ball" : "Ordinary ball";
    const rr = chase ? (st.need * 6 / st.balls) : null;
    info.textContent = `${chase ? `Win probability for the chasing side ${pct(r.wp, 1)}, required rate ${f1(rr)}. ` : `Win probability for the batting side ${pct(r.wp, 1)}. `}This ball is ${f2(r.li / 1)} times as swingy as the average live ball. A pressure ball scores ${f2(cut)} or more${r.live ? "" : `, and balls with a win probability outside ${model.live_low} to ${model.live_high} are treated as decided`}.`;
    wk.replaceChildren(stumps(10 - st.hand, 10, 26));
  }
  const left = h("div", {}, h("div", { class: "ctrl" }, h("div", { class: "row" }, h("span", {}, "Innings")), innSeg), need.row, score.row, balls.row, hand.row, wk, presets,
    h("p", { class: "note", style: { marginTop: "10px" } }, `Preset buttons are real situations from the data, found by a stated rule (hover for the rule). The meter uses the reference context: ${model.reference_context.group_name}, ${model.reference_context.tier_name}, ${model.reference_context.impact_name}.`));
  innSeg.addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; st.inn = +b.dataset.i; sync(); draw(); });
  root.replaceChildren(h("div", { class: "meter" }, h("div", { class: "panel" }, left), h("div", { class: "panel gauge-big", role: "group", "aria-label": "Pressure gauge result" }, gauge, verdict, info)));
  sync(); draw();
  const f = $("#formula-box"); if (f) f.textContent = `swing(s)  =  sum over the 10 next-ball outcomes o of  p(o | s) x | WP*(after o) - WP*(s) |\nLI(s)     =  swing(s) / mean swing over live balls\nlive      =  ${model.live_low} < WP*(s) < ${model.live_high}\npressure  =  live and LI(s) >= ${f2(cut)}   (${model.cutoff_percentile}th percentile of live balls)`;
  const pe = $("#pressure-rule"); if (pe) pe.textContent = model.pressure_rule;
}
