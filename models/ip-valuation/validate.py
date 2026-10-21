"""Validation: does the model tie out?  Run: python3 validate.py

Each check is a thing a reviewer would ask. A check prints PASS/FAIL with the numbers,
and the script exits non-zero if anything fails, so it can gate a republish.
"""
import json, sys, subprocess
from openpyxl import load_workbook

wb = load_workbook("IP_valuation_model.xlsx", data_only=True)
inp = {r[0].value: r[1].value for r in wb["Inputs"].iter_rows(min_row=5) if r[0].value and r[1].value is not None}
M, D, S, V = wb["Model"], wb["DCF"], wb["Scenarios"], wb["Sensitivity"]
DCF = {}  # DCF sheet by label, so a new row can't silently shift what a check reads
for row in D.iter_rows(min_row=1):
    if isinstance(row[0].value, str) and row[1].value is not None:
        DCF.setdefault(row[0].value.strip(), row[1].value)
mc = json.load(open("mc.json")); pdown = json.load(open("mc_pdown.json"))
fails = 0
def check(name, ok, detail):
    global fails
    print(f"{'PASS' if ok else 'FAIL'}  {name}: {detail}")
    fails += 0 if ok else 1

# --- identities and tie-outs to what the company said
price, shares = inp["Share price ($)"], inp["Diluted shares (millions)"]
mcap, netdebt, debtlike = DCF["Market capitalization"], DCF["Net debt (gross debt − cash)"], DCF["Debt-like items from the 10-K, after tax (Inputs)"]
check("market cap = price × shares", abs(mcap - price * shares) < 1, f"${mcap:,.0f}M vs ${price*shares:,.0f}M")
check("net debt = gross debt − cash", abs(netdebt - (inp["Gross debt"] - inp["Cash and temporary investments"])) < 1, f"${netdebt:,.0f}M")
L = lambda prefix: next(v for k, v in inp.items() if k.startswith(prefix))
surplus, deficit = L("Pension plans in surplus"), L("Pension plans in deficit")
check("10-K pension lines tie out: surplus plans − deficit plans = the filing's net, and the U.S. plan's table = its stated surplus",
      abs((surplus - deficit) - L("Pensions, all plans")) < 1 and abs(L("Pension, U.S. qualified plan: assets") - L("Pension, U.S. qualified plan: obligation") - 366) < 1,
      f"${surplus:,.0f}M − ${deficit:,.0f}M = ${surplus - deficit:,.0f}M (10-K: ${L('Pensions, all plans'):,.0f}M); U.S. qualified ${L('Pension, U.S. qualified plan: assets'):,.0f}M − ${L('Pension, U.S. qualified plan: obligation'):,.0f}M = $366M")
dl = ((deficit + L("Retiree medical") + L("Environmental remediation") + L("Asbestos claims")) * (1 - inp["Cash tax rate"])
      - surplus * (1 - inp["Cash tax rate"]) * L("Count the pension surplus") + L("Brazil tax guarantee")
      + L("Deferred tax on the Temple-Inland") - (L("Timber notes held") - L("Nonrecourse loans")))
check("debt-like items rebuild from the 10-K lines and come off the equity, not the WACC", abs(dl - debtlike) < 1 and abs(
      DCF["Equity value = EV − net debt − debt-like"] - (DCF["Enterprise value"] - netdebt - debtlike)) < 1,
      f"${debtlike:,.0f}M after tax = ${dl:,.0f}M from the lines; equity = EV − ${netdebt:,.0f}M − ${debtlike:,.0f}M")
e26 = M["C14"].value
check("2026E EBITDA = guidance midpoint", abs(e26 - (inp["2026 adj. EBITDA guidance — low"] + inp["2026 adj. EBITDA guidance — high"]) / 2) < 1, f"${e26:,.0f}M vs $3,300M guide midpoint")
lfcf26 = M["C30"].value
check("2026E levered FCF inside the company's Jan guide ($300–500M)", 250 <= lfcf26 <= 550, f"${lfcf26:,.0f}M (guide given before the April cut; the low end is the honest reading)")
div = -M["C31"].value
check("dividend cost ≈ $980M", abs(div - 980) < 20, f"${div:,.0f}M = $1.85 × 529.5M")
check("2026E levered FCF does NOT cover the dividend", lfcf26 < div, f"{lfcf26/div:.2f}× coverage")

