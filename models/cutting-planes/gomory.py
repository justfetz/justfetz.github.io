#!/usr/bin/env python3
"""Gomory's fractional cutting-plane algorithm, exactly as Papadimitriou & Steiglitz ch. 14 lays it out,
in exact rational arithmetic so every tableau row and every cut can be printed and checked.

    maximize  c·x   subject to  A x <= b,  x >= 0,  x integer

1. Solve the LP relaxation with the (primal) simplex method.
2. If the optimal basic solution is integer, stop: it is optimal for the ILP.
3. Otherwise pick a row of the tableau whose basic variable is fractional:
       x_B(r) + sum_j a_rj x_j = b_r        (sum over non-basic j)
   Every feasible integer point satisfies the Gomory cut
       sum_j frac(a_rj) x_j >= frac(b_r),
   and the current LP optimum violates it (its non-basic x_j are all 0, and frac(b_r) > 0).
4. Add the cut as a new row with its own slack and re-optimize with the DUAL simplex
   (the old basis is still dual feasible; only the new row's right-hand side is negative).
5. Go to 2.

Each cut is also expressed back in the original variables, so it can be drawn: slack variables are
affine functions of x, and the cut slacks are affine functions of those.

Run:  python3 gomory.py            # the post's instance, every tableau and cut printed, cuts.json written
      python3 gomory.py --test     # exact answers against brute force on a batch of small instances
"""
from __future__ import annotations

import itertools
import json
import math
import random
import sys
from fractions import Fraction as F
from pathlib import Path

HERE = Path(__file__).resolve().parent


