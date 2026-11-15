// Browser-side evaluator of the pipeline's pressure score (leverage index, LI).
// It does not re-implement the win-probability model: it reads the pipeline's own value for each exact match state
// from data/pressure_tables.bin.gz (reference context: IPL, medium-scoring venue, impact-player era).
let T = null;      // {li2, wp2, li1, wp1, model}
let loading = null;

async function gunzip(buf) {
  if (typeof DecompressionStream === "undefined") throw new Error("This browser cannot decompress the pressure tables (DecompressionStream missing).");
  const stream = new Response(buf).body.pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export function load(base = "data/") {
  if (loading) return loading;
  loading = (async () => {
    const model = await (await fetch(base + "pressure_model.json")).json();
    const raw = await gunzip(await (await fetch(base + model.tables.file)).arrayBuffer());
    const n = raw.length / 2, hi = raw.subarray(0, n), lo = raw.subarray(n);
    const u16 = new Uint16Array(n);
    for (let i = 0; i < n; i++) u16[i] = (hi[i] << 8) | lo[i];
    const L = model.tables.layout; let off = 0; const parts = {};
    for (const part of L) { parts[part.name] = u16.subarray(off, off + part.len); off += part.len; }
    T = { li2: parts.LI2, wp2: parts.WP2, li1: parts.LI1, wp1: parts.WP1, model };
    return model;
  })();
  return loading;
}

export function ranges() { return T.model.tables.ranges; }

// innings 2: x = runs still required (1..200); innings 1: x = current score (0..260)
export function evaluate(innings, ballsLeft, wicketsLost, x) {
  const m = T.model, r = m.tables.ranges, sc = m.tables.scale;
  const b = Math.min(r.balls_left[1], Math.max(r.balls_left[0], Math.round(ballsLeft)));
  const w = Math.min(r.wickets_lost[1], Math.max(r.wickets_lost[0], Math.round(wicketsLost)));
  let li, wp;
  if (innings === 2) {
    const xx = Math.min(r.runs_required[1], Math.max(r.runs_required[0], Math.round(x)));
    const i = ((b - 1) * 10 + w) * (r.runs_required[1]) + (xx - 1);
    li = T.li2[i] / sc.LI; wp = T.wp2[i] / sc.WP;
  } else {
    const xx = Math.min(r.score_innings1[1], Math.max(r.score_innings1[0], Math.round(x)));
    const i = ((b - 1) * 10 + w) * (r.score_innings1[1] + 1) + xx;
    li = T.li1[i] / sc.LI; wp = T.wp1[i] / sc.WP;
  }
  const live = wp > m.live_low && wp < m.live_high;
  return { li, wp, live, pressure: live && li >= m.cutoff_LI, cutoff: m.cutoff_LI };
}
export const model = () => T && T.model;
