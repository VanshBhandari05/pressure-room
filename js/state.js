// Shareable state in the URL hash (#p=bt4260&c=bt4260,bt1699&pick=bt4260,bw781) and the remembered finisher pick.
const listeners = new Set();
export function readHash() {
  const out = {}; const raw = location.hash.replace(/^#/, "");
  if (!raw || !raw.includes("=")) return out;
  for (const part of raw.split("&")) { const [k, v] = part.split("="); if (k) out[k] = decodeURIComponent(v || ""); }
  return out;
}
export function setHash(patch) {
  const cur = readHash(); Object.assign(cur, patch);
  const str = Object.entries(cur).filter(([, v]) => v != null && v !== "").map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%2C/g, ",")}`).join("&");
  history.replaceState(null, "", str ? "#" + str : location.pathname + location.search);
}
export const onHash = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
window.addEventListener("hashchange", () => listeners.forEach((fn) => fn(readHash())));

// finisher pick: { bat: "bt4260", bowl: "bw781" }, kept in the URL hash and (when allowed) localStorage
const LS = "pressure-room-pick";
let pick = { bat: null, bowl: null };
const pickSubs = new Set();
export function loadPick() {
  try { const v = JSON.parse(localStorage.getItem(LS) || "null"); if (v) pick = { ...pick, ...v }; } catch (e) { /* storage unavailable */ }
  const h = readHash(); if (h.pick) { const [b, w] = h.pick.split(","); if (b) pick.bat = b; if (w) pick.bowl = w; }
  return pick;
}
export const getPick = () => pick;
export function setPick(patch) {
  pick = { ...pick, ...patch };
  try { localStorage.setItem(LS, JSON.stringify(pick)); } catch (e) { /* ignore */ }
  setHash({ pick: [pick.bat || "", pick.bowl || ""].join(",") === "," ? null : [pick.bat || "", pick.bowl || ""].join(",") });
  pickSubs.forEach((fn) => fn(pick));
}
export const onPick = (fn) => { pickSubs.add(fn); return () => pickSubs.delete(fn); };
