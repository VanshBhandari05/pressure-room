# Decisions taken while building the website

Every judgement call, in the order it came up. Nothing here changes the methodology, a rating or a ranking; the analysis folder was only read.

## Scope and process

1. **Folder name.** The prompt's `site/` is `website/` here, as you asked. All files stay inside it: code, data, documents, artwork.
2. **The Step 1 "STOP" gate.** You asked for the whole build in one go, so I wrote `DATA_INVENTORY.md`, listed the gaps there, and continued instead of waiting. I did stop-and-check on the rule that matters ("if you find a bug, stop"): nothing in the analysis looked wrong. The things worth knowing are listed at the end of this file.
3. **Step 2 gate (show `CHECKS.md` before building pages).** Same reason: `data/CHECKS.md` is generated, all assertions pass, and I continued.
4. **Nothing was pushed to GitHub.** The prompt requires your confirmation before the first push and a repository name. The workflow file, `.gitignore` and README are ready; deployment is the one open step.

## Data layer (`build_data.py`)

5. **Pressure meter = a lookup, not a formula.** The pressure score comes from a fitted model, so the page looks up the pipeline's own value for each exact state. I computed it with the pipeline's `wp_engine` and the pickled models for one reference context (IPL, medium-scoring venue, impact-player era) and stored it as `pressure_tables.bin.gz` (about 0.65 MB). Chase table: runs needed 1-200, balls left 1-120, wickets lost 0-9. First-innings table: score 0-260. It is verified two ways: in Python on 2,000 random real balls, and in a real browser by `tools/verify_js.py` (max error 0.0005, pressure flag agrees on 100%).
6. **Presets for the meter are real situations**, found by stated rules (first ball of a chase at the median target, the median pressure ball, the highest-leverage ball in the reference context, a settled late ball), not invented examples.
7. **Heatmap and histogram** use all 808 clean matches (the same set the pressure cutoff was computed on). **League-wide normal vs pressure** and everything per player use the 728 rated matches.
8. **League split rates are raw**, as in the report's cell tables; the pipeline's stratified differences with bootstrap intervals are parsed from `audit_stage3.md` and shown as a forest plot.
9. **Eligible players only** in `batters.json` / `bowlers.json` (53 and 56), including the ones removed for a negative shift or inactive, flagged as such. `rank` is the ranked-pool position; `listed` is the official top-10 place.
10. **`player_detail`** covers all 109 eligible players (the prompt asked for at least the 20 ranked). Files are named `bt<id>.json` / `bw<id>.json` because a batter id and a bowler id can coincide.
11. **"Three highest-pressure moments"** = the three matches in which the player's balls carried the largest summed leverage. The situation shown is the single highest-leverage ball in that match.
12. **Explorer bins.** Ten leverage bands with edges 0.60, 0.80, 0.95, 1.10, 1.2073 (the official cutoff), 1.40, 1.70, 2.20, 3.50, so the official cutoff is exactly one of the slider positions. The explorer reuses the pipeline's own cross-check rating (shrunk raw averages, method-of-moments shrinkage). At the official cutoff it reproduces the pipeline's `simple_rating` for all players (max difference 4e-8) and lists the same top 10 as the pipeline's cross-check; at other cutoffs it is exploratory. The pool is fixed to the official ranked pool. The page says all this in one paragraph.
13. **Global filters and the map.** With default filters the map shows the official ridge ratings. With any competition or season filter it shows plain average ball value on normal and pressure balls in that slice (from `player_cells.json`), labelled as unadjusted. A season range plus a competition at the same time is supported because the cells are stored per competition x season.
14. **Quadrants.** Rocks = above-median baseline and a shift of zero or more; Faders = above-median baseline and a negative shift; Risers = below-median baseline and a shift of zero or more; Flat-track = below-median baseline and a negative shift. The headline sentence says honestly that the shifts are small.
15. **Robustness.** The pipeline's sensitivity ratings use a floor proxy, so variant top-10 lists are computed with the same proxy the pipeline used for its own "variants in top 10" count. I report both "same as final" (against the submitted list) and "same as main" (the pipeline's own number). The bump chart shows the proxy ranks, and a note says the proxy "main" list differs from the final list by one player.
16. **Season-to-season scatter** needed a refit of the stage-6 models (fit up to 2024 and on 2025-26) using the pipeline's own code and fixed penalties; the correlations match the report (batters 0.048, bowlers 0.511).
17. **Surprises and omissions rule** (stated on the page): the three listed players per role with the lowest probability of a top-10 finish; the four eligible players per role outside the top 10 with the highest baseline rating, which includes players removed for a negative pressure shift.
18. **Pressure XI rule** (stated on the page): six best-ranked batters and five best-ranked bowlers from the official lists, with at least one wicketkeeper and at least one pace bowler and one spinner. All constraints were already met by the top ranks, so no swap was needed. Batters are placed by median batting position. Field positions are decorative.
19. **Method parameters in copy** (300 resamples, 200 splits, penalties, percentiles, 15-ball season minimum) come from `meta.json -> params`, which is read from `config.yaml` and the stage outputs. One exception: the "six or more pressure balls" in the delivery-rate definition is a literal in `src/stage4_ratings.py`, copied into `params.delivery_min_balls`.
20. **Report PDF.** `report.pdf` is copied to `assets/methodology-report.pdf` so the footer link works on the published site.
21. **`data/` size:** about 1.6 MB, under the 3 MB target.

