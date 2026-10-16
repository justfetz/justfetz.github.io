// viz(id, fn, helpers?) — runs a visual and appends a "show the code" dropdown
// under the element with that id, containing the exact source of fn (and any helper
// functions it relies on). What you read is what ran.
window.viz = function (id, fn, helpers) {
  fn();
  var el = document.getElementById(id);
  if (!el) return;
  var d = document.createElement('details');
  d.className = 'code';
  var s = document.createElement('summary');
  s.textContent = 'show the code for this visual';
  d.appendChild(s);
  var pre = document.createElement('pre');
  var src = (helpers || []).map(function (h) { return h.toString(); }).concat([fn.toString()]).join('\n\n');
  // strip one level of leading indentation so it reads cleanly
  var lines = src.split('\n'), ind = Infinity;
  lines.forEach(function (l) { var m = l.match(/^(\s+)\S/); if (m && l.trim()) ind = Math.min(ind, m[1].length); });
  if (ind === Infinity) ind = 0;
  pre.textContent = lines.map(function (l) { return l.slice(Math.min(ind, (l.match(/^\s*/) || [''])[0].length)); }).join('\n');
  d.appendChild(pre);
  el.appendChild(d);
};
