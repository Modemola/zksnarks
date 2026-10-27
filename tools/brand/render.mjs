// Renders every brand image from tools/brand/mark.svg in the site's own fonts.
//
//   (cd web && npm ci)                # the fonts come from web/node_modules
//   node tools/brand/render.mjs
//
// Writes web/public/{favicon.svg, apple-touch-icon.png, og.png} and
// docs/brand/{unseal-mark.svg, unseal-icon.png, unseal-logo.png, unseal-cover.png}.
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { launch } from "../browser.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const at = (p) => join(root, p);
const markFile = at("tools/brand/mark.svg");
const mark = readFileSync(markFile, "utf8").replace(/<svg /, '<svg class="mark" ');

const font = (pkg, file) => pathToFileURL(at(`web/node_modules/@fontsource/${pkg}/files/${file}.woff2`)).href;
const head = `<meta charset="utf-8"><style>
@font-face { font-family: Display; src: url(${font("instrument-serif", "instrument-serif-latin-400-normal")}); }
@font-face { font-family: Display; font-style: italic; src: url(${font("instrument-serif", "instrument-serif-latin-400-italic")}); }
@font-face { font-family: Text; src: url(${font("ibm-plex-sans", "ibm-plex-sans-latin-400-normal")}); }
@font-face { font-family: Code; src: url(${font("ibm-plex-mono", "ibm-plex-mono-latin-400-normal")}); }
* { box-sizing: border-box; margin: 0; }
body { background: #f4f1e9; color: #15171c; font-family: Text; overflow: hidden; position: relative; }
.eyebrow { font: 15px Code; letter-spacing: .18em; text-transform: uppercase; color: #5c3d00; display: flex; align-items: center; gap: 10px; }
.eyebrow i { width: 10px; height: 10px; border-radius: 50%; background: #f4b728; box-shadow: 0 0 0 3px #f4b72855; }
h1 { font-weight: 400; font-family: Display; letter-spacing: -.01em; line-height: 1; }
h1 em { color: #8a5a00; }
.slip { position: absolute; background: #fbf9f3; font-family: Code; transform: rotate(-2deg); box-shadow: 8px 8px 0 -1px #15171c14;
  -webkit-mask: radial-gradient(circle at 8px 0, transparent 6px, #000 6.5px) top / 16px 51% repeat-x, radial-gradient(circle at 8px 100%, transparent 6px, #000 6.5px) bottom / 16px 51% repeat-x; }
.slip .top { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px dashed #15171c33; padding-bottom: .7em; }
.slip .top b { font: 400 1.9em Display; } .slip .top span { font-size: .8em; color: #5a5f6a; letter-spacing: .14em; }
.row { display: flex; justify-content: space-between; gap: 12px; padding: .62em 0; border-bottom: 1px dotted #15171c33; }
.row span:first-child { color: #5a5f6a; }
.redact { display: inline-block; height: .95em; background: #15171c; border-radius: 2px; }
.sealed { margin-top: 1.1em; display: flex; align-items: center; gap: 14px; color: #3a3f4a; font-size: .88em; line-height: 1.45; }
</style>`;

/** The receipt slip, as the site's home page draws it. */
const slip = (style, sealSize) => `<div class="slip" style="${style}">
  <div class="top"><b>Unseal</b><span>RECEIPT · ZR1</span></div>
  <div class="row"><span>Amount</span><span>0.001 ZEC</span></div>
  <div class="row"><span>Paid to</span><span>u1egp0qx…wusvvm</span></div>
  <div class="row"><span>Note</span><span>Invoice #1042</span></div>
  <div class="row"><span>Block</span><span>3,531,890 · mainnet</span></div>
  <div class="row"><span>Sender</span><span class="redact" style="width:38%"></span></div>
  <div class="row"><span>Other outputs</span><span class="redact" style="width:30%"></span></div>
  <div class="row"><span>Balance</span><span class="redact" style="width:34%"></span></div>
  <div class="sealed"><span style="width:${sealSize}px;flex:none">${mark}</span><span>One payment shown.<br>Everything else sealed.</span></div>
</div>`;