## Front end

22. **No D3 and no charting library.** All charts are small hand-written SVG helpers (`js/charts/`), so nothing needs vendoring and the page stays well under 1 MB before data. Fonts (Teko and Inter, Latin subsets from Fontsource, SIL OFL) are self-hosted in `assets/fonts/`.
23. **Colour grammar kept strictly.** Avatars use a neutral navy disc; the ring is blue (track) and pink (fill = rating within the pool); the bat or ball glyph shows the role, so the "pink/blue split by role" idea was dropped to avoid breaking blue = normal, pink = pressure. Pressure bars carry a hatch pattern and every chart is labelled, so colour is never the only cue.
24. **Section 5** has two parts: paired bars (raw rates, toggles for phase, competition and innings) and a forest plot of the pipeline's stratified differences.
25. **Over ticker.** Scroll progress is shown as overs 0.0 to 20.0, with a mini gauge from blue to pink.
26. **Filter bar is sticky for the whole page** (it drives the map, head to head and the explorer, and says so). On a phone it scrolls sideways inside its own strip.
27. **Neutral pronouns.** All generated copy avoids he/she, since the data say nothing about it.
28. **Graceful failure.** Each section is built in its own try/catch and shows a short note if a data file is missing. The pressure meter needs `DecompressionStream` (all current browsers); if it is missing, the meter says so and the rest of the page is unaffected.
29. **Shareable state** in the URL hash: `#p=` (open player card), `#c=` (comparison), `#pick=` (your finisher). The pick is also kept in localStorage, wrapped in try/catch.
30. **Hero counters** show all 193,076 clean balls and 34,494 pressure balls in the clean matches; the rated-match figure (31,263) is used elsewhere. The page says which is which where it matters.

## Deployment files

31. `.github/workflows/pages.yml` publishes only `index.html`, `css/`, `js/`, `assets/` and `data/` (not `tools/`, scripts or documents). It assumes the repository root is this `website/` folder. **Create a separate clean repository containing only this folder**: the parent folder holds the organisers' CSVs, and this folder's `.gitignore` also blocks any CSV, parquet or pickle.

## Things that looked inconsistent or weak (for your report-back)

- **Pressure is a chase.** Only 78 of 31,263 rated pressure balls are in the first innings, so the ratings are close to ratings of performance in live chases (the report already says so).
- **Small samples in the top 10.** Klaasen 200 pressure balls over 19 matches; Salt 231 over 19; Iyer 298 over 20; Noor Ahmad 207 over 16.
- **Low top-10 probabilities.** Gill 25%, Sai Sudharsan 28%, Axar Patel 39%, Pooran 56%; Sudharsan is ranked above Pooran because the ranking is on the floor, not the rating.
- **Proxy vs final.** The sensitivity grid's proxy top 10 has Buttler in and Gill out; the final list (true bootstrap floor) is the reverse.
- **Flips when the pool changes.** Rating on IPL matches only keeps 7 of 10 batters and on T20I only 5 of 10 (bowlers 8 and 7).
- **Batter persistence.** Season-to-season r is 0.05 for batters (34 players), 0.51 for bowlers.
- **Shift reliability.** Split-half 0.13 (batters) and 0.15 (bowlers): the lists rank proven quality, not a separate clutch trait.
- **Rashid Khan** has two ids; the list uses 4722 (check the Unstop dropdown).
- **Bowler sign check** was amended after results (Hasaranga and Noor Ahmad); the page's limits section says so.
