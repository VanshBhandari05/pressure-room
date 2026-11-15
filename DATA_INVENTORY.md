# Data inventory (Step 1)

Written from the pipeline code, `config.yaml`, `report.md`, `CHANGES_FOR_REVIEW.md`, `FINAL_LOCK.md` and the files in `outputs/`. Nothing in the methodology was changed.

## 1. The pressure definition

**Pressure is leverage.** There is no hand-weighted formula.

- For every ball `s`, a multinomial logistic **next-ball model** gives the probability `p(o | s)` of each of 10 outcome classes: wicket, 0, 1, 2, 3, 4, 6 (legal) and wide/no-ball with 1, 2 or 3+ runs.
  - Features: over band (10 bands), wickets lost (0..6, 7+), required-rate band (chase only, 6 bands), venue scoring tier (3, terciles of leave-one-out venue rate within competition group), competition group (IPL, A-team, T20I-full, T20I-assoc) and the impact-player rule. One model per innings, `C = 0.1`.
- **Win probability** `WP*` comes from exact backward induction over match states using that model, then recalibrated on out-of-fold predictions: `WP* = logistic(a + c * logit(WP_raw))` (innings 1: a = -0.047, c = 0.733; innings 2: a = 0.153, c = 0.804). The chase surface is projected to be monotone.
- `swing(s) = sum over o of p(o|s) * |WP*(after o) - WP*(s)|`, and `LI(s) = swing(s) / mean swing over live balls` (mean swing 0.014414).
- A ball is **live** when `0.02 < WP* < 0.98`. Dead balls are removed from pressure sets and baselines.
- **Cutoff:** a *pressure ball* is a live ball with `LI >= 1.2073` (the 80th percentile of live balls, pooled across both innings). Median live LI is 0.834, the 95th percentile 1.995.
- Share of balls: 20.0% of live balls in the rated matches (31,263 of 156,062); 17.9% of all 193,076 clean balls (34,494). **78** pressure balls are in the first innings of the rated matches, so pressure is almost entirely a live chase.

## 2. Metrics, baseline and rating

- Value of a ball: `v = (dWP - mean dWP in the same bin) / swing`, where the bin is innings x over band x wickets band x leverage band. Credit is split between batter and bowler by the credit table in the report (wides to the bowler only, byes and leg-byes as dot balls, run-outs not credited to the bowler, and so on).
- Rating model (two ridge regressions, one per role):  
  batting `v = context + B_i + P*C_i - (W_j + P*K_j)`, bowling `v = context + W_j + P*K_j - (B_i + P*C_i)`.  
  `B`/`W` = **baseline**, `C`/`K` = **pressure shift**, `P` = 1 on pressure balls. Context = innings x phase x P plus a competition-group term. Penalties chosen by 5-fold cross-validation with whole matches held out: baseline 300, shift 3000.
- **Pressure rating = baseline + shift** (units: share of the expected swing in win probability per ball; 0 = an average player in the same situations).
- **Uncertainty:** 300 whole-match bootstrap resamples with penalties fixed. `floor_p10` = 10th percentile of the rating, `p90` = 90th, `p_top10`, `p_top20`, rank interval.
- **Ranking rule:** eligible and active players, drop anyone whose bootstrap shift has 90th percentile below zero, sort by `floor_p10`, ties by delivery rate then pressure balls.
- Companion cricket numbers (live rated balls, pressure vs ordinary): strike rate, runs index, dismissal ratio, boundary and dot rates (batters); economy, economy index, wicket ratio, dot rate, boundary rate, extras per over (bowlers); wins added per 100 pressure balls; delivery rate.

## 3. Eligibility and fair comparison

- Rated sample: 728 matches (353 IPL, 375 full-member T20I); 808 clean matches overall. Associate and A-team matches fit the scoring model only. Super overs, no-results, rain-affected and truncated matches are removed (200,999 raw rows, 867 matches -> 193,076 rows, 808 matches).
- Eligible: at least 120 pressure balls over at least 15 matches (fixed before any leaderboard was seen): **53 batters, 56 bowlers**. Active: any appearance in 2025 or 2026 (53 and 55). Removed for a reliably negative shift: 6 batters, 7 bowlers. Ranked pool: **47 batters, 48 bowlers**.
- One model rates IPL and T20I together with a competition term. IPL-only and T20I-only ratings are sensitivity variants.

## 4. Final lists (copied from `outputs/top10_*.csv`, hashes in `FINAL_LOCK.md`)

| # | Batters | Bowlers |
|--:|---|---|
| 1 | Heinrich Klaasen | Sunil Narine |
| 2 | Suryakumar Yadav | Kuldeep Yadav |
| 3 | Tim David | Rashid Khan (id 4722) |
| 4 | Abhishek Sharma | Varun Chakravarthy |
| 5 | Phil Salt | Josh Hazlewood |
| 6 | Shreyas Iyer | Wanindu Hasaranga |
| 7 | Namboori Tilak Varma | Jasprit Bumrah |
| 8 | Sai Sudharsan | Axar Patel |
| 9 | Nicholas Pooran | Noor Ahmad |
| 10 | Shubman Gill | Krunal Pandya |

## 5. Pipeline outputs used and their columns

