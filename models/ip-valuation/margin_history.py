"""Does the 17% mid-cycle margin defend itself? IP's own packaging margins, year by year, from its 10-Ks.

The model assumes a North American mid-cycle EBITDA margin (Inputs: midcycle_na_margin). Through a
cycle, a mid-cycle margin should sit near the middle of what the business actually earned. This
reads IP's reported segment sales, operating profit and depreciation from each 10-K's segment
note (data/segments.json, one row per segment-year with its source), computes the EBITDA margin
the same way every year, and says where the model's number falls in that history.
Run: python3 margin_history.py  (writes margin_history.json)
"""
import json, os, statistics

HERE = os.path.dirname(os.path.abspath(__file__))
rows = json.load(open(os.path.join(HERE, "data", "segments.json")))
inputs = json.load(open(os.path.join(HERE, "inputs.json")))
model = inputs["midcycle_na_margin"]["value"]

# the North American containerboard business under its names over time; the newest 10-K wins for a restated year
NA = ("Packaging Solutions North America", "Industrial Packaging")
by_year = {}
for r in sorted(rows, key=lambda r: r["filed"]):
    if r["segment"] in NA and r.get("sales") and r.get("op_profit") is not None and r.get("da") is not None:
        by_year[r["year"]] = r
years = sorted(by_year)
hist = [{"year": y, "segment": by_year[y]["segment"], "sales": by_year[y]["sales"],
         "ebitda": by_year[y]["op_profit"] + by_year[y]["da"], "margin": (by_year[y]["op_profit"] + by_year[y]["da"]) / by_year[y]["sales"],
         "source": by_year[y]["source"]} for y in years]
m = [h["margin"] for h in hist]
out = {"model_margin": model, "years": hist, "mean": statistics.mean(m), "median": statistics.median(m), "min": min(m), "max": max(m),
       "share_at_or_above_model": sum(x >= model - 1e-9 for x in m) / len(m),
       "rank": f"{sum(x < model for x in m)} of {len(m)} years earned less than the model's mid-cycle margin",
       "note": "EBITDA = segment operating profit + segment depreciation and amortization; segment definitions change in 2025 (NA vs Industrial Packaging incl. EMEA)."}
json.dump(out, open(os.path.join(HERE, "margin_history.json"), "w"), indent=1)
print(f"{years[0]}–{years[-1]}: mean {out['mean']:.1%}, median {out['median']:.1%}, range {out['min']:.1%}–{out['max']:.1%}; model {model:.0%}: {out['rank']}")
