"""How often does containerboard turn down? The base rate under the model's 30%.

The model's P(down-cycle over the next three years) is a judgment. This puts a number from
history next to it: the share of three-year windows in which the producer price index for
kraft packaging paperboard (the linerboard family) fell by at least a threshold from its
running high. It also asks the question that matters now: how often does a down-cycle
follow a year in which the index rose as much as it has in 2026?

Data: FRED / BLS producer price indexes, monthly, downloaded as CSV into data/:
  PCU3221303221301  Paperboard mills: unbleached kraft packaging and industrial converting paperboard
  PCU322130322130   Paperboard mills (all), the fallback when the kraft series is missing
Run: python3 base_rate.py  (writes base_rate.json)
"""
import csv, glob, json, os

HERE = os.path.dirname(os.path.abspath(__file__))
SERIES = ["PCU3221303221301", "PCU322130322130"]
HORIZON = 36            # months: the model's three-year horizon
DROPS = (0.05, 0.10)    # a down-cycle = the index falls this far below its running high inside the window
RISE = 0.08             # "a year like 2026": the index up at least this much over the prior 12 months


def load(sid):
    """FRED's CSV (observation_date or DATE, then the series) -> [(YYYY-MM, value)]."""
    paths = glob.glob(os.path.join(HERE, "data", f"{sid}*.csv"))
    if not paths:
        return None
    rows = []
    with open(paths[0]) as f:
        for r in csv.reader(f):
            if len(r) < 2 or not r[0][:4].isdigit() or r[1] in ("", "."):
                continue
            rows.append((r[0][:7], float(r[1])))
    return sorted(rows)


def windows(vals, drop):
    """For each start month with a full horizon ahead: did the index fall `drop` below its running high?"""
    out = []
    for t in range(len(vals) - HORIZON):
        hi, hit = vals[t], False
        for v in vals[t + 1: t + HORIZON + 1]:
            hi = max(hi, v)
            if v <= hi * (1 - drop):
                hit = True
                break
        out.append(hit)
    return out


def episodes(dates, vals, drop):
    """Peak-to-trough declines of at least `drop`. An episode runs from the high until the index
    regains that high (or the data ends); its trough is the low in between."""
    eps, peak, i = [], 0, 1
    while i < len(vals):
        if vals[i] > vals[peak]:
            peak = i
        elif vals[i] <= vals[peak] * (1 - drop):
            j = i
            while j < len(vals) and vals[j] < vals[peak]:
                j += 1
            trough = min(range(i, j), key=lambda k: vals[k])
            eps.append({"peak": dates[peak], "trough": dates[trough], "depth": round(vals[trough] / vals[peak] - 1, 4)})
            peak = i = trough
        i += 1
    return eps


sid, rows = next(((s, r) for s in SERIES for r in [load(s)] if r), (None, None))
if not rows:
    raise SystemExit(f"no data: download {SERIES[0]}.csv from https://fred.stlouisfed.org/graph/fredgraph.csv?id={SERIES[0]} into {os.path.join(HERE, 'data')}/")
dates, vals = [d for d, _ in rows], [v for _, v in rows]
out = {"series": sid, "first": dates[0], "last": dates[-1], "months": len(vals), "horizon_months": HORIZON, "rise_threshold": RISE,
       "latest_12m_change": round(vals[-1] / vals[-13] - 1, 4) if len(vals) > 13 else None, "by_drop": {}}
for drop in DROPS:
    hits = windows(vals, drop)
    after_rise = [h for t, h in enumerate(hits) if t >= 12 and vals[t] / vals[t - 12] - 1 >= RISE]
    out["by_drop"][f"{drop:.0%}"] = {
        "base_rate": round(sum(hits) / len(hits), 4), "windows": len(hits),
        "after_a_rise": round(sum(after_rise) / len(after_rise), 4) if after_rise else None, "windows_after_a_rise": len(after_rise),
        "episodes": episodes(dates, vals, drop)}
json.dump(out, open(os.path.join(HERE, "base_rate.json"), "w"), indent=1)
for k, v in out["by_drop"].items():
    print(f"{sid} {out['first']}–{out['last']}: a {k} fall within {HORIZON} months in {v['base_rate']:.0%} of windows; "
          f"after a {RISE:.0%}+ year, {v['after_a_rise']:.0%} ({v['windows_after_a_rise']} windows); {len(v['episodes'])} episodes")
