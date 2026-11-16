// Generic scatter (map + stability), dumbbell, bump chart.
import { h, s, responsive, linear, ticks, bindTip, f1, f2, f3, fmt, extent, clamp } from "../util.js";

// opts: points[{id,x,y,r,label,top,hl,tip}], xLabel,yLabel, diag, vline, hline, quads[{x,y,text,anchor}], onClick(point), xFmt,yFmt, height
export function scatter(el, opts) {
  const ctl = responsive(el, (W) => {
    const m = { l: 56, r: 14, t: 14, b: 46 }, H = opts.height || clamp(W * 0.72, 320, 560), iw = W - m.l - m.r, ih = H - m.t - m.b;
    const pts = opts.points; if (!pts.length) { el.append(h("div", { class: "note" }, "No players match the current filters.")); return; }
    const [x0, x1] = extent(pts.map((p) => p.x).concat(opts.xInclude || [])), [y0, y1] = extent(pts.map((p) => p.y).concat(opts.yInclude || []));
    const px = (x1 - x0) * 0.06 || 0.01, py = (y1 - y0) * 0.08 || 0.01;
    const x = linear(x0 - px, x1 + px, 0, iw), y = linear(y0 - py, y1 + py, ih, 0), rs = linear(0, Math.sqrt(Math.max(...pts.map((p) => p.r || 1))), 3.5, W < 520 ? 10 : 15);
    const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H }), g = s("g", { transform: `translate(${m.l},${m.t})` });
    ticks(x0 - px, x1 + px, 6).forEach((t) => g.append(s("line", { x1: x(t), x2: x(t), y1: 0, y2: ih, stroke: "var(--line)" }), s("text", { x: x(t), y: ih + 17, "text-anchor": "middle", fill: "var(--muted)", "font-size": 11 }, (opts.xFmt || f2)(t))));
    ticks(y0 - py, y1 + py, 5).forEach((t) => g.append(s("line", { x1: 0, x2: iw, y1: y(t), y2: y(t), stroke: "var(--line)" }), s("text", { x: -7, y: y(t) + 4, "text-anchor": "end", fill: "var(--muted)", "font-size": 11 }, (opts.yFmt || f2)(t))));
    // quadrant tints (blue = below the no-change reference, pink = above), drawn before points
    if (opts.vline != null && opts.hline != null) {
      const vx = x(opts.vline), hy = y(opts.hline);
      g.append(s("line", { x1: vx, x2: vx, y1: 0, y2: ih, stroke: "var(--muted)", "stroke-dasharray": "4 4" }));
      if (opts.hlineDraw) g.append(s("line", { x1: 0, x2: iw, y1: hy, y2: hy, stroke: "#fff", "stroke-opacity": 0.7, "stroke-width": 1.5 }));
    }
    if (opts.diag) {
      const lo = Math.max(x.invert(0), y.invert(ih)), hi = Math.min(x.invert(iw), y.invert(0));
      g.append(s("line", { x1: x(lo), y1: y(lo), x2: x(hi), y2: y(hi), stroke: "#fff", "stroke-opacity": 0.7, "stroke-width": 1.5, "stroke-dasharray": "7 5" }),
        s("text", { x: 8, y: 14, fill: "#fff", "font-size": 11, opacity: 0.85 }, "- - -  dashed line: no change under pressure"));
    }
    (opts.quads || []).forEach((q) => g.append(s("text", { x: q.ax === "r" ? iw - 8 : 8, y: q.ay === "b" ? ih - 10 : 20, "text-anchor": q.ax === "r" ? "end" : "start", fill: "var(--rr-pink-soft)", "font-family": "Montserrat,Arial,sans-serif", "font-size": 22, "letter-spacing": ".06em", opacity: 0.9 }, q.text)));
    // points: others first, top-10 last so they sit on top
    const order = [...pts].sort((a, b) => (a.top ? 1 : 0) - (b.top ? 1 : 0) || (a.hl ? 1 : 0) - (b.hl ? 1 : 0));
    order.forEach((p) => {
      const r = rs(Math.sqrt(p.r || 1));
      const c = s("circle", { cx: x(p.x), cy: y(p.y), r, tabindex: "0", role: "button", "aria-label": p.aria || p.label, style: { cursor: "pointer" },
        fill: p.top ? "var(--rr-pink)" : "var(--rr-blue)", "fill-opacity": p.top ? 0.9 : 0.55, stroke: p.hl ? "#fff" : p.top ? "#fff" : "var(--rr-blue-soft)", "stroke-width": p.hl ? 3 : p.top ? 1.5 : 1 });
      bindTip(c, () => p.tip || p.label);
      c.addEventListener("click", () => opts.onClick && opts.onClick(p));
      c.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); opts.onClick && opts.onClick(p); } });
      g.append(c);
      if (p.top || p.hl) g.append(s("text", { x: x(p.x) + r + 3, y: y(p.y) + 4, fill: "#fff", "font-size": 11, "font-weight": 600, "paint-order": "stroke", stroke: "#071678", "stroke-width": 3, "pointer-events": "none" }, p.short || p.label));
    });
    g.append(s("text", { x: iw / 2, y: ih + 38, "text-anchor": "middle", fill: "var(--paper)", "font-size": 12, ...(String(opts.xLabel).length*7.2>iw?{textLength:Math.max(40,iw-6),lengthAdjust:"spacingAndGlyphs"}:{}),  }, opts.xLabel),
      s("text", { x: -ih / 2, y: -42, "text-anchor": "middle", fill: "var(--paper)", "font-size": 12, transform: "rotate(-90)" }, opts.yLabel));
    svg.append(g); el.append(svg);
  });
  return ctl;
}

