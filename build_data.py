"""Build every JSON file the website reads, from the SupeRR pipeline outputs.

Run from anywhere:   python -I website/build_data.py
Reads  : ../outputs/*, ../config.yaml, ../FINAL_LOCK.md, ../submission_sheet.csv and (locally, never published) the supplied CSVs.
Writes : website/data/*.json, website/data/pressure_tables.bin.gz, website/data/player_detail/<id>.json, website/data/CHECKS.md
Nothing here changes a rule, a rating or a ranking: every figure is a read-out or a new aggregation of existing results.
The raw ball-by-ball file is never copied; only small derived aggregates are written.
"""
import datetime as dt
import gzip
import hashlib
import json
import pickle
import re
import shutil
import sys
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
import yaml

warnings.filterwarnings("ignore")
SITE = Path(__file__).resolve().parent
ROOT = SITE.parent
OUT = ROOT / "outputs"
DATA = SITE / "data"
sys.path.insert(0, str(ROOT / "src"))
import wp_engine as E  # noqa: E402  (pipeline code, used unchanged)
import rating_model as RM  # noqa: E402

CFG = yaml.safe_load(open(ROOT / "config.yaml", encoding="utf-8-sig"))
RAT = CFG["rating"]
CHECKS = []           # (status, text) lines for CHECKS.md


def check(ok, text):
    CHECKS.append(("PASS" if ok else "FAIL", text))
    if not ok:
        print("CHECK FAILED:", text)
    return ok


def rnd(x, d=3):
    if x is None:
        return None
    try:
        if isinstance(x, (float, np.floating)) and not np.isfinite(x):
            return None
        return round(float(x), d)
    except Exception:
        return x


