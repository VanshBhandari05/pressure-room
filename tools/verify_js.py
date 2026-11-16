"""Browser-side checks, recorded in data/CHECKS.md:
  1. the page's own js/pressure.js reproduces the pipeline's leverage on the 2,000-ball fixture written by build_data.py;
  2. the page's explorer, at the official cutoff, lists the same top 10 as the pipeline's simple cross-check rating (needs ../outputs locally).
Needs:  pip install playwright pandas   and an installed Edge or Chrome.
Usage:  python tools/build_then_verify.py   or, after build_data.py:   python tools/verify_js.py"""
import functools, http.server, json, re, socketserver, sys, threading
from pathlib import Path
from playwright.sync_api import sync_playwright

SITE = Path(__file__).resolve().parent.parent
OUT = SITE.parent / "outputs"
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(SITE))
handler.log_message = lambda *a, **k: None
lines = []
ok_all = True


def launch(p):
    for channel in ("msedge", "chrome", None):
        try:
            return p.chromium.launch(channel=channel) if channel else p.chromium.launch()
        except Exception:
            continue
    sys.exit("No Chromium-based browser available for playwright.")


socketserver.ThreadingTCPServer.daemon_threads = True
with socketserver.ThreadingTCPServer(("127.0.0.1", 0), handler) as srv:
    port = srv.server_address[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    with sync_playwright() as p:
        b = launch(p)
        pg = b.new_page(viewport={"width": 1280, "height": 900})
        # 1. pressure formula
        pg.goto(f"http://127.0.0.1:{port}/tools/verify.html")
        pg.wait_for_function("document.getElementById('out').textContent.startsWith('{')", timeout=60000)
        res = json.loads(pg.inner_text("#out"))
        ok = bool(res.get("ok")) and res["maxLiErr"] <= 0.0006 and res["flagAgree"] >= 0.998
        ok_all &= ok
        lines.append(f"| {'PASS' if ok else 'FAIL'} | js/pressure.js, run in a real browser, reproduces the pipeline's leverage on {res.get('n', 0):,} random real balls: max abs error {res.get('maxLiErr', float('nan')):.5f}, pressure flag agrees on {100 * res.get('flagAgree', 0):.2f}% |")
        print(res)
        # 2. explorer at the official cutoff
        if (OUT / "eligible_table_batters.csv").exists():
            import pandas as pd
            pg.goto(f"http://127.0.0.1:{port}/index.html", wait_until="networkidle")
            pg.wait_for_function("document.documentElement.dataset.ready === '1'", timeout=60000)
            pg.wait_for_timeout(800)
            for role, label in (("batters", "Batters"), ("bowlers", "Bowlers")):
                pg.click(f"#filters-ui >> text={label}")
                pg.wait_for_timeout(500)
                got = pg.evaluate("[...document.querySelectorAll('#explorer-ui .movers .panel:nth-child(2) .mrow button')].map(b=>b.innerText)")
                want = list(pd.read_csv(OUT / f"eligible_table_{role}.csv").sort_values("simple_rating", ascending=False).head(10).name)
                ok_all &= got == want
                lines.append(f"| {'PASS' if got == want else 'FAIL'} | explorer (default cutoff) in the browser lists the same top 10 {role} as the pipeline's simple cross-check rating |")
                print(role, got == want)
        # 3. rankings as rendered on the page equal the submission sheet, in order
        sheet = SITE.parent / "submission_sheet.csv"
        if sheet.exists():
            import pandas as pd
            sub = pd.read_csv(sheet)
            pg.goto(f"http://127.0.0.1:{port}/index.html", wait_until="networkidle")
            pg.wait_for_function("document.documentElement.dataset.ready === '1'", timeout=60000)
            pg.evaluate("document.getElementById('rankings').scrollIntoView()")
            pg.wait_for_timeout(1500)
            for role, label in (("batter", "Top 10 batters"), ("bowler", "Top 10 bowlers")):
                pg.click(f"#rank-ui >> text={label}")
                pg.wait_for_timeout(800)
                got = pg.evaluate("[...document.querySelectorAll('#rank-ui .rcard h3')].map(h=>h.innerText)")
                want = list(sub[sub['list'] == role].sort_values('rank').name)
                ok_all &= got == want
                lines.append(f"| {'PASS' if got == want else 'FAIL'} | rankings section as rendered in the browser = submission_sheet.csv, same 10 {role}s in the same order |")
                print(role, got == want)
        b.close()
    srv.shutdown()

chk = SITE / "data" / "CHECKS.md"
txt = chk.read_text(encoding="utf-8")
txt = re.sub(r"\n\| (PASS|FAIL) \| (js/pressure\.js, run in a real browser|explorer \(default cutoff\)|rankings section as rendered).*?\|(?=\n)", "", txt)
txt = txt.replace("| Status | Check |\n|---|---|\n", "| Status | Check |\n|---|---|\n" + "\n".join(lines) + "\n", 1)
chk.write_text(txt, encoding="utf-8")
sys.exit(0 if ok_all else 1)
