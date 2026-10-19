#!/usr/bin/env python3
"""The assignment problem by successive shortest paths (Korte & Vygen §11.1 → §9.4).

n orders, n machines, cost[i][j] in minutes (None = that machine cannot run that order).
Find a perfect matching of minimum total cost.

The algorithm is the Hungarian method in its modern form: treat the bipartite graph as a
min-cost flow network (source → orders → machines → sink, unit capacities), start with the
empty matching, and repeat n times:

    1. run Dijkstra from the source over the residual graph using reduced costs
       c_pi(u,v) = c(u,v) + pi(u) - pi(v), which are non-negative by induction;
    2. augment one unit along the shortest source→sink path (forward edges match an
       order to a machine; backward edges un-match one, i.e. re-route an order);
    3. pi(v) += dist(v) for every node Dijkstra reached, so reduced costs stay non-negative.

n augmentations, each a Dijkstra: O(n (m + n log n)) with a heap, O(n^3) dense.

The potentials are the dual solution. With u_i = -pi(order_i) and v_j = pi(machine_j):
u_i + v_j <= c_ij on every edge, with equality on the matched edges, and
sum(u) + sum(v) == total cost of the matching. That equality is the proof of optimality.

Run:  python3 assignment.py          # solves the post's instance, prints the steps and the prices
      python3 assignment.py --test   # checks against brute force on random instances
"""
from __future__ import annotations

import heapq
import itertools
import random
import sys

INF = float("inf")


def successive_shortest_paths(cost, order=None, trace=None):
    """cost: n x n list; cost[i][j] is a number or None (no edge).
    order: the sequence in which free orders are used as Dijkstra roots (default 0..n-1);
           the result is optimal regardless, but the path of augmentations differs.
    trace: optional list; each augmentation appends a dict describing the step.
    Returns (match, total, u, v) with match[i] = j."""
    n = len(cost)
    # Node ids: source S, orders 0..n-1, machines n..2n-1, sink T
    S, T = 2 * n, 2 * n + 1
    N = 2 * n + 2
    match_l = [-1] * n          # order -> machine
    match_r = [-1] * n          # machine -> order
    pi = [0.0] * N              # potentials
    total = 0.0

    def residual_edges(x):
        """Yield (y, cost) for residual edges out of node x under the current matching."""
        if x == S:
            for i in range(n):
                if match_l[i] == -1:
                    yield i, 0.0
        elif x < n:                      # order i: forward to any machine it is not matched to
            i = x
            for j in range(n):
                c = cost[i][j]
                if c is not None and match_l[i] != j:
                    yield n + j, float(c)
        elif x < 2 * n:                  # machine j: to sink if free, else backward to its order
            j = x - n
            if match_r[j] == -1:
                yield T, 0.0
            else:
                yield match_r[j], -float(cost[match_r[j]][j])
        # sink: no outgoing residual edges we need (we never route back through T)

    for step in range(n):
        # ---- 1. Dijkstra with reduced costs
        dist = [INF] * N
        prev = [-1] * N
        dist[S] = 0.0
        heap = [(0.0, S)]
        done = [False] * N
        while heap:
            d, x = heapq.heappop(heap)
            if done[x]:
                continue
            done[x] = True
            for y, c in residual_edges(x):
                rc = c + pi[x] - pi[y]
                assert rc > -1e-9, f"negative reduced cost {rc} on {x}->{y}"
                nd = d + max(rc, 0.0)
                if nd < dist[y] - 1e-12:
                    dist[y] = nd
                    prev[y] = x
                    heapq.heappush(heap, (nd, y))
        if dist[T] == INF:
            raise ValueError("no perfect matching exists: some order has no feasible machine left")

        # ---- 2. augment along the shortest path
        path = []
        y = T
        while y != S:
            path.append(y)
            y = prev[y]
        path.append(S)
        path.reverse()
        rerouted = []
        for a, b in zip(path, path[1:]):
            if a < n and n <= b < 2 * n:               # match order a to machine b-n
                match_l[a] = b - n
                match_r[b - n] = a
            elif n <= a < 2 * n and b < n:             # backward edge: un-match order b from machine a-n
                rerouted.append(b)
        # (the forward edge later in the path re-matches the un-matched order)
        path_cost = sum(float(cost[i][match_l[i]]) for i in range(n) if match_l[i] != -1) - total
        total += path_cost

        # ---- 3. update potentials
        reached = [d for d in dist if d < INF]
        D = max(reached)
        for x in range(N):
            pi[x] += dist[x] if dist[x] < INF else D

        if trace is not None:
            trace.append({
                "step": step + 1,
                "path": [node_name(x, n) for x in path],
                "rerouted": [node_name(i, n) for i in rerouted],
                "path_cost": path_cost,
                "total": total,
                "match": match_l[:],
                "dist": dist[:],
            })

    u = [-pi[i] for i in range(n)]
    v = [pi[n + j] for j in range(n)]
    # Potentials are only pinned up to a constant within each connected block of the graph
    # (shift every u in a block up by d and every v in it down by d: nothing changes). Normalise
    # each block so its smallest order price is 0, which is the convention the tables use.
    for block in components(cost):
        shift = min(u[i] for i in block["orders"])
        for i in block["orders"]:
            u[i] -= shift
        for j in block["machines"]:
            v[j] += shift
    return match_l, total, u, v