const pages = {
  "web/public/apple-touch-icon.png": {
    size: [180, 180],
    html: `<body style="display:grid;place-items:center;width:180px;height:180px"><div style="width:132px">${mark}</div></body>`,
  },
  "docs/brand/unseal-icon.png": {
    size: [1024, 1024],
    html: `<body style="display:grid;place-items:center;width:1024px;height:1024px"><div style="width:740px">${mark}</div></body>`,
  },
  "docs/brand/unseal-logo.png": {
    size: [1024, 1024],
    html: `<body style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:48px;width:1024px;height:1024px">
      <div style="width:520px">${mark}</div>
      <h1 style="font-size:190px">Unseal</h1></body>`,
  },
  "web/public/og.png": {
    size: [1200, 630],
    html: `<body style="width:1200px;height:630px;background:radial-gradient(600px 400px at 95% 0%, #f7dea0 0%, transparent 70%), #f4f1e9">
      <div style="position:absolute;left:72px;top:92px;width:600px">
        <div class="eyebrow"><i></i>Receipts for shielded Zcash payments</div>
        <h1 style="font-size:84px;margin:26px 0">Prove one payment.<br>Keep the rest <em>sealed.</em></h1>
        <p style="font-size:24px;line-height:1.45;color:#3a3f4a">A receipt for one shielded payment that anyone can check in their browser, without opening your wallet.</p>
      </div>
      ${slip("right:70px;top:70px;width:400px;padding:34px 30px 30px;font-size:16px", 70)}
      <div style="position:absolute;left:72px;bottom:56px;display:flex;align-items:center;gap:14px;font:400 40px Display">
        <span style="width:50px">${mark}</span>Unseal<span style="font:16px Code;color:#5a5f6a;letter-spacing:.08em">unseall.vercel.app</span>
      </div></body>`,
  },
  "docs/brand/unseal-cover.png": {
    size: [1600, 900],
    html: `<body style="width:1600px;height:900px;background:radial-gradient(800px 520px at 92% 0%, #f7dea0 0%, transparent 70%), #f4f1e9">
      <div style="position:absolute;inset:36px;border:1px solid #15171c1f"></div>
      <div style="position:absolute;left:96px;top:84px;display:flex;align-items:center;gap:16px;font:400 46px Display"><span style="width:56px">${mark}</span>Unseal</div>
      <div style="position:absolute;right:96px;top:104px;font:14px Code;letter-spacing:.2em;color:#5a5f6a">ZECATHON · CORE &amp; TOOLING · ZCASH MAINNET</div>
      <div style="position:absolute;left:96px;top:206px;width:900px">
        <div class="eyebrow" style="font-size:17px"><i></i>Receipts for shielded Zcash payments</div>
        <h1 style="font-size:108px;margin:30px 0 30px">Prove one payment.<br>Keep the rest <em>sealed.</em></h1>
        <p style="font-size:26px;line-height:1.45;color:#3a3f4a;width:740px">A receipt for one shielded payment: its amount, recipient and memo. Anyone can check it in a browser against the chain, and nothing else in the wallet is shown.</p>
      </div>
      ${slip("right:110px;top:160px;width:440px;padding:34px 32px 30px;font-size:16px", 76)}
      <div style="position:absolute;left:96px;right:96px;bottom:84px;border-top:1px solid #15171c26;padding-top:28px;display:grid;grid-template-columns:repeat(4,1fr)">
        ${[
          ["1", "payment opened"],
          ["0", "keys inside a receipt"],
          ["3", "shielded pools supported"],
          ["16", "blocks: all the relay sees"],
        ]
          .map(([n, t]) => `<div><div style="font:400 52px Display;color:#8a5a00">${n}</div><div style="font:14px Code;letter-spacing:.16em;text-transform:uppercase;color:#5a5f6a;margin-top:6px">${t}</div></div>`)
          .join("")}
      </div></body>`,
  },
};

copyFileSync(markFile, at("web/public/favicon.svg"));
copyFileSync(markFile, at("docs/brand/unseal-mark.svg"));
const dir = mkdtempSync(join(tmpdir(), "unseal-brand-"));
const browser = await launch();
for (const [out, { size, html }] of Object.entries(pages)) {
  const file = join(dir, "page.html");
  writeFileSync(file, `<!doctype html><html><head>${head}</head>${html}</html>`);
  const page = await browser.newPage({ viewport: { width: size[0], height: size[1] } });
  await page.goto(pathToFileURL(file).href);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: at(out) });
  await page.close();
  console.log(`wrote ${out}`);
}
await browser.close();
