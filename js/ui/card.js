// Player card (section 8): modal opened from anywhere on the site.
import { $, h, s, f1, f2, f3, fmt, pct, signed, bindTip, tip, seasonSpan } from "../util.js";
import { D, detail, percentile, P } from "../data.js";
import { avatar } from "../art.js";
import { pairedBars, lineChart } from "../charts/bars.js";
import { setHash } from "../state.js";

let bg, box, lastFocus;
export function initCard() {
  bg = h("div", { class: "modal-bg", id: "modal", role: "dialog", "aria-modal": "true", "aria-label": "Player card" });
  bg.addEventListener("mousedown", (e) => { if (e.target === bg) closeCard(); });
  document.body.append(bg);
  document.addEventListener("keydown", (e) => {
    if (!bg.classList.contains("open")) return;
    if (e.key === "Escape") closeCard();
    if (e.key === "Tab") { const f = [...bg.querySelectorAll("button,[href],input,select,[tabindex]:not([tabindex='-1'])")].filter((x) => !x.disabled && x.offsetParent !== null); if (!f.length) return; const first = f[0], last = f[f.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } }
  });
}
export function closeCard(updateHash = true) {
  if (!bg || !bg.classList.contains("open")) return;
  bg.classList.remove("open"); bg.replaceChildren(); document.body.style.overflow = ""; tip.hide();
  if (updateHash) setHash({ p: null });
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
}
const PH = [["powerplay", "Powerplay (1-6)"], ["middle", "Middle (7-15)"], ["death", "Death (16-20)"]];

