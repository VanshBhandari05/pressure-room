// Small DOM, formatting, scale and interaction helpers. No framework.
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const reduceMotion = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const SVGNS = "http://www.w3.org/2000/svg";
function apply(el, props) {
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.setAttribute("class", v);
    else if (k === "text") el.textContent = v;
    else if (k === "html") el.innerHTML = v;
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
}
function addKids(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    el.append(k.nodeType ? k : document.createTextNode(String(k)));
  }
}
export function h(tag, props, ...kids) { const el = document.createElement(tag); apply(el, props); addKids(el, kids); return el; }
export function s(tag, props, ...kids) { const el = document.createElementNS(SVGNS, tag); apply(el, props); addKids(el, kids); return el; }

// ---------- number formatting ----------
export const fmt = (x, d = 0) => (x == null || Number.isNaN(x) ? "n/a" : Number(x).toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d }));
export const f1 = (x) => fmt(x, 1);
export const f2 = (x) => fmt(x, 2);
export const f3 = (x) => fmt(x, 3);
export const pct = (x, d = 0) => (x == null ? "n/a" : fmt(100 * x, d) + "%");
export const signed = (x, d = 2) => (x == null ? "n/a" : (x > 0 ? "+" : x < 0 ? "-" : "") + fmt(Math.abs(x), d));
export const FORMATS = { int: (x) => fmt(x, 0), d1: f1, d2: f2, d3: f3, pct: (x) => pct(x, 1), pct0: (x) => pct(x, 0) };

// ---------- scales and ticks ----------
export function linear(d0, d1, r0, r1) {
  const k = (r1 - r0) / (d1 - d0 || 1);
  const fn = (v) => r0 + (v - d0) * k;
  fn.invert = (p) => d0 + (p - r0) / k;
  fn.domain = [d0, d1]; fn.range = [r0, r1];
  return fn;
}
export function ticks(min, max, n = 5) {
  const span = max - min || 1, raw = span / n, mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((t) => t >= raw) || raw;
  const out = []; for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-6; v += step) out.push(+v.toFixed(10));
  return out;
}
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const extent = (arr) => [Math.min(...arr), Math.max(...arr)];
export const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
export function quantileRank(sorted, v) { // share of values <= v
  let c = 0; for (const x of sorted) if (x <= v) c++; return c / sorted.length;
}

// ---------- tooltip ----------
let tipEl;
export const tip = {
  show(html, ev) {
    if (!tipEl) { tipEl = h("div", { id: "tip", role: "status" }); document.body.append(tipEl); }
    tipEl.innerHTML = html; tipEl.classList.add("on");
    const pad = 14, w = tipEl.offsetWidth, hh = tipEl.offsetHeight;
    let x = ev.clientX + pad, y = ev.clientY + pad;
    if (x + w > innerWidth - 8) x = ev.clientX - w - pad;
    if (y + hh > innerHeight - 8) y = ev.clientY - hh - pad;
    tipEl.style.left = Math.max(6, x) + "px"; tipEl.style.top = Math.max(6, y) + "px";
  },
  hide() { if (tipEl) tipEl.classList.remove("on"); },
};
export function bindTip(el, htmlFn) {
  el.addEventListener("pointermove", (e) => tip.show(htmlFn(e), e));
  el.addEventListener("pointerleave", () => tip.hide());
  el.addEventListener("focus", () => { const r = el.getBoundingClientRect(); tip.show(htmlFn({}), { clientX: r.left + r.width / 2, clientY: r.top }); });
  el.addEventListener("blur", () => tip.hide());
}
export function term(label, def) {
  const el = h("span", { class: "term", tabindex: "0", role: "button", "aria-label": `${label}: ${def}` }, label);
  const showFn = (e) => { const r = el.getBoundingClientRect(); tip.show(`<b>${label}</b><br>${def}`, { clientX: r.left, clientY: r.bottom - 12 }); };
  el.addEventListener("pointerenter", showFn); el.addEventListener("focus", showFn);
  el.addEventListener("pointerleave", () => tip.hide()); el.addEventListener("blur", () => tip.hide());
  return el;
}

// ---------- visibility, counters, responsive drawing ----------
export function inView(el, cb, opts = {}) {
  if (!("IntersectionObserver" in window)) { cb(); return; }
  const io = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) { cb(e); if (opts.once !== false) io.disconnect(); } }, { threshold: opts.threshold ?? 0.2, rootMargin: opts.rootMargin || "0px" });
  io.observe(el);
}
export function countUp(el, to, formatter = FORMATS.int, ms = 1400) {
  if (reduceMotion()) { el.textContent = formatter(to); return; }
  const t0 = performance.now();
  const tick = (t) => { const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3); el.textContent = formatter(to * e); if (k < 1) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}
export function responsive(el, draw, minW = 260) {
  let last = 0, raf = 0;
  const run = () => { const w = Math.max(minW, Math.floor(el.clientWidth)); if (Math.abs(w - last) < 2 && last) return; last = w; el.replaceChildren(); draw(w); };
  if ("ResizeObserver" in window) new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(run); }).observe(el);
  run();
  return { redraw() { last = 0; run(); } };
}
export function note(el, msg) { el.replaceChildren(h("div", { class: "fail", role: "note" }, msg)); }

// "View as table" companion for charts
export function tableToggle(headers, rows, caption = "View as table") {
  const t = h("table", { class: "t" }, h("thead", {}, h("tr", {}, headers.map((x) => h("th", { scope: "col" }, x)))),
    h("tbody", {}, rows.map((r) => h("tr", {}, r.map((c) => h("td", {}, c))))));
  return h("details", { class: "viewtable" }, h("summary", {}, caption), h("div", { class: "tbl-wrap" }, t));
}
export const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export function debounce(fn, ms = 120) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
export const ord = (n) => { const v = n % 100; return n + (["th", "st", "nd", "rd"][(v - 20) % 10] || ["th", "st", "nd", "rd"][v] || "th"); };
export const seasonSpan = (y) => `${y[0]}-${String(y[y.length - 1]).slice(2)}`;
