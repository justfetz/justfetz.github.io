/* Twenty Rings: every NBA game Kobe Bryant played, 1996-2016.
   Needs d3 v7 and data.js (window.KOBE_DATA).

   Rings.poster(el, data, { interactive, byline })  the full bill, one 2400 x 3000 SVG
   Rings.ledger(el, data, { poster })               the same data season by season, for phones
   Rings.table(el, data)                            a plain table of the twenty seasons
*/
(function (global) {
  "use strict";
  var d3 = global.d3;

  // ---------- geometry ----------
  var W = 2400, H = 3000;
  var CX = 1200, CY8 = 1092, CY24 = 2236;   // centers of the two discs; they touch at y = 1664
  var R0 = 168, PITCH = 39.5, RD = 572;     // first ring, distance between rings, disc radius
  var GAP = 76, SWEEP = 360 - GAP;          // each ring is open for the summer
  var WIN = 239;                            // days from Oct 25 to Jun 20, the window a season can occupy
  var MAXLEN = 36.5;
  var SC = { pts: 0.56, min: MAXLEN / 55, fga: MAXLEN / 50 };   // only the 81 outgrows its ring, and it sits on the outside one

  var rad = function (a) { return a * Math.PI / 180; };
  var pt = function (cx, cy, r, a) { return [cx + r * Math.sin(rad(a)), cy - r * Math.cos(rad(a))]; };
  var utc = function (iso) { return Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)); };
  var fmtDate = function (iso) { return d3.utcFormat("%b %-d, %Y")(new Date(utc(iso))); };
  var num = d3.format(",");
  var TEAMS = { ATL: "Atlanta", BOS: "Boston", BRK: "Brooklyn", NJN: "New Jersey", CHA: "Charlotte", CHH: "Charlotte", CHO: "Charlotte", CHI: "Chicago", CLE: "Cleveland",
    DAL: "Dallas", DEN: "Denver", DET: "Detroit", GSW: "Golden State", HOU: "Houston", IND: "Indiana", LAC: "the Clippers", MEM: "Memphis", VAN: "Vancouver",
    MIA: "Miami", MIL: "Milwaukee", MIN: "Minnesota", NOH: "New Orleans", NOK: "New Orleans", NOP: "New Orleans", NYK: "New York", OKC: "Oklahoma City", SEA: "Seattle",
    ORL: "Orlando", PHI: "Philadelphia", PHO: "Phoenix", POR: "Portland", SAC: "Sacramento", SAS: "San Antonio", TOR: "Toronto", UTA: "Utah", WAS: "Washington" };
  var ROUND = { R1: "First round", R2: "Conference semifinals", CF: "Conference finals", F: "NBA Finals" };
  var ROUND_END = { R1: "lost in the first round", R2: "lost in the conference semifinals", CF: "lost in the conference finals", F: "lost in the Finals" };

  // the nights and the summers called out on the bill
  var MOMENTS = [
    { n: 1, date: "1996-11-03", head: "Nov 3, 1996", text: "Debut at 18 years, 72 days. Six minutes, no points." },
    { n: 2, date: "1997-05-12", head: "May 12, 1997", text: "Game 5 in Utah. Four airballs with the season on the line. Back home, by his own account, he shot in a gym until the sun came up." },
    { n: 3, date: "2000-06-14", head: "Jun 14, 2000", text: "Finals, Game 4 at Indiana: 28 points, 8 of them in overtime. The first title comes five days later." },
    { n: 4, date: "2002-06-12", head: "Jun 12, 2002", text: "A third straight championship, at 23." },
    { n: 5, date: "2003-01-07", head: "Jan 7, 2003", text: "Twelve three-pointers against Seattle." },
    { n: 6, date: "2003-02-23", head: "February 2003", text: "Nine straight games of 40 or more." },
    { n: 7, date: "2005-12-20", head: "Dec 20, 2005", text: "62 points in three quarters against Dallas. He sits out the fourth." },
    { n: 8, date: "2006-01-22", head: "Jan 22, 2006", text: "81 against Toronto, 55 of them after halftime." },
    { n: 9, date: "2007-03-23", head: "Mar 16–23, 2007", text: "Four straight games of 50 or more: 65, 50, 60, 50." },
    { n: 10, date: "2009-02-02", head: "Feb 2, 2009", text: "61 at Madison Square Garden, 20 for 20 at the line." },
    { n: 11, date: "2009-06-14", head: "Jun 14, 2009", text: "A fourth title, and his first Finals MVP." },
    { n: 12, date: "2010-06-17", head: "Jun 17, 2010", text: "Game 7 against Boston. He shoots 6 for 24, takes 15 rebounds and scores 10 in the fourth. Title five." },
    { n: 13, date: "2013-04-12", head: "Apr 12, 2013", text: "Tears his Achilles against Golden State, makes both free throws, walks off." },
    { n: 14, date: "2014-12-14", head: "Dec 14, 2014", text: "Passes Michael Jordan for third on the all-time scoring list." },
    { n: 15, date: "2016-04-13", head: "Apr 13, 2016", text: "The last game: 60 points on 50 shots, 23 of them in the fourth." },
  ];
  var SUMMERS = [
    { k: "A", after: 5, head: "Jul 18, 2002 · Rucker Park, Harlem", text: "Five weeks after a third title he turns up at the Entertainers Basketball Classic: 15 points, 7 rebounds, 7 assists before rain ends it. The park’s announcer names him Lord of the Rings." },
    { k: "B", after: 11, head: "August 2008 · Beijing", text: "Olympic gold. Twenty points in the final against Spain." },
    { k: "C", after: 15, head: "August 2012 · London", text: "A second gold, at 33." },
  ];
  var ERA = {
    8: { years: "1996–2006 · AGES 18 TO 27", allstar: 8, titles: "3", titlesL: "championships" },
    24: { years: "2006–2016 · AGES 28 TO 37", allstar: 10, titles: "2", titlesL: "more, both as Finals MVP" },
  };
  var TAGS = { "2007-2008": "MVP" };

  // ---------- data ----------
  function prep(D) {
    var K = D.keys;
    var S = D.seasons.map(function (s, i) {
      var top = i < 10;
      return Object.assign({}, s, { i: i, top: top, cx: CX, cy: top ? CY8 : CY24, r: R0 + (top ? i : 19 - i) * PITCH, games: [] });
    });
    var seriesCount = {};
    var G = D.games.map(function (row, idx) {
      var g = { idx: idx };
      K.forEach(function (k, j) { g[k] = row[j]; });
      var y = +g.date.slice(0, 4), m = +g.date.slice(5, 7);
      g.s = S[(m >= 8 ? y : y - 1) - 1996];
      g.frac = (utc(g.date) - Date.UTC(g.s.y, 9, 25)) / 864e5 / WIN;
      g.a = g.s.top ? 218 + g.frac * SWEEP : 322 - g.frac * SWEEP;
      g.late = g.q4 + g.otp;
      g.w8 = Math.max(2.9, Math.min(9.2, 0.0179 * g.s.r));
      if (g.po) { var key = g.s.season + g.series + g.opp; seriesCount[key] = (seriesCount[key] || 0) + 1; g.gameNo = seriesCount[key]; }
      g.s.games.push(g);
      return g;
    });
    S.forEach(function (s) { s.rsGames = s.games.filter(function (g) { return !g.po; }); s.poGames = s.games.filter(function (g) { return g.po; }); });
    return { S: S, G: G, arenas: D.arenas };
  }
  function lens(g, metric) {
    if (metric === "min") return [g.mp * SC.min, 0];
    if (metric === "fga") return [g.fgm * SC.fga, (g.fga - g.fgm) * SC.fga];
    return [(g.pts - g.late) * SC.pts, g.late * SC.pts];
  }
  function arcPath(s, a1, a2, r) {
    r = r || s.r;
    var p1 = pt(s.cx, s.cy, r, a1), p2 = pt(s.cx, s.cy, r, a2);
    return "M" + p1[0].toFixed(2) + "," + p1[1].toFixed(2) + "A" + r + "," + r + " 0 " + (Math.abs(a2 - a1) > 180 ? 1 : 0) + " " + (s.top ? 1 : 0) + " " + p2[0].toFixed(2) + "," + p2[1].toFixed(2);
  }
  var ang = function (top, frac) { return top ? 218 + frac * SWEEP : 322 - frac * SWEEP; };

  // ---------- text helpers ----------
  function wrap(text, str, width, lh) {
    var words = str.split(/ +/), line = [], x = text.attr("x"), n = 1;   // a no-break space keeps "No. 8" together
    var ts = text.append("tspan").attr("x", x).attr("dy", 0);
    words.forEach(function (w) {
      line.push(w); ts.text(line.join(" "));
      if (ts.node().getComputedTextLength() > width && line.length > 1) {
        line.pop(); ts.text(line.join(" ")); line = [w];
        ts = text.append("tspan").attr("x", x).attr("dy", lh).text(w); n++;
      }
    });
    return n;
  }
  function fit(text, width, size) {
    text.style("font-size", size + "px");
    var w = text.node().getComputedTextLength();
    if (w > 0) text.style("font-size", (size * width / w).toFixed(1) + "px");
  }
  var FACES = ['900 100px "Bodoni Moda"', '700 40px "Bodoni Moda"', 'italic 500 24px "Bodoni Moda"', '400 20px "IBM Plex Sans Condensed"', '500 20px "IBM Plex Sans Condensed"',
    '600 20px "IBM Plex Sans Condensed"', '700 20px "IBM Plex Sans Condensed"'];
  function fonts() {
    var d = global.document;
    if (!d.fonts || !d.fonts.load) return Promise.resolve();
    return Promise.all(FACES.map(function (f) { return d.fonts.load(f); })).catch(function () {});
  }

  // =====================================================================
  //  The figure eight: two discs, ten rings each
  // =====================================================================
  function hero(root, P, opts) {
    opts = opts || {};
    var S = P.S, G = P.G, metric = "pts";
    var discs = { 8: root.append("g").attr("class", "rg-d is-8"), 24: root.append("g").attr("class", "rg-d is-24") };
    var cy = { 8: CY8, 24: CY24 };
    [8, 24].forEach(function (j) {
      var g = discs[j], top = j === 8;
      g.append("circle").attr("class", "rg-disc-" + j).attr("cx", CX).attr("cy", cy[j]).attr("r", RD);
      // the month scale around the rim
      var rim = root.append("g").attr("class", "rg-months");
      rim.append("path").attr("class", "rg-rim").attr("d", arcPath({ cx: CX, cy: cy[j], top: top }, ang(top, 0), ang(top, 1), RD + 9));
      [["NOV", 7, 37], ["DEC", 37, 68], ["JAN", 68, 99], ["FEB", 99, 127], ["MAR", 127, 158], ["APR", 158, 188], ["MAY", 188, 219], ["JUN", 219, 239]].forEach(function (m) {
        var a = ang(top, m[1] / WIN), p1 = pt(CX, cy[j], RD + 9, a), p2 = pt(CX, cy[j], RD + 19, a);
        rim.append("line").attr("class", "rg-mtick").attr("x1", p1[0]).attr("y1", p1[1]).attr("x2", p2[0]).attr("y2", p2[1]);
        var pm = pt(CX, cy[j], RD + 33, ang(top, (m[1] + m[2]) / 2 / WIN));
        rim.append("text").attr("class", "rg-month").attr("x", pm[0]).attr("y", pm[1] + 5.5).text(m[0]);
      });
    });

    // rings
    S.forEach(function (s) {
      var g = discs[s.jersey];
      g.append("path").attr("class", "rg-guide").attr("d", arcPath(s, ang(s.top, 0), ang(s.top, 1)));
      if (s.champion) g.append("path").attr("class", "rg-champ").attr("d", arcPath(s, s.games[0].a, s.games[s.games.length - 1].a));
      if (s.poGames.length) {
        var a1 = s.poGames[0].a, a2 = s.poGames[s.poGames.length - 1].a, padA = (s.top ? 1 : -1) * 0.55;
        g.append("path").attr("class", "rg-po").attr("d", arcPath(s, a1 - padA, a2 + padA, s.r - 1.5));
      }
    });

    // one spike per game
    var spikes = {};
    [8, 24].forEach(function (j) {
      spikes[j] = discs[j].append("g").attr("class", "rg-spikes").selectAll("g").data(G.filter(function (g) { return g.s.jersey === j; })).join("g")
        .attr("class", "rg-g")
        .attr("transform", function (g) { var p = pt(g.s.cx, g.s.cy, g.s.r + 1.2, g.a); return "translate(" + p[0].toFixed(2) + "," + p[1].toFixed(2) + ") rotate(" + g.a.toFixed(2) + ")"; });
    });
    var all = root.selectAll("g.rg-g");
    all.append("rect").attr("class", "rg-zero").attr("x", function (g) { return -g.w8 / 2; }).attr("width", function (g) { return g.w8; }).attr("y", -1.6).attr("height", 1.6);
    var base = all.append("rect").attr("class", "rg-base").attr("x", function (g) { return -g.w8 / 2; }).attr("width", function (g) { return g.w8; });
    var tip = all.append("rect").attr("class", "rg-tip").attr("x", function (g) { return -g.w8 / 2; }).attr("width", function (g) { return g.w8; });
    var fifty = all.filter(function (g) { return g.pts >= 50; }).append("circle").attr("class", "rg-fifty").attr("r", 4.3);
    function size(sel, dur) {
      var b = dur ? base.transition().duration(dur) : base, t = dur ? tip.transition().duration(dur) : tip;
      b.attr("y", function (g) { return -lens(g, metric)[0]; }).attr("height", function (g) { return Math.max(0, lens(g, metric)[0]); });
      t.attr("y", function (g) { var l = lens(g, metric); return -(l[0] + l[1]); }).attr("height", function (g) { return Math.max(0, lens(g, metric)[1]); });
      (dur ? fifty.transition().duration(dur) : fifty).attr("cy", function (g) { var l = lens(g, metric); return -(l[0] + l[1] + 7.5); }).style("opacity", metric === "pts" ? 1 : 0);
    }
    size();

    // numerals and the season ladder in each gap
    discs[8].append("text").attr("class", "rg-num8").attr("x", CX).attr("y", CY8 + 72).text("8");
    discs[24].append("text").attr("class", "rg-num24").attr("x", CX - 4).attr("y", CY24 + 60).text("24");
    S.forEach(function (s) {
      var g = discs[s.jersey], y = s.top ? s.cy + s.r + 6.5 : s.cy - s.r + 6.5;
      g.append("text").attr("class", "rg-slab").attr("x", CX).attr("y", y).text(s.label);
      if (s.champion) g.append("circle").attr("class", "rg-ringicon").attr("cx", CX - 50).attr("cy", y - 6).attr("r", 6.5);
      if (TAGS[s.season]) g.append("text").attr("class", "rg-tag").attr("x", CX + 40).attr("y", y - 1).text(TAGS[s.season]);
    });
    // where 8 becomes 24
    var mid = (CY8 + CY24) / 2;
    root.append("rect").attr("class", "rg-pill").attr("x", CX - 172).attr("y", mid - 17).attr("width", 344).attr("height", 34).attr("rx", 17);
    root.append("text").attr("class", "rg-pill-t").attr("x", CX).attr("y", mid + 5.5).text("SUMMER 2006 · 8 BECOMES 24");

    if (opts.markers !== false) {
      MOMENTS.forEach(function (m) {
        var g = G.filter(function (d) { return d.date === m.date; })[0];
        if (!g) return;
        var l = lens(g, "pts"), p = pt(g.s.cx, g.s.cy, g.s.r + l[0] + l[1] + (g.pts >= 50 ? 27 : 17), g.a);
        var mk = discs[g.s.jersey].append("g").attr("class", "rg-mk").attr("transform", "translate(" + p[0].toFixed(1) + "," + p[1].toFixed(1) + ")");
        mk.append("circle").attr("r", 12);
        mk.append("text").attr("y", 5).text(m.n);
      });
      SUMMERS.forEach(function (m) {
        var s = S[m.after], r = s.r + (s.top ? PITCH / 2 : -PITCH / 2), p = pt(s.cx, s.cy, r, s.top ? 156 : 24);
        var mk = discs[s.jersey].append("g").attr("class", "rg-sm").attr("transform", "translate(" + p[0].toFixed(1) + "," + p[1].toFixed(1) + ")");
        mk.append("rect").attr("x", -9.5).attr("y", -9.5).attr("width", 19).attr("height", 19).attr("transform", "rotate(45)");
        mk.append("text").attr("y", 4.8).text(m.k);
      });
    }
    return {
      all: all,
      setMetric: function (m, animate) { metric = m; size(null, animate ? 800 : 0); },
      metric: function () { return metric; },
    };
  }

  // =====================================================================
  //  The bill
  // =====================================================================
  function poster(el, D, opts) {
    opts = opts || {};
    var P = prep(D), S = P.S, G = P.G;
    var rs = G.filter(function (g) { return !g.po; }), po = G.filter(function (g) { return g.po; });
    var sum = function (a, k) { return d3.sum(a, function (g) { return g[k]; }); };
    var root = d3.select(el);
    root.selectAll("*").remove();
    var svg = root.append("svg").attr("class", "rg-svg").attr("viewBox", "0 0 " + W + " " + H).attr("role", "img")
      .attr("aria-label", "Twenty Rings: every NBA game Kobe Bryant played. Two discs form a figure eight. Each has ten rings, one per season, and each ring has one spike per game, as long as the points he scored. A table of the twenty seasons is below.");

    // ---------- header ----------
    var hd = svg.append("g");
    hd.append("line").attr("class", "rg-rule").attr("x1", 100).attr("x2", 2300).attr("y1", 92).attr("y2", 92);
    hd.append("text").attr("class", "rg-over").attr("x", 100).attr("y", 136).text("KOBE BRYANT · 1978–2020");
    hd.append("text").attr("class", "rg-over").attr("x", 2300).attr("y", 136).attr("text-anchor", "end").text("LOS ANGELES LAKERS · 1996–2016 · EVERY GAME");
    var title = hd.append("text").attr("class", "rg-title").attr("x", 92).attr("y", 356).text("TWENTY RINGS");
    fit(title, 1560, 250);
    var deckX = 1712;
    hd.append("line").attr("class", "rg-hair").attr("x1", deckX - 30).attr("x2", deckX - 30).attr("y1", 176).attr("y2", 470);
    var deck = hd.append("text").attr("class", "rg-deck").attr("x", deckX).attr("y", 204);
    wrap(deck, "One ring for each of his 20 seasons. One spike for each of his " + num(G.length) + " games, as long as the points he scored that night. Five of the rings came with jewelry.", 590, 38);
    var sub = hd.append("text").attr("class", "rg-deck").attr("x", 100).attr("y", 424);
    wrap(sub, "Read it the way you would write an 8. Start at the center of the top disc in 1996 and work outward through ten seasons in No.\u00a08. Cross over in the summer of 2006, then work inward through ten seasons in No.\u00a024, to the last game in 2016.", 1540, 38);

    // ---------- the figure eight ----------
    var fig = hero(svg.append("g").attr("class", "rg-hero"), P, {});

    // ---------- left column ----------
    var LX = 100, col = svg.append("g").attr("class", "rg-col");
    function era(j, y) {
      var e = G.filter(function (g) { return !g.po && g.s.jersey === j; }), ep = G.filter(function (g) { return g.po && g.s.jersey === j; });
      col.append("circle").attr("class", "rg-disc-" + j).attr("cx", LX + 26).attr("cy", y - 34).attr("r", 26);
      col.append("circle").attr("cx", LX + 26).attr("cy", y - 34).attr("r", 8).style("fill", j === 8 ? "var(--rg-gold)" : "var(--rg-violet)");
      col.append("text").attr("class", "rg-era").attr("x", LX + 70).attr("y", y).text("No. " + j);
      col.append("text").attr("class", "rg-era-sub").attr("x", LX).attr("y", y + 46).text(ERA[j].years);
      var cells = [
        [num(e.length), "regular-season games"], [num(sum(e, "pts")), "points"],
        [(sum(e, "pts") / e.length).toFixed(1), "points a game"], [String(e.filter(function (g) { return g.pts >= 40; }).length), "games of 40 or more"],
        [ERA[j].titles, ERA[j].titlesL], [String(ERA[j].allstar), "All-Star Games"],
      ];
      cells.forEach(function (c, i) {
        var x = LX + (i % 2) * 248, yy = y + 122 + Math.floor(i / 2) * 98;
        col.append("text").attr("class", "rg-stat").attr("x", x).attr("y", yy).text(c[0]);
        col.append("text").attr("class", "rg-stat-l").attr("x", x).attr("y", yy + 28).text(c[1]);
      });
      col.append("text").attr("class", "rg-stat-l").attr("x", LX).attr("y", y + 122 + 3 * 98 - 22)
        .text(ep.length + " playoff games, " + (sum(ep, "pts") / ep.length).toFixed(1) + " points a game");
      col.append("text").attr("class", "rg-stat-l").attr("x", LX).attr("y", y + 122 + 3 * 98 + 6)
        .text(j === 8 ? "Scoring champion, 2006" : "Most Valuable Player, 2008 · scoring champion, 2007");
    }
    era(8, 640);
    era(24, 2056);

    // how to read it
    (function () {
      var y = 1104, g = col.append("g").attr("transform", "translate(" + LX + "," + y + ")");
      g.append("text").attr("class", "rg-h").attr("y", 0).text("HOW TO READ IT");
      // a straightened piece of a ring
      var bx = 6, by = 132, k = g.append("g").attr("class", "is-8");
      k.append("rect").attr("class", "rg-disc-8").attr("x", -8).attr("y", 26).attr("width", 486).attr("height", 128).attr("rx", 6);
      k.append("line").attr("x1", bx).attr("x2", bx + 466).attr("y1", by).attr("y2", by).style("stroke", "var(--rg-gold)").style("stroke-opacity", .35);
      var sample = [[24, 6], [31, 9], [12, 2], [45, 14], [81, 28], [27, 5], [0, 0], [38, 11], [52, 16], [22, 8], [33, 12], [29, 9], [41, 15], [25, 4]];
      var sc = 92 / 81;
      sample.forEach(function (d, i) {
        var x = bx + 20 + i * 22, bl = (d[0] - d[1]) * sc, tl = d[1] * sc;
        k.append("rect").attr("class", "rg-zero").attr("x", x - 5).attr("width", 10).attr("y", by - 2).attr("height", 2);
        k.append("rect").attr("class", "rg-base").attr("x", x - 5).attr("width", 10).attr("y", by - bl).attr("height", bl);
        k.append("rect").attr("class", "rg-tip").attr("x", x - 5).attr("width", 10).attr("y", by - bl - tl).attr("height", tl);
        if (d[0] >= 50) k.append("circle").attr("class", "rg-fifty").attr("cx", x).attr("cy", by - bl - tl - 9).attr("r", 5);
        if (i > 9) k.append("line").attr("class", "rg-po").attr("x1", x - 11).attr("x2", x + 11).attr("y1", by + 2).attr("y2", by + 2);
      });
      [[20, "20"], [40, "40"], [60, "60"], [81, "81 points"]].forEach(function (d) {
        k.append("line").attr("x1", bx + 336).attr("x2", bx + 348).attr("y1", by - d[0] * sc).attr("y2", by - d[0] * sc).style("stroke", "var(--rg-cream)").style("stroke-opacity", .6);
        k.append("text").attr("class", "rg-key-s").attr("x", bx + 354).attr("y", by - d[0] * sc + 5).text(d[1]);
      });
      var rows = [
        "Gold: points in the first three quarters.",
        "Bright tip: the fourth quarter and overtime.",
        "Dot above a spike: 50 or more.",
        "Heavy line under the spikes: playoffs.",
        "Bright ring, and a ring by the season: champions.",
        "A gap in a ring: games he missed.",
      ];
      rows.forEach(function (t, i) { g.append("text").attr("class", "rg-key-l").attr("x", 0).attr("y", 190 + i * 28).text(t); });
      g.append("text").attr("class", "rg-key-s").attr("x", 0).attr("y", 190 + rows.length * 28 + 4).text("On the gold disc the same marks are purple, with black tips.");
    })();

    // the work
    (function () {
      var y = 1524, g = col.append("g").attr("transform", "translate(" + LX + "," + y + ")");
      g.append("text").attr("class", "rg-h").attr("y", 0).text("THE WORK");
      var it = g.append("text").attr("class", "rg-ital").attr("x", 0).attr("y", 40);
      wrap(it, "The stories trainers tell about him tend to start at 4 a.m. The box scores can only show what came after.", 600, 31);
      var total = G, late = d3.sum(G, function (d) { return d.late; });
      var cells = [
        ["57,278", "minutes played: 39.8 days"], [num(sum(total, "fga")), "shots taken"], [num(sum(total, "fga") - sum(total, "fgm")), "of them missed"],
        [num(late), "points in fourth quarters and overtime"], [String(G.filter(function (d) { return d.pts >= 40; }).length), "games of 40 or more"], [num(sum(total, "ftm")), "free throws made"],
      ];
      cells.forEach(function (c, i) {
        var x = (i % 3) * 212, yy = 152 + Math.floor(i / 3) * 104;
        g.append("text").attr("class", "rg-stat").attr("x", x).attr("y", yy).style("font-size", "44px").text(c[0]);
        var l = g.append("text").attr("class", "rg-stat-l").attr("x", x).attr("y", yy + 27);
        wrap(l, c[1], 196, 21);
      });
      var f = g.append("text").attr("class", "rg-body").attr("x", 0).attr("y", 356);
      wrap(f, "Over the seven games that ended with his torn Achilles, he played 318 of a possible 336 minutes.", 600, 27);
    })();

    // points per game, by season
    (function () {
      var y = 2548, g = col.append("g").attr("transform", "translate(" + LX + "," + y + ")");
      g.append("text").attr("class", "rg-h").attr("y", 0).text("POINTS A GAME, BY SEASON");
      var bw = 17, pitch = 23.6, h = 176, by = 244, sc = h / 36;
      S.forEach(function (s, i) {
        var x = i * pitch + (i >= 10 ? 8 : 0), bh = s.ppg * sc;
        g.append("rect").attr("class", "rg-bar" + (s.jersey === 24 ? " is-24" : "")).attr("x", x).attr("width", bw).attr("y", by - bh).attr("height", bh);
        g.append("text").attr("class", "rg-bar-v").attr("x", x + bw / 2).attr("y", by - bh - 6).style("font-size", "11.5px").text(s.ppg.toFixed(1));
        g.append("text").attr("class", "rg-bar-x").attr("x", x + bw / 2).attr("y", by + 18).style("font-size", "12px").text("’" + String(s.y + 1).slice(2));
        if (s.champion) g.append("circle").attr("class", "rg-m-num").attr("cx", x + bw / 2).attr("cy", by + 32).attr("r", 5).style("fill", "none").style("stroke", "var(--rg-gold)").style("stroke-width", 2.5);
      });
      g.append("line").attr("class", "rg-hair").attr("x1", 0).attr("x2", 20 * pitch + 4).attr("y1", by).attr("y2", by);
    })();

    // ---------- right column ----------
    var RX = 1850;
    function moments(list, y, heading) {
      var g = col.append("g").attr("transform", "translate(" + RX + "," + y + ")");
      g.append("text").attr("class", "rg-h").attr("y", 0).text(heading);
      var yy = 50;
      list.forEach(function (m) {
        var b = g.append("g").attr("class", "rg-m-num").attr("transform", "translate(13," + (yy - 6) + ")");
        b.append("circle").attr("r", 13);
        b.append("text").attr("y", 5).text(m.n);
        g.append("text").attr("class", "rg-m-head").attr("x", 40).attr("y", yy).text(m.head.toUpperCase());
        var t = g.append("text").attr("class", "rg-body").attr("x", 40).attr("y", yy + 28);
        var n = wrap(t, m.text, 410, 26.5);
        yy += 28 + n * 26.5 + 22;
      });
      return y + yy;
    }
    moments(MOMENTS.filter(function (m) { return m.n <= 8; }), 566, "THE NIGHTS · NO. 8");
    moments(MOMENTS.filter(function (m) { return m.n > 8; }), 2000, "THE NIGHTS · NO. 24");

    // the summers
    (function () {
      var x = 1722, y = 1506, g = col.append("g").attr("transform", "translate(" + x + "," + y + ")");
      g.append("text").attr("class", "rg-h").attr("y", 0).text("THE SUMMERS");
      var it = g.append("text").attr("class", "rg-ital").attr("x", 0).attr("y", 40);
      var n0 = wrap(it, "Every ring is open from June to October. He did not take the gap off.", 570, 31);
      var yy = 40 + n0 * 31 + 26;
      SUMMERS.forEach(function (m) {
        var b = g.append("g").attr("class", "rg-m-num rg-m-let").attr("transform", "translate(13," + (yy - 6) + ")");
        b.append("rect").attr("x", -9.5).attr("y", -9.5).attr("width", 19).attr("height", 19).attr("transform", "rotate(45)");
        b.append("text").attr("y", 5).text(m.k);
        g.append("text").attr("class", "rg-m-head").attr("x", 40).attr("y", yy).text(m.head.toUpperCase());
        var t = g.append("text").attr("class", "rg-body").attr("x", 40).attr("y", yy + 28);
        var n = wrap(t, m.text, 536, 26.5);
        yy += 28 + n * 26.5 + 20;
      });
    })();

    // ---------- footer ----------
    var ft = svg.append("g");
    ft.append("line").attr("class", "rg-hair").attr("x1", 100).attr("x2", 2300).attr("y1", 2880).attr("y2", 2880);
    ft.append("text").attr("class", "rg-foot").attr("x", 100).attr("y", 2912).text("Each ring runs from late October to mid-June; the summer gap is not to scale. Totals reconcile to the official record: 1,346 games and 33,643 points in the regular season, 220 and 5,640 in the playoffs.");
    ft.append("text").attr("class", "rg-foot").attr("x", 100).attr("y", 2938).text("Box scores: Basketball-Reference, via the nba-datasets collection by Gonzalo Gigena. Stories: ESPN, NBA.com, NBC Los Angeles, Wikipedia. Checked November 2026.");
    if (opts.byline) ft.append("text").attr("class", "rg-byline").attr("x", 2300).attr("y", 2938).text(opts.byline);

    var api = { setMetric: function (m) { fig.setMetric(m, !(global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches)); }, P: P };
    if (!opts.interactive) return api;

    // ---------- interaction ----------
    var card = root.append("div").attr("class", "rg-tip-card").attr("hidden", "");
    var live = root.append("div").attr("class", "rg-sr").attr("aria-live", "polite");
    var on = null;
    function fill(g) {
      card.selectAll("*").remove();
      card.classed("is-24", g.s.jersey === 24);
      var top = card.append("div").attr("class", "rg-tc-top");
      top.append("span").text(fmtDate(g.date));
      top.append("span").text(g.po ? ROUND[g.series] + ", Game " + g.gameNo : "No. " + g.s.jersey + " · " + g.s.label);
      var main = card.append("div").attr("class", "rg-tc-main");
      main.append("span").attr("class", "rg-tc-pts").text(g.pts);
      var who = main.append("span").attr("class", "rg-tc-who");
      who.append("span").text((g.home ? "vs. " : "at ") + (TEAMS[g.opp] || g.opp));
      who.append("small").text((g.w ? "Won " : "Lost ") + g.ts + "–" + g.os + (g.ot ? (g.ot > 1 ? " (" + g.ot + "OT)" : " (OT)") : ""));
      var q = card.append("div").attr("class", "rg-tc-q"), ql = card.append("div").attr("class", "rg-tc-ql");
      var parts = [["1st", g.q1], ["2nd", g.q2], ["3rd", g.q3], ["4th", g.q4]];
      if (g.ot) parts.push(["OT", g.otp]);
      var mx = Math.max(12, d3.max(parts, function (d) { return d[1]; }));
      parts.forEach(function (d, i) {
        var c = q.append("div").attr("class", i >= 3 ? "is-late" : null);
        c.append("span").text(d[1]);
        c.append("i").style("height", (26 * d[1] / mx) + "px");
        ql.append("span").text(d[0]);
      });
      var dl = card.append("dl");
      var row = function (k, v) { dl.append("dt").text(k); dl.append("dd").text(v); };
      row("Shooting", g.fgm + "–" + g.fga + " field goals, " + g.tpm + "–" + g.tpa + " threes");
      row("Free throws", g.ftm + "–" + g.fta);
      row("Also", g.reb + " reb · " + g.ast + " ast · " + g.stl + " stl · " + g.blk + " blk");
      row("Minutes", Math.round(g.mp) + (g.gs ? "" : " (off the bench)"));
      row("Where", P.arenas[g.arena].replace(/ \([IVX]+\)$/, "").replace("STAPLES", "Staples"));
    }
    function show(g, px, py) {
      if (on !== g) {
        on = g; svg.classed("has-on", true);
        fig.all.classed("is-on", function (d) { return d === g; });
        fill(g);
        live.text(fmtDate(g.date) + ": " + g.pts + (g.pts === 1 ? " point " : " points ") + (g.home ? "against " : "at ") + (TEAMS[g.opp] || g.opp) + ", " + (g.w ? "won " : "lost ") + g.ts + " to " + g.os + ".");
      }
      card.attr("hidden", null);
      var box = el.getBoundingClientRect(), tw = card.node().offsetWidth, th = card.node().offsetHeight;
      var x = px + 22; if (x + tw > box.width - 8) x = px - tw - 22;
      var y = Math.max(8, Math.min(box.height - th - 8, py - th / 2));
      card.style("left", Math.max(8, x) + "px").style("top", y + "px");
    }
    function hide() { on = null; svg.classed("has-on", false); fig.all.classed("is-on", false); card.attr("hidden", ""); }
    function local(ev) {
      var box = el.getBoundingClientRect(), k = W / box.width;
      return { px: ev.clientX - box.left, py: ev.clientY - box.top, x: (ev.clientX - box.left) * k, y: (ev.clientY - box.top) * k };
    }
    function nearest(p) {
      var top = p.y < (CY8 + CY24) / 2, cyy = top ? CY8 : CY24, dx = p.x - CX, dy = p.y - cyy, rr = Math.sqrt(dx * dx + dy * dy);
      if (rr > RD + 6 || rr < R0 - 8) return null;
      var ri = Math.max(0, Math.min(9, Math.floor((rr - R0) / PITCH)));
      var s = S[top ? ri : 19 - ri];
      var a = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
      var best = null, bd = 1e9;
      s.games.forEach(function (g) {
        var d = Math.abs((((g.a - a) % 360) + 540) % 360 - 180);
        if (d < bd) { bd = d; best = g; }
      });
      return best && rad(bd) * s.r < 16 ? best : null;
    }
    [CY8, CY24].forEach(function (cyy, i) {
      svg.append("circle").attr("class", "rg-hit").attr("cx", CX).attr("cy", cyy).attr("r", RD + 4).attr("tabindex", 0)
        .attr("aria-label", (i ? "No. 24, 2006 to 2016" : "No. 8, 1996 to 2006") + ". Left and right arrow keys step through the games; up and down change season.")
        .on("pointermove pointerdown", function (ev) { var p = local(ev), g = nearest(p); if (g) show(g, p.px, p.py); else hide(); })
        .on("pointerleave", function (ev) { if (ev.pointerType !== "touch") hide(); })
        .on("keydown", function (ev) {
          var cur = on ? on.idx : (i ? S[10].games[0].idx : -1), next = null;
          if (ev.key === "ArrowRight") next = Math.min(G.length - 1, cur + 1);
          else if (ev.key === "ArrowLeft") next = Math.max(0, cur - 1);
          else if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
            var g0 = G[Math.max(0, cur)], si = Math.max(0, Math.min(19, g0.s.i + (ev.key === "ArrowDown" ? 1 : -1))), bd = 9, t = null;
            S[si].games.forEach(function (g) { var d = Math.abs(g.frac - g0.frac); if (d < bd) { bd = d; t = g; } });
            next = t ? t.idx : cur;
          } else if (ev.key === "Home") next = 0;
          else if (ev.key === "End") next = G.length - 1;
          else if (ev.key === "Escape") { hide(); return; }
          if (next == null) return;
          ev.preventDefault();
          var g = G[next], l = lens(g, fig.metric()), p = pt(g.s.cx, g.s.cy, g.s.r + l[0] + l[1], g.a), box = el.getBoundingClientRect(), k = box.width / W;
          show(g, p[0] * k, p[1] * k);
        })
        .on("blur", hide);
    });
    d3.select(global.document).on("pointerdown.rg", function (ev) { if (!el.contains(ev.target)) hide(); });
    return api;
  }

  // =====================================================================
  //  The ledger: season by season, for phones
  // =====================================================================
  function ledger(el, D, opts) {
    opts = opts || {};
    var P = prep(D), S = P.S, G = P.G;
    var sum = function (a, k) { return d3.sum(a, function (g) { return g[k]; }); };
    var root = d3.select(el);
    root.selectAll("*").remove();
    var sh = root.append("div").attr("class", "rg-sheet");
    sh.append("div").attr("class", "rg-p-over").text("Kobe Bryant · 1978–2020 · every game");
    sh.append("h1").attr("class", "rg-p-title").text("TWENTY RINGS");
    var deck = sh.append("p").attr("class", "rg-p-deck");
    deck.append("span").text("One ring for each of his 20 seasons with the Lakers. One spike for each of his " + num(G.length) + " games, as long as the points he scored that night. ");
    deck.append("b").text("Five of the rings came with jewelry.");

    var fig = sh.append("svg").attr("class", "rg-p-fig rg-svg").attr("viewBox", "570 480 1260 2370").attr("role", "img")
      .attr("aria-label", "Two discs forming a figure eight: ten seasons in No. 8 above, ten in No. 24 below, one spike per game.");
    hero(fig.append("g"), P, { markers: false });
    sh.append("p").attr("class", "rg-p-text").text("Read it the way you would write an 8: out from the center of the top disc through ten seasons in No. 8, across in the summer of 2006, and in through ten seasons in No. 24 to the last game.");
    var key = sh.append("div").attr("class", "rg-p-key");
    [["b", "Gold or purple: points in the first three quarters"], ["t", "Bright tip: the fourth quarter and overtime"], ["p", "Heavy line under the spikes: playoffs"], ["r", "Bright ring: a championship season"]].forEach(function (k) {
      var s = key.append("span"), v = s.append("svg").attr("viewBox", "0 0 30 22");
      if (k[0] === "b") { v.append("rect").attr("x", 6).attr("y", 3).attr("width", 7).attr("height", 17).style("fill", "var(--rg-gold)"); v.append("rect").attr("x", 17).attr("y", 3).attr("width", 7).attr("height", 17).style("fill", "#a783ee"); }
      if (k[0] === "t") { v.append("rect").attr("x", 11).attr("y", 9).attr("width", 8).attr("height", 11).style("fill", "var(--rg-gold)"); v.append("rect").attr("x", 11).attr("y", 2).attr("width", 8).attr("height", 7).style("fill", "var(--rg-white)"); }
      if (k[0] === "p") v.append("line").attr("x1", 3).attr("x2", 27).attr("y1", 14).attr("y2", 14).style("stroke", "var(--rg-cream)").style("stroke-width", 4);
      if (k[0] === "r") v.append("circle").attr("cx", 15).attr("cy", 11).attr("r", 7).style("fill", "none").style("stroke", "var(--rg-gold)").style("stroke-width", 3);
      s.append("em").text(k[1]);
    });

    // the work
    var h = sh.append("h2").attr("class", "rg-p-h"); h.append("span").text("The work");
    sh.append("p").attr("class", "rg-p-ital").text("The stories trainers tell about him tend to start at 4 a.m. The box scores can only show what came after.");
    var st = sh.append("div").attr("class", "rg-p-stats");
    [["57,278", "minutes played: 39.8 days on the floor"], [num(sum(G, "fga")), "shots taken"], [num(sum(G, "fga") - sum(G, "fgm")), "of them missed"],
     [num(d3.sum(G, function (g) { return g.late; })), "points in fourth quarters and overtime"], [String(G.filter(function (g) { return g.pts >= 40; }).length), "games of 40 or more"], [num(sum(G, "ftm")), "free throws made"]]
      .forEach(function (c) { var d = st.append("div"); d.append("b").text(c[0]); d.append("span").text(c[1]); });
    sh.append("p").attr("class", "rg-p-text").text("Over the seven games that ended with his torn Achilles, he played 318 of a possible 336 minutes.");

    // seasons
    function strip(parent, s) {
      var SW = 400, SH = 66, by = 46, v = parent.append("svg").attr("class", "rg-strip").attr("viewBox", "0 0 " + SW + " " + SH).attr("aria-hidden", "true");
      var x = function (f) { return 4 + f * (SW - 8); }, sc = 42 / 81, j = s.jersey;
      v.append("line").attr("class", "ax").attr("x1", 0).attr("x2", SW).attr("y1", by).attr("y2", by);
      if (s.poGames.length) v.append("line").attr("class", "po").attr("x1", x(s.poGames[0].frac) - 2).attr("x2", x(s.poGames[s.poGames.length - 1].frac) + 2).attr("y1", by + 3).attr("y2", by + 3);
      s.games.forEach(function (g) {
        var bl = (g.pts - g.late) * sc, tl = g.late * sc;
        v.append("rect").attr("class", "b" + j).attr("x", x(g.frac) - 1.15).attr("width", 2.3).attr("y", by - bl - .8).attr("height", bl + .8);
        v.append("rect").attr("class", "t" + j).attr("x", x(g.frac) - 1.15).attr("width", 2.3).attr("y", by - bl - tl - .8).attr("height", tl);
      });
      [["Nov", 7], ["Jan", 68], ["Mar", 127], ["May", 188]].forEach(function (m) { v.append("text").attr("x", x(m[1] / WIN)).attr("y", SH - 2).text(m[0]); });
    }
    function seasons(j) {
      var e = G.filter(function (g) { return !g.po && g.s.jersey === j; });
      var hd = sh.append("div").attr("class", "rg-p-era");
      hd.append("b").text("No. " + j);
      hd.append("span").text(ERA[j].years.split(" · ")[0] + " · " + num(e.length) + " games · " + num(sum(e, "pts")) + " points");
      S.filter(function (s) { return s.jersey === j; }).forEach(function (s) {
        var d = sh.append("details").attr("class", "rg-row");
        var sm = d.append("summary");
        var a = sm.append("span").attr("class", "rg-row-s");
        a.append("span").text(s.label);
        if (s.champion) { a.append("i").attr("title", "Champions"); a.append("em").text("CHAMPIONS"); }
        if (TAGS[s.season]) a.append("em").text(TAGS[s.season]);
        var v = sm.append("span").attr("class", "rg-row-v"); v.append("span").text(s.ppg.toFixed(1) + " "); v.append("small").text("a game");
        sm.append("span").attr("class", "rg-row-sub").text(s.g + " of " + s.teamGames + " games · Lakers " + s.teamW + "–" + s.teamL + " · " +
          (s.champion ? "won the title" : s.round ? ROUND_END[s.round] : "missed the playoffs"));
        strip(sm, s);
        var more = d.append("div").attr("class", "rg-row-more"), dl = more.append("dl");
        var row = function (k, val) { dl.append("dt").text(k); dl.append("dd").text(val); };
        var hi = s.games.reduce(function (m, g) { return g.pts > m.pts ? g : m; }, s.games[0]);
        row("Points", num(s.pts) + " in " + num(s.min) + " minutes");
        row("Best night", hi.pts + (hi.home ? " vs. " : " at ") + (TEAMS[hi.opp] || hi.opp) + ", " + fmtDate(hi.date));
        row("40 or more", String(s.games.filter(function (g) { return g.pts >= 40; }).length) + " games");
        if (s.pg) row("Playoffs", s.pg + " games, " + (s.ppts / s.pg).toFixed(1) + " a game");
        else if (s.teamPO) row("Playoffs", "Injured; did not play");
      });
    }
    h = sh.append("h2").attr("class", "rg-p-h"); h.append("span").text("The nights");
    MOMENTS.forEach(function (m) {
      var d = sh.append("div").attr("class", "rg-p-mom");
      d.append("i").text(m.n);
      var t = d.append("div"); t.append("b").text(m.head); t.append("span").text(m.text);
    });
    h = sh.append("h2").attr("class", "rg-p-h"); h.append("span").text("Season by season"); h.append("small").text("tap a season for more");
    seasons(8);
    sh.append("div").attr("class", "rg-swap").text("Summer 2006 · 8 becomes 24");
    seasons(24);

    // summers
    h = sh.append("h2").attr("class", "rg-p-h"); h.append("span").text("The summers");
    sh.append("p").attr("class", "rg-p-ital").text("Every ring is open from June to October. He did not take the gap off.");
    SUMMERS.forEach(function (m) {
      var d = sh.append("div").attr("class", "rg-p-mom");
      d.append("i").attr("class", "sq").append("u").text(m.k);
      var t = d.append("div"); t.append("b").text(m.head); t.append("span").text(m.text);
    });

    var foot = sh.append("p").attr("class", "rg-p-foot");
    foot.text("Totals reconcile to the official record: 1,346 games and 33,643 points in the regular season, 220 and 5,640 in the playoffs. Box scores: Basketball-Reference, via the nba-datasets collection by Gonzalo Gigena.");
    if (opts.poster) sh.append("a").attr("class", "rg-p-link").attr("href", opts.poster).text("See it as one poster →");
  }

  // =====================================================================
  //  Table view
  // =====================================================================
  function table(el, D) {
    var P = prep(D), root = d3.select(el);
    root.selectAll("*").remove();
    var t = root.append("div").attr("class", "rg-tablewrap").append("table").attr("class", "rg-table");
    t.append("caption").attr("class", "rg-sr").text("Kobe Bryant, season by season");
    var hr = t.append("thead").append("tr");
    [["Season", 1], ["No.", 0], ["Games", 0], ["Points", 0], ["Per game", 0], ["High", 0], ["Minutes", 0], ["Lakers", 0], ["Playoff games", 0], ["Playoff points", 0], ["Finish", 1]].forEach(function (h) { hr.append("th").attr("scope", "col").attr("class", h[1] ? "l" : null).text(h[0]); });
    var tb = t.append("tbody");
    P.S.forEach(function (s) {
      var tr = tb.append("tr");
      tr.append("th").attr("scope", "row").attr("class", "l").text(s.label);
      [s.jersey, s.g, num(s.pts), s.ppg.toFixed(1), s.high, num(s.min), s.teamW + "–" + s.teamL, s.pg || "–", s.pg ? num(s.ppts) : "–"].forEach(function (v) { tr.append("td").text(v); });
      tr.append("td").attr("class", "l").text(s.champion ? "Champions" : s.round ? ROUND_END[s.round].replace(/^lost/, "Lost") : "Missed the playoffs");
    });
  }

  global.Rings = { poster: poster, ledger: ledger, table: table, fonts: fonts };
})(window);
