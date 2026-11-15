// Section 6: how a player is rated (three steps, worked example from the #1 player in each list).
import { $, h, f1, f2, f3, pct, fmt, term, signed, ord } from "../util.js";
import { D, P } from "../data.js";
import { avatar } from "../art.js";

export function initRating() {
  const root = $("#rating-ui"); if (!root || !D.meta) return;
  const m = D.meta, el = m.eligibility;
  let role = "batters";
  const ratio = P().lambda_C / P().lambda_B;
  const seg = h("div", { class: "seg", role: "group", "aria-label": "Worked example" }, h("button", { "aria-pressed": "true", "data-r": "batters" }, "Batting example"), h("button", { "aria-pressed": "false", "data-r": "bowlers" }, "Bowling example"));
  const host = h("div", {});
  const T = {
    baseline: term("baseline", "A player's average value per ball on ordinary balls, compared with an average player in the same situation against the same opposition. Zero is average; higher is better."),
    shift: term("pressure shift", "How much better or worse the player is on pressure balls than their own baseline predicts. It is shrunk hard toward zero because a pressure record is thin."),
    floor: term("floor", `The ${ord(P().floor_pct)} percentile of the player's rating across ${P().bootstrap_n} resamples of whole matches. Players are ranked on this, so a thin record is penalised.`),
    sr: term("strike rate", "Runs scored per 100 balls faced."), econ: term("economy", "Runs conceded per six legal balls (one over)."),
    ri: term("runs index", "100 times the runs actually scored over the runs an average batter would be expected to score off the same balls. Above 100 is better than expected."),
    dr: term("dismissal ratio", "Actual dismissals divided by expected dismissals on the same balls. Below 1 is better than expected."),
    wr: term("wicket ratio", "Actual bowler-credited wickets divided by expected wickets on the same balls. Above 1 is better than expected."),
    ei: term("economy index", "100 times the runs an average bowler would be expected to concede over the runs actually conceded. Above 100 is better than expected."),
    dv: term("delivery rate", `Share of matches (with ${P().delivery_min_balls} or more pressure balls) in which the player's total value was positive.`),
  };
  function paint() {
    const t = D.top10[role][0], p = D.byKey[(role === "batters" ? "bt" : "bw") + t.id], bat = role === "batters";
    const span = Math.max(p.p90, p.rating, p.baseline) * 1.05;
    const bar = h("div", { style: { position: "relative", height: "34px", background: "rgba(37,74,165,.3)", borderRadius: "8px", margin: "10px 0 28px" }, role: "img", "aria-label": `Baseline ${f3(p.baseline)} plus shift ${signed(p.shift, 4)} equals rating ${f3(p.rating)}, floor ${f3(p.floor)}` },
      h("div", { style: { position: "absolute", left: 0, top: 0, bottom: 0, width: (p.baseline / span) * 100 + "%", background: "var(--rr-blue)", borderRadius: "8px 0 0 8px" } }),
      h("div", { style: { position: "absolute", left: (p.baseline / span) * 100 + "%", top: 0, bottom: 0, width: Math.max(0.6, (Math.abs(p.shift) / span) * 100) + "%", background: "var(--rr-pink)", backgroundImage: "repeating-linear-gradient(135deg,rgba(255,255,255,.55) 0 2px,transparent 2px 6px)" } }),
      h("div", { style: { position: "absolute", left: (p.floor / span) * 100 + "%", top: "-6px", bottom: "-6px", width: "3px", background: "#fff" } }),
      h("div", { style: { position: "absolute", left: (p.floor / span) * 100 + "%", top: "40px", fontSize: ".72rem", whiteSpace: "nowrap", transform: "translateX(-50%)", color: "var(--paper)" } }, `floor ${f3(p.floor)}`));
    host.replaceChildren(
      h("div", { class: "step" },
        h("div", { class: "s" }, h("div", { class: "n" }, "1"), h("h4", {}, "Baseline"), h("p", {}, "Every ball gets a value: the change in win probability it caused, minus what a typical player does in the identical situation, divided by how much the ball could swing. A ", T.baseline, " is a player's average value per ball on ordinary balls, with the opposition's quality removed."), h("div", { class: "ex badge-n" }, `${p.name}: ${f3(p.baseline)}`)),
        h("div", { class: "s" }, h("div", { class: "n" }, "2"), h("h4", {}, "Pressure performance"), h("p", {}, "The same value, measured only on pressure balls. The ", T.shift, " says how far the player moves from their own baseline when the ball matters. It is shrunk ${ratio} times harder than the baseline, so a few balls cannot make a reputation."), h("div", { class: "ex badge-p" }, `${p.name}: ${signed(p.shift, 4)}`)),
        h("div", { class: "s" }, h("div", { class: "n" }, "3"), h("h4", {}, "Adjusted rating"), h("p", {}, "Rating = baseline + pressure shift. Players are ranked on the ", T.floor, " of that rating, not the rating itself, so a strong but thin record cannot jump the queue."), h("div", { class: "ex" }, `${p.name}: ${f3(p.rating)} (floor ${f3(p.floor)})`))),
      h("div", { class: "panel", style: { marginTop: "16px" } }, h("div", { style: { display: "flex", gap: "14px", alignItems: "center" } }, avatar(p, 64), h("div", {}, h("h3", { class: "chart-title" }, `Worked example: ${p.name}, official number 1 ${bat ? "batter" : "bowler"}`), h("div", { class: "note" }, `${fmt(p.n_P)} pressure ${bat ? "balls" : "deliveries"} over ${fmt(p.matches_P)} matches`))), bar,
        h("div", { class: "legend" }, h("span", {}, h("span", { class: "sw n" }), "baseline (normal balls)"), h("span", {}, h("span", { class: "sw p" }), "pressure shift"), h("span", {}, "white tick: floor, the number players are ranked on")),
        h("p", { class: "how", style: { marginTop: "6px" } }, bat ? ["On the balls themselves: ", T.sr, ` ${f1(p.sr_O)} on normal balls and ${f1(p.sr_P)} under pressure; ${T.ri} ${fmt(p.runs_index_P)}; ${T.dr} ${f2(p.dism_ratio_P)}; ${T.dv} ${pct(p.delivery_rate, 0)}.`]
          : ["On the balls themselves: ", T.econ, ` ${f2(p.econ_O)} on normal balls and ${f2(p.econ_P)} under pressure; ${T.ei} ${fmt(p.econ_index_P)}; ${T.wr} ${f2(p.wk_ratio_P)}; ${T.dv} ${pct(p.delivery_rate, 0)}.`])),
      h("div", { class: "grid2", style: { marginTop: "16px" } },
        h("div", { class: "panel" }, h("h4", { class: "chart-title" }, "Who counts, and how small samples are handled"), h("ul", { class: "note", style: { paddingLeft: "18px", margin: 0 } },
          h("li", {}, `A player must have faced or bowled at least ${fmt(el.min_pressure_balls)} pressure balls over at least ${fmt(el.min_matches)} matches: ${fmt(m.eligible_batters)} batters and ${fmt(m.eligible_bowlers)} bowlers qualify.`),
          h("li", {}, `A player must also have appeared in ${el.active_years.join(" or ")}, because the lists inform the next auction.`),
          h("li", {}, `Anyone whose pressure shift is reliably negative (its ${ord(P().neg_shift_pct)} percentile below zero) is removed from the ranking.`),
          h("li", {}, `Ridge shrinkage pulls thin records toward average; the shift is penalised ${ratio} times harder than the baseline.`),
          h("li", {}, "Ties on floor break on delivery rate, then pressure balls."))),
        h("div", { class: "panel" }, h("h4", { class: "chart-title" }, "IPL and T20I together"), h("ul", { class: "note", style: { paddingLeft: "18px", margin: 0 } },
          h("li", {}, `${fmt(m.matches_rated)} matches rate players: ${fmt(m.matches_rated_ipl)} IPL and ${fmt(m.matches_rated_t20i)} full-member T20I. Associate and A-team matches help fit the scoring model but never rate a player.`),
          h("li", {}, "One model rates both competitions, with a competition term in its context, so there is a single leaderboard."),
          h("li", {}, "Opposition quality is adjusted inside the same regression: runs against a strong attack earn more credit."),
          h("li", {}, "Rating IPL-only or T20I-only changes the lists more than any other check (see the trust section).")))));
  }
  seg.addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; role = b.dataset.r; seg.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); paint(); });
  root.replaceChildren(h("div", { class: "chart-tools" }, seg), host); paint();
}