// dumbbell: rows [{label, n, p, key}], blue normal -> pink pressure
export function dumbbell(el, rows, opts = {}) {
  responsive(el, (W) => {
    const rh = 34, m = { l: W < 520 ? 104 : 150, r: 18, t: 10, b: 32 }, H = m.t + rows.length * rh + m.b, iw = W - m.l - m.r;
    const vals = rows.flatMap((r) => [r.n, r.p]).filter((v) => v != null), [a, b] = extent(vals), pad = (b - a) * 0.1 || 1, x = linear(a - pad, b + pad, 0, iw);
    const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H }), g = s("g", { transform: `translate(${m.l},${m.t})` });
    ticks(a - pad, b + pad, 5).forEach((t) => g.append(s("line", { x1: x(t), x2: x(t), y1: 0, y2: rows.length * rh, stroke: "var(--line)" }), s("text", { x: x(t), y: rows.length * rh + 16, "text-anchor": "middle", fill: "var(--muted)", "font-size": 11 }, (opts.fmt || f1)(t))));
    rows.forEach((r, i) => {
      const cy = i * rh + rh / 2, up = r.p > r.n;
      const grp = s("g", { tabindex: "0", role: "button", style: { cursor: "pointer" }, "aria-label": `${r.label}: normal ${(opts.fmt || f1)(r.n)}, pressure ${(opts.fmt || f1)(r.p)}` },
        s("line", { x1: x(r.n), x2: x(r.p), y1: cy, y2: cy, stroke: "var(--rr-pink-soft)", "stroke-width": 3, opacity: 0.7 }),
        s("rect", { x: x(r.n) - 6, y: cy - 6, width: 12, height: 12, fill: "var(--rr-blue)", stroke: "#fff", "stroke-width": 1.5 }),
        s("circle", { cx: x(r.p), cy, r: 7, fill: "var(--rr-pink)", stroke: "#fff", "stroke-width": 1.5 }));
      g.append(s("text", { x: -8, y: cy + 4, "text-anchor": "end", fill: "var(--paper)", "font-size": 12 }, (r.rank ? r.rank + ". " : "") + r.label), grp);
      bindTip(grp, () => `<b>${r.label}</b><br><span class="badge-n">Normal</span> ${(opts.fmt || f1)(r.n)}<br><span class="badge-p">Pressure</span> ${(opts.fmt || f1)(r.p)}<br>${r.sub || ""}`);
      grp.addEventListener("click", () => opts.onClick && opts.onClick(r)); grp.addEventListener("keydown", (e) => { if (e.key === "Enter") opts.onClick && opts.onClick(r); });
    });
    g.append(s("text", { x: iw / 2, y: rows.length * rh + 30, "text-anchor": "middle", fill: "var(--paper)", "font-size": 12, ...(String(opts.xLabel||"").length*7.2>iw?{textLength:Math.max(40,iw-6),lengthAdjust:"spacingAndGlyphs"}:{}),  }, opts.xLabel || ""));
    svg.append(g); el.append(svg);
  });
}

