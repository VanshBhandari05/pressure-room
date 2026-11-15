// Data layer: every number on the page is read from data/*.json (built by build_data.py from the pipeline outputs).
const BASE = "data/";
const cache = new Map();
export const missing = [];

export function get(name) {
  if (!cache.has(name)) {
    cache.set(name, fetch(BASE + name).then((r) => { if (!r.ok) throw new Error(r.status + " " + name); return r.json(); })
      .catch((e) => { console.warn("data file unavailable:", name, e.message); missing.push(name); return null; }));
  }
  return cache.get(name);
}

export const D = { meta: null, batters: null, bowlers: null, top10: {}, pool: { batters: [], bowlers: [] }, byKey: {}, stats: {} };
export const P = () => (D.meta && D.meta.params) || {};
export const CODE = { batters: "bt", bowlers: "bw" };
export const ROLE_OF = { bt: "batters", bw: "bowlers" };
export const keyOf = (role, id) => CODE[role] + id;

export async function init() {
  const [meta, bt, bw, t1, t2] = await Promise.all([get("meta.json"), get("batters.json"), get("bowlers.json"), get("top10_batters.json"), get("top10_bowlers.json")]);
  D.meta = meta; D.top10 = { batters: t1 && t1.list, bowlers: t2 && t2.list };
  for (const [role, file] of [["batters", bt], ["bowlers", bw]]) {
    const arr = file ? file.players : [];
    for (const p of arr) { p.role_key = role; p.key = keyOf(role, p.id); p.initials = initials(p.name); D.byKey[p.key] = p; }
    D.pool[role] = arr;
    const r = arr.map((p) => p.rating);
    D.stats[role] = { min: Math.min(...r), max: Math.max(...r), sorted: [...r].sort((a, b) => a - b) };
  }
  return D;
}
export function initials(name) {
  const parts = name.replace(/[^A-Za-z\s.-]/g, "").split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}
export const ratingFrac = (p) => { const s = D.stats[p.role_key]; return s ? (p.rating - s.min) / (s.max - s.min || 1) : 0.5; };
export const detail = (p) => get(`player_detail/${CODE[p.role_key]}${p.id}.json`);
export const percentile = (p, field) => {
  const vals = D.pool[p.role_key].map((q) => q[field]).filter((v) => v != null).sort((a, b) => a - b);
  if (p[field] == null || !vals.length) return null;
  return vals.filter((v) => v <= p[field]).length / vals.length;
};

// ---------- global filters (state) ----------
export const F = { role: "batters", comp: "all", y0: 0, y1: 4, minP: 0 };
const subs = new Set();
export const onFilter = (fn) => { subs.add(fn); return () => subs.delete(fn); };
export function setFilter(patch) { Object.assign(F, patch); if (F.y0 > F.y1) { const t = F.y0; F.y0 = F.y1; F.y1 = t; } subs.forEach((fn) => fn(F)); }
export const filterIsDefault = () => F.comp === "all" && F.y0 === 0 && F.y1 === 4;

// ---------- slice statistics from player_cells.json ----------
let cells = null;
export async function loadCells() { if (!cells) cells = await get("player_cells.json"); return cells; }
export const years = () => (cells ? cells.years : []);
export function slice(p, comp = F.comp, y0 = F.y0, y1 = F.y1) {
  if (!cells) return null;
  const rows = cells.roles[p.role_key][String(p.id)] || [];
  let n0 = 0, v0 = 0, n1 = 0, v1 = 0;
  for (const [c, yi, pr, n, v] of rows) {
    if (comp !== "all" && (comp === "IPL" ? 0 : 1) !== c) continue;
    if (yi < y0 || yi > y1) continue;
    if (pr) { n1 += n; v1 += v; } else { n0 += n; v0 += v; }
  }
  return { n0, n1, m0: n0 ? v0 / n0 : null, m1: n1 ? v1 / n1 : null };
}
