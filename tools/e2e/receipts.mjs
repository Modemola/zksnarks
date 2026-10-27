// Drives every flow of the site in a real browser against the live Zcash chain.
//
//   node tools/e2e/receipts.mjs [base-url]          default: https://unseall.vercel.app
//
// Uses only public data: the demo receipts in core/tests/data and the demo
// shop's view-only key, which the site itself publishes. Set UNSEAL_PAYER_KEY
// to the payer's viewing key to also check the sender's side.
import { readFileSync } from "node:fs";
import { launch } from "../browser.mjs";

const base = (process.argv[2] ?? "https://unseall.vercel.app").replace(/\/$/, "");
const data = (name) => readFileSync(new URL(`../../core/tests/data/${name}`, import.meta.url), "utf8").trim();
const DEMO = data("mainnet-demo.zr");
const FORGED = data("mainnet-forged.zr");
const SAPLING = data("mainnet-sapling.zr");
const SHOP_KEY = readFileSync(new URL("../../web/src/lib/sample.ts", import.meta.url), "utf8").match(/key: "(uview1[a-z0-9]+)"/)[1];
const PAYER_KEY = process.env.UNSEAL_PAYER_KEY;
const TESTNET_KEY =
  "uviewtest106xcrgaw667c2qas6xtv4qgm4z5ychvzez35dpzp8gktm50sr2mlrxwdsfy5xws394sxy2ln9nuzxmel9qdx45h76zks9kxyds6hrq8p6caz3zke9nvuezh4wth8uc66vhxz2ycpcwwaz733guq0e43yfcygx63ezketmye30qdjzq8l7ea78mqt33ept2qatslfssl5eqa3567sg8d8lyxjvpc4q9vkvkatssup0wrkdgskt8zne8kdrzde9xyz04dln7z8jgp6ww75t5pfjhql5wrvqje592wttzy7acg24djqnjqe248vfuxyzk9l68x4l9z8n4ze63strpj3nxd97l0vjlx5qh7m5ujj768zmcg2svn5zzpa04tmwqfd9mca7ly5uqqn2yv5jty30lkkfnyh5pr533ygxgu2lqmpupd6f96cfapyg6zsvs79wpzjyt25dcdnpshx7dhaazhruyxrur4vksem8r963zdyxr7d5vvp8lh5";
const TXID = "04f89f774842deb5b61a444c0932a569a9ae27cd5834f7625c26eefe9df6e2d1";
const SAPLING_TXID = "a3eae06535c5350927f81f02235b96743a1a06cb159f075964df8643be4c0e35";
const SHOP_ADDR = "u1egp0qxvvyf5ngje5xrcn2y836y4mphr7xzcj92a34sxd9kv54xel7fg9hxelkjh6tjykvz764hjqk2x6fj8avjpdhc32rrkrwvwusvvm";
const SHOP_SAPLING_UA = "u1rn763caval0zfhg5kk5swsslddknapnzmqxa04vnpzmn49rrl0wzxq22ma47ttv9t509d0ss073c5w2yweqftrcmms43nywvagaygw5p";
const SHOP_ZS1 = "zs1vp67zys00c34zu9d7420jpxutuxfcxv5adhkt0xed92sqygt60wdjrvzw95nyhs9zzf7x0sv35k";

let pass = 0, fail = 0;
const errors = [];
const ok = (name, cond, extra = "") => {
  cond ? pass++ : fail++;
  console.log((cond ? "PASS " : "FAIL ") + name + (extra ? `  (${extra})` : ""));
};

const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true, permissions: ["clipboard-read", "clipboard-write"] });
/** A page that records script errors and console errors. */
const page = async () => {
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(String(e)));
  p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  return p;
};
/** Waits for the verdict; true when the receipt checked out. */
const result = async (p) => {
  await p.waitForSelector(".note.good, [role=alert]", { timeout: 30000 });
  return (await p.locator(".note.good").count()) > 0;
};

