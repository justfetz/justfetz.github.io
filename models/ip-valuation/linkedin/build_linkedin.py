"""The LinkedIn post, its carousel caption and the carousel PDF, generated from numbers.json.

Same rule as the blog post: no number is typed here. The text quotes numbers.json `fmt` keys
({{key}} in post.tmpl.txt and caption.tmpl.txt, F[...] in the slides), the charts read its data,
and a missing key stops the build. Run after ../run_all.py:

  python3 build_linkedin.py      writes out/post.txt, out/caption.txt, out/deck.html,
                                 then out/IP-carousel.pdf, out/slide-N.png, out/preview.png (needs node + playwright)
"""
import html, json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL = os.path.dirname(HERE)
OUT = os.path.join(HERE, "out")
os.makedirs(OUT, exist_ok=True)

N = json.load(open(os.path.join(MODEL, "numbers.json")))
F, DATA = N["fmt"], N["data"]
mc = json.load(open(os.path.join(MODEL, "mc.json")))
bet = json.load(open(os.path.join(MODEL, "bet.json")))


def fill(text):
    def sub(m):
        k = m.group(1).strip()
        if k not in F:
            raise KeyError(f"unknown placeholder {{{{{k}}}}} — add it to post_numbers.py")
        return F[k]
    return re.sub(r"\{\{(.*?)\}\}", sub, text)


for name in ("post", "caption"):
    text = fill(open(os.path.join(HERE, f"{name}.tmpl.txt")).read())
    open(os.path.join(OUT, f"{name}.txt"), "w").write(text)
post_len = len(open(os.path.join(OUT, "post.txt")).read().rstrip())
assert post_len <= 3000, f"LinkedIn posts stop at 3,000 characters; this one is {post_len}"

# ---------------------------------------------------------------- the carousel
TENK = "tk_dtl" in F  # the 10-K hidden-debt check, when the model has it
FOOT = (f"<div class='foot'><div><b>Jason Fetzer</b> · 11 years running corrugators<br>model: justfetz.github.io</div>"
        f"<div style='text-align:right'>price as of {F['price_date_short']} close<br>not investment advice</div></div>")
KICK = "International Paper (IP) · Q3 results Oct 28"


def slide(i, n, h1, sub, body):
    pg = f"{i} / {n}" + (" →" if i == 1 else "")
    sub_html = f"<div class='sub'>{sub}</div>" if sub else ""
    return (f"<section class='slide' id='s{i}'><div class='kick'><span>{KICK}</span><span class='pg'>{pg}</span></div>"
            f"<h1>{h1}</h1>{sub_html}{body}{FOOT}</section>")


def s_coin():
    return (f"At {F['price']}, the market is pricing a <em>coin flip</em> on a containerboard down-cycle.",
            f"The chance IP is worth more than {F['price']}, against the odds of a down-cycle in the next three years. {F['n_runs']} runs of a DCF built from IP's own numbers.",
            "<div class='chart' id='c1'></div>")


def s_bridge():
    return (f"Does the <em>{F['idx']} a ton</em> stick? {F['stick_Word']} of it is {F['price_bridge']} of 2027 EBITDA.",
            "North America EBITDA, $ millions, from IP's 2026 guidance to my 2027 bridge, then the deliberate step down to mid-cycle. Grey is IP's guidance, orange my judgment, green what falls out.",
            "<div class='chart' id='c2'></div>")


def s_drivers():
    return ("It still isn't the biggest lever. <em>The cycle</em> is.",
            f"What moves IP's value most across the {F['n_runs']} runs. Margin and multiple are what a down-cycle takes from you, and the down-cycle on its own ranks third. The price debate ranks fifth.",
            "<div class='chart' id='c3'></div>")


def s_lying():
    return ("My first Monte Carlo said 90%. <em>It was lying.</em>",
            f"It drew every input on its own. In a real downturn, price, volume, margin and the multiple fall together. Draw the cycle first, and the {F['n_runs']} values split in two.",
            f"<div class='chart' id='c4'></div><div class='strip'>all {F['n_runs']}: <b>{F['p_above']}</b> above {F['price']} · median <b>{F['median']}</b> · 10th–90th <b>{F['p10']}–{F['p90'][1:]}</b></div>")


