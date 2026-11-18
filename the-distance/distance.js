/* The Distance: Mike Tyson's 59 professional fights, drawn to the second.
   Needs d3 v7 and data.js (window.TYSON_DATA).

   Distance.poster(el, data, { interactive, byline })  the full bill, one 2400 x 3000 SVG
   Distance.ledger(el, data, { poster })               the same data as a list, for phones
   Distance.table(el, data)                            a plain table of every fight
*/
(function (global) {
  "use strict";
  var d3 = global.d3;

  // ---------- geometry of the bill ----------
  var W = 2400, H = 3000;
  var X0 = 130, X1 = 2300;      // left and right edge of the columns
  var B = 1520;                 // baseline the columns stand on
  var RH = 48;                  // height of one three-minute round
  var PPS = RH / 180;           // pixels per second
  var BW = 22;                  // column width
  var CGAP = 22;                // air between chapters
  var FAN_TOP = B + 296, AXIS = B + 590;

  // ---------- small helpers ----------
  var utc = function (iso) { return new Date(iso + "T12:00:00Z"); };
  var fmtDate = d3.utcFormat("%b %-d, %Y");
  var fmtMonth = d3.utcFormat("%b %Y");
  var pad = function (n) { return String(n).padStart(2, "0"); };
  var clock = function (s) { return Math.floor(s / 60) + ":" + pad(s % 60); };
  var hms = function (s) { return Math.floor(s / 3600) + ":" + pad(Math.floor((s % 3600) / 60)) + ":" + pad(s % 60); };
  var METHOD = { KO: "knockout", TKO: "technical knockout", UD: "unanimous decision", RTD: "corner retirement", DQ: "disqualification", NC: "no contest" };
  var RES = { W: "Win", L: "Loss", NC: "No contest" };

  function ages(a) { return a.years + " years, " + a.days + " days"; }
  function gapText(days) {
    if (days == null) return "Debut";
    if (days < 60) return days + " days since the last fight";
    if (days < 730) return Math.round(days / 30.44) + " months since the last fight";
    return (days / 365.25).toFixed(1) + " years since the last fight";
  }
  // "KO 1 · 1:31", "UD 12", "RTD 6"
  function shortEnd(f) {
    if (f.res === "NC") return "NC " + f.rd;
    if (f.type === "UD") return "UD " + f.sched;
    if (f.time === "3:00") return f.type + " " + f.rd;
    return f.type + " " + f.rd + " · " + f.time;
  }
  function longEnd(f) {
    if (f.res === "NC") return "No contest after round " + f.rd + " of " + f.sched;
    var who = RES[f.res] + " by " + METHOD[f.type];
    if (f.type === "UD") return who + " over " + f.sched + (f.len === 120 ? " two-minute" : "") + " rounds";
    if (f.time === "3:00") return who + " after round " + f.rd + " of " + f.sched;
    return who + ", round " + f.rd + " of " + f.sched + " (" + f.time + ")";
  }
  function beltText(f) {
    if (!f.belts) return null;
    var by = { won: [], kept: [], lost: [], missed: [] };
    Object.keys(f.belts).forEach(function (k) { by[f.belts[k]].push(k); });
    var out = [];
    if (by.won.length) out.push("won " + by.won.join(", "));
    if (by.kept.length) out.push("kept " + by.kept.join(", "));
    if (by.lost.length) out.push("lost " + by.lost.join(", "));
    if (by.missed.length) out.push("challenged for " + by.missed.join(", "));
    var s = out.join("; ");
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function star(R, r, n) {
    var p = "";
    for (var i = 0; i < n * 2; i++) {
      var a = Math.PI * i / n - Math.PI / 2, rr = i % 2 ? r : R;
      p += (i ? "L" : "M") + (rr * Math.cos(a)).toFixed(2) + "," + (rr * Math.sin(a)).toFixed(2);
    }
    return p + "Z";
  }
  function prep(D) {
    var chIdx = {};
    D.chapters.forEach(function (c, i) { chIdx[c.id] = i; });
    return D.fights.map(function (f) {
      var o = Object.assign({}, f);
      o.d = utc(f.date); o.ci = chIdx[f.chapter];
      o.stop = f.type === "KO" || f.type === "TKO" || f.type === "RTD";
      return o;
    });
  }
  function lines(sel, arr, lh) {
    arr.forEach(function (t, i) {
      var ts = sel.append("tspan").attr("x", sel.attr("x")).attr("dy", i ? lh : 0);
      // "*bold*" marks a bold run
      t.split("*").forEach(function (part, j) { if (part) ts.append("tspan").attr("class", j % 2 ? "b" : null).text(part); });
    });
    return sel;
  }

  // =====================================================================
  //  The three small charts. Each one redraws the same 59 fights.
  // =====================================================================
  function unitRows(g, o) {
    // rows of squares: o.rows = [{label, fights, sub}], one square per fight
    var u = o.u, gap = o.gap, y = o.y;
    o.rows.forEach(function (r) {
      var row = g.append("g").attr("transform", "translate(" + o.x + "," + y + ")");
      row.append("text").attr("class", "td-p-lab" + (o.labEnd ? " is-end" : "")).attr("x", o.labEnd ? o.labW - 12 : 0).attr("y", u - 4).text(r.label);
      r.fights.forEach(function (f, i) {
        var open = f.type === "UD";
        row.append("rect").datum(f).attr("class", "td-sq res-" + f.res + (open ? " is-open" : ""))
          .attr("x", o.labW + i * (u + gap) + (open ? 1.5 : 0)).attr("y", open ? 1.5 : 0)
          .attr("width", u - (open ? 3 : 0)).attr("height", u - (open ? 3 : 0));
      });
      row.append("text").attr("class", "td-p-val").attr("x", o.labW + r.fights.length * (u + gap) + 8).attr("y", u - 4)
        .text(r.fights.length || "");
      if (r.sub) { row.append("text").attr("class", "td-p-val").attr("x", 0).attr("y", u + 24).text(r.sub); y += 24; }
      y += o.pitch;
    });
    return y;
  }

  function panelRounds(g, F, o) {
    g.append("text").attr("class", "td-p-head").attr("x", o.x).attr("y", o.y).text("THE ROUND IT ENDED IN");
    g.append("text").attr("class", "td-p-sub").attr("x", o.x).attr("y", o.y + 27).text(o.narrow ? "Hollow squares went to the judges." : "One square per fight. Hollow squares went to the judges.");
    var rows = d3.range(1, 13).map(function (r) {
      return { label: (r === 1 ? (o.narrow ? "Rd " : "Round ") : "") + r, fights: F.filter(function (f) { return f.rd === r; }) };
    });
    return unitRows(g, { x: o.x, y: o.y + 50, rows: rows, u: o.u, gap: o.gap, pitch: o.pitch, labW: o.labW, labEnd: true });
  }

  function panelPlaces(g, F, o) {
    g.append("text").attr("class", "td-p-head").attr("x", o.x).attr("y", o.y).text("WHERE");
    g.append("text").attr("class", "td-p-sub").attr("x", o.x).attr("y", o.y + 27).text("Places, in order of first appearance.");
    var order = [];
    F.forEach(function (f) { if (f.place !== "Elsewhere" && order.indexOf(f.place) < 0) order.push(f.place); });
    var rows = order.map(function (p) { return { label: p, fights: F.filter(function (f) { return f.place === p; }) }; });
    var rest = F.filter(function (f) { return f.place === "Elsewhere"; });
    rows.push({ label: "Once each", fights: rest, sub: o.narrow ? null : rest.map(function (f) { return f.city.split(",")[0]; }).join(", ") });
    return unitRows(g, { x: o.x, y: o.y + 50, rows: rows, u: o.u, gap: o.gap, pitch: o.pitch, labW: o.labW });
  }

  function panelLedger(g, D, o) {
    g.append("text").attr("class", "td-p-head").attr("x", o.x).attr("y", o.y).text("RING TIME, CHAPTER BY CHAPTER");
    g.append("text").attr("class", "td-p-sub").attr("x", o.x).attr("y", o.y + 27).text("Pale is what was scheduled. Ink is what was fought.");
    var max = d3.max(D.chapters, function (c) { return c.schedSecs; });
    var bx = o.x + o.labW, bw = o.w - o.labW;
    var sx = d3.scaleLinear().domain([0, max]).range([0, bw]);
    var y = o.y + 50;
    D.chapters.forEach(function (c) {
      var row = g.append("g").attr("transform", "translate(0," + y + ")");
      var rec = c.w + "–" + c.l + (c.nc ? ", " + c.nc + " NC" : "");
      row.append("text").attr("class", "td-p-lab").attr("x", o.x).attr("y", 15).text(c.name);
      row.append("text").attr("class", "td-p-val").attr("x", o.x).attr("y", 38).text(c.fights + (c.fights === 1 ? " fight · " : " fights · ") + rec);
      row.append("rect").attr("class", "td-track").attr("x", bx).attr("y", 0).attr("width", Math.max(3, sx(c.schedSecs))).attr("height", 20);
      row.append("rect").attr("class", "td-meter").attr("x", bx).attr("y", 0).attr("width", Math.max(3, sx(c.secs))).attr("height", 20);
      var t = row.append("text").attr("class", "td-p-val").attr("x", bx).attr("y", 41);
      t.append("tspan").attr("class", "b").text(hms(c.secs));
      t.append("tspan").text(" of " + hms(c.schedSecs) + " · " + Math.round(100 * c.secs / c.schedSecs) + "%");
      y += o.pitch;
    });
    return y;
  }

  // =====================================================================
  //  The bill
  // =====================================================================
  function poster(el, D, opts) {
    opts = opts || {};
    var F = prep(D);
    var T = D.totals;
    var pitch = (X1 - X0 - (D.chapters.length - 1) * CGAP) / F.length;
    var tx = d3.scaleUtc().domain([utc("1985-01-01"), utc("2025-01-01")]).range([X0, X1]);
    F.forEach(function (f) { f.xs = X0 + (f.n - 0.5) * pitch + f.ci * CGAP; f.xt = tx(f.d); f.x = f.xs; });
    var byN = {}; F.forEach(function (f) { byN[f.n] = f; });

    var root = d3.select(el);
    root.selectAll("*").remove();
    var svg = root.append("svg").attr("class", "td-svg").attr("viewBox", "0 0 " + W + " " + H)
      .attr("role", "img").attr("aria-label", "The Distance: a chart of Mike Tyson's 59 professional fights, 1985 to 2024. One column per fight shows the scheduled rounds and the time actually fought. The same data is in the table below.");

    // ---------- header ----------
    var hd = svg.append("g").attr("class", "td-head");
    hd.append("rect").attr("class", "td-rule-heavy").attr("x", 100).attr("y", 88).attr("width", 2200).attr("height", 9);
    hd.append("text").attr("class", "td-over").attr("x", 100).attr("y", 142).text("★ MIKE TYSON");
    hd.append("text").attr("class", "td-over").attr("x", 1200).attr("y", 142).attr("text-anchor", "middle").text("EVERY PROFESSIONAL FIGHT · 1985–2024");
    hd.append("text").attr("class", "td-over").attr("x", 2300).attr("y", 142).attr("text-anchor", "end").text("50 WINS · 7 LOSSES · 2 NO CONTESTS ★");
    hd.append("line").attr("class", "td-rule").attr("x1", 100).attr("x2", 2300).attr("y1", 166).attr("y2", 166);

    var cap = capRatio(svg.style("--td-display") || '"Anton"') || 0.86;
    cap = capRatio('"Anton"');
    var title = hd.append("text").attr("class", "td-title").attr("x", 94).text("THE DISTANCE");
    fit(title, 1540, 300);
    var titleBase = 198 + parseFloat(title.style("font-size")) * cap;
    title.attr("y", titleBase);

    var cx = 1706;
    hd.append("line").attr("class", "td-hair").attr("x1", cx - 34).attr("x2", cx - 34).attr("y1", 198).attr("y2", titleBase + 98);
    hd.append("text").attr("class", "td-clock-lab").attr("x", cx).attr("y", 220).text("TOTAL TIME IN THE RING, 1985–2024");
    var ck = hd.append("text").attr("class", "td-clock").attr("x", cx - 5).text(hms(T.secs));
    fit(ck, 596, 200);
    var ckBase = 248 + parseFloat(ck.style("font-size")) * cap;
    ck.attr("y", ckBase);
    lines(hd.append("text").attr("class", "td-clock-sub").attr("x", cx).attr("y", titleBase + 58),
      ["Hours, minutes, seconds. Thirty-nine years of", "fights; less than ten hours of fighting."], 40);

    lines(hd.append("text").attr("class", "td-deck").attr("x", 100).attr("y", titleBase + 58), [
      "Every fight Mike Tyson had as a professional, drawn to the second. Each column is one fight: the pale blocks are the",
      "rounds on the contract, the ink is the time it took. *He was booked for " + d3.sum(F, function (f) { return f.sched; }) + " rounds. Only " +
        d3.sum(F, function (f) { return f.type === "UD" ? f.sched : f.rd; }) + " of them ever began.*"
    ], 40);

    // stat band
    var sy = 600;
    hd.append("line").attr("class", "td-rule").attr("x1", 100).attr("x2", 2300).attr("y1", sy).attr("y2", sy);
    var wins = F.filter(function (f) { return f.res === "W"; });
    var stats = [
      [String(T.fights), "FIGHTS"],
      [String(T.kos), "WINS BY KNOCKOUT"],
      [String(wins.filter(function (f) { return f.stop && f.rd === 1; }).length), "OF THEM IN ROUND ONE"],
      ["0:30", "FASTEST WIN"],
      ["37–0", "BEFORE THE FIRST LOSS"],
      [hms(T.schedSecs), "SCHEDULED, START TO FINISH"],
    ];
    var sw = 2200 / stats.length;
    stats.forEach(function (s, i) {
      var x = 100 + i * sw;
      if (i) hd.append("line").attr("class", "td-hair").attr("x1", x - 22).attr("x2", x - 22).attr("y1", sy + 18).attr("y2", sy + 96);
      hd.append("text").attr("class", "td-stat-num").attr("x", x).attr("y", sy + 72).text(s[0]);
      hd.append("text").attr("class", "td-stat-lab").attr("x", x).attr("y", sy + 100).text(s[1]);
    });
    hd.append("line").attr("class", "td-rule").attr("x1", 100).attr("x2", 2300).attr("y1", sy + 118).attr("y2", sy + 118);

    // ---------- hero: grid and axis labels ----------
    var hero = svg.append("g").attr("class", "td-hero");
    var grid = hero.append("g").attr("class", "td-grid");
    [4, 8, 12].forEach(function (r) {
      grid.append("line").attr("x1", X0 - 6).attr("x2", X1 + 6).attr("y1", B - r * RH).attr("y2", B - r * RH);
    });
    [[1, "1 round"], [4, "4"], [8, "8"], [12, "12"], [15, "15 rounds"]].forEach(function (d) {
      hero.append("text").attr("class", "td-ytick").attr("x", X0 - 14).attr("y", B - d[0] * RH + 5.5).attr("text-anchor", "end").text(d[1]);
    });
    [[4, "12 min"], [8, "24 min"], [12, "36 min"]].forEach(function (d) {
      hero.append("text").attr("class", "td-ytick").attr("x", X1 + 14).attr("y", B - d[0] * RH + 5.5).text(d[1]);
    });

    // layers
    var gSeq = hero.append("g").attr("class", "td-seq");   // things that only make sense evenly spaced
    var gCal = hero.append("g").attr("class", "td-cal").style("opacity", 0).style("display", "none");
    var gLinks = hero.append("g").attr("class", "td-links");
    var gAxis = hero.append("g").attr("class", "td-axis");
    var gF = hero.append("g").attr("class", "td-fights");

    // chapters
    D.chapters.forEach(function (c, i) {
      var a = byN[c.from].xs - pitch / 2 + 3, b = byN[c.to].xs + pitch / 2 - 3;
      var g = gSeq.append("g");
      g.append("line").attr("class", "td-chap-rule").attr("x1", a).attr("x2", b).attr("y1", B - 762).attr("y2", B - 762);
      var last = i === D.chapters.length - 1;
      var rec = c.w + "–" + c.l + (c.nc ? " · " + c.nc + " NC" : "");
      g.append("text").attr("class", "td-chap").attr("x", last ? b : a).attr("y", B - 776).attr("text-anchor", last ? "end" : "start").text(c.name.toUpperCase());
      var span = c.from === c.to ? fmtMonth(utc(c.start)) : fmtMonth(utc(c.start)) + " to " + fmtMonth(utc(c.end));
      var sub = (b - a > 420) ? c.fights + " fights · " + rec + " · " + span : (b - a > 300 ? rec + " · " + span : (last ? "" : rec));
      if (c.id === "goodbye") sub = rec.replace(" · ", ", ") + " · 1999 to 2005";
      if (sub) g.append("text").attr("class", "td-chap-sub").attr("x", a).attr("y", B - 736).text(sub);
    });

    // ---------- the columns ----------
    hero.append("line").attr("class", "td-base").attr("x1", X0 - 6).attr("x2", X1 + 6).attr("y1", B).attr("y2", B);
    var fg = gF.selectAll("g.td-f").data(F).join("g")
      .attr("class", function (f) { return "td-f res-" + f.res + (f.belts ? " is-title" : ""); })
      .attr("transform", function (f) { return "translate(" + f.xs + ",0)"; });
    var bars = fg.append("g").attr("class", "td-bars");
    bars.each(function (f) {
      var g = d3.select(this), ch = f.len * PPS, r, left = f.secs;
      for (r = 0; r < f.sched; r++) {
        g.append("rect").attr("class", "td-cell").attr("x", -BW / 2).attr("width", BW).attr("y", B - (r + 1) * ch + 1).attr("height", ch - 2).attr("rx", 1.5);
      }
      for (r = 0; left > 0; r++) {
        var s = Math.min(f.len, left); left -= s;
        var h = s === f.len ? ch - 2 : Math.max(2, s * PPS - 1);
        g.append("rect").attr("class", "td-fill").attr("x", -BW / 2).attr("width", BW).attr("y", B - r * ch - 1 - h).attr("height", h).attr("rx", 1.5);
      }
    });
    // how it ended
    var gl = fg.append("g").attr("class", "td-end").attr("transform", function (f) { return "translate(0," + (B - f.secs * PPS) + ")"; });
    gl.each(function (f) {
      var g = d3.select(this);
      if (f.res === "NC") return;
      if (f.type === "UD") g.append("rect").attr("class", "td-glyph res-" + f.res).attr("x", -BW / 2 - 4).attr("width", BW + 8).attr("y", -7).attr("height", 5);
      else if (f.type === "DQ") {
        g.append("path").attr("class", "td-glyph-x").attr("d", "M-6,-19L6,-7M6,-19L-6,-7");
      } else g.append("path").attr("class", "td-glyph res-" + f.res).attr("d", star(9.5, 3.9, 8)).attr("transform", "translate(0,-14)");
    });
    fg.append("text").attr("class", "td-num").attr("y", B + 24).text(function (f) { return f.n; });
    var names = fg.append("text").attr("class", "td-name").attr("transform", "translate(6.5," + (B + 38) + ") rotate(-90)").text(function (f) { return f.opp; });
    names.each(function (f) { f.stemY = B + 38 + this.getComputedTextLength() + 8; });
    // belts on the line
    var BELTS = ["WBC", "WBA", "IBF"], beltY = function (i) { return B + 234 + i * 20; };
    BELTS.forEach(function (b, i) {
      hero.append("text").attr("class", "td-belt-lab").attr("x", X0 - 14).attr("y", beltY(i) + 5).text(b);
    });
    fg.filter(function (f) { return !!f.belts; }).each(function (f) {
      var g = d3.select(this);
      BELTS.forEach(function (b, i) {
        var st = f.belts[b]; if (!st) return;
        g.append("circle").attr("class", "td-belt is-" + st).attr("cy", beltY(i)).attr("r", st === "missed" ? 5.3 : 6.5);
      });
    });

    // ---------- the fan: evenly spaced fights above, the real calendar below ----------
    function linkPath(f, t) {
      var y0 = f.stemY + (B + 6 - f.stemY) * t, ym = (FAN_TOP + AXIS) / 2;
      return "M" + f.x + "," + y0 + "V" + FAN_TOP + "C" + f.x + "," + ym + " " + f.xt + "," + ym + " " + f.xt + "," + AXIS;
    }
    var links = gLinks.selectAll("path").data(F).join("path")
      .attr("class", function (f) { return "td-link res-" + f.res; }).attr("d", function (f) { return linkPath(f, 0); });

    // calendar axis
    D.spans.forEach(function (s) {
      var a = tx(utc(s.from)), b = tx(utc(s.to));
      gAxis.append("rect").attr("class", "td-span").attr("x", a).attr("width", b - a).attr("y", AXIS - 20).attr("height", 20);
    });
    gAxis.append("line").attr("class", "td-axis-line").attr("x1", X0 - 6).attr("x2", X1 + 6).attr("y1", AXIS).attr("y2", AXIS);
    d3.range(1985, 2026).forEach(function (y) {
      var x = tx(utc(y + "-01-01")), major = y % 5 === 0;
      gAxis.append("line").attr("class", "td-axis-tick").attr("x1", x).attr("x2", x).attr("y1", AXIS).attr("y2", AXIS + (major ? 12 : 7));
      if (y < 2025) gAxis.append("text").attr("class", "td-year" + (major ? "" : " is-minor")).attr("x", x + (X1 - X0) / 80).attr("y", AXIS + 31)
        .text(major ? y : "’" + String(y).slice(2));
    });
    // the two long silences
    function dim(a, b, y, label, sub) {
      var g = gAxis.append("g");
      g.append("path").attr("class", "td-dim").attr("d", "M" + a + "," + (y - 7) + "V" + (y + 7) + "M" + a + "," + y + "H" + b + "M" + b + "," + (y - 7) + "V" + (y + 7));
      g.append("text").attr("class", "td-dim-lab").attr("x", (a + b) / 2).attr("y", y - 10).attr("text-anchor", "middle").text(label);
      if (sub) g.append("text").attr("class", "td-age").attr("x", (a + b) / 2).attr("y", y + 26).text(sub);
    }
    dim(byN[42].xt, byN[43].xt, AXIS + 74, "4 years, 52 days", "Prison, 1992 to 1995");
    dim(byN[58].xt, byN[59].xt, AXIS + 74, "19 years, 157 days between fights", "Retired after McBride. Back at 58 for one more.");
    gAxis.append("text").attr("class", "td-age").attr("x", tx(utc(D.spans[1].from)) - 6).attr("y", AXIS + 100).style("text-anchor", "start").text("Licence revoked, 1997 to 1998");

    // fan notes, in the empty wedge the long retirement leaves
    lines(gSeq.append("text").attr("class", "td-fan-note").attr("x", tx(utc("2013-09-01"))).attr("y", AXIS - 112),
      ["Above, every fight gets the same width.", "Below, each one drops to its real date.", "*The first 27 took 18 months.*", "*The last one took 19 years.*"], 26);

    // ---------- how to read it ----------
    var key = gSeq.append("g").attr("class", "td-key").attr("transform", "translate(" + (X0 + 4) + "," + (B - 694) + ")");
    key.append("text").attr("class", "td-key-head").attr("y", 0).text("HOW TO READ A COLUMN");
    (function () {
      var kx = 13, kb = 150, ch = 25, n = 5, secs = 2 * 180 + 124, pps = ch / 180, r, left = secs;
      for (r = 0; r < n; r++) key.append("rect").attr("class", "td-cell").attr("x", kx - 11).attr("width", 22).attr("y", kb - (r + 1) * ch + 1).attr("height", ch - 2).attr("rx", 1.5);
      for (r = 0; left > 0; r++) {
        var s = Math.min(180, left); left -= s; var h = s === 180 ? ch - 2 : s * pps - 1;
        key.append("rect").attr("class", "td-fill").attr("x", kx - 11).attr("width", 22).attr("y", kb - r * ch - 1 - h).attr("height", h).attr("rx", 1.5);
      }
      var top = kb - secs * pps;
      key.append("path").attr("class", "td-glyph").attr("d", star(9.5, 3.9, 8)).attr("transform", "translate(" + kx + "," + (top - 14) + ")");
      key.append("line").attr("class", "td-base").attr("x1", kx - 18).attr("x2", kx + 18).attr("y1", kb).attr("y2", kb);
      [[kb - 4.5 * ch, "Pale block: one round on the contract"], [top - 14, "Star: stopped here (KO, TKO, retired)"], [kb - 1.1 * ch, "Ink: time actually fought"]].forEach(function (d) {
        key.append("line").attr("class", "td-leader").attr("x1", kx + 16).attr("x2", kx + 40).attr("y1", d[0]).attr("y2", d[0]);
        key.append("text").attr("class", "td-key-lab").attr("x", kx + 48).attr("y", d[0] + 6.5).text(d[1]);
      });
      // the other marks
      var ox = 372, row = function (i) { return key.append("g").attr("transform", "translate(" + ox + "," + (36 + i * 28.5) + ")"); };
      var g0 = row(0); g0.append("rect").attr("class", "td-glyph").attr("x", -4).attr("y", -10).attr("width", 30).attr("height", 5);
      g0.append("text").attr("class", "td-key-lab").attr("x", 38).attr("y", 0).text("Went the distance");
      var g1 = row(1); g1.append("path").attr("class", "td-glyph-x").attr("d", "M5,-14L17,-2M17,-14L5,-2");
      g1.append("text").attr("class", "td-key-lab").attr("x", 38).attr("y", 0).text("Disqualification");
      var g2 = row(2); g2.append("rect").attr("class", "td-sq res-L").attr("x", 2).attr("y", -15).attr("width", 18).attr("height", 18);
      g2.append("text").attr("class", "td-key-lab").attr("x", 38).attr("y", 0).text("Tyson lost");
      var g3 = row(3); g3.append("rect").attr("class", "td-sq res-NC").attr("x", 2).attr("y", -15).attr("width", 18).attr("height", 18);
      g3.append("text").attr("class", "td-key-lab").attr("x", 38).attr("y", 0).text("No contest");
      var g4 = row(4); g4.append("circle").attr("class", "td-belt").attr("cx", 4).attr("cy", -6).attr("r", 6.5);
      g4.append("circle").attr("class", "td-belt is-lost").attr("cx", 21).attr("cy", -6).attr("r", 6.5);
      g4.append("text").attr("class", "td-key-lab").attr("x", 38).attr("y", 0).text("Belt won or kept; lost");
    })();

    // ---------- annotations ----------
    var notes = [
      { n: 1, x: X0 + 2, y: B - 344, a: "start", t: ["*Mar 6, 1985.* Albany, N.Y.", "Age 18. Over in 1:47."], to: "track" },
      { n: 20, x: byN[20].xs - 12, y: B - 522, a: "start", t: ["*First to hear", "a final bell.*"], to: "none" },
      { n: 25, x: byN[25].xs - 14, y: B - 604, a: "end", t: ["*0:30.* His", "fastest win."], to: "fill", elbow: -1 },
      { n: 28, x: byN[28].xs - 14, y: B - 708, a: "end", t: ["*Champion at 20 years,*", "*145 days.* No heavyweight", "has been younger."], to: "track", elbow: -1 },
      { n: 32, x: byN[32].xs + 20, y: B - 700, a: "start", t: ["Booked for 15,", "the only one."], to: "none" },
      { n: 35, x: byN[35].xs, y: B - 624, a: "middle", t: ["*Spinks:*", "*91 sec.*"], to: "fill" },
      { n: 38, x: byN[38].xs + 16, y: B - 700, a: "start", t: ["*Tokyo, Feb 1990.* A 42-to-1", "favourite, out in the tenth."], to: "track", elbow: 1 },
      { n: 43, x: byN[43].xs + 16, y: B - 646, a: "start", t: ["*89 seconds,*", "after four", "years away."], to: "fill", elbow: 1 },
      { n: 48, x: byN[48].xs + 16, y: B - 630, a: "start", t: ["*Disqualified*", "*for biting.*"], to: "track", elbow: 1 },
      { n: 55, x: byN[55].xs + 16, y: B - 700, a: "start", t: ["*His last", "title shot.*"], to: "track", elbow: 1 },
      { n: 58, x: X1, y: B - 540, a: "end", t: ["Quits on his", "stool."], to: "track" },
    ];
    var gN = gSeq.append("g").attr("class", "td-notes");
    notes.forEach(function (d) {
      var f = byN[d.n], top = B - f.sched * f.len * PPS - 6;
      if (d.to !== "none") {
        if (d.elbow) gN.append("path").attr("class", "td-leader").attr("d", "M" + f.xs + "," + top + "V" + (d.y - 7) + "H" + (d.x - 5 * d.elbow));
        else gN.append("path").attr("class", "td-leader").attr("d", "M" + f.xs + "," + top + "V" + (d.y + (d.t.length - 1) * 24 + 10));
      }
      lines(gN.append("text").attr("class", "td-note").attr("x", d.x).attr("y", d.y).attr("text-anchor", d.a), d.t, 24);
    });
    // 1985
    (function () {
      var a = byN[1].xs - 11, b = byN[15].xs + 11, y = B - 500;
      gN.append("path").attr("class", "td-dim").attr("d", "M" + a + "," + (y + 8) + "V" + y + "H" + b + "V" + (y + 8));
      lines(gN.append("text").attr("class", "td-note").attr("x", X0 + 2).attr("y", y + 32), ["*1985: fifteen fights in 296 days.*", "None gets past round four."], 24);
    })();

    // calendar-mode notes
    lines(gCal.append("text").attr("class", "td-note").attr("x", tx(utc("1988-04-01"))).attr("y", B - 700),
      ["*Thirty fights before he turned 21.*", "Drawn on the real calendar, the", "first two years are a solid wall."], 24);
    lines(gCal.append("text").attr("class", "td-note").attr("x", tx(utc("2014-06-01"))).attr("y", B - 330).attr("text-anchor", "middle"),
      ["*One fight in the last 19 years.*"], 24);

    // ---------- the three small charts ----------
    var PY = 2292;
    var pan = svg.append("g").attr("class", "td-panels");
    pan.append("line").attr("class", "td-rule").attr("x1", 100).attr("x2", 2300).attr("y1", PY - 46).attr("y2", PY - 46);
    panelLedger(pan, D, { x: 100, y: PY, w: 610, labW: 236, pitch: 76 });
    panelRounds(pan, F, { x: 800, y: PY, u: 24, gap: 3, pitch: 37, labW: 94 });
    panelPlaces(pan, F, { x: 1632, y: PY, u: 24, gap: 3, pitch: 46, labW: 208 });
    [752, 1588].forEach(function (x) { pan.append("line").attr("class", "td-hair").attr("x1", x).attr("x2", x).attr("y1", PY - 24).attr("y2", PY + 496); });

    // ---------- footer ----------
    var ft = svg.append("g");
    ft.append("line").attr("class", "td-rule").attr("x1", 100).attr("x2", 2300).attr("y1", 2836).attr("y2", 2836);
    lines(ft.append("text").attr("class", "td-foot").attr("x", 100).attr("y", 2868), [
      "Ring time is the round and time each fight ended, summed; the minute between rounds is left out. Tyson–Paul was eight two-minute rounds. Golota quit before round three, so that fight counts as two rounds.",
      "A bold name is a title fight. Sources: Wikipedia (professional boxing record), ESPN, CBS Sports, Sports Illustrated. Checked November 2026."
    ], 25);
    if (opts.byline) ft.append("text").attr("class", "td-byline").attr("x", 2300).attr("y", 2893).text(opts.byline);
    hd.lower();

    // ---------- evenly spaced <-> calendar ----------
    var seqOnly = fg.selectAll(".td-num, .td-name");
    function place(t) {
      F.forEach(function (f) { f.x = f.xs + (f.xt - f.xs) * t; });
      fg.attr("transform", function (f) { return "translate(" + f.x + ",0)"; });
      bars.attr("transform", "scale(" + (1 - 0.72 * t) + ",1)");
      gl.attr("transform", function (f) { return "translate(0," + (B - f.secs * PPS) + ") scale(" + (1 - 0.45 * t) + ")"; });
      seqOnly.style("opacity", 1 - t);
      links.attr("d", function (f) { return linkPath(f, t); });
      gSeq.style("opacity", 1 - t).style("display", t === 1 ? "none" : null);
      gCal.style("opacity", t).style("display", t === 0 ? "none" : null);
    }
    var mode = "sequence", timer = null, cur = 0;
    function setMode(m) {
      if (m === mode) return;
      mode = m;
      var from = cur, to = m === "calendar" ? 1 : 0;
      if (timer) timer.stop();
      var still = global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (still) { cur = to; place(to); return; }
      var dur = 1500;
      timer = d3.timer(function (e) {
        var k = Math.min(1, e / dur);
        cur = from + (to - from) * d3.easeCubicInOut(k);
        place(cur);
        if (k === 1) timer.stop();
      });
    }

    // ---------- interaction ----------
    var api = { setMode: setMode, fights: F, svg: svg.node() };
    if (!opts.interactive) return api;

    var tip = root.append("div").attr("class", "td-tip").attr("hidden", "");
    var live = root.append("div").attr("class", "td-sr").attr("aria-live", "polite");
    var sqs = svg.selectAll(".td-sq").filter(function (d) { return d && d.n; });
    var on = null;

    function fillTip(f) {
      tip.selectAll("*").remove();
      var top = tip.append("div").attr("class", "td-tip-top");
      top.append("span").text("Fight " + f.n + " of 59");
      top.append("span").text(fmtDate(f.d));
      tip.append("div").attr("class", "td-tip-opp").text(f.opp);
      var r = tip.append("div").attr("class", "td-tip-res");
      r.append("span").attr("class", "td-tip-key res-" + f.res);
      r.append("span").text(longEnd(f));
      tip.append("div").attr("class", "td-tip-meter").append("i").attr("class", "res-" + f.res).style("width", (100 * f.secs / f.schedSecs) + "%");
      var dl = tip.append("dl");
      var row = function (k, v) { if (v == null) return; dl.append("dt").text(k); dl.append("dd").text(v); };
      row("Ring time", clock(f.secs) + " of a scheduled " + clock(f.schedSecs));
      row("Where", (f.venue ? f.venue + ", " : "") + f.city);
      row("Record", f.record);
      row("Age", ages(f.age));
      row("Gap", gapText(f.gap));
      row("Titles", beltText(f));
      if (f.notes && !f.belts) tip.append("p").attr("class", "td-tip-note").text(f.notes);
      else if (f.notes && /disqualified|drug|biting/i.test(f.notes)) tip.append("p").attr("class", "td-tip-note").text(f.notes);
    }
    function show(f, px, py) {
      if (on !== f) {
        on = f;
        svg.classed("has-on", true);
        fg.classed("is-on", function (d) { return d === f; });
        links.classed("is-on", function (d) { return d === f; });
        sqs.classed("is-on", function (d) { return d.n === f.n; });
        fillTip(f);
        live.text("Fight " + f.n + ": " + f.opp + ", " + fmtDate(f.d) + ". " + longEnd(f) + ".");
      }
      tip.attr("hidden", null);
      var box = el.getBoundingClientRect(), tw = tip.node().offsetWidth, th = tip.node().offsetHeight;
      var x = px + 18; if (x + tw > box.width - 8) x = px - tw - 18;
      var y = py - th / 2; y = Math.max(8, Math.min(box.height - th - 8, y));
      tip.style("left", Math.max(8, x) + "px").style("top", y + "px");
    }
    function hide() {
      on = null; svg.classed("has-on", false);
      fg.classed("is-on", false); links.classed("is-on", false); sqs.classed("is-on", false);
      tip.attr("hidden", "");
    }
    function local(ev) {
      var box = el.getBoundingClientRect(), k = W / box.width;
      return { px: ev.clientX - box.left, py: ev.clientY - box.top, x: (ev.clientX - box.left) * k, y: (ev.clientY - box.top) * k };
    }
    // x of a fan link at a given height
    function linkX(f, y) {
      if (y <= FAN_TOP) return f.x;
      var lo = 0, hi = 1, ym = (FAN_TOP + AXIS) / 2, s, i;
      for (i = 0; i < 18; i++) {
        s = (lo + hi) / 2;
        var yy = FAN_TOP * Math.pow(1 - s, 3) + 3 * ym * Math.pow(1 - s, 2) * s + 3 * ym * (1 - s) * s * s + AXIS * s * s * s;
        if (yy < y) lo = s; else hi = s;
      }
      s = (lo + hi) / 2;
      return f.x * (Math.pow(1 - s, 3) + 3 * Math.pow(1 - s, 2) * s) + f.xt * (3 * (1 - s) * s * s + Math.pow(s, 3));
    }
    function nearest(p) {
      var best = null, bd = Infinity;
      F.forEach(function (f) { var d = Math.abs(linkX(f, p.y) - p.x); if (d < bd) { bd = d; best = f; } });
      return bd < 60 ? best : null;
    }
    var hit = svg.append("rect").attr("class", "td-over-hit").attr("x", X0 - 30).attr("width", X1 - X0 + 60).attr("y", B - 730).attr("height", AXIS + 10 - (B - 730))
      .attr("tabindex", 0).attr("aria-label", "Fights. Use the left and right arrow keys to step through all 59.");
    var focusBox = svg.append("rect").attr("class", "td-focus").style("display", "none");
    hit.on("pointermove pointerdown", function (ev) {
      var p = local(ev), f = nearest(p);
      if (f) show(f, p.px, p.py); else hide();
    }).on("pointerleave", function (ev) { if (ev.pointerType !== "touch") hide(); });
    var kIdx = -1;
    function kShow(i) {
      kIdx = Math.max(0, Math.min(F.length - 1, i));
      var f = F[kIdx], box = el.getBoundingClientRect(), k = box.width / W;
      show(f, f.x * k, (B - 300) * k);
      focusBox.style("display", null).attr("x", f.x - pitch / 2).attr("width", pitch).attr("y", B - 726).attr("height", 726 + 30);
    }
    hit.on("keydown", function (ev) {
      if (ev.key === "ArrowRight" || ev.key === "ArrowDown") { kShow(kIdx + 1); ev.preventDefault(); }
      else if (ev.key === "ArrowLeft" || ev.key === "ArrowUp") { kShow(kIdx - 1); ev.preventDefault(); }
      else if (ev.key === "Home") { kShow(0); ev.preventDefault(); }
      else if (ev.key === "End") { kShow(F.length - 1); ev.preventDefault(); }
      else if (ev.key === "Escape") { hide(); focusBox.style("display", "none"); }
    }).on("focus", function () { if (kIdx < 0) kIdx = -1; }).on("blur", function () { hide(); focusBox.style("display", "none"); });
    // squares in the small charts point back at their fight
    sqs.each(function (d) {
      var r = d3.select(this), u = +r.attr("width") + (r.classed("is-open") ? 3 : 0);
      d3.select(this.parentNode).append("rect").datum(d).attr("class", "td-sq-hit")
        .attr("x", +r.attr("x") - (r.classed("is-open") ? 1.5 : 0) - 1.5).attr("y", -2).attr("width", u + 3).attr("height", u + 6)
        .on("pointermove pointerdown", function (ev) { var p = local(ev); show(byN[d.n], p.px, p.py); })
        .on("pointerleave", function (ev) { if (ev.pointerType !== "touch") hide(); });
    });
    d3.select(global.document).on("pointerdown.td", function (ev) { if (!el.contains(ev.target)) hide(); });
    return api;
  }

  var FACES = ['400 100px "Anton"', '400 20px "Archivo Narrow"', '500 20px "Archivo Narrow"', '600 20px "Archivo Narrow"',
    '700 20px "Archivo Narrow"', '400 20px "Courier Prime"', '700 20px "Courier Prime"'];
  // resolve once the faces are loaded, so text is measured in the right font
  function fonts() {
    var d = global.document;
    if (!d.fonts || !d.fonts.load) return Promise.resolve();
    return Promise.all(FACES.map(function (f) { return d.fonts.load(f); })).catch(function () {});
  }
  function capRatio(family) {
    try {
      var c = global.document.createElement("canvas").getContext("2d");
      c.font = "400 200px " + family;
      var a = c.measureText("H").actualBoundingBoxAscent;
      return a > 0 ? a / 200 : 0.86;
    } catch (e) { return 0.86; }
  }
  function fit(text, width, size) {
    text.style("font-size", size + "px");
    var w = text.node().getComputedTextLength();
    if (w > 0) text.style("font-size", (size * width / w).toFixed(1) + "px");
  }

  // =====================================================================
  //  The ledger: the same fights as a list, for phones
  // =====================================================================
  function ledger(el, D, opts) {
    opts = opts || {};
    var F = prep(D), T = D.totals;
    var root = d3.select(el);
    root.selectAll("*").remove();
    var sheet = root.append("div").attr("class", "td-sheet");
    var over = sheet.append("div").attr("class", "td-m-over");
    over.append("span").text("★ Mike Tyson");
    over.append("span").text("59 fights · 1985–2024");
    sheet.append("h1").attr("class", "td-m-title").text("THE DISTANCE");
    var ck = sheet.append("div").attr("class", "td-m-clock");
    ck.append("strong").text("Total time in the ring, 1985–2024");
    ck.append("b").text(hms(T.secs));
    ck.append("span").text("Hours, minutes, seconds. Thirty-nine years of fights; less than ten hours of fighting.");
    var rounds = d3.sum(F, function (f) { return f.sched; }), begun = d3.sum(F, function (f) { return f.type === "UD" ? f.sched : f.rd; });
    var deck = sheet.append("p").attr("class", "td-m-deck");
    deck.append("span").text("Every fight Mike Tyson had as a professional, drawn to the second. The pale bar is the distance on the contract. The ink is the time it took. ");
    deck.append("b").text("He was booked for " + rounds + " rounds. Only " + begun + " of them ever began.");
    var wins = F.filter(function (f) { return f.res === "W"; });
    var st = sheet.append("div").attr("class", "td-m-stats");
    [[T.fights, "Fights"], [T.kos, "Wins by knockout"], [wins.filter(function (f) { return f.stop && f.rd === 1; }).length, "Of them in round one"],
     ["50–7", "Wins and losses"], ["0:30", "Fastest win"], ["37–0", "Before the first loss"]].forEach(function (s) {
      var d = st.append("div"); d.append("b").text(s[0]); d.append("span").text(s[1]);
    });

    // when: a barcode of the calendar
    var h = sheet.append("h2").attr("class", "td-m-h"); h.append("span").text("When"); h.append("small").text("one tick per fight");
    var SW = 400, tx = d3.scaleUtc().domain([utc("1985-01-01"), utc("2025-01-01")]).range([4, SW - 4]);
    var strip = sheet.append("svg").attr("class", "td-strip").attr("viewBox", "0 0 " + SW + " 76").attr("role", "img")
      .attr("aria-label", "Timeline of the 59 fights. Twenty-eight fall in 1985 and 1986; there are none between 1991 and 1995 or between 2005 and 2024.");
    D.spans.forEach(function (s) { strip.append("rect").attr("class", "td-span").attr("x", tx(utc(s.from))).attr("width", tx(utc(s.to)) - tx(utc(s.from))).attr("y", 6).attr("height", 40); });
    F.forEach(function (f) { strip.append("rect").attr("class", "td-sq res-" + f.res).attr("x", tx(f.d) - 0.8).attr("width", 1.6).attr("y", 6).attr("height", 40); });
    strip.append("line").attr("class", "td-axis-line").attr("x1", 0).attr("x2", SW).attr("y1", 47).attr("y2", 47).style("stroke-width", 1.2);
    [1985, 1990, 1995, 2000, 2005, 2010, 2015, 2020].forEach(function (y) {
      var x = tx(utc(y + "-01-01"));
      strip.append("line").attr("class", "td-axis-tick").attr("x1", x).attr("x2", x).attr("y1", 47).attr("y2", 52).style("stroke-width", .8);
      strip.append("text").attr("class", "yr").attr("x", x).attr("y", 64).attr("text-anchor", y === 1985 ? "start" : "middle").text(y);
    });
    sheet.append("p").attr("class", "td-m-p").text("Thirty fights before he turned 21. One in the last 19 years. Shaded: prison (1992–95) and a revoked licence (1997–98).");

    // every fight
    h = sheet.append("h2").attr("class", "td-m-h"); h.append("span").text("Every fight"); h.append("small").text("tap one for the details");
    var key = sheet.append("div").attr("class", "td-m-key");
    [["t", "Scheduled"], ["", "Fought, win"], ["l", "Loss"], ["n", "No contest"]].forEach(function (k) {
      var s = key.append("span"); s.append("i").attr("class", k[0]); s.append("span").text(k[1]);
    });
    var FULL = 15 * 180;
    D.chapters.forEach(function (c) {
      var hh = sheet.append("h3").attr("class", "td-m-h");
      hh.append("span").text(c.name);
      hh.append("small").text(c.w + "–" + c.l + (c.nc ? ", " + c.nc + " NC" : "") + " · " + hms(c.secs) + " of " + hms(c.schedSecs));
      F.filter(function (f) { return f.chapter === c.id; }).forEach(function (f) {
        if (f.gap > 500) {
          var g = sheet.append("div").attr("class", "td-gap");
          g.append("span").text(f.n === 43 ? "4 years, 52 days" : f.n === 59 ? "19 years, 157 days" : (f.gap / 365.25).toFixed(1) + " years");
          g.append("small").text(f.n === 43 ? "Prison, March 1992 to March 1995" : f.n === 59 ? "Retired. Comes back at 58." : f.n === 49 ? "Licence revoked, July 1997 to October 1998" : "No fights");
        }
        var d = sheet.append("details").attr("class", "td-row res-" + f.res + (f.belts ? " is-title" : ""));
        var s = d.append("summary");
        s.append("span").attr("class", "td-row-n").text(f.n);
        s.append("span").attr("class", "td-row-opp").text(f.opp);
        s.append("span").attr("class", "td-row-end").text((f.res === "L" ? "L · " : "") + shortEnd(f));
        s.append("span").attr("class", "td-row-sub").text(fmtDate(f.d) + " · " + f.city.split(",")[0] + (f.belts ? " · title fight" : ""));
        var bar = s.append("span").attr("class", "td-row-bar").attr("aria-hidden", "true");
        bar.append("i").style("width", (100 * f.schedSecs / FULL) + "%");
        bar.append("i").attr("class", "f").style("width", Math.max(0.6, 100 * f.secs / FULL) + "%");
        for (var r = 1; r < f.sched; r++) bar.append("u").style("left", "calc(" + (100 * r * f.len / FULL) + "% - 1px)");
        var more = d.append("div").attr("class", "td-row-more").append("dl");
        var row = function (k, v) { if (v == null) return; more.append("dt").text(k); more.append("dd").text(v); };
        row("Result", longEnd(f));
        row("Ring time", clock(f.secs) + " of a scheduled " + clock(f.schedSecs));
        row("Where", (f.venue ? f.venue + ", " : "") + f.city);
        row("Record", f.record);
        row("Age", ages(f.age));
        row("Gap", gapText(f.gap));
        row("Titles", beltText(f));
        if (f.notes && (!f.belts || /disqualified/i.test(f.notes))) row("Note", f.notes);
      });
    });

    // small charts
    function small(hgt, draw) {
      var s = sheet.append("svg").attr("class", "td-m-svg td-svg").attr("viewBox", "0 0 500 " + hgt);
      draw(s.append("g"));
    }
    sheet.append("div").attr("class", "td-m-h");
    small(476, function (g) { panelLedger(g, D, { x: 0, y: 26, w: 500, labW: 180, pitch: 66 }); });
    sheet.append("div").attr("class", "td-m-h");
    small(430, function (g) { panelRounds(g, F, { x: 0, y: 26, u: 14.5, gap: 2.5, pitch: 29, labW: 62, narrow: true }); });
    sheet.append("div").attr("class", "td-m-h");
    small(380, function (g) { panelPlaces(g, F, { x: 0, y: 26, u: 16, gap: 2.5, pitch: 34, labW: 168, narrow: true }); });

    var foot = sheet.append("p").attr("class", "td-m-foot");
    foot.text("Ring time is the round and time each fight ended, summed; the minute between rounds is left out. Tyson–Paul was eight two-minute rounds. Golota quit before round three, so that fight counts as two rounds. ");
    if (opts.poster) sheet.append("a").attr("class", "td-m-link").attr("href", opts.poster).text("See it as one poster →");
    return { fights: F };
  }

  // =====================================================================
  //  Table view
  // =====================================================================
  function table(el, D) {
    var F = prep(D), root = d3.select(el);
    root.selectAll("*").remove();
    var t = root.append("div").attr("class", "td-tablewrap").append("table").attr("class", "td-table");
    t.append("caption").attr("class", "td-sr").text("Mike Tyson's 59 professional fights");
    var hr = t.append("thead").append("tr");
    ["No.", "Date", "Opponent", "Result", "How", "Round", "Ring time", "Scheduled", "Where", "Record"].forEach(function (h) { hr.append("th").attr("scope", "col").text(h); });
    var tb = t.append("tbody");
    F.forEach(function (f) {
      var tr = tb.append("tr");
      tr.append("td").text(f.n);
      tr.append("td").text(fmtDate(f.d));
      tr.append("th").attr("scope", "row").text(f.opp);
      tr.append("td").text(RES[f.res]);
      tr.append("td").text(f.type);
      tr.append("td").text(f.type === "UD" ? f.sched : f.rd);
      tr.append("td").text(clock(f.secs));
      tr.append("td").text(clock(f.schedSecs) + " (" + f.sched + " rounds)");
      tr.append("td").text(f.city);
      tr.append("td").text(f.record);
    });
  }

  global.Distance = { poster: poster, ledger: ledger, table: table, fonts: fonts, hms: hms };
})(window);