// A. The home page check
let p = await page();
await p.goto(base + "/", { waitUntil: "networkidle" });
const badge = await p.locator(".net").textContent();
ok("A1 header says mainnet with a live block", /mainnet/i.test(badge) && /block \d/.test(badge), badge);
await p.locator("#check").scrollIntoViewIfNeeded();
let t0 = Date.now();
await p.getByRole("button", { name: "Check this receipt" }).click();
let good = await result(p);
ok("A2 home check passes", good, `${Date.now() - t0} ms including the step animation`);
ok("A3 result names amount and memo", /0\.001 ZEC was paid.*Invoice #1042/.test(await p.locator(".note.good").innerText()));
ok("A4 ledger: 1 opened, 1 sealed", (await p.locator(".ledger .open").count()) === 1 && (await p.locator(".ledger .sealed").count()) === 1);
await p.waitForTimeout(1200);
ok("A5 seal cracks open", (await p.locator(".wax-seal.broken").count()) === 1);
await p.getByRole("button", { name: "Check again" }).click();
ok("A6 check again works", await result(p));
await p.close();

// B. A receipt link, and "Was it paid to you?"
p = await page();
t0 = Date.now();
await p.goto(base + "/check#" + DEMO);
ok("B1 receipt link checks automatically", await result(p), `${Date.now() - t0} ms from page load`);
const addr = p.getByLabel("Your Zcash address");
const verdict = async (value) => {
  await addr.fill(value);
  await p.waitForTimeout(400);
  return p.locator("#match-help").innerText();
};
ok("B2 shop address: paid to you", /^Yes\. This payment went to your address/.test(await verdict(SHOP_ADDR)));
ok("B3 another address: not paid to it", /^No\./.test(await verdict(SHOP_SAPLING_UA)));
ok("B4 garbage address: no verdict", !/^(Yes|No)\./.test(await verdict("u1garbage")));
await p.close();

// C. A forged receipt
p = await page();
await p.goto(base + "/check#" + FORGED);
good = await result(p);
const failedStep = await p.locator(".check-steps li.failed .what").innerText().catch(() => "");
ok("C1 forged receipt rejected", !good);
ok("C2 failure is at the match step", /Match it to the commitment/.test(failedStep), failedStep);
await p.close();

// D. Pasting
p = await page();
await p.goto(base + "/check", { waitUntil: "networkidle" });
await p.locator("textarea").fill("hello");
ok("D1 non receipt: hint shown, button disabled", /start with zr1/.test(await p.locator("form small").first().innerText()) && (await p.getByRole("button", { name: "Check it" }).isDisabled()));
await p.locator("textarea").fill(DEMO.slice(0, 4000) + "\n  " + DEMO.slice(4000, 9000) + "\n" + DEMO.slice(9000));
await p.getByRole("button", { name: "Check it" }).click();
ok("D2 receipt with line breaks still checks", await result(p));
await p.locator("details.more summary").click();
await p.locator("details.more textarea").fill(base + "/check#" + FORGED);
await p.locator("details.more").getByRole("button", { name: "Check it" }).click();
await p.waitForTimeout(300);
ok("D3 pasted full link of a forged receipt is rejected", !(await result(p)));
await p.close();

// E. A damaged receipt
p = await page();
await p.goto(base + "/check#" + DEMO.slice(0, 600));
good = await result(p);
const alert = await p.locator("[role=alert]").innerText();
ok("E1 truncated receipt rejected in plain words", !good && /could not be read|damaged/.test(alert), alert.slice(0, 90));
await p.close();

// G. Making a receipt: the shop received it; the payer, if its key is given, sent it
const parties = [["shop", SHOP_KEY, "You received"]];
if (PAYER_KEY) parties.unshift(["payer", PAYER_KEY, "You sent"]);
else console.log("SKIP payer side (set UNSEAL_PAYER_KEY to include it)");
for (const [who, key, dir] of parties) {
  p = await page();
  await p.goto(base + "/create", { waitUntil: "networkidle" });
  await p.getByLabel("Unified full viewing key").fill(key);
  await p.getByLabel("Transaction ID").fill(TXID);
  t0 = Date.now();
  await p.getByRole("button", { name: "Find my payments" }).click();
  await p.waitForSelector(".payments li, [role=alert]", { timeout: 30000 });
  ok(`G1 ${who}: one payment found`, (await p.locator(".payments li").count()) === 1, `${Date.now() - t0} ms`);
  ok(`G2 ${who}: direction is '${dir}'`, (await p.locator(".payments .status").innerText()).toLowerCase() === dir.toLowerCase());
  const link = await p.locator(".link-box").innerText();
  ok(`G3 ${who}: link carries the same receipt as the demo`, link.endsWith("#" + DEMO));
  if (who === "shop") {
    await p.getByRole("button", { name: "Copy link" }).click();
    await p.waitForTimeout(300);
    ok("G4 copy link puts it on the clipboard", (await p.evaluate(() => navigator.clipboard.readText())) === link);
    const [download] = await Promise.all([p.waitForEvent("download"), p.getByRole("button", { name: "Download" }).click()]);
    ok("G5 download contains the receipt", readFileSync(await download.path(), "utf8").trim() === DEMO, download.suggestedFilename());
    await p.getByRole("link", { name: "Check it now" }).click();
    ok("G6 'Check it now' opens and passes the check", (await result(p)) && p.url().includes("/check#zr1"));
  }
  await p.close();
}

// H. Every message on the make page
p = await page();
await p.goto(base + "/create", { waitUntil: "networkidle" });
const keyField = p.getByLabel("Unified full viewing key");
const txField = p.getByLabel("Transaction ID");
const find = p.getByRole("button", { name: "Find my payments" });
const alertText = async () => {
  await p.waitForSelector("[role=alert]", { timeout: 30000 });
  return p.locator("[role=alert]").innerText();
};
await find.click();
ok("H1 empty form explains both fields", /Paste your wallet/.test(await p.locator("#key-help").innerText()) && /Paste the transaction ID/.test(await p.locator("#txid-help").innerText()));
await keyField.fill("uivk1abc");
ok("H2 incoming only key explained", /incoming viewing key/.test(await p.locator("#key-help").innerText()));
await keyField.fill("zxviews1abc");
ok("H3 older Sapling key explained", /older Sapling viewing key/.test(await p.locator("#key-help").innerText()));
await txField.fill("abc");
ok("H4 short transaction ID explained with its length", /\(3 now\)/.test(await p.locator("#txid-help").innerText()));
await keyField.fill(SHOP_KEY);
await txField.fill("00000000000000000000000000000000000000000000000000000000000000aa");
await find.click();
ok("H5 unknown transaction: plain not found message", /no transaction with that ID/.test(await alertText()));
await keyField.fill(TESTNET_KEY);
await txField.fill(TXID);
await find.click();
await p.waitForTimeout(400);
ok("H6 testnet key with a mainnet transaction: not on that network", /same network as the key/.test(await alertText()));
await txField.fill("7646b10c3ccfc926be465c80d82afe2d24b7381837e3805675924a29379c44e8");
await find.click();
await p.waitForSelector(".payments, h2:has-text('No payments found')", { timeout: 30000 });
ok("H7 key that took no part: 'No payments found'", (await p.locator("h2:has-text('No payments found')").count()) === 1);
await keyField.fill(SHOP_KEY.slice(0, -3) + "qqq");
await txField.fill(TXID);
await find.click();
ok("H8 corrupted key: plain message", /not a viewing key this tool can read/.test(await alertText()));
await p.close();

// I. The other pages
{
  // The browser logs a 404 for the page itself, so this tab records script errors only.
  const q = await ctx.newPage();
  q.on("pageerror", (e) => errors.push(String(e)));
  const r = await q.goto(base + "/nowhere", { waitUntil: "networkidle" });
  ok("I1 unknown address shows the site's own not found page", /exist/i.test(await q.locator("h1").innerText()), await q.locator("h1").innerText());
  ok("I2 it offers the way forward", (await q.getByRole("link", { name: "Check a receipt" }).count()) >= 1);
  ok("I3 it answers with status 404", r.status() === 404 || /localhost:5173/.test(base), `${r.status()}${/localhost:5173/.test(base) ? ", dev server" : ""}`);
  ok("I4 the mainnet badge shows there too", await q.locator(".net").isVisible());
  await q.close();
}
p = await page();
await p.goto(base + "/how", { waitUntil: "networkidle" });
ok("I5 how it works renders", (await p.locator("h1").count()) === 1);
await p.close();

// J. One click demos
p = await page();
await p.goto(base + "/", { waitUntil: "networkidle" });
await p.getByRole("button", { name: "Forged copy" }).click();
await p.waitForSelector("#check [role=alert]", { timeout: 30000 });
ok("J1 home forged switch fails at the match step", /Match it to the commitment/.test(await p.locator("#check .check-steps li.failed .what").innerText()));
await p.getByRole("button", { name: "Genuine receipt" }).click();
ok("J2 switching back restores the genuine receipt", (await p.locator("#check .claim-score").innerText()).startsWith("0.001"));
await p.goto(base + "/check", { waitUntil: "networkidle" });
await p.getByRole("button", { name: "Try a forged copy" }).click();
ok("J3 check page 'Try a forged copy' is rejected", !(await result(p)));
await p.locator("details.more summary").click();
await p.locator("details.more").getByRole("button", { name: "Try the demo receipt" }).click();
ok("J4 then 'Try the demo receipt' passes", await result(p));
ok("J5 tab title shows the verdict", /^Paid 0\.001 ZEC/.test(await p.title()), await p.title());
await p.goto(base + "/create", { waitUntil: "networkidle" });
await p.getByRole("button", { name: "Try it with the demo wallet" }).click();
await p.waitForSelector(".payments li", { timeout: 30000 });
ok("J6 demo wallet finds the received payment", /received/i.test(await p.locator(".payments .status").innerText()));
ok("J7 focus moves to the results", await p.evaluate(() => document.activeElement?.classList.contains("results-anchor")));
await p.close();

// K. Sapling, proven with a real mainnet payment
p = await page();
await p.goto(base + "/check", { waitUntil: "networkidle" });
await p.getByRole("button", { name: "Try a Sapling receipt" }).click();
ok("K1 'Try a Sapling receipt' passes", await result(p));
ok("K2 it proves 0.0005 ZEC in the Sapling pool", /0\.0005 ZEC was paid.*Invoice #1043/.test(await p.locator(".note.good").innerText()) && /Sapling/.test(await p.locator(".receipt-facts").innerText()));
await p.goto(base + "/check#" + SAPLING, { waitUntil: "networkidle" });
await result(p);
await p.getByLabel("Your Zcash address").fill(SHOP_ZS1);
await p.waitForTimeout(500);
ok("K3 a zs1 address is recognised as the recipient", /^Yes\. This payment went to your address/.test(await p.locator("#match-help").innerText()));
await p.goto(base + "/create", { waitUntil: "networkidle" });
await p.getByLabel("Unified full viewing key").fill(SHOP_KEY);
await p.getByLabel("Transaction ID").fill(SAPLING_TXID);
await p.getByRole("button", { name: "Find my payments" }).click();
await p.waitForSelector(".payments li", { timeout: 30000 });
ok("K4 the shop's key finds its Sapling payment", (await p.locator(".payments li").count()) === 1 && /0\.0005/.test(await p.locator(".payments li").innerText()));
ok("K5 its link carries the same receipt", (await p.locator(".link-box").innerText()).endsWith("#" + SAPLING));
await p.close();

ok("Z no console or script errors", errors.length === 0, errors.slice(0, 3).join(" | "));
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
