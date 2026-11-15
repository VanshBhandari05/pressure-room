// Section 1: hero with counters and the two teaser badges.
import { $, h, FORMATS, countUp, inView } from "../util.js";
import { D } from "../data.js";
import { heroArt, avatar } from "../art.js";
import { openPlayer } from "./card.js";

export function initHero() {
  $("#hero-art").replaceChildren(heroArt());
  const m = D.meta; if (!m) return;
  const defs = [["balls_analysed", "Balls analysed"], ["matches_clean", "Matches"], ["pressure_balls_all", "Pressure balls found"], ["players", "Players rated"]];
  const wrap = $("#counters"); wrap.replaceChildren();
  for (const [k, label] of defs) {
    const val = k === "players" ? m.eligible_batters + m.eligible_bowlers : m[k];
    const v = h("div", { class: "v num", "aria-label": `${label}: ${val}` }, "0");
    wrap.append(h("div", { class: "counter" }, v, h("div", { class: "l" }, label)));
    inView(wrap, () => countUp(v, val), { threshold: 0.3 });
  }
  const tz = $("#teasers"); tz.replaceChildren();
  for (const role of ["batters", "bowlers"]) {
    const t = D.top10[role] && D.top10[role][0]; if (!t) continue;
    const p = D.byKey[(role === "batters" ? "bt" : "bw") + t.id];
    tz.append(h("button", { class: "teaser", onclick: () => openPlayer(p), "aria-label": `Open card for number one ${role === "batters" ? "batter" : "bowler"}, ${t.name}` }, avatar(p, 54), h("span", {}, h("small", {}, role === "batters" ? "Number 1 batter" : "Number 1 bowler"), h("b", {}, t.name))));
  }
  const dv = (k) => { const e = $(`[data-b="${k}"]`); return e; };
}
