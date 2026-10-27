// Records the demo video's scenes from a running site, one folder of frames per scene.
//
//   node tools/video/record.mjs <out-dir> [base-url]        default: https://unseall.vercel.app
//
// Frames come from Chrome's screencast at 1920 × 1080, each with its capture
// time, so tools/video/edit.py can rebuild every scene at its real speed. The
// pointer is drawn with the site's own cursor images, since a headless browser
// shows none.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { launch } from "../browser.mjs";

const out = process.argv[2];
const base = (process.argv[3] ?? "https://unseall.vercel.app").replace(/\/$/, "");
if (!out) throw new Error("usage: record.mjs <out-dir> [base-url]");
const here = (f) => fileURLToPath(new URL(f, import.meta.url));
const SAPLING = readFileSync(here("../../core/tests/data/mainnet-sapling.zr"), "utf8").trim();

// The pointer: the site's arrow, and its wax seal over anything that can be pressed.
const pointer = (origin) => `
  addEventListener("DOMContentLoaded", () => {
    const c = document.createElement("img");
    c.id = "demo-pointer";
    c.src = "${origin}/cursors/arrow.svg";
    c.style.cssText = "position:fixed;left:0;top:0;width:32px;height:32px;z-index:2147483647;pointer-events:none;transform:translate(-100px,-100px);transition:width .15s,height .15s";
    document.documentElement.appendChild(c);
    let pressing = false, last = null;
    const pick = (el) => {
      const cur = el ? getComputedStyle(el).cursor : "";
      c.src = "${origin}/cursors/" + (/seal/.test(cur) || /pointer/.test(cur) ? "seal.svg" : "arrow.svg");
    };
    addEventListener("mousemove", (e) => { last = e; c.style.transform = "translate(" + (e.clientX - 4) + "px," + (e.clientY - 3) + "px)" + (pressing ? " scale(.88)" : ""); pick(e.target); }, true);
    // A page scrolling under a still pointer changes what it points at.
    addEventListener("scroll", () => last && pick(document.elementFromPoint(last.clientX, last.clientY)), true);
    addEventListener("mousedown", () => { pressing = true; }, true);
    addEventListener("mouseup", () => { pressing = false; }, true);
  });`;

const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5, colorScheme: "light" });
await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: base });
await ctx.addInitScript({ content: pointer(base) });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);

let scene = null;
cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
  cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  if (!scene) return;
  const n = String(scene.frames.length).padStart(5, "0");
  writeFileSync(join(scene.dir, `${n}.jpg`), Buffer.from(data, "base64"));
  scene.frames.push({ file: `${n}.jpg`, t: metadata.timestamp });
});

/** Records everything `act` does as one scene. */
async function record(name, act) {
  const dir = join(out, name);
  mkdirSync(dir, { recursive: true });
  scene = { dir, frames: [] };
  const start = Date.now() / 1000;
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
  // Nudge one frame out at the very start, so the scene opens on its first picture.
  await page.mouse.move(mouse.x, mouse.y);
  await act();
  const end = Date.now() / 1000;
  await cdp.send("Page.stopScreencast");
  writeFileSync(join(dir, "frames.json"), JSON.stringify({ start, end, frames: scene.frames }));
  console.log(`${name}: ${scene.frames.length} frames, ${(end - start).toFixed(1)} s`);
  scene = null;
}

const wait = (ms) => page.waitForTimeout(ms);
const mouse = { x: 900, y: 420 };
/** Glides the pointer to the middle of an element. */
async function glide(locator, ms = 700) {
  const b = await locator.boundingBox();
  const x = b.x + b.width / 2, y = b.y + b.height / 2;
  const steps = Math.max(8, Math.round(ms / 16));
  for (let i = 1; i <= steps; i++) {
    const k = i / steps, e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
    await page.mouse.move(mouse.x + (x - mouse.x) * e, mouse.y + (y - mouse.y) * e);
    await wait(ms / steps);
  }
  Object.assign(mouse, { x, y });
}
async function press(locator, ms) {
  await locator.scrollIntoViewIfNeeded();
  await glide(locator, ms);
  await wait(180);
  await page.mouse.down();
  await wait(90);
  await page.mouse.up();
}
/** Scrolls smoothly so the element's top sits `offset` px below the header. */
async function scrollTo(target, ms = 1100, offset = 96) {
  await page.evaluate(
    async ([sel, ms, offset]) => {
      const el = typeof sel === "number" ? null : document.querySelector(sel);
      const to = el ? el.getBoundingClientRect().top + scrollY - offset : sel;
      const from = scrollY, t0 = performance.now();
      await new Promise((done) => {
        const step = (now) => {
          const k = Math.min(1, (now - t0) / ms), e = k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
          scrollTo(0, from + (to - from) * e);
          k < 1 ? requestAnimationFrame(step) : done();
        };
        requestAnimationFrame(step);
      });
    },
    [target, ms, offset],
  );
}
const go = async (path) => {
  await page.goto(base + path, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: "html { scroll-behavior: auto !important; } .skip-link { display: none !important; }" });
};

