"""Rebuild everything the post shows, in order, from the inputs in build_model.py.

  build_model.py   writes IP_valuation_model.xlsx (formulas only)
  recalc           LibreOffice computes every formula and stores the values
  montecarlo.py    mc.json         (reads its fixed inputs from the workbook)
  sweep.py         mc_pdown.json   (the coin-flip curve)
  bet.py           bet.json, bet_out.txt
  validate.py      validate_out.txt; a failed check stops the run
  post_numbers.py  numbers.json: every number the post, the Dictionary sheet and the LinkedIn text quote
then builds the workbook a second time so its Dictionary sheet can quote numbers.json,
and renders posts/valuing-international-paper.html from post.tmpl (build_post.py).
Run: python3 run_all.py
"""
import os, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
XLSX = os.path.join(HERE, "IP_valuation_model.xlsx")


def run(script, out=None):
    r = subprocess.run([sys.executable, script], cwd=HERE, capture_output=True, text=True)
    if out:
        open(os.path.join(HERE, out), "w").write(r.stdout)
    print(f"{script}: exit {r.returncode}")
    if r.returncode:
        print(r.stdout[-2000:], r.stderr[-2000:])
        sys.exit(r.returncode)
    return r.stdout


def recalc():
    # openpyxl writes formulas without values; LibreOffice computes them on load and saves them back
    with tempfile.TemporaryDirectory() as td:
        subprocess.run(["soffice", "--headless", "--calc", "--convert-to", "xlsx", "--outdir", td, XLSX],
                       check=True, capture_output=True, timeout=300, env={**os.environ, "HOME": td})
        shutil.copy(os.path.join(td, "IP_valuation_model.xlsx"), XLSX)
    print("recalc: done")


# pass 1: compute
run("build_model.py")
recalc()
run("montecarlo.py")
run("sweep.py")
run("bet.py", "bet_out.txt")
run("validate.py", "validate_out.txt")
run("post_numbers.py")
first = open(os.path.join(HERE, "numbers.json")).read()
# pass 2: the workbook's Dictionary quotes the numbers pass 1 computed; nothing else may move
run("build_model.py")
recalc()
print(run("validate.py", "validate_out.txt").splitlines()[-1])
run("post_numbers.py")
assert open(os.path.join(HERE, "numbers.json")).read() == first, "the second pass changed a number"
# the post: every number in it comes from numbers.json, every table from the workbook
run("build_post.py")
