// Section 14: limits. Every number comes from the data files.
import { $, h, f2, fmt, pct, note } from "../util.js";
import { D, get, P } from "../data.js";
import { icon } from "../art.js";

export async function initLimits() {
  const root = $("#limits-ui"); if (!root || !D.meta) return;
  const m = D.meta, rob = await get("robustness.json");
  const s2 = rob && rob.season_to_season.find((x) => x.role === "batters"), shiftSh = rob && rob.split_half.filter((x) => x.quantity === "pressure shift");
  const items = [
    ["wall", `Pressure here is mostly a live chase. Only ${fmt(m.pressure_balls_innings1_rated)} of ${fmt(m.pressure_balls_rated)} pressure balls in the rated matches come from the first innings, so the ratings are close to ratings of performance in live chases.`],
    ["scale", rob ? `A separate clutch trait is not reliably measurable. The pressure shift alone repeats poorly across random halves of the matches (${shiftSh.map((x) => `${f2(x.corrected_r)} for ${x.role}`).join(" and ")}), and batter ratings do not carry over from ${D.meta.seasons[0]}-${String(P().season_split_year).slice(2)} to ${P().season_split_year + 1}-${String(D.meta.seasons[D.meta.seasons.length - 1]).slice(2)} (r = ${f2(s2.r)}).` : "A separate clutch trait is not reliably measurable in this data."],
    ["users", `The pools are short: only ${fmt(m.eligible_batters)} batters and ${fmt(m.eligible_bowlers)} bowlers meet the rule of ${fmt(m.eligibility.min_pressure_balls)} pressure balls over ${fmt(m.eligibility.min_matches)} matches, so the lists are the top of small pools.`],
    ["eye", "Win probability is team-neutral and venue is not in the rating regression. A dropped catch helps the batter and hurts the bowler, and captains give the hardest overs to players they trust, so who faces pressure is not random."],
    ["clock", "Rebuilt team scores are partly imputed because bye and leg-bye runs are missing, no World Cup or knockout sample exists for tournament pressure, and one bowler sign check was amended after the results were seen (the original list is in the report appendix)."],
  ];
  root.replaceChildren(h("div", { class: "limits" }, items.map(([ic, t]) => h("div", { class: "limit" }, icon(ic), h("p", {}, t)))));
}