def jdump(obj, name, indent=None):
    p = DATA / name
    p.parent.mkdir(parents=True, exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        json.dump(obj, f, separators=(",", ":") if indent is None else None, indent=indent, ensure_ascii=False, allow_nan=False)
    return p


def md_tables(text):
    """Parse every pipe table in a markdown string -> list of DataFrames (strings)."""
    out, cur = [], []
    for ln in text.splitlines() + [""]:
        if ln.strip().startswith("|"):
            cur.append(ln.strip())
        elif cur:
            rows = [[c.strip() for c in r.strip("|").split("|")] for r in cur]
            if len(rows) >= 2:
                out.append(pd.DataFrame(rows[2:], columns=rows[0]))
            cur = []
    return out


# --------------------------------------------------------------------------------------------- reset output folder
if DATA.exists():
    shutil.rmtree(DATA)
DATA.mkdir(parents=True)

# --------------------------------------------------------------------------------------------- load pipeline frames
print("loading pipeline outputs ...", flush=True)
bs = pd.read_parquet(OUT / "balls_state.parquet")
bp = pd.read_parquet(OUT / "balls_pressure.parquet", columns=["match_id", "innings", "innings_ball_num", "oc", "wp_star", "swing", "LI", "live", "pressure"])
bs = bs.merge(bp, on=["match_id", "innings", "innings_ball_num"], how="left", validate="1:1")
TH = json.load(open(OUT / "pressure_thresholds.json"))
mf = pd.read_csv(OUT / "matches_flags.csv")
teams = pd.read_csv(ROOT / "teams.csv").drop_duplicates("team_id").set_index("team_id").team_name
mp = pd.read_csv(ROOT / "competition_team_player_mapping.csv")
names = mp.drop_duplicates("player_id").set_index("player_id").player_name
pe = pd.read_csv(ROOT / "playing_eleven.csv")
bat_v = pd.read_parquet(OUT / "ball_values_bat.parquet")
bowl_v = pd.read_parquet(OUT / "ball_values_bowl.parquet")
CUT = float(TH["p80"])

ROLES = ("batters", "bowlers")
ratings = {r: pd.read_csv(OUT / f"unfiltered_eligible_{r}.csv") for r in ROLES}     # all eligible players (53 / 56), incl. removed and inactive
ranked = {r: pd.read_csv(OUT / f"eligible_table_{r}.csv") for r in ROLES}           # eligible, active, not reliably negative (the ranked pool)
top10 = {r: pd.read_csv(OUT / f"top10_{r}.csv") for r in ROLES}
allrat = {r: pd.read_csv(OUT / f"player_ratings_{r}.csv") for r in ROLES}           # every player with any rows (for the explorer's shrinkage)

# --------------------------------------------------------------------------------------------- Check 0: lock hashes
lock = (ROOT / "FINAL_LOCK.md").read_text(encoding="utf-8")
for fn in ("config.yaml", "outputs/top10_batters.csv", "outputs/top10_bowlers.csv"):
    h = hashlib.sha256((ROOT / fn).read_bytes()).hexdigest()
    check(h in lock, f"SHA-256 of {fn} matches FINAL_LOCK.md ({h[:12]}...)")

# --------------------------------------------------------------------------------------------- meta.json
raw_rows = sum(1 for _ in open(ROOT / "ball_by_ball.csv", "rb")) - 1                # row count only; the file itself is never copied
raw_matches = pd.read_csv(ROOT / "ball_by_ball.csv", usecols=["match_id"]).match_id.nunique()
clean_m = mf[mf.clean]
rs_m = mf[mf.in_rating_sample]
live_rs = bs[bs.in_rating_sample & bs.live]
meta = {
    "build_date": dt.date.today().isoformat(),
    "raw_rows": int(raw_rows), "raw_matches": int(raw_matches),
    "balls_analysed": int(len(bs)), "matches_clean": int(bs.match_id.nunique()),
    "innings": int(bs.groupby(["match_id", "innings"]).ngroups),
    "matches_rated": int(len(rs_m)), "matches_rated_ipl": int((rs_m.group == "IPL").sum()), "matches_rated_t20i": int((rs_m.group != "IPL").sum()),
    "seasons": sorted(int(y) for y in bs.year.unique()),
    "competitions": int(clean_m.comp_id.nunique()), "ipl_editions": int(clean_m[clean_m.group == "IPL"].comp_id.nunique()),
    "live_balls_rated": int(len(live_rs)), "pressure_balls_rated": int(live_rs.pressure.sum()),
    "share_pressure_of_live_rated": float(live_rs.pressure.mean()),
    "pressure_balls_all": int(bs.pressure.sum()), "share_pressure_of_all": float(bs.pressure.mean()),
    "live_balls_all": int(bs.live.sum()),
    "eligible_batters": int(len(ratings["batters"])), "eligible_bowlers": int(len(ratings["bowlers"])),
    "ranked_pool_batters": int(len(ranked["batters"])), "ranked_pool_bowlers": int(len(ranked["bowlers"])),
    "players_with_any_rows_batters": int(len(allrat["batters"])), "players_with_any_rows_bowlers": int(len(allrat["bowlers"])),
    "eligibility": {"min_pressure_balls": RAT["eligibility"]["min_pressure_balls"], "min_matches": RAT["eligibility"]["min_matches"], "active_years": RAT["active_years"]},
    "pressure_cutoff_LI": CUT, "live_wp_band": [TH["live_low"], TH["live_high"]],
    "params": {"bootstrap_n": RAT["bootstrap_n"], "floor_pct": int(round(100 * RAT["floor_quantile"])), "neg_shift_pct": int(round(100 * RAT["negative_shift_quantile"])),
               "pressure_top_pct": int(round(100 * (1 - CFG["pressure"]["pressure_quantile"]))), "pressure_percentile": int(round(100 * CFG["pressure"]["pressure_quantile"])),
               "lambda_B": json.load(open(OUT / "stage4_choices.json"))["lambda_B"], "lambda_C": json.load(open(OUT / "stage4_choices.json"))["lambda_C"],
               "split_half_n": CFG["stage6"]["split_half_n"], "season_split_year": CFG["stage6"]["season_split_year"], "delivery_min_balls": 6,
               "min_season_balls_shown": 15},
    "pressure_balls_innings1_rated": int(live_rs[live_rs.innings == 1].pressure.sum()),
    "pressure_balls_innings2_rated": int(live_rs[live_rs.innings == 2].pressure.sum()),
}
jdump(meta, "meta.json", indent=1)
check(meta["balls_analysed"] == 193076 and meta["matches_rated"] == 728 and meta["pressure_balls_rated"] == 31263,
      f"meta counts match the report (193,076 clean balls, 728 rated matches, 31,263 rated pressure balls): {meta['balls_analysed']:,} / {meta['matches_rated']} / {meta['pressure_balls_rated']:,}")

# --------------------------------------------------------------------------------------------- pressure tables (lookup for the on-page meter)
print("pressure tables ...", flush=True)
M = pickle.load(open(OUT / "stage2_model.pkl", "rb"))
m1, m2, bands, recal, RUNS, N_MAX = M["m1"], M["m2"], M["bands"], M["recal"], M["runs"], M["n_max"]
Z = np.load(OUT / "wp_surfaces.npz")
EPS = CFG["calibration"]["wp_clip"]
REF = {"group": 0, "group_name": "IPL", "tier": 1, "tier_name": "medium-scoring venue", "impact": 1, "impact_name": "impact-player era (2023 onward)"}
key = f"g{REF['group']}_t{REF['tier']}_i{REF['impact']}"
wp2 = Z[f"wp2_{key}"].astype(np.float64)
Dd = Z[f"D_{key}"].astype(np.float64)
R_MAX = int(bs.score_before.max()) + 10
wp1 = E.wp1_table(Dd, wp2[120, 0].copy(), R_MAX)
N2 = 200                      # runs required covered by the chase table: 1..200
R1 = 261                      # first-innings score covered: 0..260
mean_swing = TH["mean_swing_live"]


def li_table_chase():
    b, w, n = np.meshgrid(np.arange(1, 121), np.arange(10), np.arange(1, N2 + 1), indexing="ij")
    bb, ww, nn = b.ravel(), w.ravel(), n.ravel()
    X = bands.design(E.over_from_balls_left(bb), ww, np.full(bb.size, REF["tier"]), np.full(bb.size, REF["impact"]), np.full(bb.size, REF["group"]), nn * 6.0 / bb)
    P = m2.predict_proba(X)
    star0 = E.apply_recal(wp2[bb, ww, nn], recal[2]["a"], recal[2]["c"], EPS)
    sw = np.zeros(bb.size)
    for k in range(10):
        b2 = bb - (1 if k < 7 else 0); w2 = ww + (1 if k == 0 else 0); n2 = nn - int(RUNS[k])
        raw2 = wp2[b2, np.minimum(w2, 10), np.clip(n2, 0, N_MAX)]
        term = (n2 <= 0) | (b2 == 0) | (w2 == 10)
        s2 = np.where(term, raw2, E.apply_recal(raw2, recal[2]["a"], recal[2]["c"], EPS))
        sw += P[:, k] * np.abs(s2 - star0)
    return (sw / mean_swing).reshape(120, 10, N2), star0.reshape(120, 10, N2)


def li_table_first():
    b, w, r = np.meshgrid(np.arange(1, 121), np.arange(10), np.arange(R1), indexing="ij")
    bb, ww, rr = b.ravel(), w.ravel(), r.ravel()
    X = bands.design(E.over_from_balls_left(bb), ww, np.full(bb.size, REF["tier"]), np.full(bb.size, REF["impact"]), np.full(bb.size, REF["group"]))
    P = m1.predict_proba(X)
    star0 = E.apply_recal(wp1[bb, ww, rr], recal[1]["a"], recal[1]["c"], EPS)
    sw = np.zeros(bb.size)
    for k in range(10):
        b2 = bb - (1 if k < 7 else 0); w2 = ww + (1 if k == 0 else 0)
        raw1 = wp1[b2, np.minimum(w2, 10), np.minimum(rr + int(RUNS[k]), R_MAX)]
        sw += P[:, k] * np.abs(E.apply_recal(raw1, recal[1]["a"], recal[1]["c"], EPS) - star0)
    return (sw / mean_swing).reshape(120, 10, R1), star0.reshape(120, 10, R1)


LI2, WP2 = li_table_chase()
LI1, WP1 = li_table_first()
SC_LI, SC_WP = 1000, 10000
u16 = lambda a, s: np.clip(np.round(a * s), 0, 65535).astype("<u2")
arrs = [u16(LI2, SC_LI), u16(WP2, SC_WP), u16(LI1, SC_LI), u16(WP1, SC_WP)]
check(max(a.max() for a in (LI2, LI1)) * SC_LI < 65535, f"largest tabulated leverage {max(LI2.max(), LI1.max()):.2f} fits the 16-bit encoding")
flat = np.concatenate([a.ravel() for a in arrs])
raw_bytes = flat.tobytes()
planes = np.frombuffer(raw_bytes, dtype=np.uint8).reshape(-1, 2)
shuffled = np.concatenate([planes[:, 1], planes[:, 0]]).tobytes()          # high-byte plane then low-byte plane: compresses much better
with open(DATA / "pressure_tables.bin.gz", "wb") as f:
    f.write(gzip.compress(shuffled, 9, mtime=0))
sizes = [a.size for a in arrs]

# validation fixture: real balls in the reference context, to be compared with the table (Python here, browser in tests)
ctx_mask = (bs.group == "IPL") & (bs.env_tier == REF["tier"]) & (bs.impact_rule == bool(REF["impact"]))
ref_balls = bs[ctx_mask].copy()
rng = np.random.default_rng(CFG["seed"])


def lookup(inn, b, w, x):
    """Python twin of js/pressure.js: returns (LI, WP) from the stored 16-bit tables."""
    if inn == 2:
        i = ((b - 1) * 10 + w) * N2 + (x - 1)
        return arrs[0].ravel()[i] / SC_LI, arrs[1].ravel()[i] / SC_WP
    i = ((b - 1) * 10 + w) * R1 + x
    return arrs[2].ravel()[i] / SC_LI, arrs[3].ravel()[i] / SC_WP


ok_rows = ref_balls[((ref_balls.innings == 2) & (ref_balls.runs_required <= N2) & (ref_balls.runs_required >= 1) & (ref_balls.wickets_lost <= 9)) |
                    ((ref_balls.innings == 1) & (ref_balls.score_before < R1) & (ref_balls.wickets_lost <= 9))]
sample = ok_rows.sample(n=min(2000, len(ok_rows)), random_state=CFG["seed"])
diff = []
fixture = []
for r in sample.itertuples():
    x = int(r.runs_required) if r.innings == 2 else int(r.score_before)
    li, wp = lookup(int(r.innings), int(r.balls_left), int(r.wickets_lost), x)
    diff.append(abs(li - r.LI))
    fixture.append([int(r.innings), int(r.balls_left), int(r.wickets_lost), x, round(float(r.LI), 6), round(float(r.wp_star), 6), bool(r.live), bool(r.pressure)])
diff = np.array(diff)
check(diff.max() <= 0.0006, f"pressure-table lookup reproduces the pipeline's leverage on {len(diff):,} random real balls (reference context): max abs error {diff.max():.5f}")
flag_ok = np.mean([((f[4] >= CUT) and (f[6])) == f[7] for f in fixture])
check(flag_ok >= 0.998, f"pressure flag from the table equals the pipeline flag on {flag_ok:.2%} of those balls (only ball-by-ball rounding at the cutoff can differ)")
(SITE / "tools").mkdir(exist_ok=True); json.dump(fixture, open(SITE / "tools" / "pressure_fixture.json", "w"))       # fixture for tools/verify_js.py (browser-side check)

# real match situations used as meter presets (reference context), chosen by stated rules
cb = ref_balls[(ref_balls.innings == 2) & ref_balls.live & (ref_balls.runs_required >= 1) & (ref_balls.runs_required <= N2) & (ref_balls.wickets_lost <= 9)]
def _pre(row, label, why):
    return {"label": label, "rule": why, "innings": 2, "balls_left": int(row.balls_left), "wickets_lost": int(row.wickets_lost), "runs_required": int(row.runs_required), "match_id": int(row.match_id)}
st = cb[(cb.balls_left == 120) & (cb.wickets_lost == 0)]
_mid = st.runs_required.median()
presets = [
    _pre(st.iloc[(st.runs_required - _mid).abs().argsort().iloc[0]], "Chase begins", "first ball of a chase at the median target in the reference context"),
    _pre(cb[cb.pressure & (cb.LI >= cb[cb.pressure].LI.median())].sort_values("LI").iloc[0], "A typical pressure ball", "the pressure ball whose leverage is the median among pressure balls"),
    _pre(cb.loc[cb.LI.idxmax()], "The tightest moment", "the highest-leverage ball in the reference context"),
    _pre(cb[(~cb.pressure) & (cb.balls_left <= 30)].sort_values("LI").iloc[int(((~cb.pressure) & (cb.balls_left <= 30)).sum() // 2)], "Late but settled", "a non-pressure live ball with 30 or fewer balls left, median leverage"),
]

pm = {
    "what": "Pressure = leverage. LI(s) = swing(s) / mean swing over live balls, swing(s) = sum over 10 next-ball outcomes o of p(o|s) * |WP*(after o) - WP*(s)|.",
    "pressure_rule": f"A ball is a pressure ball when it is live (win probability between {TH['live_low']} and {TH['live_high']}) and LI >= {CUT:.4f} (the 80th percentile of live balls, pooled over both innings).",
    "cutoff_LI": CUT, "cutoff_percentile": meta["params"]["pressure_percentile"], "median_LI": TH["median"], "p95_LI": TH["p95"], "mean_swing_live": TH["mean_swing_live"],
    "live_low": TH["live_low"], "live_high": TH["live_high"],
    "outcome_classes": E.CLASS_NAMES, "class_runs": TH["runs"],
    "engine": {
        "next_ball_model": "multinomial logistic regression, 10 outcome classes; features: over band, wickets lost, required-rate band (chase), venue scoring level, competition group, impact-player rule",
        "win_probability": "exact backward induction over match states, then recalibrated: WP* = logistic(a + c * logit(WP_raw))",
        "recalibration": {"innings1": recal[1], "innings2": recal[2]},
        "monotone_projection_chase": bool(M["use_projection"]),
    },
    "reference_context": REF,
    "presets": presets,
    "tables": {
        "file": "pressure_tables.bin.gz",
        "encoding": "gzip of a byte-shuffled little-endian uint16 buffer: all high bytes, then all low bytes",
        "scale": {"LI": SC_LI, "WP": SC_WP},
        "layout": [
            {"name": "LI2", "len": sizes[0], "shape": [120, 10, N2], "index": "((balls_left-1)*10 + wickets_lost)*200 + (runs_required-1)"},
            {"name": "WP2", "len": sizes[1], "shape": [120, 10, N2], "index": "same as LI2"},
            {"name": "LI1", "len": sizes[2], "shape": [120, 10, R1], "index": "((balls_left-1)*10 + wickets_lost)*261 + score"},
            {"name": "WP1", "len": sizes[3], "shape": [120, 10, R1], "index": "same as LI1"},
        ],
        "ranges": {"balls_left": [1, 120], "wickets_lost": [0, 9], "runs_required": [1, N2], "score_innings1": [0, R1 - 1]},
    },
    "note": "The pipeline's pressure score is the output of a fitted win-probability model, so it cannot be written as a short closed formula. The page evaluates it by looking up the pipeline's own value for each exact match state in the reference context.",
}
jdump(pm, "pressure_model.json", indent=1)

# --------------------------------------------------------------------------------------------- pressure_grid.json
g = bs.copy()
g["w"] = g.wickets_lost.clip(0, 9)
grid = {}
for inn in (1, 2):
    d = g[g.innings == inn]
    cells = d.groupby(["overid", "w"]).agg(balls=("LI", "size"), live=("live", "sum"), pressure=("pressure", "sum")).reset_index()
    ml = d[d.live].groupby(["overid", "w"]).LI.mean().rename("mean_li").reset_index()
    cells = cells.merge(ml, on=["overid", "w"], how="left")
    grid[f"innings{inn}"] = [[int(r.overid), int(r.w), int(r.balls), int(r.live), int(r.pressure), rnd(r.mean_li, 3)] for r in cells.itertuples()]
    byover = d.groupby("overid").agg(balls=("LI", "size"), live=("live", "sum"), pressure=("pressure", "sum")).reset_index()
    grid[f"innings{inn}_by_over"] = [[int(r.overid), int(r.balls), int(r.live), int(r.pressure)] for r in byover.itertuples()]
jdump({"cols": ["over", "wickets_down", "balls", "live_balls", "pressure_balls", "mean_LI_live"], "by_over_cols": ["over", "balls", "live_balls", "pressure_balls"],
       "note": "All 808 clean matches. mean_LI_live is the average leverage of live balls only; pressure_balls counts live balls at or above the cutoff.", **grid}, "pressure_grid.json")

# --------------------------------------------------------------------------------------------- pressure_distribution.json
edges = np.linspace(0, 4, 41)
live_all = bs[bs.live]
dist = {"top_pct": meta["params"]["pressure_top_pct"], "edges": edges.tolist(), "cutoff": CUT, "median": TH["median"], "p95": TH["p95"], "overflow_label": "last bin = 3.9 and above"}
for name, d in (("all", live_all), ("innings1", live_all[live_all.innings == 1]), ("innings2", live_all[live_all.innings == 2])):
    h, _ = np.histogram(np.clip(d.LI.values, 0, 3.9999), bins=edges)
    dist[name] = h.tolist()
jdump(dist, "pressure_distribution.json")
check(sum(dist["all"]) == int(bs.live.sum()), f"histogram counts all {int(bs.live.sum()):,} live balls")

# ================================================================ players, details, bins, robustness, omissions, XI, checks
from scipy.stats import norm, spearmanr  # noqa: E402

print("league split ...", flush=True)
# --------------------------------------------------------------------------------------------- live rating-sample frame (same recipe as stage4)
d = bs[bs.live & bs.in_rating_sample].copy()
d["over"] = E.over_from_balls_left(d.balls_left)
S3 = CFG["stage3"]
d["phase"] = np.select([d.over <= S3["phase_bounds"][0], d.over <= S3["phase_bounds"][1]], [0, 1], 2)
d["P"] = d.pressure.astype(int)
d["comp"] = np.where(d.group == "IPL", "IPL", "T20I")
d["st_out"] = d.is_wicket & (d.dismissed_player_id == d.striker_id) & ~d.dismissal_type.isin(list(RM.NOT_CHARGED))
d["cred"] = d.is_wicket & d.dismissal_type.isin(list(RM.BOWLER_CREDITED))
d["bnd"] = d.is_four | d.is_six
d["dotb"] = d.oc == 1
d["conceded"] = d.runs + (d.is_wide | d.is_noball).astype(int)
PH = ["powerplay", "middle", "death"]

# --------------------------------------------------------------------------------------------- league_split.json
def lg_metrics(x):
    """League-wide rates for a set of live balls."""
    f = x[~x.is_wide]
    legal = int(x.is_legal.sum())
    w = int(x.cred.sum())
    return {"balls": int(len(f)), "deliveries": int(len(x)),
            "sr": rnd(100 * f.runs.sum() / max(len(f), 1), 1),
            "dismissal_pct": rnd(100 * f.st_out.sum() / max(len(f), 1), 2),
            "dot_pct": rnd(100 * f.dotb.sum() / max(len(f), 1), 1),
            "boundary_pct": rnd(100 * f.bnd.sum() / max(len(f), 1), 1),
            "economy": rnd(6 * x.conceded.sum() / max(legal, 1), 2),
            "balls_per_wicket": rnd(legal / w, 1) if w else None, "wickets": w}


def split_block(x):
    return {"normal": lg_metrics(x[x.P == 0]), "pressure": lg_metrics(x[x.P == 1])}


league = {"definition": "Live balls of the 728 rated matches. Pressure = leverage at or above the cutoff; normal = every other live ball. Rates are raw (not standardised); strike rate, dot and boundary shares are per ball faced (wides excluded), dismissal rate is striker dismissals per ball faced, economy is runs conceded per six legal balls, balls per wicket counts bowler-credited wickets.",
          "overall": split_block(d), "innings2_only": split_block(d[d.innings == 2]),
          "by_phase": {PH[i]: split_block(d[d.phase == i]) for i in range(3)},
          "by_competition": {c: split_block(d[d.comp == c]) for c in ("IPL", "T20I")},
          "by_phase_innings2": {PH[i]: split_block(d[(d.phase == i) & (d.innings == 2)]) for i in range(3)}}
s3 = (OUT / "audit_stage3.md").read_text(encoding="utf-8")
t3 = md_tables(s3)
sep = [t for t in t3 if "diff_pressure_minus_ordinary" in t.columns][0]
league["separation"] = [{"phase": r.phase, "metric": r.metric, "diff": float(r.diff_pressure_minus_ordinary), "lo": float(r.ci_lo), "hi": float(r.ci_hi), "excludes_zero": r.excludes_zero == "True"} for r in sep.itertuples()]
league["separation_note"] = "Pressure minus ordinary live balls inside strata of innings x phase x wickets band, weighted by pressure balls per stratum; 95% intervals from 300 resamples of whole matches (pipeline stage 3). Rates are fractions of balls (runs: runs per ball)."
jdump(league, "league_split.json")

# --------------------------------------------------------------------------------------------- player attributes
print("player tables ...", flush=True)
pe_played = pe[pe.is_played.astype(str).str.lower() == "true"].copy()
pe_played["is_wk"] = pe_played.is_wk.astype(str).str.lower() == "true"
wk_share = pe_played.groupby("player_id").is_wk.mean()
dups = mp.groupby("player_name").player_id.nunique()
dup_names = set(dups[dups > 1].index)


def team_cell(df, pid, id_col, tm_col):
    out = []
    for is_ipl in (True, False):
        sub = df[(df.group == "IPL") == is_ipl]
        sub = sub[sub[id_col] == pid]
        if len(sub):
            out.append(teams.get(sub[tm_col].mode().iloc[0], ""))
    return " / ".join(x for x in out if x)


bat_pos = bs[bs.in_rating_sample].groupby("striker_id").batting_position.median()
pace_mode = bs[bs.in_rating_sample].groupby("bowler_id").pace_or_spin.agg(lambda s: s.mode().iloc[0])
t_bat = bs[["striker_id", "batting_team_id", "group"]].rename(columns={"striker_id": "pid", "batting_team_id": "tm"})
t_bow = bs[["bowler_id", "bowling_team_id", "group"]].rename(columns={"bowler_id": "pid", "bowling_team_id": "tm"})


def teams_for(pid, role):
    t = t_bat if role == "batters" else t_bow
    return team_cell(t, pid, "pid", "tm")


def pos_label(p):
    if p is None or not np.isfinite(p):
        return None
    return "Top order (1-3)" if p <= 3 else ("Middle order (4-7)" if p <= 7 else "Lower order (8-11)")


# competition split of pressure balls (IPL vs T20I) per player, from the value tables
bat_grp = bat_v[bat_v.P == 1].groupby(["player", "group"]).size().unstack(fill_value=0)
bowl_grp = bowl_v[bowl_v.P == 1].groupby(["player", "group"]).size().unstack(fill_value=0)
grp_ct = {"batters": bat_grp, "bowlers": bowl_grp}

player_json = {}
for role in ROLES:
    r = ratings[role].copy()
    bcol, scol = ("B", "C") if role == "batters" else ("W", "K")
    r["baseline"] = r[bcol]
    r["shift"] = r[scol]
    rk = ranked[role].set_index("player_id")["rank"]
    t10 = top10[role].set_index("player_id")["rank"]
    nb = "balls_P" if role == "batters" else "deliveries_P"
    pool = r[r.active].copy()
    pool["baseline_rank"] = pool.baseline.rank(ascending=False, method="min")
    r["baseline_rank"] = r.player_id.map(pool.set_index("player_id").baseline_rank)
    gct = grp_ct[role]
    recs = []
    for x in r.itertuples():
        pid = int(x.player_id)
        rec = {"id": pid, "name": str(x.name), "teams": teams_for(pid, role), "active": bool(x.active),
               "rank": int(rk[pid]) if pid in rk.index else None, "listed": int(t10[pid]) if pid in t10.index else None,
               "removed": bool(x.active and pid not in rk.index),
               "rating": rnd(x.pressure_rating, 4), "baseline": rnd(x.baseline, 4), "shift": rnd(x.shift, 5),
               "floor": rnd(x.floor_p10, 4), "p90": rnd(x.p90, 4), "boot_sd": rnd(x.boot_sd, 4),
               "shift_p10": rnd(x.shift_p10, 5), "shift_p90": rnd(x.shift_p90, 5),
               "p_top10": rnd(x.p_top10, 3), "p_top20": rnd(x.p_top20, 3), "rank_p10": rnd(x.rank_p10, 1), "rank_p90": rnd(x.rank_p90, 1),
               "baseline_rank": int(x.baseline_rank) if np.isfinite(x.baseline_rank) else None,
               "simple_rating": rnd(x.simple_rating, 4), "delivery_rate": rnd(x.delivery_rate, 3), "delivery_matches": rnd(x.delivery_matches, 0),
               "wins_added_100": rnd(x.wins_added_per100_pressure, 3), "matches_P": rnd(x.matches_P, 0), "matches_all": rnd(x.matches_all, 0),
               "variants_in_top10": rnd(x.variants_in_top10, 0), "n_variants": rnd(x.n_variants, 0),
               "p_ipl": int(gct.loc[pid, "IPL"]) if pid in gct.index and "IPL" in gct.columns else 0,
               "p_t20i": int(gct.loc[pid, [c for c in gct.columns if c != "IPL"]].sum()) if pid in gct.index else 0,
               "dup_name": str(x.name) in dup_names}
        if role == "batters":
            pos = bat_pos.get(pid, np.nan)
            rec.update({"role": pos_label(pos), "pos": rnd(pos, 1), "keeper": bool(wk_share.get(pid, 0) >= 0.5),
                        "n_P": rnd(x.balls_P, 0), "n_O": rnd(x.balls_O, 0), "n_all": rnd(x.balls_all, 0),
                        "sr_P": rnd(x.sr_P, 1), "sr_O": rnd(x.sr_O, 1), "runs_index_P": rnd(x.runs_index_P, 0), "runs_index_O": rnd(x.runs_index_O, 0),
                        "dism_ratio_P": rnd(x.dismissal_ratio_P, 2), "dism_ratio_O": rnd(x.dismissal_ratio_O, 2),
                        "bnd_P": rnd(100 * x.boundary_rate_P, 1), "bnd_O": rnd(100 * x.boundary_rate_O, 1),
                        "dot_P": rnd(100 * x.dot_rate_P, 1), "dot_O": rnd(100 * x.dot_rate_O, 1),
                        "runs_P": rnd(x.runs_P, 0), "out_P": rnd(x.dism_P, 0), "exp_out_P": rnd(x.exp_dism_P, 1)})
        else:
            rec.update({"role": "Spinner" if pace_mode.get(pid) == "Spin" else "Pace bowler",
                        "n_P": rnd(x.deliveries_P, 0), "n_O": rnd(x.deliveries_O, 0), "n_all": rnd(x.legal_all, 0), "legal_P": rnd(x.legal_P, 0),
                        "econ_P": rnd(x.economy_P, 2), "econ_O": rnd(x.economy_O, 2), "econ_index_P": rnd(x.economy_index_P, 0), "econ_index_O": rnd(x.economy_index_O, 0),
                        "wk_ratio_P": rnd(x.wicket_ratio_P, 2), "wk_ratio_O": rnd(x.wicket_ratio_O, 2),
                        "dot_P": rnd(100 * x.dot_rate_P, 1), "dot_O": rnd(100 * x.dot_rate_O, 1),
                        "bnd_P": rnd(100 * x.boundary_conceded_P, 1), "bnd_O": rnd(100 * x.boundary_conceded_O, 1),
                        "wk_P": rnd(x.wk_P, 0), "exp_wk_P": rnd(x.exp_wk_P, 1), "conc_P": rnd(x.conceded_P, 0), "exp_conc_P": rnd(x.exp_conc_P, 0)})
        recs.append(rec)
    recs.sort(key=lambda z: (z["rank"] is None, z["rank"] if z["rank"] is not None else 0, -z["floor"]))
    player_json[role] = recs
    jdump({"role": role, "count": len(recs), "note": "Every player who meets the eligibility rule (120 pressure balls over at least 15 matches). `rank` is the position in the ranked pool (eligible, active, not reliably negative); `removed` marks players dropped for a reliably negative pressure shift; `listed` is the final top-10 place.",
           "players": recs}, f"{role}.json")

# --------------------------------------------------------------------------------------------- top10 files: copied from the pipeline output
for role in ROLES:
    t = top10[role]
    arr = [{"rank": int(x.rank), "id": int(x.player_id), "name": x.name, "teams": x.teams, "rating": rnd(x.pressure_rating, 4), "floor": rnd(x.floor_p10, 4), "p90": rnd(x.p90, 4),
            "baseline": rnd(x.baseline, 4), "shift": rnd(x.shift, 5), "p_top10": rnd(x.p_top10, 3), "p_top20": rnd(x.p_top20, 3), "rank_p10": rnd(x.rank_p10, 1), "rank_p90": rnd(x.rank_p90, 1),
            "delivery_rate": rnd(x.delivery_rate, 3), "variants_in_top10": int(x.variants_in_top10), "sign_check": bool(x.sign_check), "sign_check_strict": bool(x.sign_check_strict), "duplicate_name": bool(x.duplicate_name)}
           for x in t.itertuples()]
    jdump({"role": role, "source": f"outputs/top10_{role}.csv (copied, not re-derived)", "list": arr}, f"top10_{role}.json")
    # ranking-match assertion against the submission sheet and the pipeline csv
    sub = pd.read_csv(ROOT / "submission_sheet.csv")
    sub = sub[sub["list"] == role[:-1]].sort_values("rank")
    check(list(sub.player_id) == [a["id"] for a in arr] and list(sub.name) == [a["name"] for a in arr], f"top-10 {role} on the site = submission_sheet.csv = pipeline top10_{role}.csv, same players in the same order")
    pj = {p["id"]: p for p in player_json[role]}
    check(all(pj[a["id"]]["listed"] == a["rank"] for a in arr), f"{role}.json `listed` field agrees with the top-10 order for all 10")
    check([p["id"] for p in sorted([p for p in player_json[role] if p["rank"]], key=lambda z: z["rank"])][:10] == [a["id"] for a in arr], f"first 10 of the ranked pool in {role}.json are the top 10")

# --------------------------------------------------------------------------------------------- spot checks against source tables (independent recomputation from balls)
spot = []
for pid, role in ((4260, "batters"), (781, "bowlers"), (1699, "batters")):
    rec = [p for p in player_json[role] if p["id"] == pid][0]
    if role == "batters":
        f = d[(d.striker_id == pid) & (~d.is_wide) & (d.P == 1)]
        ok = (len(f) == rec["n_P"]) and (f.runs.sum() == rec["runs_P"]) and (int(f.st_out.sum()) == rec["out_P"]) and abs(100 * f.runs.sum() / len(f) - rec["sr_P"]) < 0.06
        spot.append(f"{rec['name']}: {len(f)} pressure balls, {int(f.runs.sum())} runs, {int(f.st_out.sum())} dismissals, strike rate {100 * f.runs.sum() / len(f):.1f} recomputed from ball data vs {rec['n_P']:.0f} / {rec['runs_P']:.0f} / {rec['out_P']:.0f} / {rec['sr_P']} in batters.json")
    else:
        f = d[(d.bowler_id == pid) & (d.P == 1)]
        ok = (len(f) == rec["n_P"]) and (int(f.conceded.sum()) == rec["conc_P"]) and (int(f.cred.sum()) == rec["wk_P"]) and abs(6 * f.conceded.sum() / f.is_legal.sum() - rec["econ_P"]) < 0.006
        spot.append(f"{rec['name']}: {len(f)} pressure deliveries, {int(f.conceded.sum())} conceded, {int(f.cred.sum())} wickets, economy {6 * f.conceded.sum() / f.is_legal.sum():.2f} recomputed from ball data vs {rec['n_P']:.0f} / {rec['conc_P']:.0f} / {rec['wk_P']:.0f} / {rec['econ_P']} in bowlers.json")
    check(ok, "spot check - " + spot[-1])

# --------------------------------------------------------------------------------------------- player_detail + player_pressure_bins
print("player detail and bins ...", flush=True)
K = ["match_id", "innings", "ball"]
bxs = bs[["match_id", "innings", "innings_ball_num", "striker_id", "bowler_id", "runs", "is_four", "is_six", "is_legal", "is_wide", "is_noball", "is_wicket", "dismissed_player_id", "dismissal_type",
          "overid", "wickets_lost", "balls_left", "runs_required", "batting_team_id", "bowling_team_id", "team_runs", "oc", "score_before", "extra_kind"]].rename(columns={"innings_ball_num": "ball"})
bv = bat_v.merge(bxs, on=K, suffixes=("", "_s"), validate="m:1")
bw = bowl_v.merge(bxs, on=K, suffixes=("", "_s"), validate="m:1")
bv["is_str"] = bv.player == bv.striker_id
bv["out"] = bv.is_wicket_s & (bv.dismissed_player_id == bv.player) & ~bv.dismissal_type.isin(list(RM.NOT_CHARGED))
bv["bndb"] = bv.is_four | bv.is_six
bv["dotb"] = bv.oc_s == 1
bw["conc"] = bw.runs + (bw.is_wide | bw.is_noball).astype(int)
bw["cred"] = bw.is_wicket_s & bw.dismissal_type.isin(list(RM.BOWLER_CREDITED))
bw["bndb"] = bw.is_four | bw.is_six
bw["dotb"] = bw.oc_s == 1
for df_ in (bv, bw):
    df_["comp"] = np.where(df_.group == "IPL", "IPL", "T20I")
    df_["pcls"] = df_.P.map({0: "O", 1: "P"})
# stage-4 style phase from the value tables ('phase' already there: 0 powerplay, 1 middle, 2 death)

# explorer bands (leverage edges; the pipeline cutoff is edge #4)
BAND_EDGES = [0.60, 0.80, 0.95, 1.10, round(CUT, 4), 1.40, 1.70, 2.20, 3.50]
assert BAND_EDGES[4] == round(CUT, 4)
bv["band"] = np.searchsorted(np.array(BAND_EDGES[:4] + [CUT] + BAND_EDGES[5:]), bv.LI.values, side="right")
bw["band"] = np.searchsorted(np.array(BAND_EDGES[:4] + [CUT] + BAND_EDGES[5:]), bw.LI.values, side="right")
check(bool(((bv.band >= 5) == (bv.P == 1)).all()) and bool(((bw.band >= 5) == (bw.P == 1)).all()), "explorer bands 5-9 are exactly the pipeline's pressure balls (band edge #5 = the official cutoff)")


def cell_bat(x):
    s = x[x.is_str]
    return {"n": int(len(s)), "r": int(s.runs.sum()), "w": int(s.out.sum()), "vn": int(len(x)), "v": rnd(x.v.mean(), 4) if len(x) else None}


def cell_bowl(x):
    return {"n": int(x.is_legal.sum()), "r": int(x.conc.sum()), "w": int(x.cred.sum()), "vn": int(len(x)), "v": rnd(x.v.mean(), 4) if len(x) else None}


mf_i = mf.set_index("match_id")
comp_names = mf_i.comp_name
bins_out = {"edges": BAND_EDGES, "official_edge_index": 4, "note": "Bands are 10 leverage bands (0: below edge 1, ..., 9: above edge 9). A band at index 5 or higher is a pressure ball under the official cutoff.", "roles": {}}


def moments(rows, role, pid):
    pr = rows[(rows.player == pid) & (rows.P == 1)]
    if not len(pr):
        return []
    g = pr.groupby("match_id")
    agg = g.agg(sumLI=("LI", "sum"), n=("LI", "size"), sumv=("v", "sum"), date=("match_date", "first"))
    top = agg.sort_values(["sumLI"], ascending=False).head(3)
    res = []
    for m_id, a in top.iterrows():
        x = pr[pr.match_id == m_id]
        pk = x.loc[x.LI.idxmax()]
        opp_id = pk.bowling_team_id if role == "batters" else pk.batting_team_id
        own_id = pk.batting_team_id if role == "batters" else pk.bowling_team_id
        rec = {"match_id": int(m_id), "date": str(a["date"]), "opp": str(teams.get(opp_id, "?")), "comp": str(comp_names.get(m_id, "")), "innings": int(pk.innings),
               "pressure_balls": int(a.n), "sum_value": rnd(a.sumv, 2), "peak_LI": rnd(pk.LI, 2),
               "peak_over": int(pk.overid), "peak_wickets": int(pk.wickets_lost), "peak_balls_left": int(pk.balls_left),
               "peak_need": int(pk.runs_required) if pd.notna(pk.runs_required) else None,
               "result": str(mf_i.result.get(m_id, ""))}
        if role == "batters":
            s = x[x.is_str]
            rec.update({"runs": int(s.runs.sum()), "balls": int(len(s)), "out": bool(x.out.any())})
        else:
            rec.update({"balls": int(x.is_legal.sum()), "conceded": int(x.conc.sum()), "wickets": int(x.cred.sum())})
        res.append(rec)
    return res


ROLE_CODE = {"batters": "bt", "bowlers": "bw"}
detail_count = 0
for role, rows in (("batters", bv), ("bowlers", bw)):
    cellf = cell_bat if role == "batters" else cell_bowl
    ids_pool = [p["id"] for p in player_json[role]]
    # ---- bins for every player with more than 20 rows (needed to reproduce the shrinkage constants)
    cnt = rows.groupby("player").size()
    keep = cnt[cnt > 20].index
    rb = rows[rows.player.isin(keep)]
    grp = rb.groupby(["player", "band"])
    if role == "batters":
        s_ = rb[rb.is_str].groupby(["player", "band"]).agg(balls=("runs", "size"), runs=("runs", "sum"), out=("out", "sum"), dot=("dotb", "sum"), bnd=("bndb", "sum"))
    else:
        s_ = rb.groupby(["player", "band"]).agg(balls=("is_legal", "sum"), runs=("conc", "sum"), out=("cred", "sum"), dot=("dotb", "sum"), bnd=("bndb", "sum"))
    a_ = grp.agg(n=("v", "size"), v=("v", "sum"))
    t_ = a_.join(s_, how="left").fillna(0)
    players = {}
    for pid, sub in t_.groupby(level=0):
        n = [0] * 10; v = [0.0] * 10; ba = [0] * 10; ru = [0] * 10; ou = [0] * 10; dt_ = [0] * 10; bd = [0] * 10
        for (_, b), r_ in sub.iterrows():
            b = int(b); n[b] = int(r_["n"]); v[b] = round(float(r_["v"]), 5); ba[b] = int(r_["balls"]); ru[b] = int(r_["runs"]); ou[b] = int(r_["out"]); dt_[b] = int(r_["dot"]); bd[b] = int(r_["bnd"])
        players[str(int(pid))] = {"n": n, "v": v, "b": ba, "r": ru, "o": ou, "d": dt_, "f": bd}
    bins_out["roles"][role] = {"sigma2": float(rows.v.var()), "fields": {"n": "rows with a ball value", "v": "sum of ball values", "b": "balls faced (batters) / legal balls bowled", "r": "runs scored / runs conceded", "o": "dismissals / bowler-credited wickets",
                                                                              "d": "dot balls", "f": "boundaries (4s and 6s)"}, "players": players}

    # ---- per-player detail files for every eligible player
    for pid in ids_pool:
        x = rows[rows.player == pid]
        det = {"id": pid, "role": role, "name": str(names.get(pid, pid))}
        det["phase"] = {PH[i]: {c: cellf(x[(x.phase == i) & (x.pcls == c)]) for c in ("O", "P")} for i in range(3)}
        det["season"] = {str(y): {c: cellf(x[(x.year == y) & (x.pcls == c)]) for c in ("O", "P")} for y in sorted(x.year.unique())}
        det["competition"] = {c_: {c: cellf(x[(x.comp == c_) & (x.pcls == c)]) for c in ("O", "P")} for c_ in ("IPL", "T20I") if (x.comp == c_).any()}
        det["overall"] = {c: cellf(x[x.pcls == c]) for c in ("O", "P")}
        det["moments"] = moments(rows, role, pid)
        det["cell_note"] = ("n = balls faced, r = runs, w = dismissals" if role == "batters" else "n = legal balls, r = runs conceded, w = wickets") + "; v = mean ball value (win-probability swing units) over vn rows"
        jdump(det, f"player_detail/{ROLE_CODE[role]}{pid}.json")
        detail_count += 1
jdump(bins_out, "player_pressure_bins.json")
check(detail_count == len(player_json["batters"]) + len(player_json["bowlers"]), f"{detail_count} player_detail files written (every eligible batter and bowler)")


# ---- reproduce the pipeline's simple (shrunk) rating from the bins, to prove the explorer arithmetic is faithful
def simple_from_bins(role, cutoff_edge):
    R_ = bins_out["roles"][role]
    sig2 = R_["sigma2"]
    pids = list(R_["players"])
    n0 = np.array([sum(R_["players"][p]["n"][:cutoff_edge]) for p in pids], float); n1 = np.array([sum(R_["players"][p]["n"][cutoff_edge:]) for p in pids], float)
    s0 = np.array([sum(R_["players"][p]["v"][:cutoff_edge]) for p in pids]); s1 = np.array([sum(R_["players"][p]["v"][cutoff_edge:]) for p in pids])
    m0 = np.where(n0 > 0, s0 / np.maximum(n0, 1), 0); m1_ = np.where(n1 > 0, s1 / np.maximum(n1, 1), 0)

    def k_of(means, sizes):
        ok = sizes > 20
        tau2 = max(float(means[ok].var(ddof=1) - sig2 * np.mean(1 / sizes[ok])), 1e-6)
        return sig2 / tau2
    kb = k_of(m0, n0); base = n0 / (n0 + kb) * m0
    diff = m1_ - base
    kc = k_of(diff, n1); shift = n1 / (n1 + kc) * diff
    return pd.Series(base + shift, index=[int(p) for p in pids]), kb, kc


for role in ROLES:
    sr_, kb, kc = simple_from_bins(role, 5)
    ref = ratings[role].set_index("player_id").simple_rating
    dif = (sr_.reindex(ref.index) - ref).abs().max()
    check(dif < 5e-4, f"explorer arithmetic at the official cutoff reproduces the pipeline's simple rating for all {len(ref)} eligible {role} (max abs difference {dif:.1e}; k_baseline {kb:.0f}, k_shift {kc:.0f})")
    bins_out["roles"][role]["k_official"] = {"baseline": rnd(kb, 1), "shift": rnd(kc, 1)}
jdump(bins_out, "player_pressure_bins.json")


# --------------------------------------------------------------------------------------------- player_cells.json (powers the global filters)
YEARS = sorted(int(y) for y in bs.year.unique())
cells = {"years": YEARS, "comps": ["IPL", "T20I"], "cols": ["comp", "year_index", "pressure", "rows", "value_sum"], "roles": {}}
for role, rows in (("batters", bv), ("bowlers", bw)):
    ids_pool = {p["id"] for p in player_json[role]}
    x = rows[rows.player.isin(ids_pool)]
    g_ = x.groupby(["player", "comp", "year", "P"]).v.agg(["size", "sum"]).reset_index()
    out_ = {}
    for r_ in g_.itertuples():
        out_.setdefault(str(int(r_.player)), []).append([0 if r_.comp == "IPL" else 1, YEARS.index(int(r_.year)), int(r_.P), int(r_.size), round(float(r_.sum), 4)])
    cells["roles"][role] = out_
jdump(cells, "player_cells.json")

# --------------------------------------------------------------------------------------------- robustness.json
print("robustness ...", flush=True)
z10 = norm.ppf(1 - RAT["floor_quantile"])
rob = {"roles": {}}
sens_tbl = pd.read_csv(OUT / "sensitivity.csv")
rel = (OUT / "reliability.md").read_text(encoding="utf-8")
rt = md_tables(rel)
for role in ROLES:
    sens = pd.read_csv(OUT / f"sensitivity_ratings_{role}.csv")
    allr = allrat[role].set_index("player_id")
    ids = sens.player_id.values
    sd = allr.boot_sd.reindex(ids).values
    variants = [c for c in sens.columns if c not in ("player_id", "role", "main")]
    official = [int(v) for v in top10[role].player_id]
    ranks, tops = {}, {}
    for v in ["main"] + variants:
        x = sens[v].values - z10 * sd
        ok = ~np.isnan(x)
        order = ids[ok][np.argsort(-x[ok])]
        tops[v] = [int(i) for i in order[:10]]
        for pos, pid in enumerate(order, 1):
            ranks.setdefault(int(pid), {})[v] = pos
    cutoff_vars = ["cutoff_top10%", "cutoff_top15%", "main", "cutoff_top25%", "cutoff_top30%"]
    st = sens_tbl[sens_tbl.role == role].set_index("variant")
    vtab = []
    for v in variants:
        vtab.append({"variant": v, "top10": tops[v], "overlap_final": len(set(tops[v]) & set(official)), "overlap_pipeline": int(st.loc[v, "top10_overlap_with_main"]), "tau": rnd(st.loc[v, "kendall_tau"], 3),
                     "players_missing": int(st.loc[v, "players_missing"])})
    need = set(official) | {p for v in variants + ["main"] for p in tops[v]}
    nm = {int(p["id"]): p["name"] for p in player_json[role]}
    rob["roles"][role] = {
        "official_top10": official, "proxy_main_top10": tops["main"], "variants": vtab, "cutoff_columns": cutoff_vars,
        "ranks": {str(p): {"name": nm.get(p, str(names.get(p, p))), **ranks[p]} for p in sorted(need) if p in ranks},
        "pool_size": int(len(ids)),
        "cutoff_survivors_min": min(len(set(tops[v]) & set(official)) for v in ["cutoff_top10%", "cutoff_top15%", "cutoff_top25%", "cutoff_top30%"]),
        "cutoff_survivors_max": max(len(set(tops[v]) & set(official)) for v in ["cutoff_top10%", "cutoff_top15%", "cutoff_top25%", "cutoff_top30%"]),
        "proxy_overlap_with_final": len(set(tops["main"]) & set(official)),
        "variants_in_top10": {str(int(r.player_id)): int(r.variants_in_top10) for r in top10[role].itertuples()}}
    # --- does the pipeline's sensitivity csv agree with the recomputed variant top-10 overlaps (vs the proxy main list)?
    agree = all(len(set(tops[v]) & set(tops["main"])) == int(st.loc[v, "top10_overlap_with_main"]) for v in variants)
    check(agree, f"recomputed variant top-10 lists reproduce sensitivity.csv overlaps for all {len(variants)} variants ({role})")
    miss = set(official) - set(tops["main"])
    rob["roles"][role]["proxy_note"] = "Variant lists use the pipeline's floor proxy (variant rating minus 1.2816 x bootstrap SD) over all eligible players; the final list uses the true bootstrap floor." + (
        f" The proxy 'main' list differs from the final list by: out of proxy top 10 = {', '.join(nm.get(p, str(p)) for p in miss)}; in = {', '.join(nm.get(p, str(p)) for p in set(tops['main']) - set(official))}." if miss else "")

# split-half and season tables from reliability.md (pipeline output)
sh_t = [t for t in rt if "sd_over_splits" in t.columns][0]
s2s_t = [t for t in rt if "pressure_rating_r" in t.columns][0]
add_t = [t for t in rt if "coefficient" in t.columns][0]
perm_t = [t for t in rt if "p_value" in t.columns][0]
rob["split_half"] = [{"role": r["role"], "quantity": r["quantity"], "raw_r": float(r["mean_split_half_r"]), "corrected_r": float(r["spearman_brown"]), "sd": float(r["sd_over_splits"]), "players": float(r["mean_players"])} for _, r in sh_t.iterrows()]
rob["season_to_season"] = [{"role": r["role"], "players": int(r["players"]), "r": float(r["pressure_rating_r"]), "spearman": float(r["spearman"]), "ci_lo": float(r["ci_lo"]), "ci_hi": float(r["ci_hi"]),
                            "baseline_r": float(r["baseline_r"]), "shift_r": float(r["shift_r"])} for _, r in s2s_t.iterrows()]
rob["shift_adds"] = [{"role": r["role"], "term": r["term"], "coef": float(r["coefficient"]), "lo": float(r["ci_lo"]), "hi": float(r["ci_hi"]), "n": int(r["n"])} for _, r in add_t.iterrows()]
rob["permutation"] = [{"role": r["role"], "players": int(r["players"]), "p": float(r["p_value"])} for _, r in perm_t.iterrows()]

# season-to-season per-player scatter: refit exactly as pipeline stage 6 (penalties fixed), early (<=2024) vs late (2025-26)
try:
    from scipy import sparse
    ch = json.load(open(OUT / "stage4_choices.json")); lb, lc = ch["lambda_B"], ch["lambda_C"]
    bat_r4 = pd.read_csv(OUT / "player_ratings_batters_stage4.csv"); bowl_r4 = pd.read_csv(OUT / "player_ratings_bowlers_stage4.csv")
    all_bat, all_bowl = bat_r4.player_id.values, bowl_r4.player_id.values
    S6 = CFG["stage6"]
    um = np.unique(np.concatenate([bat_v.match_id.values, bowl_v.match_id.values]))
    roles_fit = {"batters": (bat_v, RM.Design(bat_v, all_bat, all_bowl), all_bat), "bowlers": (bowl_v, RM.Design(bowl_v, all_bowl, all_bat), all_bowl)}
    scat = {}
    for role, (rows, D, ids) in roles_fit.items():
        my = rows.groupby("match_id").year.first()
        w_early = np.array([1.0 if my.get(m_, 9999) <= S6["season_split_year"] else 0.0 for m_ in um]); w_late = 1 - w_early

        def fitw(wm):
            w = wm[np.searchsorted(um, rows.match_id.values)]
            beta = D.fit(D.lam(lb, lc, RAT["context_lambda"]), w=w)
            return D.own(beta)
        (b1, c1), (b2, c2) = fitw(w_early), fitw(w_late)
        pr_ = rows[rows.P == 1]
        M_ = sparse.coo_matrix((np.ones(len(pr_)), (np.searchsorted(ids, pr_.player.values), np.searchsorted(um, pr_.match_id.values))), shape=(len(ids), len(um))).tocsr()
        Mb = (M_ > 0).astype(float)
        okk = (((M_ @ w_early) >= S6["half_min_pressure_balls"]) & ((Mb @ w_early) >= S6["half_min_matches"]) & ((M_ @ w_late) >= S6["half_min_pressure_balls"]) & ((Mb @ w_late) >= S6["half_min_matches"]))
        r1, r2 = (b1 + c1)[okk], (b2 + c2)[okk]
        scat[role] = {"points": [{"id": int(i), "name": str(names.get(i, i)), "early": rnd(a, 4), "late": rnd(b, 4)} for i, a, b in zip(ids[okk], r1, r2)], "r": rnd(np.corrcoef(r1, r2)[0, 1], 3), "n": int(okk.sum())}
        rep = [r for r in rob["season_to_season"] if r["role"] == role][0]
        check(abs(scat[role]["r"] - rep["r"]) < 0.0015 and scat[role]["n"] == rep["players"],
              f"season-to-season scatter for {role} reproduces the reliability report (r {scat[role]['r']} vs {rep['r']}, n {scat[role]['n']} vs {rep['players']})")
    rob["season_scatter"] = scat
    rob["season_scatter_note"] = "Ratings refitted on matches up to 2024 (x) and on 2025-26 (y) with the pipeline's fixed penalties; players with at least 60 pressure balls over 7 matches in both periods."
except Exception as e:  # keep the build going; the page hides this chart if the data is missing
    print("season scatter skipped:", repr(e))
    check(False, f"season-to-season scatter could not be rebuilt: {e!r}")
jdump(rob, "robustness.json")

# --------------------------------------------------------------------------------------------- omissions.json
print("omissions ...", flush=True)
om = {"rule": "Surprises: for each role, the three listed players with the lowest probability of finishing in the top 10 across 300 match resamples. Omissions: for each role, the four eligible players outside the top 10 with the highest baseline rating (this includes players removed for a reliably negative pressure shift).",
      "omissions": {}, "surprises": {}}
for role in ROLES:
    P = player_json[role]
    ten = [p for p in P if p["listed"]]
    outs = [p for p in P if not p["listed"] and p["active"] or (not p["listed"] and not p["active"])]
    outs = sorted(outs, key=lambda z: -z["baseline"])[:4]
    kth = [p for p in P if p["listed"] == 10][0]
    om["surprises"][role] = [{"id": p["id"], "reason_value": p["p_top10"]} for p in sorted(ten, key=lambda z: z["p_top10"])[:3]]
    lst = []
    for p in outs:
        why = "removed" if p["removed"] else ("inactive" if not p["active"] else "floor")
        lst.append({"id": p["id"], "why": why, "rank": p["rank"], "baseline": p["baseline"], "baseline_rank": p["baseline_rank"], "floor": p["floor"], "tenth_floor": kth["floor"], "p_top10": p["p_top10"],
                    "shift": p["shift"], "shift_p90": p["shift_p90"], "rating": p["rating"]})
    om["omissions"][role] = lst
jdump(om, "omissions.json")

# --------------------------------------------------------------------------------------------- Pressure XI
bpl = [p for p in player_json["batters"] if p["listed"]]
wpl = [p for p in player_json["bowlers"] if p["listed"]]
bpl.sort(key=lambda z: z["listed"]); wpl.sort(key=lambda z: z["listed"])
xi_bat = bpl[:6]
if not any(p["keeper"] for p in xi_bat):
    k = next((p for p in bpl[6:] if p["keeper"]), None)
    if k:
        xi_bat = xi_bat[:5] + [k]
xi_bow = wpl[:5]
if not any(p["role"] == "Pace bowler" for p in xi_bow):
    k = next((p for p in wpl[5:] if p["role"] == "Pace bowler"), None)
    if k:
        xi_bow = xi_bow[:4] + [k]
if not any(p["role"] == "Spinner" for p in xi_bow):
    k = next((p for p in wpl[5:] if p["role"] == "Spinner"), None)
    if k:
        xi_bow = xi_bow[:4] + [k]
order = sorted(xi_bat, key=lambda z: z["pos"] if z["pos"] is not None else 99)
jdump({"rule": "The XI is built only from the two official top-10 lists: the six best-ranked batters and the five best-ranked bowlers, with two balance constraints - at least one wicketkeeper among the batters (is_wk in the playing-XI file in at least half of the player's matches) and at least one pace bowler and one spinner among the bowlers; if a constraint fails, the lowest-ranked pick is swapped for the best-ranked qualifying player. Batters are placed by their median batting position. It is a model-selected combination, not a team-balance optimiser: the data hold no all-rounder or fielding information.",
       "batters": [p["id"] for p in order], "bowlers": [p["id"] for p in xi_bow],
       "keeper_ids": [p["id"] for p in order if p["keeper"]]}, "xi.json")
check(len(xi_bat) == 6 and len(xi_bow) == 5, f"Pressure XI has 6 batters and 5 bowlers ({', '.join(p['name'] for p in order)} | {', '.join(p['name'] for p in xi_bow)})")

# --------------------------------------------------------------------------------------------- data size and CHECKS.md
size = sum(f.stat().st_size for f in DATA.rglob("*") if f.is_file())
check(size < 3_000_000, f"site/data folder is {size / 1e6:.2f} MB (target under 3 MB)")
jfiles = sorted(p.relative_to(DATA).as_posix() for p in DATA.rglob("*.json") if "player_detail" not in str(p))
lines = ["# CHECKS", "", f"Generated by `build_data.py` on {meta['build_date']}. Every line is an assertion executed during the build.", "", "| Status | Check |", "|---|---|"]
lines += [f"| {s} | {t} |" for s, t in CHECKS]
lines += ["", "## Row counts", "", "| File | Records |", "|---|---|"]
for fn, n in (("batters.json", len(player_json["batters"])), ("bowlers.json", len(player_json["bowlers"])), ("top10_batters.json", 10), ("top10_bowlers.json", 10),
              ("player_pressure_bins.json (batters / bowlers)", f"{len(bins_out['roles']['batters']['players'])} / {len(bins_out['roles']['bowlers']['players'])}"),
              ("player_detail/*.json", detail_count), ("pressure_grid.json cells (inn 1 / inn 2)", f"{len(grid['innings1'])} / {len(grid['innings2'])}"),
              ("pressure_tables.bin.gz cells", f"{sum(sizes):,}")):
    lines.append(f"| {fn} | {n} |")
lines += ["", "## Spot checks (independent recomputation from the ball data)", ""] + [f"- {s}" for s in spot]
lines += ["", "## Files", "", "| File | Bytes |", "|---|---|"] + [f"| {f} | {(DATA / f).stat().st_size:,} |" for f in jfiles + ["pressure_tables.bin.gz"]]
lines += ["", f"Total data folder: {size:,} bytes."]
lines += ["", "## Browser-side pressure check", "", "The Python twin above checks the stored table against the pipeline. `tools/verify_js.py` runs the page's own `js/pressure.js` in a headless browser on the same 2,000-ball fixture and appends its result here."]
(DATA / "CHECKS.md").write_text("\n".join(lines), encoding="utf-8")
fails = [t for s, t in CHECKS if s == "FAIL"]
print(f"\n{len(CHECKS) - len(fails)} checks passed, {len(fails)} failed")
for t in fails:
    print("FAILED:", t)