| File | Used for | Columns of note |
|---|---|---|
| `balls_state.parquet` | state of every ball | match, innings, ball, over, wickets lost, balls left, runs required, striker, bowler, runs, extras, dismissal, batting position, venue tier, group, year |
| `balls_pressure.parquet` | pressure score of every ball | `wp_star`, `swing`, `LI`, `live`, `pressure`, outcome probabilities `p0..p9` and win probability after each `wpn0..wpn9` |
| `ball_values_bat/bowl.parquet` | value of every ball for each player | player, opposition, `v`, `P`, phase, group, year, `LI`, `dWP0` |
| `stage2_model.pkl`, `wp_surfaces.npz` | the fitted scoring model and win-probability surfaces | used by the pressure-meter tables |
| `unfiltered_eligible_{batters,bowlers}.csv` | all eligible players | `B/C` or `W/K`, `pressure_rating`, `floor_p10`, `p90`, `boot_sd`, `p_top10`, cricket stats, `simple_rating`, `active` |
| `eligible_table_*.csv` | ranked pool | adds `rank`, `reliably_negative_shift` |
| `top10_*.csv`, `submission_sheet.csv` | the submitted lists | rank, id, name, teams, rating, floor, `p_top10`, `variants_in_top10`, sign checks |
| `sensitivity.csv`, `sensitivity_ratings_*.csv` | 14 sensitivity variants | rating per variant for every eligible player; overlap and Kendall tau |
| `reliability.md` | split-half, season-to-season, shift-adds, permutation | tables |
| `audit_stage3.md` | pressure vs ordinary separation | stratified differences with 95% intervals |
| `matches_flags.csv`, `teams.csv`, `competition_team_player_mapping.csv`, `playing_eleven.csv` | opposition, competition, names, wicketkeeper flags | |

## 6. Status of each site data file

| File | Status | How it is produced |
|---|---|---|
| `meta.json` | **derived** from existing outputs | counts and config parameters |
| `pressure_model.json` + `pressure_tables.bin.gz` | **new aggregation run** on the pipeline's own engine | the pipeline code (`wp_engine`, the pickled models) is evaluated on every match state of a reference context; a 2,000-ball check confirms the lookup equals the pipeline |
| `pressure_grid.json`, `pressure_distribution.json` | **new aggregation** of `balls_pressure` | |
| `league_split.json` | **new aggregation** (raw rates) + parsed `audit_stage3.md` (stratified differences) | |
| `batters.json`, `bowlers.json` | **exists** (ratings tables) + derived (teams, role, wicketkeeper, IPL/T20I ball counts) | |
| `top10_batters.json`, `top10_bowlers.json` | **exists**, copied | hash-checked against `FINAL_LOCK.md` |
| `player_detail/<code><id>.json` | **new aggregation** of the value tables | phase, season, competition splits and the three highest-pressure moments, for every eligible player (53 + 56, not just the top 50) |
| `player_pressure_bins.json` | **new aggregation** | ten leverage bands per player; reproduces the pipeline's `simple_rating` at the official cutoff |
| `player_cells.json` | **new aggregation** (added) | competition x season x pressure cells for the global filters |
| `robustness.json` | **exists** (sensitivity and reliability outputs) + **one refit** with existing code | the season-to-season scatter refits the stage-6 models with unchanged parameters |
| `omissions.json`, `xi.json` | **derived** by stated rules | |

## 7. What the prompt asks for that the methodology cannot support as written

1. **"The pressure formula as parameters the browser can evaluate."** The pressure score is the output of a fitted multinomial model plus a dynamic-programming win-probability surface. It has no short closed form. The page evaluates it by looking up the pipeline's own value for each exact state (first innings: score, balls left, wickets lost; chase: runs needed, balls left, wickets lost) in one reference context (IPL, medium-scoring venue, impact-player era). The formula is shown in words and symbols.
2. **Pressure inputs in the prompt's sense** (required rate, a weighted sum, a cutoff on a 0-100 score) do not exist; pressure is a leverage index with a percentile cutoff.
3. **Robustness "at 5 alternative cutoffs"** exists as four alternative cutoffs (top 10%, 15%, 25%, 30%) plus the chosen top 20%, ranked with the pipeline's floor proxy (rating minus 1.2816 x bootstrap SD), not the true bootstrap floor. Jos Buttler is 9th on the proxy and 11th on the true floor, so the proxy "main" list differs from the final list by one player (Gill out, Buttler in).
4. **Season-to-season** exists for two periods only (up to 2024, and 2025-26), not season by season. Split-half exists as summary statistics, not per-player values.
5. **Role data** is limited: batting position (median) and a wicketkeeper flag come from the playing-XI file; bowlers are pace or spin. There is no all-rounder or opener tag and no `players.csv`; names come from the mapping file.
6. **Per-player "phase, season and competition" splits** are on live rated balls only, so very small cells appear (for example 13 pressure balls in a powerplay). The cards show sample sizes next to every bar.
7. **First-innings pressure** is almost absent by construction (78 balls); the "pressure meter" for the first innings therefore rarely turns pink.
8. **"Percentile strip against all eligible players"** uses the 53 batters and 56 bowlers who qualify, not the wider pool of 600+ players with any rows.
9. **Quadrant names** (Risers, Rocks, Faders, Flat-track) are not part of the methodology; they are a reading aid defined on the map (see `CHANGES.md`).
