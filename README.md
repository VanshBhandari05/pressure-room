# The Pressure Room

A static, interactive website for an independent SupeRR Selector Season 2 (Round 1) entry by Vansh Bhandari: how pressure was defined, proof that the definition separates real match situations, how players are rated, the two top-10 lists with evidence, and how far the rankings can be trusted.

Not an official Rajasthan Royals or IPL page. No official logos, crests or player photographs are used; all artwork is generated in code. Plain HTML, CSS and JavaScript (ES modules): no framework, no build step, no backend, no tracking, no runtime network calls.

## Layout

```
index.html            the page
css/                  tokens.css (colour grammar), layout.css, components.css, charts.css
js/                   main.js, data.js, state.js, pressure.js, art.js, util.js, charts/*.js, ui/*.js
assets/               fonts (self-hosted), favicon, og-image, methodology-report.pdf
data/                 every number the page shows (JSON, one gzip table) + CHECKS.md
build_data.py         regenerates data/ from the pipeline outputs
tools/                verification scripts and the og-image source (not published)
DATA_INVENTORY.md     what the pipeline defines and produces, and the gaps
CHANGES.md            every decision taken while building
```

Colour grammar, everywhere: **blue = normal conditions, pink = pressure.**

## Regenerate the data

The build reads the analysis folder one level up (`../outputs`, `../config.yaml`, `../FINAL_LOCK.md`, `../submission_sheet.csv` and the supplied CSVs, which are read locally and never copied).

```
python -I website/build_data.py          # rewrites website/data/ and CHECKS.md (about 20 seconds)
python website/tools/verify_js.py        # runs js/pressure.js and the page itself in a real browser, appends to CHECKS.md
```

`build_data.py` asserts, among other things: the SHA-256 of `config.yaml` and both top-10 files match `FINAL_LOCK.md`; the top-10 files on the site equal `submission_sheet.csv` and the pipeline's `top10_*.csv`, in order; the pressure lookup reproduces the pipeline's leverage on 2,000 random real balls; three players' numbers match an independent recomputation from the ball data. `verify_js.py` needs `pip install playwright pandas` and Edge or Chrome, and also checks the rendered rankings against `submission_sheet.csv`. Re-running `build_data.py` fully regenerates `data/` (delete nothing by hand) and resets the browser-side lines in `CHECKS.md`, so run the two commands in that order.

## Preview locally

```
cd website
python -m http.server 8000
```

then open http://localhost:8000 (the page needs HTTP; opening `index.html` as a file will not load the data).

## Deploy (GitHub Pages)

`.github/workflows/pages.yml` publishes `index.html`, `css/`, `js/`, `assets/` and `data/` on every push to `main`. It assumes this folder is the root of its own repository.

1. Create a new **public repository containing only this folder** (the parent folder holds the organisers' CSVs and must not be published). `.gitignore` also blocks any CSV, parquet, npz or pickle.
2. In the repository settings choose Pages, Source: GitHub Actions.
3. Before pushing, check `git ls-files` shows no CSV or parquet.

## Data note

IPL and T20I ball-by-ball and supporting data from 2022 onward, supplied by the organisers. Only small derived aggregates are published. Every figure on the page is read from `data/*.json` and traces back to a pipeline output; see `DATA_INVENTORY.md` and `data/CHECKS.md`.
