"""The coin-flip curve: P(value > price) as the probability of a down-cycle goes from 10% to 70%.

Re-runs montecarlo.py's chain once per probability, same seed each time, so the only thing
that changes between points is the odds of the cycle.
Run: python3 sweep.py  (writes mc_pdown.json for the post's chart)
"""
import io, contextlib, json
import numpy as np

src = open("montecarlo.py").read().replace('json.dump(out, open("mc.json", "w"), indent=1)', '')
assert "p_down = 0.30" in src
rows = []
for p in (0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7):
    ns = {}
    with contextlib.redirect_stdout(io.StringIO()):
        exec(src.replace("p_down = 0.30", f"p_down = {p}"), ns)
    v = ns["value"]
    rows.append(dict(p_down=p, p_above=float((v > ns["price"]).mean()), mean=float(v.mean()), median=float(np.median(v)), half_kelly=ns["half_kelly"]))
    print(f"P(down) {p:.0%}: P(value > ${ns['price']:.0f}) {rows[-1]['p_above']:.1%}, median ${rows[-1]['median']:.1f}")
json.dump(rows, open("mc_pdown.json", "w"))