export async function openPlayer(p, { hash = true } = {}) {
  if (!p) return;
  lastFocus = document.activeElement; if (hash) setHash({ p: p.key });
  const bat = p.role_key === "batters";
  const close = h("button", { class: "btn ghost small x", "aria-label": "Close player card", onclick: () => closeCard() }, "Close");
  box = h("div", { class: "modal", tabindex: "-1" }, close);
  const rankTxt = p.listed ? `Official #${p.listed}` : p.rank ? `Pool rank ${p.rank}` : p.removed ? "Removed: reliably negative pressure shift" : !p.active ? `Not active in ${seasonSpan(D.meta.eligibility.active_years)}` : "Eligible";
  box.append(h("div", { class: "pc-head" }, avatar(p, 92), h("div", {},
    h("h2", { id: "pc-title" }, p.name), h("div", { class: "note" }, p.teams || ""),
    h("div", { class: "chips" }, h("span", { class: "chip pink" }, rankTxt), h("span", { class: "chip" }, bat ? "Batter" : "Bowler"), p.role ? h("span", { class: "chip" }, p.role) : null, p.keeper ? h("span", { class: "chip" }, "Wicketkeeper") : null, p.dup_name ? h("span", { class: "chip" }, "Name shared by two player ids") : null))));
  const stat = (k, v, sub) => h("div", {}, h("div", { class: "k" }, k), h("div", { class: "vv" }, v), sub ? h("div", { class: "note" }, sub) : null);
  box.append(h("div", { class: "pc-stats" },
    stat("Pressure rating", f3(p.rating), `floor ${f3(p.floor)}, upper ${f3(p.p90)}`), stat("Baseline", f3(p.baseline), `rank ${p.baseline_rank ?? "n/a"} of active pool`), stat("Pressure shift", signed(p.shift, 4), "rating minus baseline"),
    stat("Pressure balls", fmt(p.n_P), `${fmt(p.matches_P)} matches`), stat("IPL / T20I", `${fmt(p.p_ipl)} / ${fmt(p.p_t20i)}`, "pressure balls"), p.p_top10 != null ? stat("Top-10 chance", pct(p.p_top10, 0), `rank band ${f1(p.rank_p10)}-${f1(p.rank_p90)}`) : null));
  const loadingEl = h("div", { class: "note" }, "Loading player detail ..");
  box.append(loadingEl);
  bg.replaceChildren(box); bg.classList.add("open"); document.body.style.overflow = "hidden"; bg.setAttribute("aria-labelledby", "pc-title"); close.focus();

  const det = await detail(p);
  if (!bg.classList.contains("open")) return;
  if (!det) { loadingEl.replaceWith(h("div", { class: "fail" }, "Detail file for this player is unavailable.")); }
  else {
    const metric = (c) => (bat ? (c.n ? (100 * c.r) / c.n : null) : c.n ? (6 * c.r) / c.n : null);   // strike rate / economy
    const mname = bat ? "Strike rate" : "Economy";
    const items = PH.map(([k, lab]) => ({ label: lab, n: metric(det.phase[k].O), p: metric(det.phase[k].P), fmt: bat ? f1 : f2,
      sub: `${fmt(det.phase[k].O.n)} normal and ${fmt(det.phase[k].P.n)} pressure ${bat ? "balls" : "legal balls"}` }));
    const comp = Object.entries(det.competition).map(([k, v]) => ({ label: k, n: metric(v.O), p: metric(v.P), fmt: bat ? f1 : f2, sub: `${fmt(v.O.n)} normal and ${fmt(v.P.n)} pressure balls` }));
    const phaseBox = h("div", {}), compBox = h("div", {}), lineBox = h("div", { class: "chart-box" });
    pairedBars(phaseBox, items); pairedBars(compBox, comp);
    const yrs = Object.keys(det.season), ser = (c) => ({ name: c === "O" ? "Normal" : "Pressure", cls: c === "O" ? "n" : "p", pts: yrs.map((y, i) => ({ x: i, y: det.season[y][c].vn >= P().min_season_balls_shown ? det.season[y][c].v : null, n: det.season[y][c].vn })) });
    lineChart(lineBox, yrs, [ser("O"), ser("P")], "mean ball value");
    const moments = h("ul", { class: "tl" }, det.moments.map((m) => h("li", {}, h("b", {}, new Date(m.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })), ` v ${m.opp}`,
      h("div", {}, `${m.comp}, innings ${m.innings}. Peak moment: over ${m.peak_over}, ${m.peak_wickets} down, ${m.innings === 2 && m.peak_need != null ? `${m.peak_need} needed off ${m.peak_balls_left}` : `${m.peak_balls_left} balls left`}, pressure score ${f1(m.peak_LI)}.`),
      h("div", { class: "note" }, bat ? `Under pressure: ${m.runs} off ${m.balls} balls${m.out ? ", dismissed" : ", not dismissed on those balls"}; ${m.pressure_balls} pressure balls.` : `Under pressure: ${m.conceded} runs off ${m.balls} legal balls, ${m.wickets} wicket${m.wickets === 1 ? "" : "s"}; ${m.pressure_balls} pressure deliveries.`),
      h("div", { class: "note" }, m.result))));
    const strips = (bat ? [["rating", "Pressure rating"], ["baseline", "Baseline"], ["sr_P", "Strike rate under pressure"], ["dism_ratio_P", "Dismissal ratio (lower is better)", true]]
      : [["rating", "Pressure rating"], ["baseline", "Baseline"], ["econ_P", "Economy under pressure (lower is better)", true], ["wk_ratio_P", "Wicket ratio under pressure"]]).map(([f, lab, inv]) => {
      let pc = percentile(p, f); if (pc == null) return null; if (inv) pc = 1 - pc + 1 / D.pool[p.role_key].length;
      return h("div", {}, h("div", { class: "note" }, `${lab}: better than ${pct(Math.min(1, pc), 0)} of ${D.pool[p.role_key].length} eligible ${bat ? "batters" : "bowlers"}`),
        h("div", { class: "strip", role: "img", "aria-label": `${lab} percentile ${Math.round(pc * 100)}` }, h("div", { class: "tr" }), h("div", { class: "dot", style: { left: Math.min(100, pc * 100) + "%" } }), h("div", { class: "sl" }, h("span", {}, "lowest"), h("span", {}, "highest"))));
    });
    loadingEl.replaceWith(h("div", {},
      h("div", { class: "pc-grid" },
        h("div", {}, h("h3", { class: "chart-title" }, `${mname} by phase: does the ${bat ? "batter lift" : "bowler hold"} when it tightens?`), h("p", { class: "how" }, "Blue = normal balls, pink = pressure balls, same phase."), phaseBox),
        h("div", {}, h("h3", { class: "chart-title" }, "IPL against T20I"), h("p", { class: "how" }, `${mname}, normal against pressure, by competition.`), compBox)),
      h("div", { class: "pc-grid", style: { marginTop: "18px" } },
        h("div", {}, h("h3", { class: "chart-title" }, "Season by season"), h("p", { class: "how" }, `Average win-probability value per ball (above zero beats an average player in the same situation). Seasons with fewer than ${P().min_season_balls_shown} balls are left out.`), lineBox,
          h("div", { class: "legend" }, h("span", {}, h("span", { class: "sw n" }), "Normal (dashed, squares)"), h("span", {}, h("span", { class: "sw p" }), "Pressure (solid, circles)"))),
        h("div", {}, h("h3", { class: "chart-title" }, "Three highest-pressure moments"), h("p", { class: "how" }, "The matches where the balls they faced or bowled carried the most total pressure."), moments)),
      h("h3", { class: "chart-title", style: { margin: "18px 0 6px" } }, "Where they stand among all eligible players"), h("div", { class: "pc-grid" }, strips.filter(Boolean))));
  }
}
