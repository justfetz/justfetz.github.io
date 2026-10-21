"""Every number the post, the workbook's Dictionary, the LinkedIn text and the carousel quote.

Computed from the model's own outputs, never typed: the recalculated workbook, inputs.json,
mc.json, mc_pdown.json, bet.json and validate_out.txt. Text quotes `fmt` keys; charts and
tables read `data`. Change an input, rerun run_all.py, and every page that quotes a number
follows it.
Run: python3 post_numbers.py  (writes numbers.json)
"""
import json, math
import numpy as np
from openpyxl import load_workbook

wb = load_workbook("IP_valuation_model.xlsx", data_only=True)
inputs = json.load(open("inputs.json"))
V = {k: v["value"] for k, v in inputs.items()}
mc = json.load(open("mc.json")); pdown = json.load(open("mc_pdown.json")); bet = json.load(open("bet.json"))
checks = [l.rstrip("\n") for l in open("validate_out.txt") if l.startswith(("PASS", "FAIL"))]
assert checks and all(l.startswith("PASS") for l in checks), "post_numbers.py needs a green validate_out.txt"


def by_label(ws, cols, first=1):
    """label in column A -> values in the given columns. Labels are stripped; the first row with any
    value wins, so a section header that shares its name with a row (DCF's "WACC") doesn't shadow it."""
    out = {}
    for r in range(first, ws.max_row + 1):
        a = ws.cell(r, 1).value
        vals = [ws.cell(r, c).value for c in cols]
        if isinstance(a, str) and (a.strip() not in out or all(v is None for v in out[a.strip()])):
            out[a.strip()] = vals
    return out


D = {k: v[0] for k, v in by_label(wb["DCF"], [2]).items()}
DCF_CF = by_label(wb["DCF"], [2, 3, 4, 5])
M = by_label(wb["Model"], [2, 3, 4, 5, 6, 7])
S = by_label(wb["Scenarios"], [2, 3, 4])
C = by_label(wb["Comps_SOTP"], [2, 3, 4])
sv = wb["Sensitivity"]
grid_mults = [sv.cell(5, c).value for c in range(2, 8)]
grid = [(sv.cell(r, 1).value, [sv.cell(r, c).value for c in range(2, 8)]) for r in range(6, 11)]

price = V["price"]; shares = V["shares"]
net_debt = D["Net debt (gross debt − cash)"]
debt_like = D["Debt-like items from the 10-K, after tax (Inputs)"]   # pensions, retiree medical, the timber tax (a formula on Inputs)
mcap = price * shares
rev_na_26 = V["rev_2026_h1"] * 2 * V["rev_2025_na"] / (V["rev_2025_na"] + V["rev_2025_emea"])
price_bridge = V["stick_pct"] * V["price_index_ytd"] * V["price_sens"] - V["price_in_2026"]
na27 = M["Adj. EBITDA — NA"][2]; na28 = M["Adj. EBITDA — NA"][3]
vol_step = rev_na_26 * V["vol_2027_na"] * V["contrib_margin"]
cost_na = V["costout_2027"] * rev_na_26 / M["Net sales — enterprise"][1]
infl_na = -V["inflation_2027"] * rev_na_26 / M["Net sales — enterprise"][1]
assert abs(V["ebitda_2026_na_guide"] + price_bridge + vol_step + cost_na + infl_na - na27) < 0.5, "bridge steps don't add up to the Model sheet"
def bridge_steps():
    """The waterfall's bars in whole $M, rounded so they add up to the rounded 2027 total."""
    raw = [price_bridge, vol_step, cost_na, infl_na]
    base, total = round(V["ebitda_2026_na_guide"]), round(na27)
    steps = [math.floor(v) for v in raw]
    short = total - base - sum(steps)
    for i in sorted(range(len(raw)), key=lambda i: raw[i] - steps[i], reverse=True)[:short]:
        steps[i] += 1
    return [base] + steps + [total, round(na28)]


BRIDGE = bridge_steps()
assert BRIDGE[0] + sum(BRIDGE[1:5]) == BRIDGE[5]
weights = [0.30, 0.45, 0.25]
pw = sum(w * p for w, p in zip(weights, S["Value per share ($)"]))
dcf_ps = D["Value per share ($)"]; sotp_ps = C["Per share ($)"][2]
wacc = D["WACC"]


