const C = { ink: '#161616', ink2: '#4a4a46', ink3: '#6a6a64', mute: '#8a8a84', rule: '#e4e4df', band: '#f1f1ec', bg: '#fcfcfa', green: '#00704f', orange: '#c8692b', grey: '#a8a8a1', cyc: '#3d3d39' };
const fmt = d3.format(','), $p = '$' + Math.round(DATA.price), pct = d3.format('.0%');
function box(id) { const el = document.getElementById(id); const W = el.clientWidth, H = el.clientHeight; return { el, W, H, svg: d3.select(el).append('svg').attr('width', W).attr('height', H) }; }
function txt(svg, x, y, s, o = {}) { return svg.append('text').attr('x', x).attr('y', y).attr('text-anchor', o.a || 'start').attr('font-size', o.size || 26).attr('font-weight', o.w || 400).attr('fill', o.fill || C.ink).text(s); }

// the coin flip: P(worth more than the price) against P(down-cycle)
function c1() {
  const P = DATA.pdown, { W, H, svg } = box('c1'), m = { l: 110, r: 40, t: 30, b: 96 };
  const x = d3.scaleLinear().domain([0.1, 0.7]).range([m.l, W - m.r]), y = d3.scaleLinear().domain([0.2, 0.95]).range([H - m.b, m.t]);
  [0.25, 0.5, 0.75].forEach(v => {
    svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(v)).attr('y2', y(v)).attr('stroke', v === 0.5 ? C.mute : C.rule).attr('stroke-width', v === 0.5 ? 2.5 : 2).attr('stroke-dasharray', v === 0.5 ? '10 8' : null);
    txt(svg, m.l - 18, y(v) + 9, d3.format('.0%')(v), { a: 'end', fill: C.mute });
  });
  txt(svg, W - m.r, y(0.5) - 14, 'coin flip', { a: 'end', fill: C.ink3 });
  [0.1, 0.3, 0.5, 0.7].forEach(v => txt(svg, x(v), H - m.b + 40, d3.format('.0%')(v), { a: 'middle', fill: C.mute }));
  txt(svg, (m.l + W - m.r) / 2, H - 14, 'chance of a down-cycle, next three years', { a: 'middle', fill: C.ink2 });
  svg.append('text').attr('transform', `translate(30,${(m.t + H - m.b) / 2}) rotate(-90)`).attr('text-anchor', 'middle').attr('font-size', 26).attr('fill', C.ink2).text('chance worth > ' + $p);
  svg.append('path').datum(P).attr('fill', 'none').attr('stroke', C.green).attr('stroke-width', 7).attr('stroke-linejoin', 'round').attr('d', d3.line().x(d => x(d.p_down)).y(d => y(d.p_above)));
  svg.selectAll('circle.p').data(P).join('circle').attr('cx', d => x(d.p_down)).attr('cy', d => y(d.p_above)).attr('r', 10).attr('fill', C.green).attr('stroke', C.bg).attr('stroke-width', 2);
  let cx = null; for (let i = 1; i < P.length; i++) { const a = P[i - 1], b = P[i]; if (a.p_above >= 0.5 && b.p_above < 0.5) cx = a.p_down + (a.p_above - 0.5) / (a.p_above - b.p_above) * (b.p_down - a.p_down); }
  svg.append('circle').attr('cx', x(cx)).attr('cy', y(0.5)).attr('r', 17).attr('fill', C.bg).attr('stroke', C.ink).attr('stroke-width', 4);
  txt(svg, x(cx) - 28, y(0.5) + 66, 'the market: ~' + Math.round(cx * 100) + '%', { a: 'end', size: 30, w: 600 });
  txt(svg, x(cx) - 28, y(0.5) + 102, 'the odds the ' + $p + ' price implies', { a: 'end', size: 25, fill: C.ink2 });
  const me = P.find(d => Math.abs(d.p_down - DATA.p_down) < 1e-6);
  svg.append('circle').attr('cx', x(DATA.p_down)).attr('cy', y(me.p_above)).attr('r', 22).attr('fill', 'none').attr('stroke', C.orange).attr('stroke-width', 6);
  txt(svg, x(DATA.p_down) + 34, y(me.p_above) - 44, 'my call: ' + pct(DATA.p_down), { size: 30, w: 600 });
  txt(svg, x(DATA.p_down) + 34, y(me.p_above) - 10, Math.round(me.p_above * 100) + '% odds it is worth more, median $' + Math.round(me.median), { size: 25, fill: C.ink2 });
  const first = P[0], last = P[P.length - 1];
  txt(svg, x(first.p_down), y(first.p_above) - 30, Math.round(first.p_above * 100) + '% · $' + Math.round(first.median), { size: 25 });
  txt(svg, x(last.p_down), y(last.p_above) + 56, Math.round(last.p_above * 100) + '% · $' + Math.round(last.median), { a: 'end', size: 25 });
}

