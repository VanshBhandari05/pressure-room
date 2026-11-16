// Heatmap (over x wickets down) and histogram of ball-level pressure scores. Blue = below the cutoff (normal), pink = at or above it (pressure).
import { h, s, responsive, linear, ticks, bindTip, f1, f2, fmt, pct, tableToggle, clamp } from "../util.js";

const MIX = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const hex = (c) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
const BL = [37, 74, 165], PALE = [236, 226, 245], PK = [234, 26, 133], PKS = [255, 196, 226];
export function pressureColor(li, cut) {
  if (li == null) return "transparent";
  if (li < cut) return hex(MIX(BL, PALE, clamp((li - 0.45) / (cut - 0.45), 0, 1)));
  return hex(MIX(PKS, PK, clamp((li - cut) / 2.2, 0, 1)));
}

export function heatmap(el, grid, innings, cut) {
  const cells = grid["innings" + innings], minBalls = 20;
  const map = new Map(cells.map((c) => [c[0] + "_" + c[1], c]));
  responsive(el, (W) => {
    const m = { l: 46, r: 8, t: 8, b: 40 }, cw = (W - m.l - m.r) / 20, ch = clamp(cw * 1.1, 17, 28), H = m.t + ch * 10 + m.b;
    const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H });
    for (let w = 0; w < 10; w++) {
      svg.append(s("text", { x: m.l - 8, y: m.t + w * ch + ch / 2 + 4, "text-anchor": "end", fill: "var(--muted)", "font-size": 11 }, String(w)));
      for (let o = 1; o <= 20; o++) {
        const c = map.get(o + "_" + w), enough = c && c[2] >= minBalls && c[5] != null;
        const r = s("rect", { x: m.l + (o - 1) * cw + 0.5, y: m.t + w * ch + 0.5, width: cw - 1, height: ch - 1, rx: 3, fill: enough ? pressureColor(c[5], cut) : "rgba(197,197,201,.08)", tabindex: enough ? "0" : null });
        if (enough) {
          bindTip(r, () => `<b>Over ${o}, ${w} down</b><br>Average leverage ${f2(c[5])} on ${fmt(c[3])} live balls<br>${pct(c[4] / c[2], 0)} of all ${fmt(c[2])} balls here are pressure balls`);
          r.setAttribute("aria-label", `Over ${o}, ${w} wickets down: average leverage ${f2(c[5])}, ${fmt(c[2])} balls`);
        } else if (c) bindTip(r, () => `<b>Over ${o}, ${w} down</b><br>Only ${fmt(c[2])} balls: too few to show`);
        svg.append(r);
      }
    }
    for (let o = 1; o <= 20; o += (cw < 20 ? 3 : 1)) svg.append(s("text", { x: m.l + (o - 0.5) * cw, y: m.t + 10 * ch + 15, "text-anchor": "middle", fill: "var(--muted)", "font-size": 11 }, String(o)));
    svg.append(s("text", { x: m.l + (20 * cw) / 2, y: H - 6, "text-anchor": "middle", fill: "var(--paper)", "font-size": 12 }, "Over of the innings"),
      s("text", { x: 12, y: m.t + (10 * ch) / 2, "text-anchor": "middle", fill: "var(--paper)", "font-size": 12, transform: `rotate(-90 12 ${m.t + (10 * ch) / 2})` }, "Wickets down"));
    el.append(svg);
  });
}
export function heatLegend(cut) {
  const stops = []; for (let i = 0; i <= 20; i++) stops.push(pressureColor(0.45 + (i / 20) * 2.9, cut));
  const pos = ((cut - 0.45) / 2.9) * 100;
  return h("div", { class: "legend", "aria-hidden": "true" },
    h("span", {}, h("span", { class: "sw n" }), "below the cutoff: normal"), h("div", { style: { flex: "1 1 160px", minWidth: "140px", position: "relative", height: "12px", borderRadius: "6px", background: `linear-gradient(90deg,${stops.join(",")})` } },
      h("i", { style: { position: "absolute", left: pos + "%", top: "-4px", bottom: "-4px", width: "2px", background: "#fff" } })), h("span", {}, h("span", { class: "sw p" }), "at or above the cutoff: pressure"));
}

export function histogram(el, dist, which, innings) {
  const counts = dist[which], edges = dist.edges, cut = dist.cutoff, total = counts.reduce((a, b) => a + b, 0);
  responsive(el, (W) => {
    const m = { l: 46, r: 10, t: 16, b: 44 }, H = 240, iw = W - m.l - m.r, ih = H - m.t - m.b;
    const x = linear(0, 4, 0, iw), maxC = Math.max(...counts), y = linear(0, maxC * 1.05, ih, 0);
    const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H }), g = s("g", { transform: `translate(${m.l},${m.t})` });
    ticks(0, maxC, 4).forEach((t) => g.append(s("line", { x1: 0, x2: iw, y1: y(t), y2: y(t), stroke: "var(--line)" }), s("text", { x: -6, y: y(t) + 4, "text-anchor": "end", fill: "var(--muted)", "font-size": 11 }, fmt(t))));
    counts.forEach((c, i) => {
      const x0 = x(edges[i]), x1 = x(edges[i + 1]), pressure = edges[i] >= cut - 1e-9 || (edges[i] < cut && edges[i + 1] > cut && false);
      const r = s("rect", { x: x0 + 0.5, y: y(c), width: Math.max(1, x1 - x0 - 1), height: ih - y(c), fill: edges[i + 1] <= cut + 1e-9 ? "var(--rr-blue)" : "var(--rr-pink)", rx: 1.5, tabindex: "0",
        "aria-label": `Leverage ${f2(edges[i])} to ${f2(edges[i + 1])}: ${fmt(c)} balls` });
      bindTip(r, () => `<b>Leverage ${f2(edges[i])} to ${i === counts.length - 1 ? "and above" : f2(edges[i + 1])}</b><br>${fmt(c)} live balls (${pct(c / total, 1)})${edges[i] >= cut ? "<br>pressure balls" : edges[i + 1] <= cut ? "<br>normal balls" : "<br>the cutoff falls inside this bin"}`);
      g.append(r);
    });
    g.append(s("line", { x1: x(cut), x2: x(cut), y1: -8, y2: ih, stroke: "#fff", "stroke-width": 2, "stroke-dasharray": "5 4" }),
      s("text", { x: x(cut) + 6, y: 6, fill: "#fff", "font-size": 12, "font-weight": 600 }, `cutoff ${f2(cut)} (top ${dist.top_pct}% of live balls)`));
    ticks(0, 4, 8).forEach((t) => g.append(s("text", { x: x(t), y: ih + 16, "text-anchor": "middle", fill: "var(--muted)", "font-size": 11 }, f1(t) + (t === 4 ? "+" : ""))));
    g.append(s("text", { x: iw / 2, y: ih + 36, "text-anchor": "middle", fill: "var(--paper)", "font-size": 12, ...(60*7.2>iw?{textLength:Math.max(40,iw-6),lengthAdjust:"spacingAndGlyphs"}:{}) }, "Pressure score of the ball (leverage; 1.0 = average live ball)"));
    svg.append(g, s("text", { x: 12, y: m.t + ih / 2, "text-anchor": "middle", fill: "var(--paper)", "font-size": 12, transform: `rotate(-90 12 ${m.t + ih / 2})` }, "Balls"));
    el.append(svg);
  });
}