def components(cost):
    """Connected blocks of the bipartite graph: [{'orders': set, 'machines': set}, ...]."""
    n = len(cost)
    seen_i, blocks = set(), []
    for start in range(n):
        if start in seen_i:
            continue
        orders, machines, stack = set(), set(), [("o", start)]
        while stack:
            kind, x = stack.pop()
            if kind == "o":
                if x in orders:
                    continue
                orders.add(x)
                stack.extend(("m", j) for j in range(n) if cost[x][j] is not None)
            else:
                if x in machines:
                    continue
                machines.add(x)
                stack.extend(("o", i) for i in range(n) if cost[i][x] is not None)
        seen_i |= orders
        blocks.append({"orders": orders, "machines": machines})
    return blocks


def node_name(x, n):
    if x == 2 * n:
        return "s"
    if x == 2 * n + 1:
        return "t"
    return f"order {x}" if x < n else f"machine {x - n}"


def brute_force(cost):
    n = len(cost)
    best, best_perm = INF, None
    for perm in itertools.permutations(range(n)):
        if any(cost[i][perm[i]] is None for i in range(n)):
            continue
        c = sum(cost[i][perm[i]] for i in range(n))
        if c < best:
            best, best_perm = c, perm
    return best, best_perm


def check_duals(cost, match, u, v, total):
    n = len(cost)
    for i in range(n):
        for j in range(n):
            if cost[i][j] is not None:
                assert u[i] + v[j] <= cost[i][j] + 1e-6, (i, j, u[i] + v[j], cost[i][j])
    for i in range(n):
        j = match[i]
        assert abs(u[i] + v[j] - cost[i][j]) < 1e-6, ("matched edge not tight", i, j)
    assert abs(sum(u) + sum(v) - total) < 1e-6, (sum(u) + sum(v), total)


# ----------------------------------------------------------------------------- the post's instance

ORDERS = ["A  RSC 2-color, 12,000", "B  die-cut tray, 3,500", "C  RSC 1-color, 20,000",
          "D  die-cut wrap, 15,000", "E  HSC no glue, 8,000", "F  fine die-cut, 600"]
MACHINES = ["FFG-1", "FFG-2", "RDC-1", "RDC-2", "FBD", "PS"]
# minutes = setup + quantity / speed; None = the machine cannot run the order
COST = [
    [85, 138, None, None, None, None],   # A: glued RSC -> flexo folder-gluers only
    [None, None, 65, 83, 185, None],      # B: die cut
    [115, 191, None, None, None, None],   # C: glued RSC
    [None, None, 180, 255, 645, None],    # D: die cut, big run
    [55, 89, None, None, None, 116],      # E: no glue -> printer-slotter, or an FFG with the gluer idle
    [None, None, 66, 69, 54, None],       # F: fine die, small run
]


def greedy_cheapest_first(cost):
    """What a rushed shift does: take the cheapest (order, machine) pair still available, repeat."""
    n = len(cost)
    pairs = sorted((cost[i][j], i, j) for i in range(n) for j in range(n) if cost[i][j] is not None)
    used_i, used_j, match, total = set(), set(), [-1] * n, 0
    for c, i, j in pairs:
        if i in used_i or j in used_j:
            continue
        used_i.add(i); used_j.add(j); match[i] = j; total += c
    return match, total


def main(argv):
    if "--test" in argv:
        rng = random.Random(11)
        for trial in range(400):
            n = rng.randint(1, 6)
            cost = [[rng.choice([None] + list(range(1, 40))) if rng.random() < 0.9 else rng.randint(1, 40) for _ in range(n)] for _ in range(n)]
            bf, _ = brute_force(cost)
            try:
                match, total, u, v = successive_shortest_paths(cost)
            except ValueError:
                assert bf == INF, f"SSP said infeasible but brute force found {bf}"
                continue
            assert bf != INF
            assert abs(total - bf) < 1e-9, (cost, total, bf)
            check_duals(cost, match, u, v, total)
        print("400 random instances: successive shortest paths == brute force; duals certify every one")
        return 0

    trace = []
    match, total, u, v = successive_shortest_paths(COST, trace=trace)
    check_duals(COST, match, u, v, total)
    print("step  path                                                          +min   total  re-routed")
    for t in trace:
        path = " → ".join(p.replace("order ", "").replace("machine ", "") for p in t["path"][1:-1])
        print(f"{t['step']:>4}  {path:<60}  {t['path_cost']:>5.0f}  {t['total']:>6.0f}  {', '.join(t['rerouted'])}")
    print()
    print("assignment:")
    for i, j in enumerate(match):
        print(f"  {ORDERS[i]:<26} → {MACHINES[j]:<6} {COST[i][j]:>4} min   u={u[i]:>6.1f}  v={v[j]:>6.1f}")
    print(f"total {total:.0f} min; sum of prices {sum(u) + sum(v):.0f} min (the certificate)")
    bf, _ = brute_force(COST)
    print(f"brute force over 720 permutations: {bf:.0f}")
    g_match, g_total = greedy_cheapest_first(COST)
    stranded = [ORDERS[i][0] for i, j in enumerate(g_match) if j == -1]
    print(f"greedy cheapest-first: {g_total} min for the orders it placed; stranded: {', '.join(stranded) or 'none'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