# --- the deterministic chain (the Scenarios sheet's mid column), to price "one point of WACC"
def chain_ps(w, margin=None):
    rev_na27 = rev_na_26 * (1 + V["vol_2027_na"]) + price_bridge
    rev_emea_26 = V["rev_2026_h1"] * 2 - rev_na_26
    rev_emea27 = rev_emea_26 * (1 + V["rev_growth_lt"])
    corp = (V["ebitda_2026_guide_lo"] + V["ebitda_2026_guide_hi"]) / 2 - V["ebitda_2026_na_guide"] - V["ebitda_2026_emea_guide"]
    share_na = rev_na_26 / (rev_na_26 + rev_emea_26)
    na = V["ebitda_2026_na_guide"] + price_bridge + vol_step + (V["costout_2027"] - V["inflation_2027"]) * share_na
    emea = V["ebitda_2026_emea_guide"] + V["emea_2027_delta"] + (V["costout_2027"] - V["inflation_2027"]) * (1 - share_na)
    e27, rev27 = na + emea + corp, rev_na27 + rev_emea27
    g3 = (1 + V["rev_growth_lt"]) ** 3; rev30 = rev27 * g3
    e30 = rev_na27 * g3 * (margin or V["midcycle_na_margin"]) + rev_emea27 * g3 * V["midcycle_emea_margin"] + corp
    da, t = V["da_pct_lt"], V["tax_rate"]
    u30 = (e30 - rev30 * da) * (1 - t) + rev30 * da - rev30 * V["capex_pct_lt"] - rev30 * V["rev_growth_lt"] / (1 + V["rev_growth_lt"]) * V["nwc_pct"]
    u27 = (e27 - rev27 * da) * (1 - t) + rev27 * da - V["capex_2027"] - V["sep_costs_2026"] * 0.5
    pv = u27 / (1 + w) ** 0.7 + (u27 * 2 / 3 + u30 / 3) / (1 + w) ** 1.7 + (u27 / 3 + u30 * 2 / 3) / (1 + w) ** 2.7 + u30 / (1 + w) ** 3.7
    tv = 0.5 * (u30 * (1 + V["g"]) / (w - V["g"]) + e30 * V["exit_mult"])
    return (pv + tv / (1 + w) ** 3.7 - net_debt - debt_like) / shares


assert abs(chain_ps(S["WACC"][1]) - S["Value per share ($)"][1]) < 0.01, "Python chain no longer matches Scenarios mid column"
wacc_plus1 = 1 - chain_ps(S["WACC"][1] + 0.01) / chain_ps(S["WACC"][1])

# --- the Monte Carlo and the bet
pct = mc["percentiles"]
AT = {round(r["p_down"], 2): r for r in pdown}
me = AT[round(mc["p_down"], 2)]
# the probability of a down-cycle at which P(value > price) is a coin flip: where the market sits
cross = next(a["p_down"] + (a["p_above"] - 0.5) / (a["p_above"] - b["p_above"]) * (b["p_down"] - a["p_down"])
             for a, b in zip(pdown, pdown[1:]) if a["p_above"] >= 0.5 > b["p_above"])
fair = next(a["p_down"] + (a["mean"] - price) / (a["mean"] - b["mean"]) * (b["p_down"] - a["p_down"])
            for a, b in zip(pdown, pdown[1:]) if a["mean"] >= price > b["mean"])
R = {r["name"]: r for r in bet["rows"]}
shares_row = next(r for k, r in R.items() if k.startswith("100 shares"))
call_row = next(r for k, r in R.items() if k.startswith("1 call,"))
put_row = next(r for k, r in R.items() if "put" in k)
spread_row = next(r for k, r in R.items() if "spread" in k)

WORDS = {12: "twelve", 13: "thirteen", 14: "fourteen", 15: "fifteen", 16: "sixteen", 17: "seventeen", 18: "eighteen", 19: "nineteen",
         20: "twenty", 21: "twenty-one", 22: "twenty-two", 23: "twenty-three", 24: "twenty-four", 25: "twenty-five"}
FRACTIONS = [(1 / 2, "half"), (3 / 5, "three-fifths"), (2 / 3, "two-thirds"), (3 / 4, "three-quarters"), (4 / 5, "four-fifths")]


ONES = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split()
TENS = "_ _ twenty thirty forty fifty sixty seventy eighty ninety".split()


