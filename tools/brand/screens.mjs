// Captures the product screenshots in docs/screens from a running site.
//
//   node tools/brand/screens.mjs [base-url]          default: https://unseall.vercel.app
import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { launch } from "../browser.mjs";

const base = (process.argv[2] ?? "https://unseall.vercel.app").replace(/\/$/, "");
const out = (name) => fileURLToPath(new URL(`../../docs/screens/${name}`, import.meta.url));
const shot = { type: "jpeg", quality: 88 };
// The sticky header and the progress bar would be stitched into element shots.
const quiet = "header.site, .skip-link, .scroll-progress { display: none !important; }";

const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 1.5, reducedMotion: "reduce" });
const page = await ctx.newPage();

// 1. The home page as a visitor first sees it.
await page.goto(base + "/", { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await page.screenshot({ path: out("home.jpg"), ...shot });

// 2. The demo receipt, checked: the claim beside the steps, the ledger and the facts.
await page.locator("#check").scrollIntoViewIfNeeded();
await page.getByRole("button", { name: "Check this receipt" }).click();
await page.waitForSelector("#check .note.good", { timeout: 30000 });
await page.waitForTimeout(1500);
await page.addStyleTag({ content: quiet + " .check-grid .verify-explain { display: none !important; }" });
await page.locator("#check .check-grid").screenshot({ path: out("check.jpg"), ...shot });

// 3. Making a receipt with the demo wallet's view only key.
await page.goto(base + "/create", { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Try it with the demo wallet" }).click();
await page.waitForSelector(".payments li", { timeout: 30000 });
await page.waitForTimeout(800);
await page.addStyleTag({ content: quiet });
await page.locator("main .split").first().screenshot({ path: out("create.jpg"), ...shot });

await browser.close();
for (const old of ["home.png", "check.png"]) rmSync(out(old), { force: true });
console.log("wrote docs/screens/home.jpg, check.jpg, create.jpg");
