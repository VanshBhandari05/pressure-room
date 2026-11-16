// Original artwork, generated in code. No logos, crests, sponsor marks or photographs are used or recreated.
import { s, h } from "./util.js";
import { ratingFrac } from "./data.js";

// ---- block-print pattern tile (abstract geometric lotus/diamond, low opacity) ----
export function patternDefs(id = "bp") {
  return s("defs", {},
    s("pattern", { id, width: 56, height: 56, patternUnits: "userSpaceOnUse" },
      s("path", { d: "M28 4 L40 18 L28 32 L16 18 Z", fill: "none", stroke: "#E96DB1", "stroke-width": 1.2 }),
      s("path", { d: "M28 12 L34 18 L28 24 L22 18 Z", fill: "#E96DB1", opacity: ".55" }),
      s("circle", { cx: 0, cy: 0, r: 4, fill: "#E96DB1", opacity: ".5" }), s("circle", { cx: 56, cy: 0, r: 4, fill: "#E96DB1", opacity: ".5" }),
      s("circle", { cx: 0, cy: 56, r: 4, fill: "#E96DB1", opacity: ".5" }), s("circle", { cx: 56, cy: 56, r: 4, fill: "#E96DB1", opacity: ".5" }),
      s("path", { d: "M28 36 Q34 46 28 56 Q22 46 28 36Z", fill: "none", stroke: "#7C9DF0", "stroke-width": 1.1 })));
}
// jharokha-style arch path (pointed cusped arch) from x,y with width w and height ht
export function archPath(x, y, w, ht) {
  const r = w / 2, top = y + r * 0.9;
  return `M${x} ${y + ht} V${top} Q${x} ${y + r * 0.35} ${x + r * 0.5} ${y + r * 0.2} Q${x + r} ${y - r * 0.15} ${x + r} ${y - r * 0.55} Q${x + r} ${y - r * 0.15} ${x + r * 1.5} ${y + r * 0.2} Q${x + w} ${y + r * 0.35} ${x + w} ${top} V${y + ht} Z`;
}
// ---- hero backdrop: fort wall with crenellations, three jharokha arches, wagon-wheel rays, pitch strip ----
export function heroArt() {
  const W = 1200, H = 800, svg = s("svg", { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "xMidYMax slice", "aria-hidden": "true", focusable: "false" });
  svg.append(patternDefs("bp"),
    s("defs", {}, s("linearGradient", { id: "wall", x1: 0, y1: 0, x2: 0, y2: 1 }, s("stop", { offset: "0", "stop-color": "#1226AB" }), s("stop", { offset: "1", "stop-color": "#071678" })),
      s("radialGradient", { id: "glow", cx: "50%", cy: "38%", r: "55%" }, s("stop", { offset: "0", "stop-color": "#E50693", "stop-opacity": ".42" }), s("stop", { offset: "1", "stop-color": "#E50693", "stop-opacity": "0" }))));
  svg.append(s("rect", { width: W, height: H, fill: "url(#glow)" }), s("rect", { width: W, height: H, fill: "url(#bp)", opacity: ".07" }));
  // wagon-wheel rays from the pitch
  const g = s("g", { opacity: ".16", stroke: "#E96DB1", "stroke-width": 1.2, fill: "none" });
  for (let a = 200; a <= 340; a += 10) { const r = (a * Math.PI) / 180; g.append(s("line", { x1: 840, y1: 640, x2: 840 + Math.cos(r) * 760, y2: 640 + Math.sin(r) * 760 })); }
  g.append(s("ellipse", { cx: 840, cy: 640, rx: 560, ry: 300 }), s("ellipse", { cx: 840, cy: 640, rx: 300, ry: 160 }));
  svg.append(g);
  // fort wall with crenellations
  const wall = s("g", {}), base = 590;
  let d = `M0 ${H} V${base}`;
  for (let x = 0; x < W; x += 60) d += ` v-22 h36 v22 h24`;
  d += ` V${H} Z`;
  wall.append(s("path", { d, fill: "url(#wall)", opacity: ".96" }), s("path", { d, fill: "url(#bp)", opacity: ".1" }));
  // arches (jharokha)
  for (const [x, w, hh] of [[90, 120, 200], [800, 150, 250], [1040, 100, 180]]) {
    wall.append(s("path", { d: archPath(x, base + 40, w, hh), fill: "#181825", stroke: "#E50693", "stroke-width": 3 }),
      s("path", { d: archPath(x + 14, base + 58, w - 28, hh - 18), fill: "none", stroke: "#E96DB1", "stroke-width": 1.2, opacity: ".7" }));
  }
  // domed chhatri on top of the centre arch
  wall.append(s("path", { d: "M845 590 v-34 h60 v34 Z", fill: "#363749", stroke: "#E50693", "stroke-width": 2 }),
    s("path", { d: "M840 556 Q875 500 910 556 Z", fill: "#E50693" }), s("line", { x1: 875, y1: 500, x2: 875, y2: 478, stroke: "#E96DB1", "stroke-width": 3 }));
  svg.append(wall);
  // pitch-map strip at the foot
  const strip = s("g", { opacity: ".9" });
  strip.append(s("rect", { x: 0, y: H - 36, width: W, height: 36, fill: "#181825" }));
  for (let i = 0; i < 20; i++) strip.append(s("rect", { x: 20 + i * 58, y: H - 24, width: 40, height: 12, rx: 2, fill: i < 7 ? "#0050E6" : "#E50693", opacity: i < 7 ? ".7" : ".3" + (i % 7) }));
  svg.append(strip);
  return svg;
}
// ---- icons ----
export function stumps(lost, total = 10, size = 22) {
  const wrap = h("span", { class: "stumps", role: "img", "aria-label": `${total - lost} wickets in hand` });
  wrap.style.cssText = "display:inline-flex;gap:3px;flex-wrap:wrap";
  for (let i = 0; i < total; i++) {
    const fallen = i < lost;
    wrap.append(s("svg", { viewBox: "0 0 20 28", width: size * 0.7, height: size, "aria-hidden": "true" },
      s("g", { stroke: fallen ? "#7C9DF0" : "#E96DB1", "stroke-width": 2.4, "stroke-linecap": "round", opacity: fallen ? ".45" : "1", transform: fallen ? "rotate(14 10 24)" : "" },
        s("line", { x1: 4, y1: 6, x2: 4, y2: 26 }), s("line", { x1: 10, y1: 6, x2: 10, y2: 26 }), s("line", { x1: 16, y1: 6, x2: 16, y2: 26 })),
      !fallen ? s("g", { stroke: "#E50693", "stroke-width": 2.4, "stroke-linecap": "round" }, s("line", { x1: 4, y1: 4, x2: 9, y2: 4 }), s("line", { x1: 11, y1: 4, x2: 16, y2: 4 })) : null));
  }
  return wrap;
}
export function icon(name) {
  const p = { fill: "none", stroke: "#E96DB1", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round" };
  const paths = {
    flask: "M14 4h8M16 4v9L8 28a2 2 0 0 0 2 3h16a2 2 0 0 0 2-3l-8-15V4",
    bat: "M22 4l8 8-16 16-6 2 2-6z M10 26l-4 4",
    clock: "M18 6a12 12 0 1 0 0.1 0z M18 11v8l5 3",
    scale: "M18 6v22M8 28h20M8 12h20M8 12l-4 9a5 5 0 0 0 8 0zM28 12l-4 9a5 5 0 0 0 8 0z",
    eye: "M3 18s6-10 15-10 15 10 15 10-6 10-15 10S3 18 3 18z M18 14a4 4 0 1 0 .1 0z",
    users: "M12 16a5 5 0 1 0 .1 0z M24 16a4 4 0 1 0 .1 0z M3 29c0-6 4-9 9-9s9 3 9 9 M22 21c5 0 8 3 8 8",
    wall: "M3 28V12h4v4h4v-4h4v4h4v-4h4v4h4v-4h4v16z M3 28h30",
  };
  return s("svg", { viewBox: "0 0 36 36", "aria-hidden": "true" }, s("path", { ...p, d: paths[name] || paths.flask }));
}

// ---- player avatar: generated badge, no photographs ----
// ring fill = pressure rating (share of the pool range); ring track = blue (normal), ring arc = pink (pressure); glyph = bat or ball
export function avatar(p, size = 64) {
  const role = p.role_key, frac = Math.max(0.04, Math.min(1, ratingFrac(p))), R = 44, C = 2 * Math.PI * R;
  const id = "av" + p.key;
  const svg = s("svg", { class: "av", viewBox: "0 0 100 100", width: size, height: size, role: "img", "aria-label": `${p.name}, ${role === "batters" ? "batter" : "bowler"}, pressure rating ${p.rating}` });
  svg.append(
    s("defs", {}, s("linearGradient", { id: id + "g", x1: 0, y1: 0, x2: 1, y2: 1 }, s("stop", { offset: "0", "stop-color": "#1226AB" }), s("stop", { offset: "1", "stop-color": "#071678" })),
      s("clipPath", { id: id + "c" }, s("circle", { cx: 50, cy: 50, r: 37 }))),
    s("circle", { cx: 50, cy: 50, r: R, fill: "none", stroke: "#0050E6", "stroke-width": 8, opacity: ".75" }),
    s("circle", { cx: 50, cy: 50, r: R, fill: "none", stroke: "#E50693", "stroke-width": 8, "stroke-linecap": "round", "stroke-dasharray": `${C * frac} ${C}`, transform: "rotate(-90 50 50)" }),
    s("circle", { cx: 50, cy: 50, r: 37, fill: `url(#${id}g)` }),
    s("g", { "clip-path": `url(#${id}c)`, opacity: ".35" },
      s("path", { d: "M50 14 L64 28 L50 42 L36 28Z M50 58 L64 72 L50 86 L36 72Z M14 50 L28 36 L42 50 L28 64Z M58 50 L72 36 L86 50 L72 64Z", fill: "none", stroke: "#E96DB1", "stroke-width": 1.2 }),
      role === "batters" ? s("path", { d: "M0 100 L100 0 L100 18 L18 100Z", fill: "#E50693", opacity: ".25" }) : s("path", { d: "M0 0 L100 100 L82 100 L0 18Z", fill: "#0050E6", opacity: ".5" })),
    s("text", { x: 50, y: 60, "text-anchor": "middle", "font-family": "Montserrat,Arial,sans-serif", "font-size": 34, "font-weight": 600, fill: "#F6F6F9" }, p.initials),
    // glyph badge
    s("circle", { cx: 82, cy: 82, r: 13, fill: "#181825", stroke: "#E96DB1", "stroke-width": 2 }),
    role === "batters"
      ? s("path", { d: "M85 74 l5 5 -10 10 -4 1 1 -4z", fill: "#F6F6F9" })
      : s("g", {}, s("circle", { cx: 82, cy: 82, r: 6.2, fill: "#E50693" }), s("path", { d: "M77.5 80 Q82 83 86.5 80 M77.5 84 Q82 87 86.5 84", stroke: "#F6F6F9", "stroke-width": 1, fill: "none" })));
  return svg;
}
export function logoMark(size = 28) { // generic 'pressure room' mark: stumps inside a ring (original)
  return s("svg", { viewBox: "0 0 40 40", width: size, height: size, "aria-hidden": "true" },
    s("circle", { cx: 20, cy: 20, r: 17, fill: "none", stroke: "#0050E6", "stroke-width": 4 }),
    s("path", { d: "M20 3 A17 17 0 0 1 37 20", fill: "none", stroke: "#E50693", "stroke-width": 4, "stroke-linecap": "round" }),
    s("g", { stroke: "#F6F6F9", "stroke-width": 2.4, "stroke-linecap": "round" }, s("line", { x1: 14, y1: 12, x2: 14, y2: 28 }), s("line", { x1: 20, y1: 12, x2: 20, y2: 28 }), s("line", { x1: 26, y1: 12, x2: 26, y2: 28 })));
}
