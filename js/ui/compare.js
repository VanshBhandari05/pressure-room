// Section 10: head to head.
import { $, h, f1, f2, f3, fmt, pct, signed } from "../util.js";
import { D, F, onFilter, slice, filterIsDefault, years } from "../data.js";
import { avatar } from "../art.js";
import { searchSelect } from "./search.js";
import { readHash, setHash } from "../state.js";
import { openPlayer } from "./card.js";

const BAT = [["rating", "Pressure rating", f3, "p", 1], ["floor", "Floor", f3, "p", 1], ["baseline", "Baseline", f3, "n", 1], ["sr_P", "Strike rate, pressure", f1, "p", 1], ["sr_O", "Strike rate, normal", f1, "n", 1], ["runs_index_P", "Runs index, pressure", fmt, "p", 1],
  ["dism_ratio_P", "Dismissal ratio, pressure (lower is better)", f2, "p", -1], ["bnd_P", "Boundary %, pressure", f1, "p", 1], ["dot_P", "Dot %, pressure (lower is better)", f1, "p", -1], ["p_top10", "Chance of top-10 finish", (v) => pct(v, 0), "p", 1]];
const BOW = [["rating", "Pressure rating", f3, "p", 1], ["floor", "Floor", f3, "p", 1], ["baseline", "Baseline", f3, "n", 1], ["econ_P", "Economy, pressure (lower is better)", f2, "p", -1], ["econ_O", "Economy, normal (lower is better)", f2, "n", -1], ["econ_index_P", "Economy index, pressure", fmt, "p", 1],
  ["wk_ratio_P", "Wicket ratio, pressure", f2, "p", 1], ["dot_P", "Dot %, pressure", f1, "p", 1], ["bnd_P", "Boundaries conceded %, pressure (lower is better)", f1, "p", -1], ["p_top10", "Chance of top-10 finish", (v) => pct(v, 0), "p", 1]];

export function initCompare() {
  const root = $("#h2h-ui"); if (!root) return;
  let a = null, b = null, role = F.role;
  const host = h("div", { class: "cmp" }), roleNote = h("p", { class: "note" });
  const mkSel = (label, set) => searchSelect({ label, placeholder: label + " ..", getOptions: () => D.pool[role].filter((p) => p.n_P >= F.minP).map((p) => ({ key: p.key, label: p.name, sub: p.teams })), onSelect: (o) => { set(D.byKey[o.key]); paint(true); } });
  const sa = mkSel("First player", (p) => (a = p)), sb = mkSel("Second player", (p) => (b = p));
  function defaults() {
    const t = D.top10[role] || []; const code = role === "batters" ? "bt" : "bw";
    a = t[0] ? D.byKey[code + t[0].id] : null; b = t[1] ? D.byKey[code + t[1].id] : null; sa.set(a ? a.name : ""); sb.set(b ? b.name : "");
  }
  function paint(write = false) {
    if (write) setHash({ c: a && b ? `${a.key},${b.key}` : null });
    if (!a || !b) { host.replaceChildren(h("div", { class: "note" }, "Choose two players.")); return; }
    if (a.role_key !== b.role_key) { host.replaceChildren(h("div", { class: "fail" }, "Choose two players of the same kind (two batters or two bowlers).")); return; }
    const defs = a.role_key === "batters" ? BAT : BOW, rows = defs.map(([k, l, fm, grp, dir]) => ({ k, l, fm, grp, dir, A: a[k], B: b[k] })).filter((r) => r.A != null && r.B != null);
    let winsA = 0, winsB = 0; rows.forEach((r) => { const ba = r.dir * (r.A - r.B); if (ba > 0) winsA++; else if (ba < 0) winsB++; });
    const overlap = !(a.floor > b.p90 || b.floor > a.p90), dr = a.rating - b.rating, lead = dr >= 0 ? a : b, other = dr >= 0 ? b : a;
    const verdict = `${lead.name} leads on pressure rating by ${f3(Math.abs(dr))}, and on ${Math.max(winsA, winsB)} of ${rows.length} measures${winsA === winsB ? " (level on measures)" : ""}. Their rating intervals ${overlap ? "overlap, so the data cannot separate them with confidence" : "do not overlap, so the gap is larger than resampling noise"}.`;
    const bars = rows.map((r) => { const m = Math.max(Math.abs(r.A), Math.abs(r.B)) || 1, wa = (Math.abs(r.A) / m) * 100, wb = (Math.abs(r.B) / m) * 100, aw = r.dir * (r.A - r.B) > 0, bw = r.dir * (r.B - r.A) > 0;
      return h("div", { class: "mr", role: "group", "aria-label": `${r.l}: ${a.name} ${r.fm(r.A)}, ${b.name} ${r.fm(r.B)}` },
        h("span", { class: "v " + (aw ? "w" : "") }, r.fm(r.A)), h("div", { class: "side l" }, h("i", { class: r.grp, style: { width: wa + "%" } })), h("span", { class: "lab" }, r.l), h("div", { class: "side r" }, h("i", { class: r.grp, style: { width: wb + "%" } })), h("span", { class: "v " + (bw ? "w" : "") }, r.fm(r.B))); });
    let extra = null;
    if (!filterIsDefault()) { const sa_ = slice(a), sb_ = slice(b), yrs = years(); extra = h("p", { class: "note" }, `In the filtered slice (${F.comp === "all" ? "IPL and T20I" : F.comp}, ${yrs[F.y0]}-${yrs[F.y1]}): average ball value on pressure balls ${a.name} ${sa_.m1 == null ? "n/a" : signed(sa_.m1, 3)} (${fmt(sa_.n1)} balls) against ${b.name} ${sb_.m1 == null ? "n/a" : signed(sb_.m1, 3)} (${fmt(sb_.n1)} balls).`); }
    host.replaceChildren(h("div", { class: "cmp-heads" }, h("button", { class: "ph", onclick: () => openPlayer(a), "aria-label": `Open ${a.name}` }, avatar(a, 64), h("b", {}, a.name), h("small", {}, a.teams)), h("button", { class: "ph r", onclick: () => openPlayer(b), "aria-label": `Open ${b.name}` }, avatar(b, 64), h("b", {}, b.name), h("small", {}, b.teams))),
      h("div", { class: "mirror" }, bars), h("div", { class: "legend" }, h("span", {}, h("span", { class: "sw n" }), "measured on normal balls"), h("span", {}, h("span", { class: "sw p" }), "measured under pressure; the brighter number leads")), h("div", { class: "verdict-line", "aria-live": "polite" }, verdict), extra);
  }
  const apply = () => { role = F.role; roleNote.textContent = `Comparing ${role}. Use the filter bar to switch between batters and bowlers; the minimum pressure balls filter limits who can be searched.`; };
  root.replaceChildren(roleNote, h("div", { class: "cmp-pick" }, sa, sb), host);
  apply(); defaults();
  const hs = readHash(); if (hs.c) { const [x, y] = hs.c.split(","); if (D.byKey[x] && D.byKey[y]) { role = D.byKey[x].role_key; a = D.byKey[x]; b = D.byKey[y]; sa.set(a.name); sb.set(b.name); } }
  paint();
  onFilter(() => { if (F.role !== role) { apply(); defaults(); paint(); } else paint(); });
  window.__compareSet = (x, y) => { a = D.byKey[x]; b = D.byKey[y]; role = a.role_key; sa.set(a.name); sb.set(b.name); paint(); };
}
