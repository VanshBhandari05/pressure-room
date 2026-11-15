// Section 13: can you trust it? Bump chart, survivors, stability scatter, split-half, and the "what if pressure started here?" explorer.
import { $, h, f1, f2, f3, fmt, pct, signed, note, inView, tableToggle, seasonSpan } from "../util.js";
import { D, F, onFilter, get, P } from "../data.js";
import { bump, scatter } from "../charts/scatter.js";
import { openPlayer } from "./card.js";

const lbl = (k) => (k === "main" ? `Top ${P().pressure_top_pct}% (chosen)` : "Top " + k.replace("cutoff_top", ""));
const VNAME = { IPL_only: "IPL matches only", T20I_only: "T20I matches only", benchmark_pressure_index: "Published pressure index instead", benchmark_rule_of_thumb: "Rule-of-thumb pressure instead", "cutoff_top10%": "Cutoff: top 10%", "cutoff_top15%": "Cutoff: top 15%", "cutoff_top25%": "Cutoff: top 25%", "cutoff_top30%": "Cutoff: top 30%", cutoff_within_innings: "Cutoff set within each innings", lower_tier_included: "Associate and A-team matches also rate", no_cutoff_log_leverage: "No cutoff: log leverage", position_band_in_context: "Batting position added", recency_2yr_half_life: "Recent seasons weigh more", winsorised_values_1_99: "Extreme ball values capped" };