def s_position():
    rows = [
        ("Price realization", f"Against the {F['in_guide']} in 2026 guidance. Ahead: the third increase is landing.", f"how much of the {F['idx']} sticks · now {F['stick']}"),
        ("The 2026 EBITDA guide", f"{F['guide']}, cut from {F['guide_jan']} in January. Another cut is the coin flip winning.", f"odds of a down-cycle · now {F['p_down']}"),
        ("Volume against the market", "IP says it's beating the market by three to four points.", f"2027 volume · now {F['vol_signed']}"),
        ("Free cash flow", f"Against a {F['div_cost']} dividend. 2025 came in at {F['fcf25']}.", "the dividend · held, or halved in a down-cycle"),
        ("The EMEA sale", "Unsolicited bids are in, and the DS Smith day is November 3.", f"DS Smith multiple · {F['sotp_emea_mult']} in the model; {F['price']} implies {F['sotp_breakeven']}"),
    ]
    rows_html = "".join(f"<div class='row'><div class='n'>{k}</div><div class='what'><b>{t}</b><span>{d}</span><i>moves: {m}</i></div></div>"
                        for k, (t, d, m) in enumerate(rows, 1))
    ladder = (f"<div class='ladder'><div class='lt'>Each ten points I move toward the market's odds:</div><div class='tiles'>"
              f"<div class='tile me'><small>my {F['p_down']}</small><b>{F['median_at_me_1']}</b></div><div class='step'>−{F['step1_1']}</div>"
              f"<div class='tile'><small>{F['p_me10']}</small><b>{F['med_me10_1']}</b></div><div class='step'>−{F['step2_1']}</div>"
              f"<div class='tile'><small>{F['p_me20']}</small><b>{F['med_me20_1']}</b></div></div>"
              f"<div class='lnote'>median value per share in the model at each probability of a down-cycle; the market's {F['market_odds']} sits between the last two</div></div>")
    return ("For my old finance friends: <em>the position.</em>",
            f"I'm not trading the print. I'm long the gap between my {F['p_down']} and the market's {F['market_odds']}. October 28 tells me who's right.",
            f"<div class='rows'>{rows_html}</div>{ladder}")


def s_instruments():
    R = {r["name"]: r for r in bet["rows"]}
    put = next(r for k, r in R.items() if "put" in k); sh = next(r for k, r in R.items() if k.startswith("100 shares"))
    spr = next(r for k, r in R.items() if "spread" in k); call = next(r for k, r in R.items() if k.startswith("1 call,"))
    inst = [("Sell a $28 put", f"cash-secured, 6 months · ties up ${put['capital']:,.0f} · worst −${-put['worst']:,.0f}", put,
             f"wins most, earns least: {F['put_premium']} of premium against a ${-put['worst']:,.0f} worst case"),
            (f"Buy 100 shares at {F['price']}", f"ties up ${sh['capital']:,.0f} · worst −${-sh['worst']:,.0f}", sh, ""),
            ("35/45 call spread", f"costs ${spr['capital']:,.0f} · worst −${-spr['worst']:,.0f}", spr, f"earns most, and loses money {F['spread_lose']} of the time"),
            ("Buy a Jan-2028 $35 call", f"costs ${call['capital']:,.0f} · worst −${-call['worst']:,.0f}", call, "")]
    roc_max = max(0.5, max(r["roc"] for _, _, r, _ in inst))
    grid = "".join(f"""<div class='irow{' hi' if note else ''}'><div class='iname'><b>{n}</b><span>{d}</span></div>
<div class='bar'><div class='fill' style='width:{r['p_profit'] * 100:.1f}%'></div><em>{r['p_profit']:.0%}</em></div>
<div class='bar'><div class='fill' style='width:{max(r['roc'], 0) / roc_max * 100:.1f}%'></div><em>{r['roc']:+.0%}</em></div>
{f"<div class='inote'>{note}</div>" if note else ""}</div>""" for n, d, r, note in inst)
    return ("<em>Win rate</em> isn't edge.",
            f"The same view four ways, per 100 shares, priced on the {F['n_runs']} runs. The trade that wins most often earns the least on the capital it ties up.",
            f"""<div class='inst'><div class='ihead'><div></div><div>chance it makes money</div><div>return on capital</div></div>{grid}</div>
<div class='kelly'>Half-Kelly says put {F['half_kelly_about']} of the portfolio in it. Half-Kelly has never stood next to a corrugator. <span>Small position, long watch list.</span></div>
<div class='fine'>Over about a year, assuming the price closes {F['convergence']} of the gap to value. Option premiums are placeholders: check the live chain.</div>""")