// bump chart: columns[{key,label}], lines[{id,name,top,ranks:{key:rank}}], maxRank
export function bump(el, columns, lines, maxRank = 16, onClick) {
  responsive(el, (W) => {
    const m = { l: 34, r: W < 560 ? 108 : 150, t: 30, b: 14 }, rh = 26, H = m.t + maxRank * rh + m.b, iw = W - m.l - m.r;
    const x = linear(0, columns.length - 1, 0, iw), y = (r) => (Math.min(r, maxRank + 0.4) - 0.5) * rh;
    const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H }), g = s("g", { transform: `translate(${m.l},${m.t})` });
    g.append(s("rect", { x: -10, y: 0, width: iw + 20, height: 10 * rh, fill: "rgba(229,6,147,.07)", rx: 6 }));
    for (let r = 1; r <= maxRank; r++) g.append(s("text", { x: -14, y: y(r) + 4, "text-anchor": "end", fill: r <= 10 ? "var(--paper)" : "var(--muted)", "font-size": 11 }, String(r)));
    g.append(s("text", { x: -14, y: 10 * rh + 14, "text-anchor": "end", fill: "var(--muted)", "font-size": 10 }, ""));
    columns.forEach((c, i) => g.append(s("text", { x: x(i), y: -12, "text-anchor": "middle", fill: c.main ? "var(--rr-pink-soft)" : "var(--paper)", "font-size": 12, "font-weight": c.main ? 700 : 500 }, W < 560 ? c.short : c.label)));
    const sorted = [...lines].sort((a, b) => (a.top ? 1 : 0) - (b.top ? 1 : 0));
    sorted.forEach((ln) => {
      const pts = columns.map((c, i) => ({ i, r: ln.ranks[c.key] })).filter((p) => p.r != null);
      if (!pts.length) return;
      const col = ln.top ? "var(--rr-pink)" : "var(--rr-blue-soft)";
      const grp = s("g", { tabindex: "0", role: "button", style: { cursor: "pointer" }, "aria-label": `${ln.name}: ranks ${pts.map((p) => p.r).join(", ")} across the cutoffs` });
      grp.append(s("polyline", { points: pts.map((p) => `${x(p.i)},${y(p.r)}`).join(" "), fill: "none", stroke: col, "stroke-width": ln.top ? 3 : 2, "stroke-dasharray": ln.top ? "" : "5 4", opacity: ln.top ? 0.95 : 0.7 }));
      pts.forEach((p) => grp.append(p.r > maxRank ? s("path", { d: `M${x(p.i) - 4} ${y(p.r) - 4} l8 8 m0 -8 l-8 8`, stroke: col, "stroke-width": 2 }) : (ln.top ? s("circle", { cx: x(p.i), cy: y(p.r), r: 5, fill: col, stroke: "#071678", "stroke-width": 1.5 }) : s("rect", { x: x(p.i) - 4, y: y(p.r) - 4, width: 8, height: 8, fill: col }))));
      const last = pts[pts.length - 1];
      grp.append(s("text", { x: x(last.i) + 10, y: y(last.r) + 4, fill: ln.top ? "#fff" : "var(--rr-blue-soft)", "font-size": 11, "font-weight": ln.top ? 600 : 400 }, ln.short || ln.name));
      bindTip(grp, () => `<b>${ln.name}</b>${ln.top ? " (official top 10)" : " (enters a variant top 10)"}<br>${columns.map((c) => `${c.label}: ${ln.ranks[c.key] ?? "n/a"}`).join("<br>")}`);
      grp.addEventListener("click", () => onClick && onClick(ln)); grp.addEventListener("keydown", (e) => { if (e.key === "Enter") onClick && onClick(ln); });
      g.append(grp);
    });
    svg.append(g); el.append(svg);
  });
}
