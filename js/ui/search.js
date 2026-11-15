// Accessible search-select (combobox): type to filter, arrow keys to move, Enter to choose.
import { h } from "../util.js";

let uid = 0;
// getOptions(): [{key, label, sub}] ; onSelect(option)
export function searchSelect({ getOptions, onSelect, placeholder = "Search a player", label = "Search", value = "" }) {
  const id = "ss" + ++uid, input = h("input", { type: "search", id, placeholder, autocomplete: "off", role: "combobox", "aria-expanded": "false", "aria-controls": id + "-l", "aria-autocomplete": "list", "aria-label": label, value });
  const list = h("ul", { id: id + "-l", role: "listbox", hidden: true });
  const wrap = h("div", { class: "ss" }, input, list);
  let opts = [], idx = -1;
  const close = () => { list.hidden = true; input.setAttribute("aria-expanded", "false"); idx = -1; };
  const paint = () => [...list.children].forEach((li, i) => { li.setAttribute("aria-selected", i === idx ? "true" : "false"); if (i === idx) li.scrollIntoView({ block: "nearest" }); });
  const choose = (o) => { input.value = o.label; close(); onSelect(o); };
  const open = () => {
    const q = input.value.trim().toLowerCase(), all = getOptions();
    opts = (q && !wrap.dataset.fresh ? all.filter((o) => o.label.toLowerCase().includes(q)) : all).slice(0, 60);
    list.replaceChildren(...opts.map((o, i) => h("li", { role: "option", id: `${id}-o${i}`, "aria-selected": "false", onmousedown: (e) => { e.preventDefault(); choose(o); } }, h("span", {}, o.label), o.sub ? h("small", {}, o.sub) : null)));
    if (!opts.length) list.replaceChildren(h("li", { role: "option", "aria-disabled": "true" }, "No player found"));
    list.hidden = false; input.setAttribute("aria-expanded", "true"); idx = -1;
  };
  input.addEventListener("focus", () => { wrap.dataset.fresh = "1"; input.select(); open(); });
  input.addEventListener("input", () => { delete wrap.dataset.fresh; open(); });
  input.addEventListener("blur", () => setTimeout(close, 120));
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); if (list.hidden) open(); idx = Math.min(opts.length - 1, idx + 1); paint(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); idx = Math.max(0, idx - 1); paint(); }
    else if (e.key === "Enter") { if (idx >= 0 && opts[idx]) { e.preventDefault(); choose(opts[idx]); } else if (opts.length === 1) choose(opts[0]); }
    else if (e.key === "Escape") close();
    if (idx >= 0) input.setAttribute("aria-activedescendant", `${id}-o${idx}`);
  });
  wrap.set = (text) => { input.value = text; };
  wrap.input = input;
  return wrap;
}