def s_built():
    steps = [("Sources", f"IP's FY2025 10-K and Q2 2026 release, the Q4 2025 and Q1 2026 calls, Fastmarkets pricing via Packaging Dive, comps from Multiples.vc. Every input is tagged with its source." if TENK else
              "IP's Q2 2026 release, the Q4 2025 and Q1 2026 calls, Fastmarkets pricing via Packaging Dive, comps from Multiples.vc. Every input is tagged with its source."),
             ("Workbook", f"{F['n_formulas']} live formulas. Every judgment of mine is a yellow cell you can overwrite."),
             ("Checks", f"The chain rebuilt line for line in Python, with {F['n_checks']} tie-out checks that fail loudly. All pass."),
             ("Three routes", f"DCF {F['dcf_ps']} · sum of the parts {F['sotp_ps']} · bear / mid / bull {F['bear_ps']} / {F['mid_ps']} / {F['bull_ps']}. They land together."),
             ("Monte Carlo", f"{F['n_runs']} runs, the cycle drawn first, then priced as four different trades.")]
    pipe = "".join(f"<div class='pstep'><div class='dot'>{k}</div><div><div class='pt'>{t}</div><div class='pd'>{d}</div></div></div>" for k, (t, d) in enumerate(steps, 1))
    return ("How it's built, <em>so you can check it.</em>", "",
            f"""<div class='pipe'>{pipe}</div>
<div class='pair'>Built with Claude as my coding pair. The judgment calls are mine.</div>
<div class='cta'><b>What's your number for a down-cycle?</b><span>Tell me and I'll price it. The model, the spreadsheet and the code are in the first comment.</span></div>""")


ORDER = [s_coin, s_bridge, s_drivers, s_lying, s_position, s_instruments, s_built]
if TENK:
    from tenk_slide import s_tenk
    ORDER.insert(0, lambda: s_tenk(F))
slides = [slide(i, len(ORDER), *fn()) for i, fn in enumerate(ORDER, 1)]

b = DATA["bridge"]
running = [b[0], b[0] + b[1], b[0] + b[1] + b[2], b[0] + b[1] + b[2] + b[3], b[5], b[6]]
assert 2000 <= min(running) and max(running) <= 3300, f"bridge {b} no longer fits the slide's $2,000–3,300M axis"
deck_data = {"price": DATA["calc"]["price"], "p_down": mc["p_down"], "idx": DATA["calc"]["idx"], "pdown": DATA["MC"]["pdown"],
             "drivers": mc["drivers"], "bridge": b, "labels": {"stick_word": F["stick_Word"].lower(), "vol": F["vol_signed"]},
             "regime": {"edges": mc["hist"]["edges"], "down": mc["hist"]["down"], "base": mc["hist"]["base"], "n_down": round(mc["share_down"] * mc["n"]),
                        "n": mc["n"], "p_above_down": mc["p_above_price_given_down"], "p_above_base": mc["p_above_price_given_base"],
                        "med_down": mc["median_down"], "med_base": mc["median_base"]},
             }
C = os.path.join(HERE, "carousel")
page = (f"<!doctype html><html><head><meta charset='utf-8'><title>IP at {F['price']}: a coin flip on the cycle</title>"
        f"<style>{open(os.path.join(C, 'deck.css')).read()}</style><script>{open(os.path.join(C, 'd3.min.js')).read()}</script></head>"
        f"<body>{''.join(slides)}<script>const DATA={json.dumps(deck_data)};</script><script>{open(os.path.join(C, 'deck.js')).read()}</script></body></html>")
open(os.path.join(OUT, "deck.html"), "w").write(page)
print(f"out/: post.txt ({post_len} characters), caption.txt, deck.html ({len(ORDER)} slides)")

if "--no-pdf" not in sys.argv:
    subprocess.run(["node", os.path.join(C, "shoot.mjs"), OUT], check=True)
