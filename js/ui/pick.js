// Section 2 (pick your finisher) and section 15 (your pick, revisited).
import { $, h, f1, f2, f3, pct, fmt } from "../util.js";
import { D } from "../data.js";
import { avatar } from "../art.js";
import { searchSelect } from "./search.js";
import { getPick, setPick, onPick } from "../state.js";
import { openPlayer } from "./card.js";

const opts = (role) => D.pool[role].map((p) => ({ key: p.key, label: p.name, sub: p.teams }));

function slot(role, key) {
  const p = key && D.byKey[key];
  return p ? [avatar(p, 84), h("div", { class: "who" }, h("div", { class: "note" }, role === "batters" ? "Your finisher on strike" : "Your bowler for the last over"), h("h3", {}, p.name), h("div", { class: "note" }, p.teams || ""))]
    : [h("div", { class: "note" }, role === "batters" ? "Pick the batter you trust on strike." : "Pick the bowler you trust with the ball.")];
}

export function initPick() {
  const root = $("#pick-ui"); if (!root) return;
  const bSlot = h("div", { class: "pick-slot", "aria-live": "polite" }), wSlot = h("div", { class: "pick-slot", "aria-live": "polite" });
  const paint = () => { const pk = getPick(); bSlot.replaceChildren(...slot("batters", pk.bat)); wSlot.replaceChildren(...slot("bowlers", pk.bowl)); };
  const bSel = searchSelect({ label: "Choose your batter", placeholder: "Search a batter ..", getOptions: () => opts("batters"), onSelect: (o) => setPick({ bat: o.key }) });
  const wSel = searchSelect({ label: "Choose your bowler", placeholder: "Search a bowler ..", getOptions: () => opts("bowlers"), onSelect: (o) => setPick({ bowl: o.key }) });
  root.replaceChildren(h("div", { class: "pick-grid" }, h("div", { class: "stack" }, h("label", { class: "fld", for: bSel.input.id }, "Who do you want on strike?"), bSel, bSlot), h("div", { class: "stack" }, h("label", { class: "fld", for: wSel.input.id }, "Who bowls it?"), wSel, wSlot)),
    h("p", { class: "note", style: { marginTop: "14px" } }, "Your picks are remembered in this browser and in the page address. Scroll to the end of the page to see where the model ranks them."));
  const pk = getPick(); if (pk.bat && D.byKey[pk.bat]) bSel.set(D.byKey[pk.bat].name); if (pk.bowl && D.byKey[pk.bowl]) wSel.set(D.byKey[pk.bowl].name);
  paint(); onPick(paint);
}

function rankLine(p) {
  if (p.listed) return `Official #${p.listed} of 10`;
  if (p.rank) return `Ranked ${p.rank} of ${D.meta.ranked_pool_batters && p.role_key === "batters" ? D.meta.ranked_pool_batters : D.meta.ranked_pool_bowlers} in the ranked pool, outside the top 10`;
  if (p.removed) return "Eligible, but removed from the ranking: the pressure shift is reliably negative";
  if (!p.active) return `Eligible, but not active in ${D.meta.eligibility.active_years.join(" or ")}`;
  return "Eligible";
}

export function initRevisit() {
  const root = $("#revisit-ui"); if (!root) return;
  const paint = () => {
    const pk = getPick(), picks = [["batters", pk.bat], ["bowlers", pk.bowl]].map(([r, k]) => k && D.byKey[k]).filter(Boolean);
    if (!picks.length) { root.replaceChildren(h("div", { class: "reveal-card" }, h("p", { class: "bigq" }, "You did not pick a finisher at the start."), h("a", { class: "btn", href: "#pick" }, "Pick them now"))); return; }
    root.replaceChildren(h("div", { class: "cards-row" }, picks.map((p) => {
      const top = D.top10[p.role_key][0], topP = D.byKey[(p.role_key === "batters" ? "bt" : "bw") + top.id];
      const diff = p.rating - topP.rating;
      return h("div", { class: "reveal-card stack" }, h("div", { class: "top", style: { display: "flex", gap: "14px", alignItems: "center" } }, avatar(p, 88), h("div", {}, h("div", { class: "note" }, p.role_key === "batters" ? "Your finisher" : "Your last-over bowler"), h("h3", {}, p.name))),
        h("div", { class: "bigq" }, rankLine(p)),
        h("p", {}, `Pressure rating ${f3(p.rating)} (floor ${f3(p.floor)}). The model's number 1 ${p.role_key === "batters" ? "batter" : "bowler"}, ${topP.name}, has ${f3(topP.rating)}${p.key === topP.key ? "" : `, a gap of ${f3(Math.abs(diff))}`}.`),
        h("button", { class: "btn", onclick: () => openPlayer(p) }, "Open the player card"));
    })), h("p", { class: "note", style: { marginTop: "12px" } }, "Change your pick any time in the opening section."));
  };
  paint(); onPick(paint);
}