export async function initTrust() {
  const root = $("#trust-ui"); if (!root) return;
  const [rob, bins] = await Promise.all([get("robustness.json"), Promise.resolve(null)]);
  if (!rob) { note(root, "The robustness file is unavailable, so this section is hidden."); return; }
  let role = "batters";
  const SPAN = `${P().season_split_year + 1}-${String(D.meta.seasons[D.meta.seasons.length - 1]).slice(2)}`;
  const seg = h("div", { class: "seg", role: "group", "aria-label": "Robustness for" }, h("button", { "aria-pressed": "true", "data-r": "batters" }, "Batters"), h("button", { "aria-pressed": "false", "data-r": "bowlers" }, "Bowlers"));
  const host = h("div", {});
  seg.addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; role = b.dataset.r; seg.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); paint(); });
  const nm = (id) => (D.byKey[(role === "batters" ? "bt" : "bw") + id] || {}).name || String(id);
  function paint() {
    const R = rob.roles[role], off = R.official_top10, noun = role === "batters" ? "batters" : "bowlers";
    const cutVars = R.variants.filter((v) => v.variant.startsWith("cutoff_top")), surv = cutVars.map((v) => v.overlap_final), byName = (n) => R.variants.find((v) => v.variant === n);
    const counters = h("div", { class: "counter-row" }, ...cutVars.map((v) => h("div", { class: "bigstat" }, h("div", { class: "v num" }, `${v.overlap_final} of 10`), h("div", { class: "l" }, `survive when pressure = ${lbl(v.variant)} of live balls`))),
      ...["IPL_only", "T20I_only"].map((k) => h("div", { class: "bigstat" }, h("div", { class: "v num" }, `${byName(k).overlap_final} of 10`), h("div", { class: "l" }, `survive if rated on ${k === "IPL_only" ? "IPL" : "T20I"} matches only`))));
    const lines = Object.entries(R.ranks).map(([id, r]) => ({ id: +id, name: r.name, short: r.name.split(" ").slice(-1)[0], top: off.includes(+id), ranks: r })).filter((l) => l.top || Object.values(l.ranks).some((v) => typeof v === "number" && v <= 10));
    const cols = R.cutoff_columns.map((k) => ({ key: k, label: lbl(k), short: k === "main" ? `${P().pressure_top_pct}%*` : k.replace("cutoff_top", ""), main: k === "main" }));
    const bumpBox = h("div", { class: "chart-box" });
    const topK = [3, 2, 1].find((k) => { const S = new Set(lines.filter((l) => (l.ranks.main ?? 99) <= k).map((l) => l.id)); return S.size === k && lines.every((l) => cols.every((c) => (l.ranks[c.key] ?? 99) > k || S.has(l.id))); }) || 0, topStable = topK >= 1;
    const s2 = rob.season_to_season.find((x) => x.role === role), sc = rob.season_scatter && rob.season_scatter[role];
    const scBox = h("div", { class: "chart-box" });
    const sh = rob.split_half.filter((x) => x.role === role);
    host.replaceChildren(
      h("h3", { class: "chart-title" }, `Across the tested cutoffs, ${Math.min(...surv)} to ${Math.max(...surv)} of the ten ${noun} stay in the top 10.`), h("p", { class: "how" }, "How to read this: the pressure line was moved from the top 10% to the top 30% of live balls and everyone was re-rated. The counters say how many of the official ten still finish in the top 10 each time."),
      counters,
      h("div", { class: "panel", style: { marginTop: "18px" } }, h("h3", { class: "chart-title" }, topStable ? topK > 1 ? `Across the cutoffs the same top ${topK} stay on top (their order can swap); the rest of the list reshuffles.` : "The same number one stays on top across the cutoffs; the rest of the list reshuffles." : "Moving the cutoff reshuffles the list."), h("p", { class: "how" }, "How to read this: one line per player, rank on the vertical axis (1 at the top), one column per cutoff. Pink = official top 10; dashed blue = a player who reaches the top 10 under some other cutoff. Variant ranks use the pipeline's floor proxy over all eligible players."), bumpBox,
        tableToggle(["Player", ...cols.map((c) => c.label)], lines.sort((a, b) => (a.ranks.main ?? 99) - (b.ranks.main ?? 99)).map((l) => [l.name + (l.top ? " (official)" : ""), ...cols.map((c) => l.ranks[c.key] ?? "n/a")]), "View ranks as a table"),
        h("p", { class: "note" }, R.proxy_note)),
      h("div", { class: "grid2", style: { marginTop: "18px" } },
        h("div", { class: "panel" }, h("h3", { class: "chart-title" }, role === "batters" ? `Season to season, batter ratings do not carry over (r = ${f2(s2.r)}).` : `Season to season, bowler ratings carry over reasonably (r = ${f2(s2.r)}).`), h("p", { class: "how" }, `How to read this: each dot is a player with enough pressure balls in both periods (${s2.players} players). Horizontal = rating fitted on matches up to 2024, vertical = rating on 2025-26. A tight diagonal cloud would mean persistence. 95% interval for r: ${f2(s2.ci_lo)} to ${f2(s2.ci_hi)}.`), scBox, h("p", { class: "note" }, rob.season_scatter_note || "")),
        h("div", { class: "panel" }, h("h3", { class: "chart-title" }, "The rating is repeatable; a separate clutch trait is not."), h("p", { class: "how" }, `Split-half reliability: matches are split at random into two halves, each half rates the players, and the ratings are correlated (${P().split_half_n} splits, Spearman-Brown corrected).`),
          h("div", { class: "tbl-wrap" }, h("table", { class: "t", style: { minWidth: "0" } }, h("thead", {}, h("tr", {}, ["Quantity", "Reliability", "Sd over splits"].map((x) => h("th", {}, x)))), h("tbody", {}, sh.map((x) => h("tr", {}, h("td", {}, x.quantity), h("td", { class: "num" }, f2(x.corrected_r)), h("td", { class: "num" }, f2(x.sd))))))),
          h("p", { class: "note", style: { marginTop: "10px" } }, "The pressure shift on its own is the least repeatable number: what the lists measure is proven quality in live, high-leverage situations."))),
      h("div", { class: "panel", style: { marginTop: "18px" } }, h("h3", { class: "chart-title" }, "Every sensitivity variant we ran"), h("p", { class: "how" }, "Each row re-rates everyone under one change with the penalties fixed. 'Same as final' counts players shared with the submitted top 10; 'Same as main' is the pipeline's own overlap on its floor proxy; tau is Kendall rank correlation over the whole pool."),
        h("div", { class: "tbl-wrap" }, h("table", { class: "t" }, h("thead", {}, h("tr", {}, ["Variant", "Same as final", "Same as main", "Tau"].map((x) => h("th", {}, x)))), h("tbody", {}, R.variants.map((v) => h("tr", {}, h("td", {}, VNAME[v.variant] || v.variant), h("td", { class: "num" }, `${v.overlap_final} of 10`), h("td", { class: "num" }, `${v.overlap_pipeline} of 10`), h("td", { class: "num" }, f3(v.tau)))))))));
    scBox.replaceChildren(); bumpBox.replaceChildren();
    bump(bumpBox, cols, lines, 16, (ln) => { const p = D.byKey[(role === "batters" ? "bt" : "bw") + ln.id]; if (p) openPlayer(p); });
    if (sc) scatter(scBox, { points: sc.points.map((p) => ({ id: p.id, x: p.early, y: p.late, r: 40, label: p.name, short: p.name.split(" ").slice(-1)[0], top: off.includes(p.id), tip: `<b>${p.name}</b><br>up to ${P().season_split_year}: ${f3(p.early)}<br>${SPAN}: ${f3(p.late)}`, aria: `${p.name}: ${f3(p.early)} then ${f3(p.late)}` })),
      xLabel: `Rating, matches up to ${P().season_split_year}`, yLabel: `Rating, ${SPAN}`, diag: true, height: 340, onClick: (pt) => { const q = D.byKey[(role === "batters" ? "bt" : "bw") + pt.id]; if (q) openPlayer(q); } });
    else scBox.append(h("div", { class: "note" }, "Season scatter unavailable."));
  }
  root.replaceChildren(h("div", { class: "chart-tools" }, seg), host);
  paint();
}