// Warm the relay and the receipt engine so nothing on camera waits on a cold start.
await go("/check#" + SAPLING);
await page.waitForSelector(".note.good", { timeout: 30000 });

// 1. The problem, over the home page. Recording starts before the page draws,
// so the headline's entrance is on camera; the edit trims the blank start.
await go("/");
await record("01-hero", async () => {
  await go("/");
  await wait(1500);
  await glide(page.locator(".hero h1, h1").first(), 1400);
  await wait(3500);
  await glide(page.locator(".slip").first(), 1600);
  await wait(4000);
});

// 2. The receipt itself.
await record("02-slip", async () => {
  const slip = page.locator(".slip").first();
  const b = await slip.boundingBox();
  for (const [dx, dy] of [[0.3, 0.35], [0.7, 0.55], [0.5, 0.8]]) {
    await page.mouse.move(b.x + b.width * dx, b.y + b.height * dy, { steps: 30 });
    await wait(700);
  }
  Object.assign(mouse, { x: b.x + b.width * 0.5, y: b.y + b.height * 0.8 });
  await wait(1200);
});

// 3. The signature moment: the check, step by step, and the seal cracking.
await record("03-check", async () => {
  await scrollTo("#check", 1400, 80);
  await wait(500);
  await press(page.getByRole("button", { name: "Check this receipt" }));
  await page.waitForSelector("#check .note.good", { timeout: 30000 });
  await wait(2200);
  await scrollTo("#check .ledger", 1600, 220);
  await wait(4500);
  await scrollTo("#check .receipt-facts", 1600, 260);
  await wait(4000);
});

// 4. What stayed private.
await record("04-private", async () => {
  await scrollTo("#check .verify-explain", 1500, 120);
  await wait(6500);
});

// 5. A forged copy fails at the step that broke.
await record("05-forged", async () => {
  await scrollTo("#check", 1300, 80);
  await wait(400);
  await press(page.getByRole("button", { name: "Forged copy" }));
  await page.waitForSelector("#check [role=alert]", { timeout: 30000 });
  await wait(1200);
  await scrollTo("#check .check-steps", 1200, 160);
  await wait(5000);
});

// 6. Making a receipt with the demo wallet.
await go("/create");
await record("06-make", async () => {
  await wait(1200);
  await press(page.getByRole("button", { name: "Try it with the demo wallet" }), 1100);
  await page.waitForSelector(".payments li", { timeout: 30000 });
  await wait(2500);
  await scrollTo(".payments li", 1400, 120);
  await wait(2000);
  await press(page.getByRole("button", { name: "Copy link" }), 900);
  await wait(3500);
});

// 7. Sapling.
await go("/check");
await record("07-sapling", async () => {
  await wait(800);
  await press(page.getByRole("button", { name: "Try a Sapling receipt" }), 1000);
  await page.waitForSelector(".note.good", { timeout: 30000 });
  await wait(1800);
  await scrollTo(".receipt-facts", 1500, 200);
  await wait(4000);
});

// 8. The command line: real output from `unseal check`, typed into a terminal.
await page.goto(pathToFileURL(here("terminal.html")).href);
await record("08-terminal", async () => {
  await page.evaluate(() => document.getElementById("demo-pointer")?.remove());
  await page.evaluate(() => window.play());
  await page.waitForFunction(() => window.done === true, null, { timeout: 30000 });
  await wait(3500);
});

// 9. How it works, then the end card.
await go("/how");
await record("09-how", async () => {
  await wait(1500);
  await scrollTo(600, 2600);
  await wait(2500);
});

await browser.close();
