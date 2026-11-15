// Section 7: the rankings (countdown reveal 10 to 1, dumbbell, full table). The official lists never change with filters.
import { $, h, f1, f2, f3, pct, fmt, signed, inView, reduceMotion, tableToggle, seasonSpan } from "../util.js";
import { D } from "../data.js";
import { avatar } from "../art.js";
import { dumbbell } from "../charts/scatter.js";
import { openPlayer } from "./card.js";

export function initRankings() {
  const root = $("#rank-ui"); if (!root || !D.top10.batters) return;
  let role = "batters", token = 0, revealed = { batters: false, bowlers: false };
  const seg = h("div", { class: "seg", role: "group", "aria-label": "Which list" }, h("button", { "aria-pressed": "true", "data-r": "batters" }, "Top 10 batters"), h("button", { "aria-pressed": "false", "data-r": "bowlers" }, "Top 10 bowlers"));
  const replay = h("button", { class: "btn ghost small" }, "Replay the countdown");
  const count = h("div", { class: "countdown", "aria-live": "polite" });
  const list = h("div", { class: "rank-list", role: "list" });
  const dbBox = h("div", { class: "chart-box" }), dbTitle = h("h3", { class: "chart-title" }), dbSeg = h("div", { class: "seg blue", role: "group", "aria-label": "Metric" });
  const tblHost = h("div", {}), dbTbl = h("div", {});
  let metric = 0, started = false;

  const pk = (r) => D.byKey[(r === "batters" ? "bt" : "bw") + 0];
  const P = (t) => D.byKey[(role === "batters" ? "bt" : "bw") + t.id];
  function card(t, i) {
    const p = P(t), bat = role === "batters", lo = D.stats[role].min, hi = D.stats[role].max, sp = hi - lo;
    const left = ((p.floor - lo) / sp) * 100, width = Math.max(1.5, ((p.p90 - p.floor) / sp) * 100), mark = ((p.rating - lo) / sp) * 100;
    return h("button", { class: "rcard hidden", role: "listitem", "data-rank": t.rank, onclick: () => openPlayer(p), "aria-label": `Number ${t.rank}, ${t.name}. Pressure rating ${f3(t.rating)}. Open player card.` },
      h("div", { class: "no num" }, String(t.rank)), avatar(p, 64),
      h("div", { class: "meta" }, h("h3", {}, t.name), h("div", { class: "tm" }, t.teams), p.role ? h("div", { class: "tm" }, p.role + (p.keeper ? ", wicketkeeper" : "")) : null),
      h("div", { class: "stats" },
        h("div", {}, h("span", { class: "k" }, "Pressure rating"), h("span", { class: "vv" }, f3(t.rating)), h("div", { class: "unc", role: "img", "aria-label": `Floor ${f3(t.floor)} to upper ${f3(t.p90)} across resamples` }, h("i", { style: { left: left + "%", width: width + "%" } }), h("b", { style: { left: mark + "%" } })), h("span", { class: "note" }, `floor ${f3(t.floor)} to ${f3(t.p90)}`)),
        h("div", {}, h("span", { class: "k" }, bat ? "Strike rate: normal to pressure" : "Economy: normal to pressure"), h("div", { class: "nvp" }, h("span", { class: "n" }, bat ? f1(p.sr_O) : f2(p.econ_O)), h("span", { "aria-hidden": "true" }, "→"), h("span", { class: "p" }, bat ? f1(p.sr_P) : f2(p.econ_P))), h("span", { class: "note" }, `${fmt(p.n_P)} pressure balls`)),
        h("div", {}, h("span", { class: "k" }, "Chance of a top-10 finish"), h("span", { class: "vv" }, pct(t.p_top10, 0)), h("span", { class: "note" }, `rank band ${f1(t.rank_p10)}-${f1(t.rank_p90)}`))));
  }
  async function reveal(instant) {
    const my = ++token, arr = D.top10[role]; list.replaceChildren(...arr.map(card)); const cards = [...list.children];
    const order = [...cards].reverse();
    if (instant || reduceMotion()) { cards.forEach((c) => { c.classList.remove("hidden"); c.classList.add("show"); }); count.textContent = ""; revealed[role] = true; return; }
    count.textContent = "Final over: counting down ..";
    for (const c of order) {
      if (my !== token) return;
      c.classList.remove("hidden"); c.classList.add("show"); count.textContent = c.dataset.rank === "1" ? "And the number one is .." : `Number ${c.dataset.rank}`;
      await new Promise((r) => setTimeout(r, c.dataset.rank === "2" ? 900 : 480));
    }
    if (my === token) { count.textContent = ""; revealed[role] = true; }
  }
  function drawDumbbell() {
    const bat = role === "batters", arr = D.top10[role];
    const defs = bat ? [["Strike rate", "sr", f1, "runs per 100 balls"], ["Runs index", "runs_index", (v) => fmt(v), "100 = as expected"]] : [["Economy", "econ", f2, "runs per over (lower is better)"], ["Economy index", "econ_index", (v) => fmt(v), "100 = as expected (higher is better)"], ["Wicket ratio", "wk_ratio", f2, "1.0 = as expected"]];
    metric = Math.min(metric, defs.length - 1); const [mn, key, fm, unit] = defs[metric];
    dbSeg.replaceChildren(...defs.map((d, i) => h("button", { "aria-pressed": String(i === metric), onclick: () => { metric = i; drawDumbbell(); } }, d[0])));
    const rows = arr.map((t) => { const p = P(t); return { rank: t.rank, label: t.name, n: p[key + "_O"], p: p[key + "_P"], p_: p, sub: `${fmt(p.n_P)} pressure balls` }; }).filter((r) => r.n != null && r.p != null);
    const better = rows.filter((r) => (key === "econ" ? r.p < r.n : r.p > r.n)).length;
    dbTitle.textContent = bat ? `${rows.filter((r) => r.p > r.n).length} of the ten ${key === "sr" ? "score faster" : "beat expectation by more"} under pressure than on normal balls.` : (key === "econ" ? `${rows.filter((r) => r.p < r.n).length} of the ten concede fewer runs per over under pressure than on normal balls.` : `${better} of the ten improve on their normal-ball ${mn.toLowerCase()} under pressure.`);
    dbBox.replaceChildren(); dumbbell(dbBox, rows, { fmt: fm, xLabel: `${mn}: normal (blue square) to pressure (pink circle), ${unit}`, onClick: (r) => openPlayer(r.p_) });
    dbTbl.replaceChildren(tableToggle(["Player", "Normal", "Pressure"], rows.map((r) => [r.label, fm(r.n), fm(r.p)]), "View as table"));
  }
  function drawTable() {
    const bat = role === "batters", all = D.pool[role];
    let sort = { k: "rank", dir: 1 };
    const cols = bat ? [["rank", "#"], ["name", "Player"], ["rating", "Rating"], ["floor", "Floor"], ["p90", "Upper"], ["baseline", "Baseline"], ["shift", "Shift"], ["n_P", "Pressure balls"], ["sr_O", "SR normal"], ["sr_P", "SR pressure"], ["p_top10", "P(top 10)"]]
      : [["rank", "#"], ["name", "Player"], ["rating", "Rating"], ["floor", "Floor"], ["p90", "Upper"], ["baseline", "Baseline"], ["shift", "Shift"], ["n_P", "Pressure balls"], ["econ_O", "Econ normal"], ["econ_P", "Econ pressure"], ["p_top10", "P(top 10)"]];
    const val = (p, k) => (k === "rank" ? (p.rank ?? 999 + (p.removed ? 1 : 2)) : p[k]);
    const body = h("tbody", {});
    const head = h("tr", {}, cols.map(([k, l]) => h("th", { scope: "col", "aria-sort": k === sort.k ? "ascending" : null }, h("button", { onclick: () => { sort = { k, dir: sort.k === k ? -sort.dir : (k === "name" ? 1 : k === "rank" ? 1 : -1) }; paint(); } }, l))));
    function paint() {
      const arr = [...all].sort((a, b) => { const x = val(a, sort.k), y = val(b, sort.k); return (typeof x === "string" ? x.localeCompare(y) : (x ?? -1e9) - (y ?? -1e9)) * sort.dir; });
      head.querySelectorAll("th").forEach((th, i) => th.setAttribute("aria-sort", cols[i][0] === sort.k ? (sort.dir > 0 ? "ascending" : "descending") : "none"));
      body.replaceChildren(...arr.map((p) => h("tr", { class: p.listed ? "top" : p.rank ? "" : "rem" },
        cols.map(([k]) => k === "name" ? h("td", { class: "name" }, h("button", { onclick: () => openPlayer(p) }, p.name), !p.rank ? h("div", { class: "note" }, p.removed ? "removed: negative pressure shift" : !p.active ? `not active in ${seasonSpan(D.meta.eligibility.active_years)}` : "") : null)
          : k === "rank" ? h("td", {}, p.rank ? String(p.rank) : "n/a") : h("td", { class: "num" }, k === "p_top10" ? (p[k] == null ? "n/a" : pct(p[k], 0)) : k === "n_P" ? fmt(p[k]) : k === "shift" ? signed(p[k], 4) : k.startsWith("sr") ? f1(p[k]) : k.startsWith("econ") ? f2(p[k]) : f3(p[k]))))));
    }
    paint();
    tblHost.replaceChildren(h("div", { class: "tbl-wrap", tabindex: "0", role: "region", "aria-label": `Every eligible ${bat ? "batter" : "bowler"}, sortable` }, h("table", { class: "t" }, h("thead", {}, head), body)));
  }
  function switchRole(r) {
    role = r; seg.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.r === r))); metric = 0;
    if (started) reveal(revealed[r]); drawDumbbell(); drawTable(); root.querySelector("#rank-sub").textContent = r === "batters" ? "Batters: highest floor of the pressure rating among eligible, active players." : "Bowlers: highest floor of the pressure rating among eligible, active players.";
  }
  seg.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) switchRole(b.dataset.r); });
  replay.addEventListener("click", () => reveal(false));
  root.replaceChildren(h("div", { class: "chart-tools" }, seg, replay), h("p", { class: "note", id: "rank-sub" }), count, list,
    h("div", { class: "panel", style: { marginTop: "30px" } }, dbTitle, h("p", { class: "how" }, "How to read this: each row is one of the ten. The blue square is the figure on normal balls, the pink circle the figure under pressure; the line between them is the change. Click a row for the player card."), h("div", { class: "chart-tools" }, dbSeg), dbBox, dbTbl),
    h("h3", { class: "chart-title", style: { margin: "30px 0 8px" } }, "Everyone who qualified, in one table"), h("p", { class: "how" }, "Sort any column. Pink rows are the official top 10. Greyed rows qualified but were removed from the ranking or were not active in " + seasonSpan(D.meta.eligibility.active_years) + "."), tblHost);
  switchRole("batters");
  inView(list, () => { started = true; reveal(false); }, { threshold: 0.12 });
}