// 2. the 2027 bridge
function c2() {
  const B = DATA.bridge, L = DATA.labels;
  const S = [{ l: ['2026', 'guide'], v: B[0], k: 'in' }, { l: [L.stick_word + ' of', '$' + DATA.idx + ' sticks'], v: B[1], k: 'j' }, { l: ['volume', L.vol], v: B[2], k: 'j' }, { l: ['80/20', 'cost-out'], v: B[3], k: 'j' }, { l: ['OCC,', 'freight'], v: B[4], k: 'j' }, { l: ['2027', 'bridge'], v: B[5], k: 'out' }, { l: ['2028', 'mid-cycle'], v: B[6], k: 'out' }];
  const { W, H, svg } = box('c2'), m = { l: 120, r: 20, t: 60, b: 110 };
  const x = d3.scaleBand().domain(S.map((d, i) => i)).range([m.l, W - m.r]).padding(0.22), y = d3.scaleLinear().domain([2000, 3300]).range([H - m.b, m.t]);
  [2000, 2400, 2800, 3200].forEach(v => {
    svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(v)).attr('y2', y(v)).attr('stroke', C.rule).attr('stroke-width', 2);
    txt(svg, m.l - 16, y(v) + 9, '$' + fmt(v), { a: 'end', size: 25, fill: C.mute });
  });
  let run = 0; const col = { in: C.grey, j: C.orange, out: C.green };
  S.forEach((d, i) => {
    let y0, y1; if (d.k !== 'j') { y0 = 2000; y1 = d.v; run = d.v; } else { y0 = run; y1 = run + d.v; run = y1; }
    const top = Math.max(y0, y1), bot = Math.min(y0, y1);
    svg.append('rect').attr('x', x(i)).attr('width', x.bandwidth()).attr('y', y(top)).attr('height', Math.max(4, y(bot) - y(top))).attr('rx', 4).attr('fill', col[d.k]).attr('stroke', i === 1 ? C.ink : null).attr('stroke-width', i === 1 ? 4 : 0);
    const lab = (d.k !== 'j' ? '$' : (d.v > 0 ? '+$' : '−$')) + fmt(Math.abs(d.v));
    txt(svg, x(i) + x.bandwidth() / 2, y(top) - 14, lab, { a: 'middle', size: i === 1 ? 34 : 27, w: i === 1 ? 700 : 500 });
    d.l.forEach((t, j) => txt(svg, x(i) + x.bandwidth() / 2, H - m.b + 40 + j * 30, t, { a: 'middle', size: 24, fill: i === 1 ? C.ink : C.ink2, w: i === 1 ? 700 : 400 }));
  });
  svg.append('path').attr('d', `M${x(5) + x.bandwidth()},${y(B[5])} L${x(6)},${y(B[6])}`).attr('stroke', C.mute).attr('stroke-width', 3).attr('stroke-dasharray', '8 6');
  txt(svg, x(6) + x.bandwidth() / 2, y(B[5]) - 6, 'the cycle', { a: 'middle', size: 22, fill: C.ink3 });
  txt(svg, x(6) + x.bandwidth() / 2, y(B[5]) + 20, 'haircut', { a: 'middle', size: 22, fill: C.ink3 });
}

// 3. what moves the value: Spearman rank correlation with value per share
function c3() {
  const Dr = DATA.drivers;
  const R = [['NA mid-cycle margin', Dr['NA mid-cycle margin']], ['exit multiple', Dr['exit multiple']], ['a down-cycle comes', Dr['down-cycle regime']], ['2027 volume', Dr['2027 volume']],
    ['how much $' + DATA.idx + ' sticks', Dr['price sticks']], ['model error', Dr['model noise']], ['WACC', Dr['WACC']], ['capex intensity', Dr['capex intensity']]];
  const order = R.map((d, i) => i).sort((a, b) => Math.abs(R[b][1]) - Math.abs(R[a][1]));
  const { W, H, svg } = box('c3'), m = { l: 372, r: 200, t: 10, b: 132 };
  const y = d3.scaleBand().domain(order).range([m.t, H - m.b]).paddingInner(0.34).paddingOuter(0.12), x = d3.scaleLinear().domain([0, 0.8]).range([m.l, W - m.r]);
  const half = (y.step() - y.bandwidth()) / 2, top3 = order.slice(0, 3);
  const bt = y(top3[0]) - half, bb = y(top3[2]) + y.bandwidth() + half;
  svg.append('rect').attr('x', 0).attr('width', W).attr('y', bt).attr('height', bb - bt).attr('rx', 10).attr('fill', C.band);
  [0, 0.2, 0.4, 0.6, 0.8].forEach(v => {
    svg.append('line').attr('x1', x(v)).attr('x2', x(v)).attr('y1', m.t).attr('y2', H - m.b).attr('stroke', v === 0 ? C.mute : C.rule).attr('stroke-width', 2);
    txt(svg, x(v), H - m.b + 38, v === 0 ? '0' : d3.format('.1f')(v), { a: 'middle', size: 25, fill: C.mute });
  });
  txt(svg, x(0.4), H - m.b + 80, 'rank correlation with value per share', { a: 'middle', size: 25, fill: C.ink2 });
  txt(svg, x(0.4), H - m.b + 116, 'minus: more of it lowers the value', { a: 'middle', size: 23, fill: C.ink3 });
  order.forEach(i => {
    const [name, v] = R[i], isP = name.startsWith('how much'), yy = y(i), bh = y.bandwidth();
    svg.append('rect').attr('x', x(0)).attr('y', yy).attr('width', x(Math.abs(v)) - x(0)).attr('height', bh).attr('rx', 4).attr('fill', isP ? C.orange : (top3.includes(i) ? C.cyc : C.grey));
    txt(svg, m.l - 20, yy + bh / 2 + 9, name, { a: 'end', size: 27, w: isP || top3.includes(i) ? 600 : 400 });
    txt(svg, x(Math.abs(v)) + 14, yy + bh / 2 + 9, (v < 0 ? '−' : '') + Math.abs(v).toFixed(2), { size: 27, w: 600 });
    if (isP) txt(svg, W - 8, yy + bh / 2 + 9, '← the debate', { a: 'end', size: 25, w: 600 });
  });
  txt(svg, W - 8, y(top3[1]) + y.bandwidth() / 2 + 9, 'the cycle', { a: 'end', size: 25, w: 600 });
}

