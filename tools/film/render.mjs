// Renders the launch film (tools/film/film.html) frame by frame.
//
//   node tools/film/render.mjs <frames-dir> <footage-dir> [from-seconds] [to-seconds] [step]
//
// <footage-dir> is what tools/video/record.mjs wrote; the film plays its
// 03-check scene inside a browser frame. Each frame is drawn at an exact time,
// so the film is the same however slowly the machine renders it.
import { createReadStream, existsSync, mkdirSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { launch } from "../browser.mjs";

const [out, footage, from = "0", to = "46", step = "1"] = process.argv.slice(2);
if (!out || !footage) throw new Error("usage: render.mjs <frames-dir> <footage-dir> [from] [to] [step]");
const here = dirname(fileURLToPath(import.meta.url));
const pkg = (name) => join(here, "../node_modules", name);
const routes = {
  "/three/": pkg("three"),
  "/polygon-clipping/": pkg("polygon-clipping"),
  "/splaytree/": pkg("splaytree"),
  "/robust-predicates/": pkg("robust-predicates"),
  "/fonts/": join(here, "../../web/node_modules/@fontsource"),
  "/footage/": footage,
};
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".woff2": "font/woff2", ".jpg": "image/jpeg", ".svg": "image/svg+xml" };
const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let file = path === "/" || path === "/film.html" ? join(here, "film.html") : null;
  for (const [prefix, dir] of Object.entries(routes)) if (path.startsWith(prefix)) file = normalize(join(dir, path.slice(prefix.length)));
  if (!file || !existsSync(file) || !statSync(file).isFile()) return res.writeHead(404).end();
  res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(res);
}).listen(Number(process.env.FILM_PORT || 0), "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const base = `http://127.0.0.1:${server.address().port}`;

mkdirSync(out, { recursive: true });
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
page.on("pageerror", (e) => console.error("page error:", e.message));
page.on("console", (m) => m.type() === "error" && console.error("console:", m.text()));
await page.goto(base + "/film.html");
await page.waitForFunction(() => window.ready === true, null, { timeout: 120000 });
const FPS = 30, first = Math.round(Number(from) * FPS), last = Math.round(Number(to) * FPS);
const t0 = Date.now();
for (let f = first; f < last; f += Number(step)) {
  await page.evaluate((t) => window.render(t), f / FPS);
  await page.screenshot({ path: join(out, `${String(f).padStart(5, "0")}.jpg`), type: "jpeg", quality: 92 });
  if (f % 150 === 0) console.log(`frame ${f} (${(f / FPS).toFixed(1)} s), ${((Date.now() - t0) / 1000).toFixed(0)} s elapsed`);
}
await browser.close();
server.close();
