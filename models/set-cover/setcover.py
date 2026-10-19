#!/usr/bin/env python3
"""Set cover on the plant network (Korte & Vygen §16.1).

Universe: 69 US metros. A plant at metro s covers every metro within 250 road-ish miles
(great-circle here), the freight reach from the network model. Question: the fewest plants
that reach every metro. That is SET COVER, NP-hard, and the chapter's first approximation
algorithm is the obvious one:

    greedy: repeatedly pick the set covering the most still-uncovered elements.

Chvátal's bound (Korte & Vygen Theorem 16.3): greedy uses at most H(k) * OPT sets, where
k is the largest set and H(k) = 1 + 1/2 + ... + 1/k ~ ln k. The bound is tight in the worst
case (see bad_instance), and usually loose in practice; this file measures both.

Three solvers, each a check on the others:
    greedy         -> an upper bound on OPT, with the pick-by-pick trace
    lp_lower_bound -> the LP relaxation (GLOP), a lower bound on OPT; ceil() it
    exact          -> CP-SAT, the true optimum

Run:  python3 setcover.py          # solves and writes setcover.json for the post
      python3 setcover.py --test   # the checks
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

from ortools.linear_solver import pywraplp
from ortools.sat.python import cp_model

HERE = Path(__file__).resolve().parent
RADIUS_MI = 250.0

# (name, lat, lon, population in millions) -- the network model's metros
METROS = [
    ("New York", 40.71, -74.01, 19.5), ("Los Angeles", 34.05, -118.24, 13.0), ("Chicago", 41.88, -87.63, 9.5),
    ("Dallas", 32.78, -96.80, 7.6), ("Houston", 29.76, -95.37, 7.1), ("Washington", 38.91, -77.04, 6.3),
    ("Miami", 25.76, -80.19, 6.1), ("Philadelphia", 39.95, -75.17, 6.2), ("Atlanta", 33.75, -84.39, 6.1),
    ("Phoenix", 33.45, -112.07, 4.9), ("Boston", 42.36, -71.06, 4.9), ("San Francisco", 37.77, -122.42, 4.7),
    ("Riverside", 33.95, -117.40, 4.6), ("Detroit", 42.33, -83.05, 4.4), ("Seattle", 47.61, -122.33, 4.0),
    ("Minneapolis", 44.98, -93.27, 3.7), ("San Diego", 32.72, -117.16, 3.3), ("Tampa", 27.95, -82.46, 3.2),
    ("Denver", 39.74, -104.99, 3.0), ("Baltimore", 39.29, -76.61, 2.8), ("St. Louis", 38.63, -90.20, 2.8),
    ("Orlando", 28.54, -81.38, 2.7), ("Charlotte", 35.23, -80.84, 2.7), ("San Antonio", 29.42, -98.49, 2.6),
    ("Portland", 45.52, -122.68, 2.5), ("Sacramento", 38.58, -121.49, 2.4), ("Pittsburgh", 40.44, -80.00, 2.4),
    ("Austin", 30.27, -97.74, 2.3), ("Las Vegas", 36.17, -115.14, 2.3), ("Cincinnati", 39.10, -84.51, 2.2),
    ("Kansas City", 39.10, -94.58, 2.2), ("Columbus", 39.96, -83.00, 2.1), ("Indianapolis", 39.77, -86.16, 2.1),
    ("Cleveland", 41.50, -81.69, 2.1), ("Nashville", 36.16, -86.78, 2.0), ("San Jose", 37.34, -121.89, 2.0),
    ("Virginia Beach", 36.85, -75.98, 1.8), ("Providence", 41.82, -71.41, 1.6), ("Jacksonville", 30.33, -81.66, 1.6),
    ("Milwaukee", 43.04, -87.91, 1.6), ("Oklahoma City", 35.47, -97.52, 1.4), ("Raleigh", 35.78, -78.64, 1.4),
    ("Memphis", 35.15, -90.05, 1.3), ("Richmond", 37.54, -77.44, 1.3), ("Louisville", 38.25, -85.76, 1.3),
    ("New Orleans", 29.95, -90.07, 1.3), ("Salt Lake City", 40.76, -111.89, 1.2), ("Hartford", 41.76, -72.69, 1.2),
    ("Buffalo", 42.89, -78.88, 1.1), ("Birmingham", 33.52, -86.81, 1.1), ("Grand Rapids", 42.96, -85.67, 1.1),
    ("Tucson", 32.22, -110.97, 1.0), ("Fresno", 36.74, -119.78, 1.0), ("Omaha", 41.26, -95.94, 1.0),
    ("Tulsa", 36.15, -95.99, 1.0), ("Albuquerque", 35.08, -106.65, 0.9), ("El Paso", 31.76, -106.49, 0.9),
    ("Boise", 43.62, -116.21, 0.8), ("Des Moines", 41.59, -93.62, 0.7), ("Little Rock", 34.75, -92.29, 0.7),
    ("Spokane", 47.66, -117.43, 0.6), ("Reno", 39.53, -119.81, 0.5), ("Chattanooga", 35.05, -85.31, 0.6),
    ("Greenville", 34.85, -82.39, 0.9), ("Knoxville", 35.96, -83.92, 0.9), ("Madison", 43.07, -89.40, 0.7),
    ("Wichita", 37.69, -97.34, 0.6), ("Toledo", 41.65, -83.54, 0.6), ("Dayton", 39.76, -84.19, 0.8),
]
# the fictional producer's existing plants, from the network model
EXISTING = ["Chicago", "Atlanta", "Dallas", "Los Angeles", "Seattle", "Denver", "Minneapolis",
            "Philadelphia", "Charlotte", "Houston", "Kansas City", "Phoenix", "Columbus", "Nashville"]


def haversine_mi(lat1, lon1, lat2, lon2):
    r = 3958.8
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def build_sets(metros=METROS, radius=RADIUS_MI):
    """sets[i] = frozenset of metro indices within radius of metro i (a plant at i covers these)."""
    return [frozenset(j for j, m in enumerate(metros) if haversine_mi(s[1], s[2], m[1], m[2]) <= radius)
            for s in metros]


# ----------------------------------------------------------------------------- three solvers

def greedy(sets, universe, allowed=None):
    """Chvátal's greedy. Returns the chosen set indices in order and a trace of marginal gains.
    Ties break toward the lower index, which is deterministic and matches the figure."""
    allowed = range(len(sets)) if allowed is None else allowed
    uncovered = set(universe)
    chosen, trace = [], []
    while uncovered:
        best, gain = None, 0
        for i in allowed:
            g = len(sets[i] & uncovered)
            if g > gain:
                best, gain = i, g
        if best is None:
            raise ValueError("some element is in no set")
        chosen.append(best)
        newly = sorted(sets[best] & uncovered)
        uncovered -= sets[best]
        trace.append({"pick": best, "gain": gain, "newly": newly, "left": len(uncovered)})
    return chosen, trace


def lp_lower_bound(sets, universe, allowed=None):
    """LP relaxation: min sum x_i s.t. for each element, sum of x_i over sets containing it >= 1, 0<=x<=1."""
    allowed = list(range(len(sets)) if allowed is None else allowed)
    s = pywraplp.Solver.CreateSolver("GLOP")
    x = {i: s.NumVar(0, 1, f"x{i}") for i in allowed}
    for e in universe:
        s.Add(sum(x[i] for i in allowed if e in sets[i]) >= 1)
    s.Minimize(sum(x.values()))
    assert s.Solve() == pywraplp.Solver.OPTIMAL
    return s.Objective().Value(), {i: x[i].solution_value() for i in allowed if x[i].solution_value() > 1e-9}


def exact(sets, universe, allowed=None, time_limit=30.0):
    """The true optimum by CP-SAT."""
    allowed = list(range(len(sets)) if allowed is None else allowed)
    m = cp_model.CpModel()
    x = {i: m.NewBoolVar(f"x{i}") for i in allowed}
    for e in universe:
        m.AddBoolOr([x[i] for i in allowed if e in sets[i]])
    m.Minimize(sum(x.values()))
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit
    solver.parameters.num_workers = 8
    status = solver.Solve(m)
    assert status == cp_model.OPTIMAL, solver.StatusName(status)
    return sorted(i for i in allowed if solver.Value(x[i]))


def harmonic(k):
    return sum(1.0 / i for i in range(1, k + 1))


# ----------------------------------------------------------------------------- the textbook bad case

def bad_instance(k):
    """Greedy's worst case (Korte & Vygen 16.1, Johnson 1974). Universe: 2 rows of 2^k - 1 elements.
    OPT = the two rows. Columns of size 2, 4, ..., 2^k, each split evenly across the rows, tile the universe.
    Greedy takes the biggest column first (2^k > 2^k - 1 row), then the next, ... k sets for an optimum of 2."""
    half = 2 ** k - 1
    universe = list(range(2 * half))
    rows = [frozenset(range(half)), frozenset(range(half, 2 * half))]
    cols, start = [], 0
    for size in (2 ** j for j in range(1, k + 1)):          # 2, 4, ..., 2^k; sum = 2^(k+1) - 2 = |U|
        h = size // 2
        cols.append(frozenset(list(range(start, start + h)) + list(range(half + start, half + start + h))))
        start += h
    return universe, rows + cols, {"rows": [0, 1], "cols": list(range(2, 2 + k))}


# ----------------------------------------------------------------------------- run

def solve_network():
    sets = build_sets()
    universe = range(len(METROS))
    names = [m[0] for m in METROS]
    existing_idx = [names.index(n) for n in EXISTING]
    covered_by_existing = set().union(*(sets[i] for i in existing_idx))
    uncovered = sorted(set(universe) - covered_by_existing)

    g_chosen, g_trace = greedy(sets, universe)
    lp_val, lp_x = lp_lower_bound(sets, universe)
    opt = exact(sets, universe)
    k = max(len(s) for s in sets)

    # augmentation: keep the 14, add the fewest sites to reach the rest
    aug_allowed = [i for i in range(len(sets)) if i not in existing_idx]
    a_chosen, a_trace = greedy(sets, uncovered, aug_allowed)
    a_lp, _ = lp_lower_bound(sets, uncovered, aug_allowed)
    a_opt = exact(sets, uncovered, aug_allowed)

    return {
        "radius_mi": RADIUS_MI,
        "metros": [{"name": n, "lat": la, "lon": lo, "pop": p} for n, la, lo, p in METROS],
        "sets": [sorted(s) for s in sets],
        "k": k, "H_k": round(harmonic(k), 3),
        "existing": existing_idx, "uncovered_by_existing": uncovered,
        "from_scratch": {"greedy": g_chosen, "trace": g_trace, "lp": lp_val, "lp_x": {str(i): round(v, 3) for i, v in lp_x.items()}, "opt": opt},
        "augment": {"greedy": a_chosen, "trace": a_trace, "lp": a_lp, "opt": a_opt},
        "bad_instance": {"k": 4, **{kk: (vv if kk != "sets" else [sorted(s) for s in vv]) for kk, vv in zip(["universe", "sets", "roles"], bad_instance(4))}},
    }


def main(argv):
    if "--test" in argv:
        sets = build_sets(); U = range(len(METROS))
        g, tr = greedy(sets, U); lp, _ = lp_lower_bound(sets, U); opt = exact(sets, U)
        assert set().union(*(sets[i] for i in g)) == set(U), "greedy does not cover"
        assert set().union(*(sets[i] for i in opt)) == set(U), "optimum does not cover"
        assert math.ceil(lp - 1e-9) <= len(opt) <= len(g), (lp, len(opt), len(g))
        k = max(len(s) for s in sets)
        assert len(g) <= harmonic(k) * len(opt) + 1e-9, "Chvátal's bound violated"
        assert sum(t["gain"] for t in tr) == len(METROS)
        for kk in (2, 3, 4, 5):
            U2, S2, roles = bad_instance(kk)
            g2, _ = greedy(S2, U2); o2 = exact(S2, U2)
            assert len(o2) == 2 and len(g2) == kk, (kk, len(g2), len(o2))
            assert g2 == roles["cols"][::-1], "greedy should take the columns biggest first"
        print(f"network: greedy {len(g)}, LP {lp:.3f}, optimum {len(opt)}, k={k}, H(k)={harmonic(k):.2f}; bad instances k=2..5 behave as the book says")
        return 0
    res = solve_network()
    (HERE / "setcover.json").write_text(json.dumps(res, separators=(",", ":")))
    names = [m["name"] for m in res["metros"]]
    fs, au = res["from_scratch"], res["augment"]
    print(f"universe {len(names)} metros, largest set k={res['k']} (H(k)={res['H_k']})")
    print(f"from scratch: greedy {len(fs['greedy'])} sites, LP bound {fs['lp']:.2f}, optimum {len(fs['opt'])}")
    for t in fs["trace"]:
        print(f"   pick {names[t['pick']]:<14} +{t['gain']:>2} metros, {t['left']:>2} left")
    print(f"   optimum: {', '.join(names[i] for i in fs['opt'])}")
    print(f"existing 14 leave {len(res['uncovered_by_existing'])} metros unreached: {', '.join(names[i] for i in res['uncovered_by_existing'])}")
    print(f"augment: greedy {len(au['greedy'])} ({', '.join(names[i] for i in au['greedy'])}), LP {au['lp']:.2f}, optimum {len(au['opt'])} ({', '.join(names[i] for i in au['opt'])})")
    print(f"wrote {HERE / 'setcover.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
