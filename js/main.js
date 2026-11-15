// Entry point: loads data, wires navigation, ticker, global filters and every section. Each section fails on its own.
import { $, $$, h, fmt, FORMATS, inView, reduceMotion, note } from "./util.js";
import { D, init, F, setFilter, onFilter, loadCells, years, missing } from "./data.js";
import { loadPick, readHash, onHash } from "./state.js";
import { initCard, openPlayer, closeCard } from "./ui/card.js";
import { initHero } from "./ui/hero.js";
import { initPick, initRevisit } from "./ui/pick.js";
import { initMeter } from "./ui/meter.js";
import { initWhere, initChanges } from "./ui/where.js";
import { initRating } from "./ui/rating.js";
import { initRankings } from "./ui/rankings.js";
import { initMap } from "./ui/map.js";
import { initCompare } from "./ui/compare.js";
import { initOmissions, initXI } from "./ui/omissions.js";
import { initTrust, initExplorer } from "./ui/trust.js";
import { initLimits } from "./ui/limits.js";
import { logoMark } from "./art.js";

const SECTIONS = [["pick", "Your pick"], ["pressure", "Pressure"], ["where", "Where"], ["changes", "Proof"], ["rating", "Rating"], ["rankings", "Rankings"], ["map", "Map"], ["h2h", "Versus"], ["omit", "Surprises"], ["xi", "XI"], ["trust", "Trust"], ["limits", "Limits"], ["revisit", "Revisit"]];

async function safe(name, fn, hostSel) {
  try { await fn(); } catch (e) { console.error(`section ${name} failed`, e); const host = hostSel && $(hostSel); if (host) note(host, `This section could not be built (${e.message}). The rest of the page still works.`); }
}

function ticker() {
  const over = $("#over-label"), bar = $("#ticker-bar"), fill = $("#gauge-fill"), links = $$("#nav a");
  const secs = SECTIONS.map(([id]) => document.getElementById(id));
  const update = () => {
    const doc = document.documentElement, p = Math.min(1, Math.max(0, scrollY / Math.max(1, doc.scrollHeight - innerHeight)));
    bar.style.transform = `scaleX(${p})`; fill.style.width = p * 100 + "%";
    const balls = Math.min(120, Math.round(p * 120)), ov = Math.min(20, Math.floor(balls / 6)), bl = balls % 6;
    over.innerHTML = p >= 0.995 ? "<b>20.0</b> overs" : `Over <b>${ov}.${bl}</b>`;
    let cur = null; secs.forEach((s, i) => { if (s && s.getBoundingClientRect().top < innerHeight * 0.35) cur = i; });
    links.forEach((a, i) => a.setAttribute("aria-current", String(i === cur)));
  };
  addEventListener("scroll", update, { passive: true }); addEventListener("resize", update); update();
}

function filterBar() {
  const root = $("#filters-ui"), yrs = years();
  const seg = (label, opts, key) => { const el = h("div", { class: "seg", role: "group", "aria-label": label }, opts.map(([v, l]) => h("button", { "aria-pressed": String(F[key] === v), "data-v": v }, l))); el.addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; setFilter({ [key]: b.dataset.v }); }); return el; };
  const roleSeg = seg("Batters or bowlers", [["batters", "Batters"], ["bowlers", "Bowlers"]], "role"), compSeg = seg("Competition", [["all", "All"], ["IPL", "IPL"], ["T20I", "T20I"]], "comp");
  const mkYear = (key) => { const sel = h("select", { "aria-label": key === "y0" ? "From season" : "To season" }, yrs.map((y, i) => h("option", { value: i }, String(y)))); sel.value = F[key]; sel.addEventListener("change", () => setFilter({ [key]: +sel.value })); return sel; };
  const y0 = mkYear("y0"), y1 = mkYear("y1");
  const minp = h("input", { type: "range", min: 0, max: 400, step: 20, value: F.minP, "aria-label": "Minimum pressure balls", style: { width: "110px" } }), mval = h("span", { class: "num", style: { minWidth: "2.2em", fontFamily: "var(--font-display)", fontSize: "1.1rem" } }, "0");
  minp.addEventListener("input", () => { mval.textContent = minp.value; setFilter({ minP: +minp.value }); });
  const sync = () => { [roleSeg, compSeg].forEach((sg, i) => sg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === F[i ? "comp" : "role"])))); y0.value = F.y0; y1.value = F.y1; };
  root.replaceChildren(h("div", { class: "grp" }, h("span", { class: "lbl" }, "Show"), roleSeg), h("div", { class: "grp" }, h("span", { class: "lbl" }, "Competition"), compSeg), h("div", { class: "grp" }, h("span", { class: "lbl" }, "Seasons"), y0, h("span", { class: "lbl" }, "to"), y1),
    h("div", { class: "grp" }, h("span", { class: "lbl" }, "Min pressure balls"), minp, mval), h("span", { class: "hint" }, "Filters drive the map, head to head and explorer. The official top 10 never changes."));
  onFilter(sync);
}

function bindText() {
  const m = D.meta; if (!m) return;
  $$("[data-b]").forEach((el) => { const path = el.dataset.b.split("."); let v = D; for (const k of path) v = v == null ? v : v[k]; if (v == null) return; el.textContent = (FORMATS[el.dataset.f || "int"] || FORMATS.int)(el.dataset.f === "pct" ? v : v); });
  const b = $("#build-date"); if (b) b.textContent = new Date(m.build_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

async function boot() {
  $("#logo").append(logoMark(30));
  await init();
  if (!D.meta) { note($("#hero-fail"), "The data files could not be loaded. Serve this folder over HTTP (for example python -m http.server) rather than opening the file directly."); }
  loadPick(); initCard(); await loadCells();
  bindText();
  $("#nav").append(...SECTIONS.map(([id, l]) => h("a", { href: "#" + id, onclick: (e) => { e.preventDefault(); document.getElementById(id).scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth" }); } }, l)));
  ticker(); filterBar();
  $$(".rv").forEach((el) => inView(el, () => el.classList.add("in"), { threshold: 0.08 }));
  await Promise.all([
    safe("hero", initHero, "#hero-fail"), safe("pick", initPick, "#pick-ui"), safe("meter", initMeter, "#meter-ui"), safe("where", initWhere, "#where-ui"), safe("changes", initChanges, "#changes-ui"),
    safe("rating", initRating, "#rating-ui"), safe("rankings", initRankings, "#rank-ui"), safe("map", initMap, "#map-ui"), safe("compare", initCompare, "#h2h-ui"), safe("omissions", initOmissions, "#omit-ui"),
    safe("xi", initXI, "#xi-ui"), safe("trust", initTrust, "#trust-ui"), safe("explorer", initExplorer, "#explorer-ui"), safe("limits", initLimits, "#limits-ui"), safe("revisit", initRevisit, "#revisit-ui")]);
  const hs = readHash(); if (hs.p && D.byKey[hs.p]) openPlayer(D.byKey[hs.p], { hash: false });
  onHash((hh) => { if (hh.p && D.byKey[hh.p]) openPlayer(D.byKey[hh.p], { hash: false }); else if (!hh.p) closeCard(false); });
  if (missing.length) console.warn("missing data files:", missing);
  document.documentElement.dataset.ready = "1";
}
boot().catch((e) => { console.error(e); const f = $("#hero-fail"); if (f) note(f, "Something went wrong while starting the page: " + e.message); });
