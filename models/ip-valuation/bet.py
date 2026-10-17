"""My bet: the value distribution mapped onto the instruments I could actually buy.

The Monte Carlo gives a distribution of what the shares are WORTH. A position pays on
what they TRADE at, and the market can disagree with value for a long time. So the one
extra assumption here is convergence: over the horizon the price moves a fraction c of
the way from $32 toward the simulated value (c = 1 is full convergence, 0 is none).

Option premiums are ILLUSTRATIVE placeholders — check the live chain before trading.
Run: python3 bet.py  (writes bet.json for the post's chart)
"""
import io, contextlib, json
import numpy as np

# re-run the simulation to get the value draws (same seed as montecarlo.py)
src = open("montecarlo.py").read().replace('json.dump(out, open("mc.json", "w"), indent=1)', '')
ns = {}
with contextlib.redirect_stdout(io.StringIO()):
    exec(src, ns)
value, down, price = ns["value"], ns["down"], ns["price"]
rng = np.random.default_rng(7)

# ---- horizon price: partial convergence toward value, plus noise the model can't see
c = 0.6                                              # 60% of the gap closes over ~12–15 months
price_T = price + c * (value - price)
price_T = price_T * np.exp(rng.normal(0, 0.12, len(value)))   # 12% lognormal market noise
price_T = np.maximum(price_T, 3)

# ---- dividend over the horizon: $1.85 held in the base regime, halved in a down-cycle (cut)
div = np.where(down, 0.925, 1.85)

# ---- instruments (per 100 shares / one contract). Premiums are placeholders.
CALL_K, CALL_PREM = 35.0, 3.50          # Jan-2028 $35 call, illustrative
PUT_K, PUT_PREM = 28.0, 1.75            # 6-month $28 cash-secured put, illustrative
SPR_K1, SPR_K2, SPR_NET = 35.0, 45.0, 2.25   # 35/45 call spread, illustrative net debit

instruments = {
    "100 shares at $32": dict(pnl=100 * (price_T - price) + 100 * div, capital=100 * price),
    "1 call, Jan-2028 $35 (~$3.50)": dict(pnl=100 * (np.maximum(0, price_T - CALL_K) - CALL_PREM), capital=100 * CALL_PREM),
    "1 cash-secured put, $28 6-mo (~$1.75)": dict(pnl=100 * (PUT_PREM - np.maximum(0, PUT_K - price_T)), capital=100 * PUT_K),
    "1 call spread 35/45 (~$2.25)": dict(pnl=100 * (np.minimum(SPR_K2 - SPR_K1, np.maximum(0, price_T - SPR_K1)) - SPR_NET), capital=100 * SPR_NET),
}
rows = []
for name, d in instruments.items():
    p = d["pnl"]
    rows.append(dict(name=name, capital=float(d["capital"]), mean=float(p.mean()), p_profit=float((p > 0).mean()),
                     p10=float(np.percentile(p, 10)), p50=float(np.percentile(p, 50)), p90=float(np.percentile(p, 90)),
                     worst=float(p.min()), roc=float(p.mean() / d["capital"]),
                     mean_down=float(p[down].mean()), mean_base=float(p[~down].mean())))
    print(f"{name:40s} capital ${d['capital']:>6,.0f}  E[P&L] ${p.mean():>7,.0f}  P(profit) {(p>0).mean():5.1%}  10th ${np.percentile(p,10):>7,.0f}  90th ${np.percentile(p,90):>7,.0f}  worst ${p.min():>7,.0f}  on capital {p.mean()/d['capital']:+.1%}")

# payoff curves for the chart (per 100 shares, before dividends)
grid = np.arange(10, 70.5, 0.5)
curves = {
    "shares": (100 * (grid - price)).tolist(),
    "call": (100 * (np.maximum(0, grid - CALL_K) - CALL_PREM)).tolist(),
    "put": (100 * (PUT_PREM - np.maximum(0, PUT_K - grid))).tolist(),
    "spread": (100 * (np.minimum(SPR_K2 - SPR_K1, np.maximum(0, grid - SPR_K1)) - SPR_NET)).tolist(),
}
hist, edges = np.histogram(price_T, bins=np.arange(0, 100, 2.5))
json.dump(dict(convergence=c, price=price, grid=grid.tolist(), curves=curves, rows=rows,
               priceT=dict(edges=edges.tolist(), counts=hist.tolist(), p10=float(np.percentile(price_T, 10)), p50=float(np.percentile(price_T, 50)), p90=float(np.percentile(price_T, 90))),
               premiums=dict(call=CALL_PREM, put=PUT_PREM, spread=SPR_NET)), open("bet.json", "w"))
print(f"\nhorizon price (c={c}): 10th ${np.percentile(price_T,10):.0f}  median ${np.percentile(price_T,50):.0f}  90th ${np.percentile(price_T,90):.0f}")