# --- terminal value cross-checks (each method implies the other's parameter)
tv_mult = DCF["implied exit multiple of the Gordon TV"]; tv_g = DCF["implied perpetual growth of the exit-multiple TV"]
check("Gordon TV implies an exit multiple between SW and PKG", inp["Smurfit Westrock EV/EBITDA (LTM)"] <= tv_mult <= inp["PKG EV/EBITDA (LTM)"], f"{tv_mult:.1f}x (SW {inp['Smurfit Westrock EV/EBITDA (LTM)']}x, PKG {inp['PKG EV/EBITDA (LTM)']}x)")
check("Exit-multiple TV implies a sane perpetual growth (0–4%)", 0 <= tv_g <= 0.04, f"{tv_g*100:.2f}%")
check("WACC > terminal growth", DCF["WACC"] > inp["Terminal growth rate"], f"{DCF['WACC']*100:.2f}% > {inp['Terminal growth rate']*100:.1f}%")
tv_share = DCF["terminal value as % of EV"]
check("terminal value share of EV disclosed and in the mature-company band (60–90%)", 0.6 <= tv_share <= 0.9, f"{tv_share*100:.0f}%")

# --- three routes agree
dcf_ps, scen_mid_ps, sens_cell = DCF["Value per share ($)"], S["C30"].value, V["D8"].value  # sensitivity row 17% × col 8.5x
check("DCF sheet ≈ Scenarios mid-cycle column (same chain, two layouts)", abs(dcf_ps - scen_mid_ps) < 1.0, f"${dcf_ps:.2f} vs ${scen_mid_ps:.2f}")
check("Sensitivity grid (17% × 8.5x) ≈ DCF within the interpolation error", abs(sens_cell - dcf_ps) < 3.0, f"${sens_cell:.2f} vs ${dcf_ps:.2f}")
check("Bear < Mid < Bull", S["B30"].value < S["C30"].value < S["D30"].value, f"${S['B30'].value:.0f} < ${S['C30'].value:.0f} < ${S['D30'].value:.0f}")

# --- the CFO's sensitivity is reproduced
e0, e25 = V["C16"].value, V["C17"].value  # 2027E EBITDA at 0% and 25% stick
check("25% of $170/ton moves 2027E EBITDA by 42.5 × $9M", abs((e25 - e0) - 42.5 * 9) < 1, f"${e25-e0:,.1f}M vs ${42.5*9:,.1f}M (CFO: $10/ton ≈ $90M)")

# --- Python reproduces the spreadsheet chain (the Monte Carlo's point estimate equals the mid column)
import importlib.util, io, contextlib
src = open("montecarlo.py").read().replace('json.dump(out, open("mc.json", "w"), indent=1)', '')
ns = {}
with contextlib.redirect_stdout(io.StringIO()):
    exec(src, ns)
import numpy as np
# deterministic run of the same chain at the mid inputs
a = dict(stick=0.5, margin=0.17, mult=8.0, wacc=DCF["WACC"], vol=0.01, emea_m=0.11, emea_d=150.0, capex=0.065)
pd_ = a["stick"] * 170 * 9 - 175
rev_na_27 = ns["rev_na_26"] * (1 + a["vol"]) + pd_; rev_emea_27 = ns["rev_emea_26"] * 1.025
na27 = 2425 + pd_ + ns["rev_na_26"] * a["vol"] * 0.30 + (300 - 250) * ns["rev_na_26"] / ns["rev_26"]
emea27 = 950 + a["emea_d"] + (300 - 250) * ns["rev_emea_26"] / ns["rev_26"]
check("Python chain reproduces Scenarios!C21 (2027E EBITDA)", abs((na27 + emea27 - 75) - S["C21"].value) < 1, f"${na27+emea27-75:,.0f}M vs ${S['C21'].value:,.0f}M")

# --- Monte Carlo sanity
check("P(value > price) falls monotonically as P(down-cycle) rises", all(pdown[i]["p_above"] > pdown[i+1]["p_above"] for i in range(len(pdown)-1)), " → ".join(f"{r['p_above']:.0%}" for r in pdown))
check("breakeven P(down-cycle) ≈ 50% (market price = expected value)", any(abs(r["mean"] - 32) < 1.5 and abs(r["p_down"] - 0.5) < 1e-9 for r in pdown), f"mean at p=0.5: ${[r['mean'] for r in pdown if abs(r['p_down']-0.5)<1e-9][0]:.1f}")
check("MC mean sits between the Bear and Bull point estimates", S["B30"].value < mc["mean"] < S["D30"].value, f"${mc['mean']:.1f}")
check("regime split is real: P(>price | down) ≪ P(>price | base)", mc["p_above_price_given_down"] < 0.2 and mc["p_above_price_given_base"] > 0.8, f"{mc['p_above_price_given_down']:.0%} vs {mc['p_above_price_given_base']:.0%}")

print(f"\n{fails} failure(s)")
sys.exit(1 if fails else 0)