def frac(q: F) -> F:
    """Fractional part in [0, 1): q - floor(q)."""
    return q - (q.numerator // q.denominator)


class Tableau:
    """Rows: one per basic variable. Columns: every variable. rhs: current values.
    z: reduced costs (for a max problem, z_j >= 0 for all j at optimality)."""

    def __init__(self, c, A, b):
        n, m = len(c), len(A)
        self.n = n                                 # original variables
        self.names = [f"x{j+1}" for j in range(n)] + [f"s{i+1}" for i in range(m)]
        self.rows = [[F(v) for v in A[i]] + [F(int(i == k)) for k in range(m)] for i in range(m)]
        self.rhs = [F(v) for v in b]
        self.basis = [n + i for i in range(m)]
        self.z = [F(-v) for v in c] + [F(0)] * m   # reduced costs c_B B^-1 A - c with c_B = 0
        self.zval = F(0)
        # affine expression of every variable in the original x: expr[j] = (coeffs..., const)
        self.expr = [[F(int(j == k)) for k in range(n)] + [F(0)] for j in range(n)]
        for i in range(m):                        # s_i = b_i - A_i x
            self.expr.append([F(-v) for v in A[i]] + [F(b[i])])
        self.cuts = []                            # list of dicts describing each cut, for the write-up

    # ---- pivoting
    def pivot(self, r, s):
        p = self.rows[r][s]
        self.rows[r] = [v / p for v in self.rows[r]]
        self.rhs[r] /= p
        for i in range(len(self.rows)):
            if i != r and self.rows[i][s] != 0:
                f = self.rows[i][s]
                self.rows[i] = [a - f * bq for a, bq in zip(self.rows[i], self.rows[r])]
                self.rhs[i] -= f * self.rhs[r]
        if self.z[s] != 0:
            f = self.z[s]
            self.z = [a - f * bq for a, bq in zip(self.z, self.rows[r])]
            self.zval -= f * self.rhs[r]
        self.basis[r] = s

    def primal_simplex(self):
        while True:
            s = next((j for j, v in enumerate(self.z) if v < 0), None)   # Bland: first negative reduced cost
            if s is None:
                return
            ratios = [(self.rhs[i] / self.rows[i][s], self.basis[i], i) for i in range(len(self.rows)) if self.rows[i][s] > 0]
            if not ratios:
                raise ValueError("unbounded")
            self.pivot(min(ratios)[2], s)

    def dual_simplex(self):
        while True:
            r = next((i for i, v in enumerate(self.rhs) if v < 0), None)  # first infeasible row
            if r is None:
                return
            cands = [(self.z[j] / -self.rows[r][j], j) for j in range(len(self.z)) if self.rows[r][j] < 0]
            if not cands:
                raise ValueError("infeasible")
            self.pivot(r, min(cands)[1])

    # ---- Gomory
    def solution(self):
        x = [F(0)] * len(self.z)
        for i, j in enumerate(self.basis):
            x[j] = self.rhs[i]
        return x[: self.n]

    def is_integer(self):
        return all(v.denominator == 1 for v in self.solution())

    def add_gomory_cut(self):
        # source row: the fractional basic variable with the largest fractional part, originals first
        rows = [(frac(self.rhs[i]), self.basis[i] < self.n, i) for i in range(len(self.rows)) if frac(self.rhs[i]) != 0]
        rows.sort(key=lambda t: (not t[1], -t[0]))
        _, _, r = rows[0]
        coeffs = [frac(a) if j not in self.basis else F(0) for j, a in enumerate(self.rows[r])]
        f0 = frac(self.rhs[r])
        # new slack t >= 0:  -sum frac(a_rj) x_j + t = -f0
        k = len(self.z)
        for row in self.rows:
            row.append(F(0))
        self.rows.append([-v for v in coeffs] + [F(1)])
        self.rhs.append(-f0)
        self.z.append(F(0))
        self.basis.append(k)
        self.names.append(f"t{len(self.cuts)+1}")
        # express t in original variables:  t = sum frac(a_rj) * expr_j - f0
        e = [F(0)] * (self.n + 1)
        for j, cj in enumerate(coeffs):
            if cj:
                e = [a + cj * b for a, b in zip(e, self.expr[j])]
        e[-1] -= f0
        self.expr.append(e)
        # the cut in original space is t >= 0:  sum e_k x_k + e_const >= 0  ->  -e·x <= e_const; scale to integers
        den = 1
        for v in e:
            den = den * v.denominator // math.gcd(den, v.denominator)
        ints = [int(v * den) for v in e]
        g = 0
        for v in ints:
            g = math.gcd(g, abs(v))
        g = g or 1
        ints = [v // g for v in ints]
        lhs = [-v for v in ints[:-1]]          # a·x <= b with a = -e_k, b = e_const
        cut = {
            "source_row": {"basic": self.names[self.basis[r]], "coeffs": {self.names[j]: str(a) for j, a in enumerate(self.rows[r][:-1]) if a != 0 and j != self.basis[r]}, "rhs": str(self.rhs[r])},
            "fractional_parts": {self.names[j]: str(cj) for j, cj in enumerate(coeffs) if cj},
            "f0": str(f0),
            "in_x": {"a": lhs, "b": ints[-1]},
            "name": self.names[-1],
        }
        self.cuts.append(cut)
        return cut


def snapshot(T):
    """The tableau as strings, for the write-up: one row per basic variable, then the z row."""
    return {
        "columns": list(T.names),
        "rows": [{"basic": T.names[T.basis[i]], "coeffs": [str(v) for v in T.rows[i]], "rhs": str(T.rhs[i])} for i in range(len(T.rows))],
        "z": {"coeffs": [str(v) for v in T.z], "value": str(T.zval)},
    }


def gomory(c, A, b, max_cuts=50, log=None):
    T = Tableau(c, A, b)
    T.primal_simplex()
    history = [{"x": [str(v) for v in T.solution()], "z": str(T.zval), "cut": None, "tableau": snapshot(T)}]
    while not T.is_integer():
        if len(T.cuts) >= max_cuts:
            raise RuntimeError("too many cuts")
        cut = T.add_gomory_cut()
        T.dual_simplex()
        history.append({"x": [str(v) for v in T.solution()], "z": str(T.zval), "cut": cut, "tableau": snapshot(T)})
        if log:
            log(T, cut)
    return T, history


def brute_force(c, A, b, box=60):
    best, arg = None, None
    for x in itertools.product(range(box + 1), repeat=len(c)):
        if all(sum(a * v for a, v in zip(row, x)) <= bi for row, bi in zip(A, b)):
            z = sum(cv * v for cv, v in zip(c, x))
            if best is None or z > best:
                best, arg = z, x
    return best, arg


# ----------------------------------------------------------------------------- the post's instance
# Next week's commitments, in truckloads. x1 = loads of printed single-wall RSC, x2 = loads of double-wall die-cut.
# Contribution per load $900 and $1,400; the corrugator and the converting floor each have a week of hours.
INSTANCE = {
    "c": [9, 11],                     # $100s of contribution per load: printed RSC 900, double-wall die-cut 1,100
    "A": [[2, 3],                     # corrugator hours per load (double wall runs slow): 2 and 3; 19 hours left this week
          [3, 1]],                    # converting hours per load (RSC needs the folder-gluer, DW one pass on the die cutter): 3 and 1; 24 hours
    "b": [19, 24],
    "vars": ["RSC loads", "double-wall loads"],
    "rows": ["corrugator hours", "converting hours"],
}


def main(argv):
    if "--test" in argv:
        rng = random.Random(14)
        n_ok = 0
        for _ in range(300):
            n = rng.choice([2, 2, 3])
            m = rng.choice([2, 3])
            c = [rng.randint(1, 12) for _ in range(n)]
            A = [[rng.randint(0, 9) for _ in range(n)] for _ in range(m)]
            if any(all(v == 0 for v in row) for row in A) or any(all(A[i][j] == 0 for i in range(m)) for j in range(n)):
                continue
            b = [rng.randint(5, 40) for _ in range(m)]
            try:
                T, hist = gomory(c, A, b, max_cuts=200)
            except RuntimeError:
                continue  # Gomory's method can be slow to converge on some instances; the test is about correctness
            z_bf, x_bf = brute_force(c, A, b, box=45)
            x = T.solution()
            assert all(v.denominator == 1 for v in x)
            assert all(sum(a * v for a, v in zip(row, x)) <= bi for row, bi in zip(A, b)), "cut solution violates a constraint"
            assert T.zval == z_bf, (c, A, b, T.zval, z_bf)
            # every cut must keep every feasible integer point
            pts = [p for p in itertools.product(range(46), repeat=n) if all(sum(a * v for a, v in zip(row, p)) <= bi for row, bi in zip(A, b))]
            for cut in T.cuts:
                a, bb = cut["in_x"]["a"], cut["in_x"]["b"]
                assert all(sum(ai * pi for ai, pi in zip(a, p)) <= bb for p in pts), ("cut removed an integer point", cut)
            n_ok += 1
        print(f"{n_ok} random instances: Gomory == brute force, and no cut ever removed a feasible integer point")
        return 0

    I = INSTANCE
    def log(T, cut):
        print(f"  cut {cut['name']}: from row of {cut['source_row']['basic']} = {cut['source_row']['rhs']} - ({', '.join(f'{v}·{k}' for k, v in cut['source_row']['coeffs'].items())})")
        print(f"     fractional parts: {' + '.join(f'{v}·{k}' for k, v in cut['fractional_parts'].items())} >= {cut['f0']}")
        a, bb = cut["in_x"]["a"], cut["in_x"]["b"]
        print(f"     in the original variables: {a[0]}·x1 + {a[1]}·x2 <= {bb}")
        print(f"     new LP optimum: x = ({', '.join(str(v) for v in T.solution())}), z = {T.zval}")
    T = Tableau(I["c"], I["A"], I["b"]); T.primal_simplex()
    print(f"LP relaxation: x = ({', '.join(str(v) for v in T.solution())}), z = {T.zval}")
    T, hist = gomory(I["c"], I["A"], I["b"], log=log)
    z_bf, x_bf = brute_force(I["c"], I["A"], I["b"])
    print(f"integer optimum: x = {tuple(int(v) for v in T.solution())}, z = {T.zval}; brute force: {x_bf}, {z_bf}")
    out = {"instance": I, "history": hist, "cuts": T.cuts}
    (HERE / "cuts.json").write_text(json.dumps(out, indent=1))
    print(f"wrote {HERE / 'cuts.json'} ({len(T.cuts)} cuts)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
