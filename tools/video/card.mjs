// Renders the video's end card (1920 × 1080) in the site's fonts.
//
//   node tools/video/card.mjs <out.png>
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { launch } from "../browser.mjs";

const at = (p) => fileURLToPath(new URL(`../../${p}`, import.meta.url));
const font = (pkg, file) => pathToFileURL(at(`web/node_modules/@fontsource/${pkg}/files/${file}.woff2`)).href;
const mark = readFileSync(at("tools/brand/mark.svg"), "utf8");
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Display; src: url(${font("instrument-serif", "instrument-serif-latin-400-normal")}); }
@font-face { font-family: Display; font-style: italic; src: url(${font("instrument-serif", "instrument-serif-latin-400-italic")}); }
@font-face { font-family: Code; src: url(${font("ibm-plex-mono", "ibm-plex-mono-latin-400-normal")}); }
* { margin: 0; box-sizing: border-box; }
body { width: 1280px; height: 720px; background: radial-gradient(700px 460px at 50% 0%, #f7dea0 0%, transparent 70%), #f4f1e9; color: #15171c;
  display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.mark { width: 120px; }
h1 { font: 400 92px/1 Display; margin: 26px 0 14px; }
h2 { font: 400 46px/1.1 Display; color: #3a3f4a; } h2 em { color: #8a5a00; }
.links { margin-top: 46px; font: 20px Code; letter-spacing: .06em; color: #15171c; }
.track { margin-top: 18px; font: 14px Code; letter-spacing: .2em; color: #5a5f6a; text-transform: uppercase; }
</style></head><body>
<div class="mark">${mark}</div>
<h1>Unseal</h1>
<h2>Prove one payment. Keep the rest <em>sealed.</em></h2>
<div class="links">unseall.vercel.app &nbsp;·&nbsp; github.com/Modemola/zksnarks</div>
<div class="track">Zecathon · Core &amp; Tooling · Zcash mainnet</div>
</body></html>`;
const file = join(mkdtempSync(join(tmpdir(), "unseal-card-")), "card.html");
writeFileSync(file, html);
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 });
await page.goto(pathToFileURL(file).href);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: process.argv[2] });
await browser.close();
