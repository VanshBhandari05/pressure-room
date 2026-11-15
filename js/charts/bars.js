// Paired bars (normal blue vs pressure pink), forest plot of pressure-minus-ordinary differences, grouped bars, line chart.
import { h, s, responsive, linear, ticks, bindTip, f1, f2, f3, fmt, signed, extent } from "../util.js";

// items: [{label, n, p, d, note, lowerBetter}] ; horizontal HTML bars, accessible and responsive
export function pairedBars(el, items) {
  el.replaceChildren(...items.map((it) => {
    const max = Math.max(it.n ?? 0, it.p ?? 0) || 1;
    const row = (cls, name, v) => h("div", { class: "pb-row" },
      h("span", { class: "pb-name" }, name),
      h("div", { class: "pb-track" }, h("div", { class: "pb-bar " + cls, style: { width: v == null ? "0%" : Math.max(2, (v / max) * 100) + "%" } })),
      h("span", { class: "pb-val " + (cls === "n" ? "badge-n" : "badge-p") }, v == null ? "n/a" : (it.fmt || f1)(v)));
    const box = h("div", { class: "pb", tabindex: "0", role: "group", "aria-label": `${it.label}: normal ${it.n}, pressure ${it.p}${it.sub ? ", " + it.sub : ""}` },
      h("div", { class: "pb-title" }, it.label, it.hint ? h("small", {}, it.hint) : null), row("n", "Normal", it.n), row("p", "Pressure", it.p),
      it.sub ? h("div", { class: "note" }, it.sub) : null);
    return box;
  }));
}
// forest plot: rows [{label, diff, lo, hi, sig}], one panel
export function forest(el, rows, unit, digits = 1, scale = 1) {
  responsive(el, (W) => {
    const rh = 30, m = { l: 118, r: 12, t: 10, b: 30 }, H = m.t + rows.length * rh + m.b, iw = W - m.l - m.r;
    const all = rows.flatMap((r) => [r.lo * scale, r.hi * scale, 0]), [a, b] = extent(all), pad = (b - a) * 0.12, x = linear(a - pad, b + pad, 0, iw);
    const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H }), g = s("g", { transform: `translate(${m.l},${m.t})` });
    ticks(a - pad, b + pad, 4).forEach((t) => g.append(s("line", { x1: x(t), x2: x(t), y1: 0, y2: rows.length * rh, stroke: "var(--line)" }), s("text", { x: x(t), y: rows.length * rh + 16, "text-anchor": "middle", fill: "var(--muted)", "font-size": 11 }, f1(t))));
    g.append(s("line", { x1: x(0), x2: x(0), y1: -4, y2: rows.length * rh, stroke: "#fff", "stroke-width": 1.5 }));
    rows.forEach((r, i) => {
      const cy = i * rh + rh / 2, col = r.sig ? "var(--rr-pink)" : "var(--muted)";
      g.append(s("text", { x: -8, y: cy + 4, "text-anchor": "end", fill: "var(--paper)", "font-size": 12 }, r.label));
      const grp = s("g", { tabindex: "0", "aria-label": `${r.label}: ${signed(r.diff * scale, digits)} ${unit}, interval ${f1(r.lo * scale)} to ${f1(r.hi * scale)}${r.sig ? ", excludes zero" : ", includes zero"}` },
        s("line", { x1: x(r.lo * scale), x2: x(r.hi * scale), y1: cy, y2: cy, stroke: col, "stroke-width": 3, "stroke-linecap": "round" }),
        r.sig ? s("circle", { cx: x(r.diff * scale), cy, r: 6.5, fill: "var(--rr-pink)", stroke: "#fff", "stroke-width": 1.5 }) : s("rect", { x: x(r.diff * scale) - 5.5, y: cy - 5.5, width: 11, height: 11, fill: "none", stroke: col, "stroke-width": 2, transform: `rotate(45 ${x(r.diff * scale)} ${cy})` }));
      bindTip(grp, () => `<b>${r.label}</b><br>${signed(r.diff * scale, digits)} ${unit} (pressure minus normal)<br>95% interval ${f1(r.lo * scale)} to ${f1(r.hi * scale)}<br>${r.sig ? "excludes zero" : "includes zero"}`);
      g.append(grp);
    });
    svg.append(g); el.append(svg);
  });
}

// season trend: series [{name, cls, pts:[{x,y,n}]}]
export function lineChart(el, years, series, yLabel) {
  responsive(el, (W) => {
    const m = { l: 44, r: 12, t: 12, b: 34 }, H = 200, iw = W - m.l - m.r, ih = H - m.t - m.b;
    const ys = series.flatMap((se) => se.pts.filter((p) => p.y != null).map((p) => p.y));
    if (!ys.length) { el.append(h("div", { class: "note" }, "No seasons with enough balls.")); return; }
    const [a, b] = extent(ys.concat(0)), x = linear(0, years.length - 1, 12, iw - 12), y = linear(a - (b - a) * 0.1, b + (b - a) * 0.1, ih, 0);
    const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H }), g = s("g", { transform: `translate(${m.l},${m.t})` });
    ticks(a, b, 4).forEach((t) => g.append(s("line", { x1: 0, x2: iw, y1: y(t), y2: y(t), stroke: t === 0 ? "#fff" : "var(--line)", "stroke-opacity": t === 0 ? 0.5 : 1 }), s("text", { x: -6, y: y(t) + 4, "text-anchor": "end", fill: "var(--muted)", "font-size": 11 }, f1(t))));
    years.forEach((yr, i) => g.append(s("text", { x: x(i), y: ih + 18, "text-anchor": "middle", fill: "var(--muted)", "font-size": 11 }, String(yr))));
    series.forEach((se) => {
      const col = se.cls === "p" ? "var(--rr-pink)" : "var(--rr-blue-soft)", pts = se.pts.filter((p) => p.y != null);
      if (pts.length > 1) g.append(s("polyline", { points: pts.map((p) => `${x(p.x)},${y(p.y)}`).join(" "), fill: "none", stroke: col, "stroke-width": 2.5, "stroke-dasharray": se.cls === "p" ? "" : "6 4" }));
      pts.forEach((p) => {
        const c = se.cls === "p" ? s("circle", { cx: x(p.x), cy: y(p.y), r: 5, fill: col, stroke: "#fff", "stroke-width": 1, tabindex: "0" }) : s("rect", { x: x(p.x) - 4.5, y: y(p.y) - 4.5, width: 9, height: 9, fill: col, tabindex: "0" });
        c.setAttribute("aria-label", `${se.name} ${years[p.x]}: ${f2(p.y)} on ${p.n} balls`);
        bindTip(c, () => `<b>${years[p.x]}, ${se.name}</b><br>mean ball value ${signed(p.y, 3)}<br>${fmt(p.n)} balls`);
        g.append(c);
      });
    });
    svg.append(g, s("text", { x: 10, y: m.t + ih / 2, "text-anchor": "middle", fill: "var(--paper)", "font-size": 11, transform: `rotate(-90 10 ${m.t + ih / 2})` }, yLabel)); el.append(svg);
  });
}