def words(n):
    """0–99 in words, for prose like 'down twenty percent'."""
    n = int(round(n))
    return ONES[n] if n < 20 else TENS[n // 10] + ("" if n % 10 == 0 else "-" + ONES[n % 10])


def usd(v, d=0): return ("−" if v < 0 else "") + f"${abs(v):,.{d}f}"
def usd_m(v): return ("−" if v < 0 else "") + f"${abs(v):,.0f}M"
def usd_b(v): return ("−" if v < 0 else "") + f"${abs(v) / 1000:,.1f}B"
def pc(v, d=0): return ("−" if v < 0 else "") + f"{abs(v) * 100:.{d}f}%"
def x(v, d=1): return f"{v:.{d}f}×"
def pts(v): return f"{v * 100:.0f}"


formulas = sum(1 for ws in load_workbook("IP_valuation_model.xlsx") for row in ws.iter_rows() for c in row
               if isinstance(c.value, str) and c.value.startswith("="))
F = {
    # market and company facts (Inputs sheet)
    "price": usd(price), "price_date": V["price_date"], "price_date_short": V["price_date"].rsplit(",", 1)[0], "wk52": f"${V['wk52_lo']:.0f}–{V['wk52_hi']:.0f}",
    "chg_ytd": pc(V["chg_ytd"]), "chg_12m": pc(V["chg_12m"]), "yield": pc(V["dps"] / price, 1), "dps": usd(V["dps"], 2),
    "div_cost": usd_m(V["dps"] * shares), "shares": f"{shares:,.1f}M", "mcap_b": usd_b(mcap), "mcap_b0": f"${mcap / 1000:,.0f}B",
    "gross_debt": usd_m(V["gross_debt"]), "cash": usd_m(V["cash"]), "debt_like": usd_m(debt_like), "net_debt_all": usd_m(net_debt + debt_like),
    "net_debt": usd_m(net_debt), "net_debt_b": usd_b(net_debt), "ev_mkt_b": usd_b(mcap + net_debt),
    "guide": f"${V['ebitda_2026_guide_lo'] / 1000:.1f}–{V['ebitda_2026_guide_hi'] / 1000:.1f}B",
    "guide_jan": f"${V['ebitda_2026_guide_jan_lo'] / 1000:.1f}–{V['ebitda_2026_guide_jan_hi'] / 1000:.1f}B",
    "fcf25": usd_m(V["fcf_2025"]), "idx": usd(V["price_index_ytd"]), "sens10": usd_m(V["price_sens"] * 10),
    "da26": usd_m(V["da_2026"]), "da_pct": pc(V["da_pct_lt"]), "capex26_b": usd_b(V["capex_2026_h1"] * 2),
    "in_guide": usd_m(V["price_in_2026"]), "sens1": usd_m(V["price_sens"]),
    # the judgments (yellow cells)
    "stick": pc(V["stick_pct"]), "price_bridge": usd_m(price_bridge), "vol": pc(V["vol_2027_na"]), "contrib": pc(V["contrib_margin"]),
    "costout": usd_m(V["costout_2027"]), "infl": usd_m(V["inflation_2027"]), "na_margin": pc(V["midcycle_na_margin"]),
    "na_margin_26": pc(V["ebitda_2026_na_guide"] / rev_na_26, 1), "emea_margin": pc(V["midcycle_emea_margin"]),
    "capex_pct": pc(V["capex_pct_lt"], 1), "nwc_pct": pc(V["nwc_pct"]), "tax": pc(V["tax_rate"]), "g": pc(V["g"]),
    "rf": pc(V["rf"]), "beta": f"{V['beta']:.2f}", "erp": pc(V["erp"], 1), "kd": pc(V["kd"], 1), "exit_mult": x(V["exit_mult"]),
    "exit_mult0": x(V["exit_mult"], 0), "p_down": pc(mc["p_down"]),
    "sw_margin": pc(V["sw_margin"]), "pkg_margin": pc(V["pkg_margin"]), "sw_mult": x(V["sw_ev_ebitda"]), "pkg_mult": x(V["pkg_ev_ebitda"]),
    "sw_mult0": x(V["sw_ev_ebitda"], 0), "pkg_mult0": x(V["pkg_ev_ebitda"], 0),
    # what the machine says
    "dcf_ps": usd(dcf_ps), "dcf_ps2": usd(dcf_ps, 2), "wacc": pc(wacc, 1), "coe": pc(D["Cost of equity = rf + β × ERP"], 1),
    "tv_share": pc(D["terminal value as % of EV"]), "tv_mult": x(D["implied exit multiple of the Gordon TV"]),
    "sotp_ps": usd(sotp_ps), "sotp_na_mult": x(C["Packaging Solutions NA"][1], 0), "sotp_na_mult1": x(C["Packaging Solutions NA"][1]), "sotp_emea_mult": x(C["Packaging Solutions EMEA (DS Smith)"][1]),
    "sotp_breakeven": x(C["Breakeven: EMEA multiple at which SOTP = market price"][2]),
    "bear_ps": usd(S["Value per share ($)"][0]), "mid_ps": usd(S["Value per share ($)"][1]), "bull_ps": usd(S["Value per share ($)"][2]),
    "weights": "/".join(pts(w) for w in weights), "pw_ps": usd(pw), "margin_of_safety": pc(1 - price / dcf_ps),
    "mkt_ev_26": x(D["market EV / 2026E EBITDA (today)"]), "mkt_ev_27": x(D["market EV / 2027E EBITDA (today)"], 0),
    "lfcf26": usd_m(M["Levered FCF proxy = UFCF − after-tax interest"][1]), "lfcf26_100": usd_m(round(M["Levered FCF proxy = UFCF − after-tax interest"][1], -2)),
    "df3": f"{100 / (1 + wacc) ** 3:.0f}¢", "wacc_1p": f"{1 + wacc:.3f}", "wacc_plus1": pc(wacc_plus1),
    "na27": usd_m(na27), "na28": usd_m(na28), "vol_step": usd_m(BRIDGE[2]), "cost_na": usd_m(BRIDGE[3]), "infl_na": usd_m(BRIDGE[4]),
    **{f"bridge_{i}": str(v) for i, v in enumerate(BRIDGE)}, "bridge_mid": str(int(round((BRIDGE[5] + BRIDGE[6]) / 2, -1))),
    # the bet
    "n_runs": f"{mc['n']:,}", "noise": pc(mc["model_noise_sd"]), "p_above": pc(mc["p_above_price"]), "p_above_down": pc(mc["p_above_price_given_down"]),
    "p_above_base": pc(mc["p_above_price_given_base"]), "median": usd(pct["50"]), "mean": usd(mc["mean"]),
    "p10": usd(pct["10"]), "p90": usd(pct["90"]), "half_price": usd(price / 2), "double_price": usd(price * 2),
    "p_half": pc(mc["p_loss_half"]), "p_double": pc(mc["p_double"]), "sweep_lo": pc(pdown[0]["p_down"]), "sweep_hi": pc(pdown[-1]["p_down"]),
    "median_at_me": usd(me["median"]), **{f"med_{round(r['p_down'] * 100)}": usd(r["median"]) for r in pdown},
    # each ten points I move toward the market's odds: my odds, +10, +20
    "p_me10": pc(mc["p_down"] + 0.1), "p_me20": pc(mc["p_down"] + 0.2),
    "med_me10": usd(AT[round(mc["p_down"] + 0.1, 2)]["median"]), "med_me20": usd(AT[round(mc["p_down"] + 0.2, 2)]["median"]),
    "step1": usd(me["median"] - AT[round(mc["p_down"] + 0.1, 2)]["median"]),
    "step2": usd(AT[round(mc["p_down"] + 0.1, 2)]["median"] - AT[round(mc["p_down"] + 0.2, 2)]["median"]),
    # the same ladder to one decimal, for the slide's tiles, so tile-to-tile differences match the steps
    "median_at_me_1": usd(me["median"], 1), "med_me10_1": usd(AT[round(mc["p_down"] + 0.1, 2)]["median"], 1),
    "med_me20_1": usd(AT[round(mc["p_down"] + 0.2, 2)]["median"], 1),
    "step1_1": usd(round(me["median"], 1) - round(AT[round(mc["p_down"] + 0.1, 2)]["median"], 1), 1),
    "step2_1": usd(round(AT[round(mc["p_down"] + 0.1, 2)]["median"], 1) - round(AT[round(mc["p_down"] + 0.2, 2)]["median"], 1), 1),
    "median_down": usd(mc["median_down"]), "median_base": usd(mc["median_base"]), "share_down": pc(mc["share_down"]), "share_base": pc(1 - mc["share_down"]), "market_odds": pc(cross), "fair_odds": pc(fair), "kelly": f"{mc['kelly']:.2f}",
    "half_kelly": f"{mc['half_kelly']:.2f}", "half_kelly_about": f"{math.floor(mc['half_kelly'] * 10) * 10}%",
    "convergence": pc(bet["convergence"]), "mkt_noise": pc(bet["noise"]),
    "put_win": pc(put_row["p_profit"]), "put_lose": pc(1 - put_row["p_profit"]), "put_worst_round": usd(math.floor(-put_row["worst"] / 100) * 100),
    "put_premium": usd(bet["premiums"]["put"] * 100), "spread_lose": pc(1 - spread_row["p_profit"]), "spread_wipe": pc(bet["spread_wipeout"]),
    "spread_cost": usd(spread_row["capital"]), "shares_odds": min(FRACTIONS, key=lambda f: abs(f[0] - shares_row["p_profit"]))[1],
    "shares_roc": ("+" if shares_row["roc"] >= 0 else "") + pc(shares_row["roc"]), "spread_roc": "+" + pc(spread_row["roc"]), "spread_roc_abs": pc(spread_row["roc"]),
    "put_roc": ("+" if put_row["roc"] >= 0 else "") + pc(put_row["roc"]), "call_win": pc(call_row["p_profit"]),
    "chg_ytd_words": words(abs(V["chg_ytd"]) * 100) + " percent", "n_runs_words": words(mc["n"] / 1000) + " thousand",
    "n_runs_Words": (words(mc["n"] / 1000) + " thousand").capitalize(), "vol_signed": ("+" if V["vol_2027_na"] >= 0 else "") + pc(V["vol_2027_na"]),
    "stick_Word": next((w.capitalize() for f, w in FRACTIONS if abs(f - V["stick_pct"]) < 1e-9), pc(V["stick_pct"])),
    "stick_pts": f"{V['stick_pct'] * 100:g}", "na_margin_pts": f"{V['midcycle_na_margin'] * 100:g}", "na_margin_1": pc(V["midcycle_na_margin"], 1),
    "exit_mult_val": f"{V['exit_mult']:g}", "wacc_pts": f"{round(wacc * 100, 1):g}", "p_down_pts": f"{mc['p_down'] * 100:g}",
    # the receipts
    "n_checks": str(len(checks)), "n_checks_word": WORDS.get(len(checks), str(len(checks))),
    "n_checks_Word": WORDS.get(len(checks), str(len(checks))).capitalize(), "n_formulas": str(formulas),
}
# --- the 10-K pass: each line that behaves like debt, in value per share, and what the post said before it
t = V["tax_rate"]
TK = {"deficit": -V["pen_deficit"] * (1 - t), "opeb": -V["opeb"] * (1 - t), "dtl": -V["timber_dtl"], "vie": V["vie_assets"] - V["vie_liab"],
      "surplus": V["pen_surplus"] * (1 - t) * V["count_surplus"], "env": -V["env_reserve"] * (1 - t), "asb": -V["asbestos"] * (1 - t),
      "brazil": -V["brazil_booked"]}
assert abs(sum(TK.values()) + debt_like) < 0.5, "the 10-K lines no longer add up to the workbook's debt-like total"


def ps(v):
    v /= shares
    return ("+" if v > 0.005 else "−" if v < -0.005 else "") + f"${abs(v):.2f}"


F.update({
    "tk_us_q_assets": usd_m(V["pen_us_q_assets"]), "tk_us_q_pbo": usd_m(V["pen_us_q_pbo"]),
    "tk_us_q_surplus": usd_m(V["pen_us_q_assets"] - V["pen_us_q_pbo"]), "tk_uk_surplus": usd_m(V["pen_uk_surplus"]),
    "tk_us_nq": usd_m(V["pen_us_nq"]), "tk_net": usd_m(V["pen_net"]), "tk_surplus": usd_m(V["pen_surplus"]), "tk_deficit": usd_m(V["pen_deficit"]),
    "tk_opeb": usd_m(V["opeb"]), "tk_op_leases": usd_m(V["op_leases"]), "tk_fin_leases": usd_m(V["fin_leases"]), "tk_dtl": usd_m(V["timber_dtl"]),
    "tk_vie_assets": usd_m(V["vie_assets"]), "tk_vie_liab": usd_m(V["vie_liab"]), "tk_vie_equity": usd_m(V["vie_assets"] - V["vie_liab"]),
    "tk_debt_2027": usd_b(V["debt_2027"]), "tk_utb": usd_m(V["utb"]), "tk_brazil": usd_m(V["brazil_tax"]),
    "tk_surplus_counted": "counted" if V["count_surplus"] else "not counted",
    "ps_deficit": ps(TK["deficit"]), "ps_opeb": ps(TK["opeb"]), "ps_dtl": ps(TK["dtl"]), "ps_vie": ps(TK["vie"]),
    "ps_timber": ps(TK["dtl"] + TK["vie"]), "ps_surplus": ps(TK["surplus"]), "ps_surplus_if": ps(V["pen_surplus"] * (1 - t)),
    "ps_pensions": ps(TK["deficit"] + TK["opeb"] + TK["surplus"]), "ps_total": ps(-debt_like),
    "tk_env": usd_m(V["env_reserve"]), "tk_asb": usd_m(V["asbestos"]), "tk_brazil_booked": usd_m(V["brazil_booked"]),
    "tk_reserves": usd_m(V["env_reserve"] + V["asbestos"] + V["brazil_booked"]), "tk_env_asb": usd_m(V["env_reserve"] + V["asbestos"]),
    "tk_brazil_rest": usd_m(V["brazil_tax"] - V["brazil_booked"]),
    "ps_env": ps(TK["env"]), "ps_asb": ps(TK["asb"]), "ps_brazil_booked": ps(TK["brazil"]), "ps_reserves": ps(TK["env"] + TK["asb"] + TK["brazil"]),
    "ps_pen_opeb": ps(TK["deficit"] + TK["opeb"]), "tk_pen_opeb": usd_m(V["pen_deficit"] + V["opeb"]),
    "ps_utb": ps(-V["utb"]), "ps_brazil": ps(-V["brazil_tax"]), "ps_brazil_rest": ps(-(V["brazil_tax"] - V["brazil_booked"])), "ps_zero": "$0.00", "ps_total_abs": f"${debt_like / shares:.2f}",
    "edge": f"{round((cross - mc['p_down']) * 100)} points",
    **{f"was_{k}": v for k, v in json.load(open("published.json"))["before_10k"]["fmt"].items()},
})
F["was_edge"] = f"{int(F['was_market_odds'].rstrip('%')) - round(mc['p_down'] * 100)} points"

data = {
    "MC": {"price": mc["price"], "p_down": mc["p_down"], "p_above": mc["p_above_price"], "mean": mc["mean"], "pct": pct,
           "half_kelly": mc["half_kelly"], "p_half": mc["p_loss_half"], "p_double": mc["p_double"],
           "down": {"p": mc["p_above_price_given_down"], "mean": mc["mean_down"]}, "base": {"p": mc["p_above_price_given_base"], "mean": mc["mean_base"]},
           "hist": mc["hist"], "drivers": mc["drivers"], "pdown": pdown},
    "bridge": BRIDGE,
    "calc": {"price": price, "shares": shares, "netDebt": net_debt + debt_like, "revNA25": V["rev_2025_na"], "revEMEA25": V["rev_2025_emea"],
             "revH1": V["rev_2026_h1"], "na26": V["ebitda_2026_na_guide"], "emea26": V["ebitda_2026_emea_guide"],
             "corp": (V["ebitda_2026_guide_lo"] + V["ebitda_2026_guide_hi"]) / 2 - V["ebitda_2026_na_guide"] - V["ebitda_2026_emea_guide"],
             "idx": V["price_index_ytd"], "sens": V["price_sens"], "inGuide": V["price_in_2026"], "contrib": V["contrib_margin"],
             "costout": V["costout_2027"], "infl": V["inflation_2027"], "emeaDelta": V["emea_2027_delta"], "g": V["rev_growth_lt"],
             "da": V["da_pct_lt"], "nwc": V["nwc_pct"], "tax": V["tax_rate"], "capex27": V["capex_2027"], "sep": V["sep_costs_2026"],
             "gT": V["g"], "emeaMargin": V["midcycle_emea_margin"], "capexLT": V["capex_pct_lt"], "vol": V["vol_2027_na"],
             "stick": V["stick_pct"], "margin": V["midcycle_na_margin"], "mult": V["exit_mult"], "wacc": round(wacc, 3), "pDown": mc["p_down"]},
    "grid": {"mults": grid_mults, "rows": grid, "model_margin": V["midcycle_na_margin"], "model_mult_col": min(grid_mults, key=lambda m: (abs(m - V["exit_mult"]), -m))},
    "checks": checks,
}
json.dump({"fmt": F, "data": data}, open("numbers.json", "w"), indent=1, ensure_ascii=False)
print(f"numbers.json: {len(F)} quoted numbers; DCF {F['dcf_ps']}, P(> {F['price']}) {F['p_above']}, market odds {F['market_odds']}, {F['n_checks']} checks")