// 4. the 20,000 values, split by whether a down-cycle came
function c4() {
  const Rg = DATA.regime, E = Rg.edges, w = E[1] - E[0];
  const bins = Rg.down.map((dn, i) => ({ x0: E[i], dn, bs: Rg.base[i] }));
  const { W, H, svg } = box('c4'), m = { l: 20, r: 20, t: 70, b: 96 };
  const x = d3.scaleLinear().domain([0, 97.5]).range([m.l, W - m.r]), y = d3.scaleLinear().domain([0, d3.max(bins, b => b.dn + b.bs) * 1.04]).range([H - m.b, m.t]);
  [0, 0.5, 1, 1.5, 2, 2.5, 3].map(k => Math.round(DATA.price * k)).forEach(v => txt(svg, x(v), H - m.b + 40, '$' + v, { a: 'middle', size: 25, fill: v === Math.round(DATA.price) ? C.ink : C.mute, w: v === Math.round(DATA.price) ? 600 : 400 }));
  txt(svg, (m.l + W - m.r) / 2, H - 12, 'value per share, 20,000 runs', { a: 'middle', size: 26, fill: C.ink2 });
  svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(0)).attr('y2', y(0)).attr('stroke', C.mute).attr('stroke-width', 2);
  bins.forEach(b => {
    const x0 = x(b.x0) + 1, bw = x(b.x0 + w) - x(b.x0) - 2;
    // segments under 4px are a handful of runs: drawing them only leaves a sliver
    const hd = y(0) - y(b.dn), hb = y(b.dn) - y(b.dn + b.bs);
    if (hd >= 4) svg.append('rect').attr('x', x0).attr('width', bw).attr('y', y(b.dn)).attr('height', hd).attr('fill', C.cyc);
    if (hb >= 4) svg.append('rect').attr('x', x0).attr('width', bw).attr('y', y(b.dn + b.bs)).attr('height', hb - (hd >= 4 ? 2 : 0)).attr('fill', C.green);
  });
  svg.append('line').attr('x1', x(DATA.price)).attr('x2', x(DATA.price)).attr('y1', m.t - 46).attr('y2', y(0)).attr('stroke', C.ink).attr('stroke-width', 3).attr('stroke-dasharray', '9 7');
  txt(svg, x(DATA.price) + 14, m.t - 22, $p + ' today', { size: 26, w: 600 });
  const lab = (sx, y0, sw, lines, a) => {
    const tw = txt(svg, sx, y0, lines[0], { a, size: 28, w: 600 }).node().getComputedTextLength();
    svg.append('rect').attr('x', a === 'end' ? sx - tw - 34 : sx - 34).attr('y', y0 - 21).attr('width', 22).attr('height', 22).attr('rx', 4).attr('fill', sw);
    lines.slice(1).forEach((t, k) => txt(svg, sx, y0 + 36 + k * 34, t, { a, size: 25, fill: C.ink2 }));
  };
  const pd = Rg.n_down / Rg.n;
  lab(x(1.5) + 34, m.t + 40, C.cyc, ['a down-cycle', `${Math.round(pd * 100)}% of runs`, `${Math.round(Rg.p_above_down * 100)}% above ${$p}`, `median $${Math.round(Rg.med_down)}`], 'start');
  lab(W - m.r, m.t + 40, C.green, ['no down-cycle', `${Math.round((1 - pd) * 100)}% of runs`, `${Math.round(Rg.p_above_base * 100)}% above ${$p}`, `median $${Math.round(Rg.med_base)}`], 'end');
}

document.fonts.ready.then(() => { c1(); c2(); c3(); c4(); document.body.dataset.ready = '1'; });