// ----------------------------------------------------------------- explorer: what if pressure started here?
export async function initExplorer() {
  const root = $("#explorer-ui"); if (!root) return;
  const bins = await get("player_pressure_bins.json");
  if (!bins) { note(root, "The explorer data is unavailable. See the precomputed alternatives above instead."); return; }
  let cband = 5;                          // first pressure band; 5 = the official cutoff
  const edges = bins.edges, role = () => F.role;
  const slider = h("input", { type: "range", min: 1, max: 9, step: 1, value: cband, id: "ex-slider", "aria-label": "Pressure starts at this leverage" });
  const lab = h("div", { class: "val num", "aria-live": "polite" }), sub = h("div", { class: "note" }), out = h("div", {});
  const sig = (r) => bins.roles[r].sigma2;
  function simple(r, c) {
    const R = bins.roles[r], pids = Object.keys(R.players), out = {};
    const n0 = [], m0 = [], n1 = [], m1 = [];
    for (const p of pids) { const q = R.players[p]; let a = 0, av = 0, b = 0, bv = 0; for (let i = 0; i < 10; i++) { if (i < c) { a += q.n[i]; av += q.v[i]; } else { b += q.n[i]; bv += q.v[i]; } } n0.push(a); m0.push(a ? av / a : 0); n1.push(b); m1.push(b ? bv / b : 0); }
    const k = (m, n) => { const idx = n.map((x, i) => (x > 20 ? i : -1)).filter((i) => i >= 0); const mu = idx.reduce((s, i) => s + m[i], 0) / idx.length, vr = idx.reduce((s, i) => s + (m[i] - mu) ** 2, 0) / (idx.length - 1), inv = idx.reduce((s, i) => s + 1 / n[i], 0) / idx.length; return sig(r) / Math.max(vr - sig(r) * inv, 1e-6); };
    const kb = k(m0, n0), base = n0.map((n, i) => (n / (n + kb)) * m0[i]), diff = m1.map((m, i) => m - base[i]), kc = k(diff, n1);
    pids.forEach((p, i) => { out[+p] = { rating: base[i] + (n1[i] / (n1[i] + kc)) * diff[i], n1: n1[i] }; });
    return out;
  }
  function paint() {
    const r = role(), c = cband, noun = r === "batters" ? "batters" : "bowlers", pool = D.pool[r].filter((p) => p.rank), sr = simple(r, c);
    const R = bins.roles[r], tot = Object.values(R.players).reduce((s, q) => s + q.n.reduce((a, b) => a + b, 0), 0), pr = Object.values(R.players).reduce((s, q) => s + q.n.slice(c).reduce((a, b) => a + b, 0), 0);
    const lv = edges[c - 1];
    lab.textContent = `Pressure = leverage of ${f2(lv)} or more`;
    sub.textContent = `${pct(pr / tot, 0)} of live balls count as pressure balls at this setting${c === 5 ? " (the official cutoff)" : ""}.`;
    const ranked = pool.filter((p) => sr[p.id]).sort((a, b) => sr[b.id].rating - sr[a.id].rating), simpleRank = new Map(ranked.map((p, i) => [p.id, i + 1]));
    const top = ranked.slice(0, 10), offIds = new Set(D.top10[r].map((t) => t.id)), same = top.filter((p) => offIds.has(p.id)).length;
    const row = (p, i, side) => h("div", { class: "mrow " + (side === "x" && !offIds.has(p.id) ? "in" : "") }, h("span", { class: "r num" }, String(i)), h("button", { onclick: () => openPlayer(p) }, p.name),
      side === "o" ? h("span", { class: "d" }, `explorer rank ${simpleRank.get(p.id) ?? "n/a"}`) : h("span", { class: "d" }, `official ${p.listed ? "#" + p.listed : p.rank ? "rank " + p.rank : "n/a"}`));
    out.replaceChildren(h("h3", { class: "chart-title" }, `${same} of the official ten ${noun} are still in this explorer's top 10 at this setting.`),
      h("div", { class: "movers" }, h("div", { class: "panel pad-s" }, h("h4", { class: "chart-title", style: { fontSize: "1.25rem" } }, "Official list (never changes)"), D.top10[r].map((t) => row(D.byKey[(r === "batters" ? "bt" : "bw") + t.id], t.rank, "o"))),
        h("div", { class: "panel pad-s" }, h("h4", { class: "chart-title", style: { fontSize: "1.25rem" } }, "Exploratory list at this cutoff"), top.map((p, i) => row(p, i + 1, "x")))));
  }
  slider.addEventListener("input", () => { cband = +slider.value; paint(); });
  onFilter(paint);
  root.replaceChildren(h("div", { class: "panel" }, h("span", { class: "sim-tag" }, "Exploratory view, simplified recomputation"), h("p", { class: "how", style: { marginTop: "8px" } },
    "Drag the slider to change where pressure starts. For each cutoff the browser recomputes every player's average ball value on normal and pressure balls and shrinks both toward average with the same method as the pipeline's cross-check rating. It differs from the official rating in three ways: no opposition adjustment (no regression), no bootstrap floor, and the pool is fixed to the official ranked pool. At the official cutoff it matches the pipeline's own simple cross-check exactly; it will not match the official order exactly."),
    h("div", { class: "ctrl" }, h("div", { class: "row" }, h("label", { for: "ex-slider" }, "Where does pressure start?"), lab), slider, h("div", { class: "note", style: { display: "flex", justifyContent: "space-between" } }, h("span", {}, "earlier: more balls count"), h("span", {}, "later: only the tightest balls count"))), sub, out));
  paint();
}
