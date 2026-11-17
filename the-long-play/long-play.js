/* The Long Play — a D3 chart of Eminem's studio albums.
 *
 * LongPlay.render(figureEl, EM_DATA, { interactive: true })
 *   draws the square "sleeve": Side A (sales) and Side B (guests).
 * LongPlay.renderNotes(el, EM_DATA)
 *   writes the collaborator lists and the data table as plain HTML.
 *
 * Requires d3 v7 on the page. Everything is drawn in a 1600 x 1600 viewBox,
 * so the figure scales to whatever width its container gives it.
 */
(function (global) {
  "use strict";

  const W = 1600, H = 1600;
  const C = {
    surface: "#241d15", surfaceHi: "#3b3021", surfaceLo: "#130f0a",
    vinyl: "#0b0907", label: "#2e261b",
    ink: "#eee2c9", ink2: "#bcae93", ink3: "#8a7f6a",
    guest: "#f05a3c"
  };

  /* ---------- helpers ---------- */

  const fmtMonth = d3.utcFormat("%b %Y");
  const fmtYear = d3.utcFormat("%Y");
  function fmtN(n) {
    return n >= 1e6 ? String(+(n / 1e6).toFixed(2)) + "M" : Math.round(n / 1e3) + "K";
  }
  function rng(seed) { // mulberry32, so the wear and dust are the same on every render
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }
  function joinNames(a) {
    return a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1];
  }

  /* ---------- model ---------- */

  function buildModel(DATA) {
    const parse = d3.utcParse("%Y-%m-%d");
    const curl = s => s.replace(/'/g, "’");
    const albums = DATA.albums.map((a, i) => Object.assign({}, a, {
      i, when: parse(a.date), year: +a.date.slice(0, 4),
      title: curl(a.title), short: curl(a.short || a.title),
      tracks: a.tracks.map((t, j) => ({ n: j + 1, title: curl(t[0]), guests: t[1] || [], skit: !!t[2] }))
    }));
    const byName = new Map();
    albums.forEach(a => a.tracks.forEach(t => t.guests.forEach(name => {
      if (!byName.has(name)) byName.set(name, { name, order: byName.size, apps: [] });
      byName.get(name).apps.push({ album: a, track: t });
    })));
    const guests = [...byName.values()].map(g => {
      const perAlbum = d3.rollup(g.apps, v => v.length, d => d.album.i);
      return Object.assign(g, {
        tracks: g.apps.length, albums: perAlbum.size, perAlbum,
        first: d3.min(g.apps, d => d.album.i), last: d3.max(g.apps, d => d.album.i)
      });
    });
    albums.forEach(a => { a.guestNames = [...new Set(a.tracks.flatMap(t => t.guests))]; });
    const comp = Object.assign({}, DATA.compilation, { when: parse(DATA.compilation.date) });
    const totals = {
      albums: albums.length,
      tracks: d3.sum(albums, a => a.tracks.length),
      guestTracks: d3.sum(albums, a => a.tracks.filter(t => t.guests.length).length),
      guests: guests.length,
      certified: d3.sum(albums, a => a.riaa || 0),
      no1: albums.filter(a => a.peak === 1).length,
      grammys: albums.filter(a => a.grammy && a.grammy.won).length,
      years: albums[albums.length - 1].year - albums[0].year
    };
    return { albums, guests, comp, totals, beyond: DATA.beyond || {}, asOf: DATA.asOf };
  }

  /* ---------- the figure ---------- */

  function render(el, DATA, opts) {
    opts = Object.assign({ interactive: true, byline: "" }, opts);
    const M = buildModel(DATA);
    const uid = "lp" + (render._n = (render._n || 0) + 1);
    const rand = rng(1996);

    el.classList.add("lp-sleeve");
    el.textContent = "";
    const svg = d3.select(el).append("svg")
      .attr("class", "lp-svg").attr("viewBox", `0 0 ${W} ${H}`)
      .attr("xmlns", "http://www.w3.org/2000/svg");
    svg.append("title").text("The Long Play: Eminem's studio albums, 1996 to 2024");
    const defs = svg.append("defs");

    /* --- sleeve: tone, ring wear, dust --- */
    const bg = defs.append("radialGradient").attr("id", uid + "-bg")
      .attr("cx", "38%").attr("cy", "26%").attr("r", "90%");
    bg.append("stop").attr("offset", "0").attr("stop-color", C.surfaceHi);
    bg.append("stop").attr("offset", ".5").attr("stop-color", C.surface);
    bg.append("stop").attr("offset", "1").attr("stop-color", C.surfaceLo);
    svg.append("rect").attr("width", W).attr("height", H).attr("fill", `url(#${uid}-bg)`);

    const wear = svg.append("g").attr("class", "lp-wear")
      .attr("transform", `translate(${W / 2},${H / 2 + 30})`).attr("fill", "none").attr("stroke", C.ink);
    // ring wear: a soft band where the record has pressed through, plus two fine scuff lines
    d3.range(-3, 4).forEach(k => {
      wear.append("circle").attr("r", 742 + k * 5).attr("stroke-width", 5.5).attr("stroke-opacity", (.05 * (1 - Math.abs(k) / 4)).toFixed(3));
    });
    [[735, 1.3, .1], [750, .8, .085]].forEach(d => {
      const dash = d3.range(30).map(() => (30 + rand() * 300).toFixed(0)).join(" ");
      wear.append("circle").attr("r", d[0]).attr("stroke-width", d[1]).attr("stroke-opacity", d[2])
        .attr("stroke-dasharray", dash).attr("transform", `rotate(${(rand() * 360).toFixed(0)})`);
    });
    const vig = defs.append("radialGradient").attr("id", uid + "-vig").attr("cx", "50%").attr("cy", "46%").attr("r", "74%");
    vig.append("stop").attr("offset", ".55").attr("stop-color", "#000").attr("stop-opacity", 0);
    vig.append("stop").attr("offset", "1").attr("stop-color", "#000").attr("stop-opacity", .5);
    svg.append("rect").attr("width", W).attr("height", H).attr("fill", `url(#${uid}-vig)`);
    // edges rubbed back to the card
    const edge = svg.append("g").attr("class", "lp-edge").attr("fill", "none").attr("stroke", C.ink);
    [[1.5, 2.6, .17], [5.5, 1.2, .08]].forEach(d => {
      const dash = d3.range(60).map(() => (3 + rand() * 90).toFixed(0)).join(" ");
      edge.append("rect").attr("x", d[0]).attr("y", d[0]).attr("width", W - 2 * d[0]).attr("height", H - 2 * d[0])
        .attr("stroke-width", d[1]).attr("stroke-opacity", d[2]).attr("stroke-dasharray", dash).attr("stroke-dashoffset", (rand() * 400).toFixed(0));
    });
    [[0, 0], [W, 0], [0, H], [W, H]].forEach(c => {
      edge.append("circle").attr("cx", c[0]).attr("cy", c[1]).attr("r", 6 + rand() * 9).attr("fill", C.ink).attr("fill-opacity", .13).attr("stroke", "none");
    });
    const dust = svg.append("g").attr("class", "lp-dust");
    d3.range(110).forEach(() => {
      dust.append("circle").attr("cx", (rand() * W).toFixed(1)).attr("cy", (rand() * H).toFixed(1))
        .attr("r", (.4 + rand() * 1.1).toFixed(2)).attr("fill", C.ink).attr("fill-opacity", (.04 + rand() * .12).toFixed(2));
    });
    d3.range(9).forEach(() => {
      const x0 = rand() * W, y0 = rand() * H, a = rand() * Math.PI, len = 60 + rand() * 240;
      dust.append("path")
        .attr("d", `M${x0.toFixed(0)},${y0.toFixed(0)} q${(Math.cos(a) * len / 2).toFixed(0)},${(Math.sin(a) * len / 2 + 14).toFixed(0)} ${(Math.cos(a) * len).toFixed(0)},${(Math.sin(a) * len).toFixed(0)}`)
        .attr("fill", "none").attr("stroke", C.ink).attr("stroke-opacity", .05).attr("stroke-width", .7);
    });

    /* worn-print filter for the title */
    const worn = defs.append("filter").attr("id", uid + "-worn")
      .attr("x", "-2%").attr("y", "-8%").attr("width", "104%").attr("height", "116%");
    worn.append("feTurbulence").attr("type", "fractalNoise").attr("baseFrequency", "0.9 0.07")
      .attr("numOctaves", 2).attr("seed", 12).attr("result", "streak");
    worn.append("feColorMatrix").attr("in", "streak").attr("type", "matrix")
      .attr("values", "0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -9 7.25").attr("result", "mask");
    worn.append("feComposite").attr("in", "SourceGraphic").attr("in2", "mask").attr("operator", "in");

    const shadow = defs.append("radialGradient").attr("id", uid + "-shadow");
    shadow.append("stop").attr("offset", ".78").attr("stop-color", "#000").attr("stop-opacity", .5);
    shadow.append("stop").attr("offset", "1").attr("stop-color", "#000").attr("stop-opacity", 0);

    defs.append("marker").attr("id", uid + "-arrow").attr("viewBox", "0 0 10 10")
      .attr("refX", 8).attr("refY", 5).attr("markerWidth", 9).attr("markerHeight", 9).attr("orient", "auto-start-reverse")
      .append("path").attr("d", "M1,1 L8,5 L1,9").attr("fill", "none").attr("stroke", C.ink).attr("stroke-width", 1.3)
      .attr("stroke-linecap", "round").attr("stroke-linejoin", "round");

    /* small drawing helpers */
    function text(g, x, y, str, cls, anchor) {
      return g.append("text").attr("x", x).attr("y", y).attr("class", cls)
        .attr("text-anchor", anchor || "start").text(str);
    }
    function lines(g, x, y, arr, lh, cls, anchor) {
      const t = g.append("text").attr("x", x).attr("y", y).attr("class", cls).attr("text-anchor", anchor || "start");
      arr.forEach((s, i) => t.append("tspan").attr("x", x).attr("dy", i ? lh : 0).text(s));
      return t;
    }
    function arrow(g, x1, y1, x2, y2, bend) {
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = x2 - x1, dy = y2 - y1;
      const len = Math.hypot(dx, dy) || 1, b = bend == null ? .22 : bend;
      return g.append("path").attr("class", "lp-arrow")
        .attr("d", `M${x1},${y1} Q${(mx - dy / len * len * b).toFixed(1)},${(my + dx / len * len * b).toFixed(1)} ${x2},${y2}`)
        .attr("marker-end", `url(#${uid}-arrow)`);
    }
    function sideLabel(g, x, y, letter, head, rest) {
      g.append("circle").attr("cx", x + 13).attr("cy", y - 7).attr("r", 13).attr("class", "lp-side-ring");
      text(g, x + 13, y - 1, letter, "lp-side-letter", "middle");
      const t = text(g, x + 38, y, "", "lp-side-head");
      t.append("tspan").text("Side " + letter + ". " + head + " ");
      t.append("tspan").attr("class", "lp-side-rest").text(rest);
    }

    /* --- header --- */
    const head = svg.append("g").attr("class", "lp-head");
    text(head, 52, 78, "Eminem’s studio albums, 1996–2024", "lp-over");
    text(head, 47, 222, "THE LONG PLAY", "lp-title").attr("filter", `url(#${uid}-worn)`);
    lines(head, 985, 80, [
      "Twelve albums in thirty years. Each record sits at",
      "its release date and its best U.S. sales week, and",
      "is sized by what the RIAA has certified since.",
      "Every groove is a track. The red ones have a guest."
    ], 25, "lp-deck");
    // hype sticker: Infinite came out on 12 November 1996
    const st = head.append("g").attr("class", "lp-sticker").attr("transform", "translate(1480,118) rotate(-11)");
    st.append("circle").attr("r", 66).attr("class", "lp-sticker-disc");
    st.append("circle").attr("r", 59).attr("class", "lp-sticker-ring");
    text(st, 0, -33, "INFINITE AT", "lp-sticker-sm", "middle");
    text(st, 0, 20, "30", "lp-sticker-num", "middle");
    text(st, 0, 42, "NOV 12, 1996", "lp-sticker-sm", "middle");
    const stats = [
      [M.totals.tracks, "tracks"], [M.totals.guests, "credited guests"],
      [M.totals.certified + "M", "units certified"], [M.totals.no1, "No. 1 debuts"],
      [M.totals.grammys, "rap album Grammys"]
    ];
    const sg = head.append("g").attr("transform", "translate(985,220)");
    let sx = 0;
    stats.forEach(s => {
      const num = text(sg, sx, 0, s[0], "lp-stat-num");
      const words = s[1].split(" ");
      const cut = Math.ceil(words.length / 2);
      const lab = words.length > 1 ? [words.slice(0, cut).join(" "), words.slice(cut).join(" ")] : ["", s[1]];
      const lt = lines(sg, 0, -17, lab, 15, "lp-stat-lab");
      const lx = sx + num.node().getComputedTextLength() + 7;
      lt.attr("x", lx).selectAll("tspan").attr("x", lx);
      sx = lx + lt.node().getBBox().width + 24;
    });

    /* ================= SIDE A: sales ================= */
    const A = svg.append("g").attr("class", "lp-a");
    sideLabel(A, 52, 270, "A", "Sales:", "how hard each album opened, and how far it went");

    const PL = 128, PR = 1548, PT = 312, PB = 900;
    const x = d3.scaleUtc().domain([Date.UTC(1996, 0, 1), Date.UTC(2027, 0, 1)]).range([PL, PR]);
    const y = d3.scaleLinear().domain([0, 2e6]).range([PB, PT]);
    const rS = d3.scaleSqrt().domain([0, 12]).range([0, 72]);

    // grid and axes: solid hairlines, one step off the surface
    const grid = A.append("g").attr("class", "lp-grid");
    [5e5, 1e6, 1.5e6, 2e6].forEach(v => {
      grid.append("line").attr("x1", PL).attr("x2", PR).attr("y1", y(v)).attr("y2", y(v));
      text(grid, PL - 12, y(v) + 4.5, fmtN(v), "lp-tick", "end");
    });
    text(grid, PL, PT - 12, "↑ Best week of U.S. sales", "lp-axis-title");
    A.append("line").attr("class", "lp-base").attr("x1", PL).attr("x2", PR).attr("y1", PB).attr("y2", PB);
    const xa = A.append("g").attr("class", "lp-xaxis");
    d3.range(1996, 2028).forEach(yr => {
      const px = x(Date.UTC(yr, 0, 1)), major = yr % 2 === 0;
      xa.append("line").attr("x1", px).attr("x2", px).attr("y1", PB).attr("y2", PB + (major ? 8 : 4));
      if (major && yr < 2027) text(xa, px, PB + 24, yr, "lp-tick", "middle");
    });
    // what the vertical scale counts changes in December 2014
    const eraX = x(Date.UTC(2014, 11, 13)), eraY = PB + 46;
    const era = A.append("g").attr("class", "lp-era");
    era.append("path").attr("d", `M${PL},${eraY - 5}V${eraY}H${eraX - 5}V${eraY - 5}`);
    era.append("path").attr("d", `M${eraX + 5},${eraY - 5}V${eraY}H${PR}V${eraY - 5}`);
    text(era, (PL + eraX) / 2, eraY + 17, "counted in copies sold", "lp-era-lab", "middle");
    text(era, (eraX + PR) / 2, eraY + 17, "counted in album-equivalent units, sales plus streams. The tick on each stem marks sales alone.", "lp-era-lab", "middle");
    era.append("line").attr("class", "lp-era-rule").attr("x1", eraX).attr("x2", eraX).attr("y1", PB).attr("y2", 626);

    // geometry for every record
    M.albums.forEach(a => {
      a.cx = x(a.when); a.cy = y(a.week ? a.week.n : 0);
      a.r = a.riaa ? rS(a.riaa) : (a.week ? rS(1) : 0);
      a.certified = a.riaa != null;
    });
    const comp = M.comp;
    comp.cx = x(comp.when); comp.cy = y(comp.week.n); comp.r = rS(comp.riaa);

    const charted = M.albums.filter(a => a.week);

    // stems
    const stems = A.append("g").attr("class", "lp-stems");
    charted.forEach(a => {
      stems.append("line").attr("x1", a.cx).attr("x2", a.cx).attr("y1", PB).attr("y2", a.cy + a.r);
      stems.append("circle").attr("cx", a.cx).attr("cy", PB).attr("r", 2.4);
      if (a.week.pure) stems.append("path").attr("class", "lp-pure").attr("d", `M${a.cx - 5},${y(a.week.pure)}h10`);
    });

    // the greatest-hits set, drawn as an outline for context
    const ghost = A.append("g").attr("class", "lp-ghost").attr("transform", `translate(${comp.cx},${comp.cy})`);
    ghost.append("circle").attr("r", comp.r);
    ghost.append("circle").attr("r", 2).attr("class", "lp-ghost-dot");
    lines(ghost, 0, -22, ["Curtain Call: The Hits", "2005 greatest-hits set", "441K first week", "10× platinum, Diamond"], 15, "lp-ghost-lab", "middle");

    /* one record: disc, a groove per track, label, spindle hole */
    function drawRecord(g, a, r, o) {
      o = o || {};
      const n = a.tracks.length;
      const labelR = Math.max(r * .27, 2.6);
      const rOut = r * .955, rIn = labelR + Math.max(r * .07, 1.2);
      const pitch = (rOut - rIn) / n;
      const solid = a.certified || o.solid;
      g.append("circle").attr("r", r * 1.17).attr("fill", `url(#${uid}-shadow)`).attr("class", "lp-rec-shadow")
        .attr("opacity", solid ? 1 : 0);
      g.append("circle").attr("r", r + 2.5).attr("fill", C.surface).attr("opacity", solid ? .9 : 0);
      const disc = g.append("circle").attr("r", r).attr("class", "lp-disc" + (solid ? "" : " is-open"));
      if (solid) {
        // two soft wedges of reflected light, as on real vinyl
        [-38, 142].forEach(deg => {
          const a0 = (deg - 13) * Math.PI / 180, a1 = (deg + 13) * Math.PI / 180;
          g.append("path").attr("class", "lp-sheen")
            .attr("d", `M0,0L${(rOut * Math.cos(a0)).toFixed(2)},${(rOut * Math.sin(a0)).toFixed(2)}A${rOut},${rOut} 0 0 1 ${(rOut * Math.cos(a1)).toFixed(2)},${(rOut * Math.sin(a1)).toFixed(2)}Z`);
        });
      }
      const grooves = g.append("g").attr("class", "lp-grooves");
      a.tracks.forEach((t, i) => {
        const rr = rOut - (i + .5) * pitch; // track 1 is the outer groove
        const c = grooves.append("circle").attr("r", rr.toFixed(2))
          .attr("class", "lp-groove" + (t.guests.length ? " is-guest" : "") + (t.skit ? " is-skit" : ""))
          .attr("stroke-width", t.guests.length
            ? Math.min(2.6, Math.max(pitch * .7, .95)).toFixed(2)
            : Math.min(1.1, Math.max(pitch * .4, .5)).toFixed(2));
        if (t.skit) c.attr("stroke-dasharray", `${Math.max(1, pitch * .45).toFixed(1)} ${Math.max(2.6, pitch * 1.5).toFixed(1)}`);
        c.datum({ album: a, track: t });
      });
      const won = a.grammy && a.grammy.won;
      g.append("circle").attr("r", labelR).attr("class", "lp-label" + (won ? " is-won" : ""));
      g.append("circle").attr("r", Math.max(labelR * .16, .9)).attr("class", "lp-hole" + (won ? " is-won" : ""));
      disc.datum(a);
      return { labelR, rOut, rIn, pitch, n };
    }

    const recLayer = A.append("g").attr("class", "lp-records");
    const geo = new Map();
    M.albums.filter(a => a.week).sort((p, q) => q.r - p.r).forEach(a => {
      const g = recLayer.append("g").attr("class", "lp-rec").attr("data-album", a.id)
        .attr("transform", `translate(${a.cx.toFixed(1)},${a.cy.toFixed(1)})`);
      geo.set(a.id, Object.assign(drawRecord(g, a, a.r), { g, a, r: a.r }));
    });

    // Infinite: about 1,000 copies. At this scale it is a speck, so show it through a lens.
    const inf = M.albums[0];
    const speckR = Math.max(rS(inf.pressed / 1e6), .9);
    const lensX = inf.cx + 6, lensY = 668, lensR = 46;
    const lens = A.append("g").attr("class", "lp-lens");
    const ang = Math.atan2(PB - lensY, inf.cx - lensX), off = Math.acos(lensR / Math.hypot(PB - lensY, inf.cx - lensX));
    [ang - off, ang + off].forEach(t => {
      lens.append("line").attr("x1", inf.cx).attr("y1", PB)
        .attr("x2", lensX + lensR * Math.cos(t)).attr("y2", lensY + lensR * Math.sin(t));
    });
    lens.append("circle").attr("cx", lensX).attr("cy", lensY).attr("r", lensR).attr("class", "lp-lens-ring");
    A.append("circle").attr("cx", inf.cx).attr("cy", PB).attr("r", speckR).attr("class", "lp-speck");
    const infG = recLayer.append("g").attr("class", "lp-rec").attr("data-album", inf.id)
      .attr("transform", `translate(${lensX},${lensY})`);
    geo.set(inf.id, Object.assign(drawRecord(infG, inf, 38, { solid: true }), { g: infG, a: inf, r: 38 }));

    /* direct labels */
    const lab = A.append("g").attr("class", "lp-labels");
    function recLabel(a, o) {
      const px = o.x != null ? o.x : a.cx + (o.dx || 0), py = o.y != null ? o.y : a.cy + (o.dy || 0);
      const t = lab.append("text").attr("class", "lp-rec-lab").attr("text-anchor", o.anchor || "start")
        .attr("x", px).attr("y", py);
      (o.title || [a.short]).forEach((s, i) => t.append("tspan").attr("class", "lp-rec-title").attr("x", px).attr("dy", i ? 17 : 0).text(s));
      o.sub.forEach((s, i) => t.append("tspan").attr("class", "lp-rec-sub").attr("x", px).attr("dy", i ? 15 : 17).text(s));
    }
    const A_ = id => M.albums.find(a => a.id === id);
    const cert = a => a.riaa + "× platinum" + (a.riaa >= 10 ? ", Diamond" : "");
    let a;
    a = A_("sslp"); recLabel(a, { dx: 0, dy: -(a.r + 44), anchor: "middle", sub: [fmtN(a.week.n) + " first week", cert(a)] });
    a = A_("mmlp"); recLabel(a, { dx: a.r + 14, dy: -46, sub: [fmtN(a.week.n) + " first week", cert(a)] });
    a = A_("tes"); recLabel(a, { dx: a.r + 14, dy: -30, sub: [fmtN(a.week.n) + " first full week", cert(a)] });
    a = A_("encore"); recLabel(a, { dx: a.r + 12, dy: -22, sub: [fmtN(a.week.n) + " first full week", cert(a)] });
    a = A_("relapse"); recLabel(a, { dx: -(a.r + 9), dy: -30, anchor: "end", sub: [fmtN(a.week.n) + ", " + cert(a)] });
    a = A_("recovery"); recLabel(a, { dx: -6, dy: -(a.r + 44), anchor: "middle", sub: [fmtN(a.week.n) + " first week", cert(a)] });
    a = A_("mmlp2"); recLabel(a, { dx: -a.r, dy: -(a.r + 44), sub: [fmtN(a.week.n) + " first week", cert(a)] });
    a = A_("revival"); recLabel(a, { dx: -(a.r + 9), dy: -6, anchor: "end", sub: [fmtN(a.week.n) + " units, 1×"] });
    a = A_("kamikaze"); recLabel(a, { dx: 0, dy: -(a.r + 27), anchor: "middle", sub: [fmtN(a.week.n) + " units, 1×"] });
    a = A_("mtbmb"); recLabel(a, { dx: a.r + 9, dy: -30, title: ["Music to Be", "Murdered By"], sub: [fmtN(a.week.n) + " units, 1×"] });
    a = A_("tdoss"); recLabel(a, { x: PR, dy: -(a.r + 27), anchor: "end", sub: [fmtN(a.week.n) + " units, not yet certified"] });

    /* handwritten notes */
    const notes = A.append("g").attr("class", "lp-notes");
    lines(notes, 138, lensY - 128, ["Infinite, 1996. About", "1,000 copies pressed.", "At true size it is the", "speck on the axis."], 21, "lp-hand");
    a = A_("mmlp");
    lines(notes, a.cx + a.r + 14, a.cy + 22, ["1.76 million in a week, more", "than double rap’s old record"], 21, "lp-hand");
    a = A_("tes");
    lines(notes, a.cx + a.r + 14, a.cy + 42, ["Leaked, shipped early:", "284K in a short frame,", "then 1.32M in a week"], 21, "lp-hand");
    const gapL = A_("encore").cx + 8, gapR = A_("relapse").cx - 8, gapY = PB - 46;
    notes.append("path").attr("class", "lp-bracket").attr("d", `M${gapL},${gapY + 6}V${gapY}H${gapR}V${gapY + 6}`);
    text(notes, (gapL + gapR) / 2, gapY + 26, "4½ years, no studio album", "lp-hand", "middle");
    lines(notes, eraX + 12, 648, ["Dec 2014: the chart starts", "counting streams. From", "here it’s units, not copies."], 21, "lp-hand");
    a = A_("mtbmb");
    lines(notes, a.cx + 62, a.cy - 130, ["Tenth No. 1 debut in a row,", "a Billboard 200 first"], 21, "lp-hand");
    arrow(notes, a.cx + 56, a.cy - 124, a.cx + 5, a.cy - a.r - 8, .3);

    /* how to read a record */
    const key = A.append("g").attr("class", "lp-key").attr("transform", "translate(700,336)");
    text(key, 0, 0, "How to read a record", "lp-key-head");
    const sample = {
      certified: true, grammy: { won: true },
      tracks: d3.range(12).map(i => ({ n: i + 1, guests: [2, 6, 9].includes(i) ? ["x"] : [], skit: i === 4 || i === 11 }))
    };
    const sg2 = key.append("g").attr("transform", "translate(78,104)").attr("class", "lp-rec is-sample");
    const sgeo = drawRecord(sg2, sample, 76);
    const callouts = [
      { r: 76, deg: -64, label: ["Area: U.S. units certified by the RIAA"] },
      { r: sgeo.rOut - .5 * sgeo.pitch, deg: -38, label: ["One groove per track. Track 1 is the outer groove."] },
      { r: sgeo.rOut - 2.5 * sgeo.pitch, deg: -14, label: ["Red groove: a track with a credited guest"] },
      { r: sgeo.rOut - 4.5 * sgeo.pitch, deg: 10, label: ["Dotted groove: a skit, intro or interlude"] },
      { r: sgeo.labelR * .6, deg: 34, label: ["Solid label: won the Grammy for Best Rap Album"] }
    ];
    callouts.forEach((c, i) => {
      const t = c.deg * Math.PI / 180, px = 78 + c.r * Math.cos(t), py = 104 + c.r * Math.sin(t);
      const ly = 38 + i * 27;
      key.append("path").attr("class", "lp-leader").attr("d", `M${px.toFixed(1)},${py.toFixed(1)}L${178},${ly - 4}H186`);
      key.append("circle").attr("cx", px).attr("cy", py).attr("r", 1.8).attr("class", "lp-leader-dot");
      lines(key, 192, ly, c.label, 16, "lp-key-lab");
    });
    key.append("circle").attr("cx", 172).attr("cy", 169).attr("r", 8).attr("class", "lp-disc is-open");
    lines(key, 192, 173, ["Dashed edge: not yet certified, drawn at 1×"], 16, "lp-key-lab");
    // size key
    const sk = key.append("g").attr("transform", "translate(640,180)");
    [12, 5, 1].forEach(v => {
      sk.append("circle").attr("cx", 0).attr("cy", -rS(v)).attr("r", rS(v)).attr("class", "lp-size-ring");
      sk.append("line").attr("class", "lp-leader").attr("x1", 0).attr("x2", 92).attr("y1", -2 * rS(v)).attr("y2", -2 * rS(v));
      text(sk, 98, -2 * rS(v) + 4.5, v === 12 ? "12 million units" : v === 5 ? "5 million" : "1 million (platinum)", "lp-key-lab");
    });

    /* ================= SIDE B: guests ================= */
    const B = svg.append("g").attr("class", "lp-b");
    sideLabel(B, 52, 1016, "B", "Guests:", `every credited feature across ${M.totals.tracks} tracks, in order of first appearance`);

    const ML = 668, MR = 1548, RT = 1136, RH = 31;
    const colW = (MR - ML) / M.guests.length;
    const colX = i => ML + (i + .5) * colW, rowY = i => RT + (i + .5) * RH;
    const rowsEnd = RT + M.albums.length * RH;

    const rules = B.append("g").attr("class", "lp-rules");
    d3.range(M.albums.length + 1).forEach(i => {
      rules.append("line").attr("x1", 52).attr("x2", MR).attr("y1", RT + i * RH).attr("y2", RT + i * RH);
    });

    // ledger: year, album, Grammy, chart peak, certification, critics
    const LX = { year: 52, title: 100, grammy: 338, peak: 384, riaa: 420, meta: 646 };
    const hd = B.append("g").attr("class", "lp-colhead");
    text(hd, LX.year, RT - 10, "Year", "lp-th");
    text(hd, LX.title, RT - 10, "Album", "lp-th");
    text(hd, LX.grammy, RT - 10, "Grammy", "lp-th", "middle");
    text(hd, LX.peak, RT - 10, "Peak", "lp-th", "middle");
    text(hd, LX.riaa - 5, RT - 10, "RIAA certified: one disc, one million", "lp-th");
    text(hd, LX.meta, RT - 10, "Metacritic", "lp-th", "end");

    const rows = B.append("g").attr("class", "lp-rows");
    M.albums.forEach((al, i) => {
      const g = rows.append("g").attr("class", "lp-row").attr("data-album", al.id).attr("transform", `translate(0,${rowY(i)})`);
      text(g, LX.year, 5, al.year, "lp-td-year");
      text(g, LX.title, 5, al.short, "lp-td-title");
      if (al.grammy) g.append("circle").attr("cx", LX.grammy).attr("cy", 0).attr("r", 4.6).attr("class", "lp-gram" + (al.grammy.won ? " is-won" : ""));
      text(g, LX.peak, 5, al.peak ? "No. " + al.peak : "—", "lp-td", "middle");
      if (al.riaa) {
        d3.range(al.riaa).forEach(k => {
          g.append("circle").attr("cx", LX.riaa + k * 12.6).attr("cy", 0).attr("r", 4.9).attr("class", "lp-plat");
          g.append("circle").attr("cx", LX.riaa + k * 12.6).attr("cy", 0).attr("r", 1.2).attr("class", "lp-plat-hole");
        });
        text(g, LX.riaa + al.riaa * 12.6 + 2, 5, al.riaa + "×", "lp-td-num");
      } else {
        text(g, LX.riaa - 5, 5, al.pressed ? "about 1,000 copies pressed" : "not yet certified", "lp-td-none");
      }
      text(g, LX.meta, 5, al.metacritic == null ? "—" : al.metacritic, "lp-td", "end");
    });

    // matrix
    const cols = B.append("g").attr("class", "lp-cols");
    M.guests.forEach((gst, j) => {
      const g = cols.append("g").attr("class", "lp-col" + (gst.tracks > 1 ? " is-repeat" : "")).attr("data-guest", gst.name);
      g.append("line").attr("class", "lp-drop").attr("x1", colX(j)).attr("x2", colX(j)).attr("y1", RT - 6).attr("y2", rowY(gst.first));
      if (gst.last > gst.first) {
        g.append("line").attr("class", "lp-span").attr("x1", colX(j)).attr("x2", colX(j)).attr("y1", rowY(gst.first)).attr("y2", rowY(gst.last));
      }
      gst.perAlbum.forEach((count, ai) => {
        g.append("circle").attr("class", "lp-dot").attr("cx", colX(j)).attr("cy", rowY(ai)).attr("r", (3.4 * Math.sqrt(count)).toFixed(2));
      });
      g.append("text").attr("class", "lp-col-name")
        .attr("transform", `translate(${(colX(j) + 4).toFixed(1)},${RT - 12}) rotate(-56)`).text(gst.name);
      if (gst.tracks > 1) text(g, colX(j), rowsEnd + 19, gst.tracks, "lp-col-total", "middle");
    });
    text(B, ML - 12, rowsEnd + 19, "Tracks together, where more than one", "lp-th", "end");

    // key for Side B, in the space above the ledger
    const kb = B.append("g").attr("class", "lp-keyb").attr("transform", "translate(52,1052)");
    [1, 2, 3].forEach((n, i) => {
      kb.append("circle").attr("class", "lp-dot").attr("cx", 6 + i * 20).attr("cy", 0).attr("r", 3.4 * Math.sqrt(n));
    });
    text(kb, 62, 4.5, "1, 2 or 3 tracks on an album", "lp-key-lab");
    kb.append("line").attr("class", "lp-span").attr("x1", 262).attr("x2", 296).attr("y1", 0).attr("y2", 0);
    kb.append("circle").attr("class", "lp-dot").attr("cx", 262).attr("cy", 0).attr("r", 3.4);
    kb.append("circle").attr("class", "lp-dot").attr("cx", 296).attr("cy", 0).attr("r", 3.4);
    text(kb, 308, 4.5, "first to last album together", "lp-key-lab");
    kb.append("circle").attr("class", "lp-gram is-won").attr("cx", 6).attr("cy", 28).attr("r", 4.6);
    text(kb, 18, 32.5, "won Best Rap Album", "lp-key-lab");
    kb.append("circle").attr("class", "lp-gram").attr("cx", 168).attr("cy", 28).attr("r", 4.6);
    text(kb, 180, 32.5, "nominated", "lp-key-lab");

    /* --- footer --- */
    const foot = svg.append("g").attr("class", "lp-foot");
    lines(foot, 52, 1556, [
      "Sources: RIAA Gold & Platinum database; Billboard and Luminate figures as reported in each album’s Wikipedia entry; Metacritic. Checked " + M.asOf + ".",
      "Guests are credited features on standard editions. Best week is the first full tracking week: The Eminem Show (284K) and Encore (710K) each had a shortened debut frame before it."
    ], 17, "lp-foot-text");
    if (opts.byline) text(foot, MR, 1573, opts.byline, "lp-byline", "end");

    if (opts.interactive) interact(el, svg, M, geo, { colX, rowY, ML, MR, RT, RH, rowsEnd, colW });
    return { model: M };
  }

  /* ---------- hover, focus, tap ---------- */

  function interact(el, svg, M, geo, L) {
    const tip = d3.select(el).append("div").attr("class", "lp-tip").attr("role", "status").style("display", "none");
    const root = svg.node();
    let pinned = false;

    function place(evt, target, beside) {
      const box = el.getBoundingClientRect();
      const n = tip.node(), w = n.offsetWidth, h = n.offsetHeight;
      let left, top;
      if (beside || !evt || evt.clientX == null || evt.type === "focus") {
        const b = target.getBoundingClientRect();
        left = b.right - box.left + 10;
        if (left + w > box.width - 8) left = b.left - box.left - w - 10;
        top = b.top - box.top + b.height / 2 - h / 2;
      } else {
        left = evt.clientX - box.left + 16; top = evt.clientY - box.top + 16;
        if (left + w > box.width - 8) left = evt.clientX - box.left - w - 16;
        if (top + h > box.height - 8) top = evt.clientY - box.top - h - 16;
      }
      tip.style("left", Math.max(8, Math.min(left, box.width - w - 8)) + "px")
        .style("top", Math.max(8, Math.min(top, box.height - h - 8)) + "px");
    }
    function show(build, evt, target, beside) {
      const n = tip.node();
      n.textContent = "";
      build(n);
      tip.style("display", "block");
      place(evt, target, beside);
    }
    function add(parent, tag, cls, str) {
      const e = document.createElement(tag);
      if (cls) e.className = cls;
      if (str != null) e.textContent = str;
      parent.appendChild(e);
      return e;
    }
    function clear() {
      tip.style("display", "none");
      root.classList.remove("has-focus", "has-track");
      svg.selectAll(".is-on").classed("is-on", false);
      svg.selectAll(".is-hot").classed("is-hot", false);
    }

    function albumFacts(n, a) {
      add(n, "div", "lp-tip-title", a.title);
      add(n, "div", "lp-tip-meta", fmtMonth(a.when) + (a.peak ? ", peaked at No. " + a.peak : ", did not chart"));
      const dl = add(n, "dl", "lp-tip-facts");
      const fact = (k, v) => { add(dl, "dt", null, k); add(dl, "dd", null, v); };
      if (a.week) {
        fact("Best week", fmtN(a.week.n) + (a.week.kind === "units" ? " units (" + fmtN(a.week.pure) + " pure sales)" : " copies"));
        if (a.week.debut) fact("Debut frame", fmtN(a.week.debut) + ", shortened");
      }
      fact("RIAA", a.riaa ? a.riaa + "× platinum" : a.pressed ? "none; about 1,000 pressed" : "not yet certified");
      if (a.metacritic != null) fact("Metacritic", a.metacritic);
      if (a.grammy) fact("Grammy", (a.grammy.won ? "Won" : "Nominated for") + " Best Rap Album, " + a.grammy.year);
      fact("Tracks", a.tracks.length + ", " + plural(a.guestNames.length, "guest", "guests"));
    }

    // records: the pointer only has to be over the disc; the nearest groove answers
    geo.forEach(G => {
      const a = G.a;
      const hit = G.g.append("circle").attr("r", G.r + 5).attr("class", "lp-hit")
        .attr("tabindex", 0).attr("role", "img")
        .attr("aria-label", `${a.title}, ${a.year}. ${a.tracks.length} tracks, ${a.guestNames.length} guests.`);
      function over(evt) {
        const p = d3.pointer(evt, G.g.node()), d = Math.hypot(p[0], p[1]);
        let t = null;
        if (evt.type !== "focus" && d > G.labelR && d <= G.r + 5) {
          t = a.tracks[Math.max(0, Math.min(G.n - 1, Math.floor((G.rOut - d) / G.pitch)))];
        }
        root.classList.add("has-focus");
        root.classList.toggle("has-track", !!t);
        svg.selectAll(".is-on").classed("is-on", false);
        svg.selectAll(".is-hot").classed("is-hot", false);
        svg.selectAll(`[data-album="${a.id}"]`).classed("is-on", true);
        G.g.selectAll(".lp-groove").classed("is-hot", d => t && d.track === t);
        if (t) t.guests.forEach(name => svg.selectAll(".lp-col").filter(function () { return this.getAttribute("data-guest") === name; }).classed("is-on", true));
        show(n => {
          albumFacts(n, a);
          if (t) {
            const box = add(n, "div", "lp-tip-track");
            add(box, "span", "lp-tip-no", "Track " + t.n + " of " + a.tracks.length);
            add(box, "strong", null, t.title);
            if (t.guests.length) add(box, "span", "lp-tip-feat", "with " + joinNames(t.guests));
            else if (t.skit) add(box, "span", "lp-tip-feat is-quiet", "skit, intro or interlude");
          } else if (a.note) add(n, "p", "lp-tip-note", a.note);
        }, evt, hit.node(), true);
      }
      hit.on("pointermove", over).on("pointerdown", evt => { pinned = true; over(evt); evt.stopPropagation(); })
        .on("focus", over).on("pointerleave", () => { if (!pinned) clear(); }).on("blur", clear);
    });

    // the greatest-hits outline
    svg.select(".lp-ghost").each(function () {
      const g = d3.select(this), c = M.comp;
      const hit = g.append("circle").attr("r", c.r).attr("class", "lp-hit");
      function over(evt) {
        show(n => {
          add(n, "div", "lp-tip-title", c.title);
          add(n, "div", "lp-tip-meta", fmtMonth(c.when) + ", peaked at No. " + c.peak + ". Not a studio album.");
          add(n, "p", "lp-tip-note", c.note);
        }, evt, hit.node(), true);
      }
      hit.on("pointermove", over).on("pointerdown", evt => { pinned = true; over(evt); evt.stopPropagation(); })
        .on("pointerleave", () => { if (!pinned) clear(); });
    });

    // ledger rows
    svg.selectAll(".lp-row").each(function () {
      const row = d3.select(this), a = M.albums.find(d => d.id === row.attr("data-album"));
      const hit = row.append("rect").attr("class", "lp-hit").attr("x", 46).attr("y", -L.RH / 2)
        .attr("width", L.ML - 52).attr("height", L.RH);
      function over(evt) {
        root.classList.add("has-focus");
        root.classList.remove("has-track");
        svg.selectAll(".is-on").classed("is-on", false);
        svg.selectAll(".is-hot").classed("is-hot", false);
        svg.selectAll(`[data-album="${a.id}"]`).classed("is-on", true);
        a.guestNames.forEach(name => svg.selectAll(".lp-col").filter(function () { return this.getAttribute("data-guest") === name; }).classed("is-on", true));
        show(n => { albumFacts(n, a); if (a.note) add(n, "p", "lp-tip-note", a.note); }, evt, hit.node());
      }
      hit.on("pointermove", over).on("pointerdown", evt => { pinned = true; over(evt); evt.stopPropagation(); })
        .on("pointerleave", () => { if (!pinned) clear(); });
    });

    // guest columns
    svg.selectAll(".lp-col").each(function () {
      const col = d3.select(this), name = col.attr("data-guest");
      const gst = M.guests.find(d => d.name === name), j = gst.order;
      const hit = col.append("path").attr("class", "lp-hit").attr("tabindex", 0).attr("role", "img")
        .attr("aria-label", `${name}: ${plural(gst.tracks, "track", "tracks")} on ${plural(gst.albums, "album", "albums")}.`)
        .attr("d", `M${L.colX(j) - L.colW / 2},${L.rowsEnd + 26}V${L.RT - 8}l64,-82h${L.colW}l-64,82V${L.rowsEnd + 26}Z`);
      function over(evt) {
        root.classList.add("has-focus", "has-track");
        svg.selectAll(".is-on").classed("is-on", false);
        svg.selectAll(".is-hot").classed("is-hot", false);
        col.classed("is-on", true);
        svg.selectAll(".lp-groove").classed("is-hot", d => d && d.track && d.track.guests && d.track.guests.includes(name));
        gst.perAlbum.forEach((c, ai) => svg.selectAll(`[data-album="${M.albums[ai].id}"]`).classed("is-on", true));
        show(n => {
          add(n, "div", "lp-tip-title", name);
          const span = M.albums[gst.first].year === M.albums[gst.last].year ? String(M.albums[gst.first].year)
            : M.albums[gst.first].year + "–" + M.albums[gst.last].year;
          add(n, "div", "lp-tip-meta", plural(gst.tracks, "track", "tracks") + " on " + plural(gst.albums, "album", "albums") + ", " + span);
          const ul = add(n, "ul", "lp-tip-list");
          gst.apps.forEach(ap => {
            const li = add(ul, "li");
            add(li, "strong", null, ap.track.title);
            add(li, "span", null, " " + ap.album.short + ", " + ap.album.year);
          });
          if (M.beyond[name]) add(n, "p", "lp-tip-note", M.beyond[name]);
        }, evt, hit.node());
      }
      hit.on("pointermove", over).on("pointerdown", evt => { pinned = true; over(evt); evt.stopPropagation(); })
        .on("focus", over).on("pointerleave", () => { if (!pinned) clear(); }).on("blur", clear);
    });

    d3.select(document).on("pointerdown." + el.id, () => { pinned = false; clear(); })
      .on("keydown." + el.id, evt => { if (evt.key === "Escape") { pinned = false; clear(); } });
  }

  /* ---------- collaborator lists and data table, as HTML ---------- */

  function renderNotes(el, DATA) {
    const M = buildModel(DATA);
    const root = d3.select(el);
    root.selectAll("*").remove();

    const freq = M.guests.filter(g => g.tracks > 1)
      .sort((p, q) => q.tracks - p.tracks || q.albums - p.albums || p.order - q.order);
    const once = M.guests.filter(g => g.tracks === 1);

    const s1 = root.append("section").attr("class", "lp-sec");
    s1.append("h2").text("The regulars");
    s1.append("p").attr("class", "lp-lede")
      .text(`${freq.length} of the ${M.guests.length} credited guests appear on more than one track. ` +
        "Counts cover the twelve studio albums only, standard editions.");
    const ol = s1.append("ol").attr("class", "lp-freq");
    const li = ol.selectAll("li").data(freq).join("li");
    const hd = li.append("div").attr("class", "lp-freq-head");
    hd.append("span").attr("class", "lp-freq-name").text(d => d.name);
    hd.append("span").attr("class", "lp-freq-pips").attr("aria-hidden", "true")
      .selectAll("i").data(d => d3.range(d.tracks)).join("i");
    hd.append("span").attr("class", "lp-freq-count").text(d => {
      const y0 = M.albums[d.first].year, y1 = M.albums[d.last].year;
      return plural(d.tracks, "track", "tracks") + " on " + plural(d.albums, "album", "albums") + ", " + (y0 === y1 ? y0 : y0 + "–" + y1);
    });
    li.append("p").attr("class", "lp-freq-tracks").each(function (d) {
      const p = d3.select(this);
      d.apps.forEach((ap, i) => {
        if (i) p.append("span").text("; ");
        p.append("em").text(ap.track.title);
        p.append("span").text(" (" + ap.album.short + ", " + ap.album.year + ")");
      });
    });
    li.filter(d => M.beyond[d.name]).append("p").attr("class", "lp-freq-note").text(d => M.beyond[d.name]);

    const s2 = root.append("section").attr("class", "lp-sec");
    s2.append("h2").text("One-time guests");
    s2.append("p").attr("class", "lp-lede").text(`${once.length} artists with a single credited feature, by album.`);
    const dl = s2.append("dl").attr("class", "lp-once");
    M.albums.forEach(a => {
      const mine = once.filter(g => g.apps[0].album === a);
      if (!mine.length) return;
      dl.append("dt").text(a.short + ", " + a.year);
      const dd = dl.append("dd");
      mine.forEach((g, i) => {
        if (i) dd.append("span").text("; ");
        dd.append("strong").text(g.name);
        dd.append("span").text(" on ");
        dd.append("em").text(g.apps[0].track.title);
      });
    });

    const s3 = root.append("section").attr("class", "lp-sec");
    s3.append("h2").text("The numbers");
    const wrap = s3.append("div").attr("class", "lp-table-wrap");
    const table = wrap.append("table").attr("class", "lp-table");
    table.append("caption").text("Eminem's studio albums: U.S. chart peak, best sales week, RIAA certification, Metacritic score and guests.");
    const headRow = table.append("thead").append("tr");
    ["Album", "Released", "Peak", "Best week, U.S.", "RIAA", "Metacritic", "Best Rap Album Grammy", "Tracks", "Guests"]
      .forEach((h, i) => headRow.append("th").attr("scope", "col").attr("class", i > 1 && i !== 6 ? "is-num" : null).text(h));
    const tr = table.append("tbody").selectAll("tr").data(M.albums).join("tr");
    tr.append("th").attr("scope", "row").text(d => d.title);
    tr.append("td").text(d => fmtMonth(d.when));
    tr.append("td").attr("class", "is-num").text(d => d.peak || "—");
    tr.append("td").attr("class", "is-num").text(d => !d.week ? "—"
      : fmtN(d.week.n) + (d.week.kind === "units" ? " units" : "") + (d.week.debut ? "*" : ""));
    tr.append("td").attr("class", "is-num").text(d => d.riaa ? d.riaa + "× platinum" : d.pressed ? "—" : "not certified");
    tr.append("td").attr("class", "is-num").text(d => d.metacritic == null ? "—" : d.metacritic);
    tr.append("td").text(d => !d.grammy ? "—" : (d.grammy.won ? "Won, " : "Nominated, ") + d.grammy.year);
    tr.append("td").attr("class", "is-num").text(d => d.tracks.length);
    tr.append("td").attr("class", "is-num").text(d => d.guestNames.length);
    s3.append("p").attr("class", "lp-fine")
      .text("* First full tracking week. The Eminem Show sold about 284,000 copies and Encore 710,000 in shortened debut frames before it. " +
        "From December 2014 the Billboard 200 counts album-equivalent units, which add streams and track sales to album sales.");
    return { model: M };
  }

  global.LongPlay = { render, renderNotes, buildModel };
})(typeof window !== "undefined" ? window : globalThis);
