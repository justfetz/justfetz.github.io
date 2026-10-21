// Render out/deck.html: one PNG per slide (2x), a PDF built from those PNGs (so every converter,
// LinkedIn's included, shows exactly these pixels), and a contact sheet. Usage: node shoot.mjs <out dir>
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire("/opt/node-tools/node_modules/"); const { chromium } = require("playwright");
const dir = (process.argv[2] || ".").replace(/\/?$/, "/");
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await (await browser.newContext({ viewport: { width: 1200, height: 1500 }, deviceScaleFactor: 2 })).newPage();
const errs = []; page.on("pageerror", e => errs.push(String(e))); page.on("console", m => { if (m.type() === "error") errs.push(m.text()); });
await page.goto("file://" + dir + "deck.html", { waitUntil: "load" });
await page.waitForSelector("body[data-ready='1']", { timeout: 15000 }); await page.waitForTimeout(300);
// layout audit: nothing may spill out of its slide or push the footer down
const audit = await page.evaluate(() => [...document.querySelectorAll(".slide")].map(s => {
  const r = s.getBoundingClientRect(), foot = s.querySelector(".foot").getBoundingClientRect();
  const over = [...s.querySelectorAll("*")].filter(e => { const b = e.getBoundingClientRect(); return b.width && (b.right > r.right + 0.5 || b.bottom > r.bottom + 0.5); }).length;
  return { id: s.id, footTop: Math.round(foot.top - r.top), over };
}));
const bad = audit.filter(a => a.over || a.footTop !== 1362);
if (bad.length || errs.length) { console.error("layout/js problems:", JSON.stringify(bad), errs); process.exit(1); }
const n = audit.length;
for (let i = 1; i <= n; i++) await (await page.$("#s" + i)).screenshot({ path: dir + `slide-${i}.png` });
const imgs = Array.from({ length: n }, (_, k) => `<img src="slide-${k + 1}.png">`).join("");
fs.writeFileSync(dir + "pdfpages.html", `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:1200px 1500px;margin:0}*{margin:0;padding:0}img{display:block;width:1200px;height:1500px;break-after:page}img:last-child{break-after:auto}</style></head><body>${imgs}</body></html>`);
const pp = await (await browser.newContext({ viewport: { width: 1200, height: 1500 } })).newPage();
await pp.goto("file://" + dir + "pdfpages.html", { waitUntil: "load" });
await pp.pdf({ path: dir + "IP-carousel.pdf", width: "1200px", height: "1500px", printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
const cols = 4, cells = imgs.replaceAll("<img", "<div><img").replaceAll(".png\">", ".png\"></div>");
fs.writeFileSync(dir + "sheet.html", `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#e9e9e4}.g{display:grid;grid-template-columns:repeat(${cols},1fr);gap:28px;padding:36px;width:2400px;box-sizing:border-box}.g div{background:#fff;box-shadow:0 2px 10px rgba(0,0,0,.12)}.g img{display:block;width:100%}</style></head><body><div class="g">${cells}</div></body></html>`);
const sp = await (await browser.newContext({ viewport: { width: 2400, height: 1500 }, deviceScaleFactor: 0.75 })).newPage();
await sp.goto("file://" + dir + "sheet.html", { waitUntil: "load" }); await sp.waitForTimeout(300);
await sp.screenshot({ path: dir + "preview.png", fullPage: true });
console.log(`slides: ${n}; wrote IP-carousel.pdf, slide-1..${n}.png, preview.png`);
await browser.close();
