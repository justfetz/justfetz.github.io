"""The carousel's lead slide: the 10-K's hidden-debt check, item by item, in value per share."""


def s_tenk(F):
    rows = [
        ("Pensions in surplus", f"{F['tk_surplus']} · the U.S. plan holds {F['tk_us_q_assets']} against {F['tk_us_q_pbo']} owed", F["ps_surplus"], "not counted"),
        ("Pensions in deficit", f"{F['tk_deficit']} owed by the underfunded plans", F["ps_deficit"], "after tax"),
        ("Retiree medical", f"{F['tk_opeb']} unfunded", F["ps_opeb"], "after tax"),
        ("Leases", f"{F['tk_op_leases']} operating: the rent is already inside EBITDA. {F['tk_fin_leases']} finance: already in debt.", F["ps_zero"], "count them again and you count them twice"),
        ("Timber-note tax, due 2027", f"{F['tk_dtl']} · \"settled with the maturity of the notes in 2027\"", F["ps_dtl"], "in full"),
        ("Timber notes, net of their loans", f"{F['tk_vie_assets']} of notes against {F['tk_vie_liab']} of loans", F["ps_vie"], "the rest is IP's"),
    ]
    body = "".join(
        f"<div class='trow{' cnt' if eff not in ('$0.00',) else ''}'><div class='titem'><b>{item}</b><span>{said}</span></div>"
        f"<div class='tfx'><em>{eff}</em><span>{how}</span></div></div>" for item, said, eff, how in rows)
    total = (f"<div class='ttot'><div>DCF value per share</div><div><s>{F['was_dcf_ps2']}</s> → <b>{F['dcf_ps2']}</b></div></div>"
             f"<div class='tnote'>The odds the {F['price']} price implies: {F['was_market_odds']} → {F['market_odds']}. <b>The discount isn't hidden debt. It's the cycle.</b></div>")
    return ("Pensions: clean. Leases: clean. <em>A footnote: " + F["tk_dtl"].replace("M", "M.") + "</em>",
            "What IP's FY2025 10-K adds to the debt that \"net debt\" leaves out, line by line, in value per share.",
            f"<div class='tenk'>{body}</div>{total}")
