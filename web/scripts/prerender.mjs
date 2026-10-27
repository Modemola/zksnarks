// Writes real HTML for the pages that need no chain data before their first
// render, so phones draw them before the JavaScript arrives. Runs after
// `vite build`: node scripts/prerender.mjs [--mode <mode>] [--outDir <dir>]
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "vite";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const mode = arg("mode", "production");
const outDir = resolve(arg("outDir", "dist"));
// Inside the project, so the server build can import its packages.
const ssrDir = resolve("node_modules/.cache/prerender-ssr");

await build({ mode, logLevel: "warn", build: { ssr: "src/entry-server.tsx", outDir: ssrDir, emptyOutDir: true, sourcemap: false } });
const { render, PRERENDERED, DESCRIPTIONS } = await import(pathToFileURL(join(ssrDir, "entry-server.js")).href);

// On a second run index.html is already pre-rendered; the shell is in app.html.
const shell = existsSync(join(outDir, "app.html")) ? "app.html" : "index.html";
const template = readFileSync(join(outDir, shell), "utf8");
if (!template.includes('<div id="root"></div>')) throw new Error("index.html has no empty #root");
// Every other address still gets the plain app shell.
writeFileSync(join(outDir, "app.html"), template);
// Addresses that match no page get the same shell with a real 404 status
// (static hosts serve 404.html for them); the app then draws its own page.
writeFileSync(join(outDir, "404.html"), template);

// React warns that layout effects don't run on the server; that's expected here.
const warn = console.error;
console.error = (msg, ...rest) => (String(msg).includes("useLayoutEffect does nothing on the server") ? undefined : warn(msg, ...rest));

// Pre-rendered pages carry their stylesheet inline, saving a round trip
// before the first paint. Pages rendered in the browser keep the shared file.
const cssLink = template.match(/<link rel="stylesheet"[^>]*href="(\/assets\/index-[^"]+\.css)"[^>]*>/);
const inlineCss = (html) =>
  cssLink ? html.replace(cssLink[0], () => `<style>${readFileSync(join(outDir, cssLink[1]), "utf8")}</style>`) : html;

// The public address, for canonical links (from VITE_SITE_URL in .env).
const site = (readFileSync(".env", "utf8").match(/^VITE_SITE_URL=(.*)$/m)?.[1] ?? "").trim().replace(/\/$/, "");

for (const [path, title] of Object.entries(PRERENDERED)) {
  const app = await render(path);
  // A host that falls back to this file for another address must not show
  // this page's HTML there: clear it before anything is drawn.
  // External, so a strict Content-Security-Policy needs no inline scripts.
  const guard = `<script src="/guard.js"></script>`;
  const html = inlineCss(template)
    .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
    .replace(/(<meta name="description" content=")[^"]*"/, `$1${DESCRIPTIONS[path]}"`)
    .replace(/(<meta property="og:description" content=")[^"]*"/, `$1${DESCRIPTIONS[path]}"`)
    .replace(/(<meta property="og:url" content=")[^"]*"/, `$1${site}${path === "/" ? "/" : path}"`)
    .replace(/(<link rel="canonical" href=")[^"]*"/, `$1${site}${path === "/" ? "/" : path}"`)
    .replace('<div id="root"></div>', `<div id="root" data-prerendered data-path="${path}">${app}</div>${guard}`);
  // Both /how.html and /how/index.html: hosts differ in which one serves /how.
  const files = path === "/" ? [join(outDir, "index.html")] : [join(outDir, `${path.slice(1)}.html`), join(outDir, path.slice(1), "index.html")];
  for (const file of files) {
    mkdirSync(join(file, ".."), { recursive: true });
    writeFileSync(file, html);
  }
  console.log(`prerendered ${path} (${Math.round(app.length / 1024)} KB)`);
}
console.error = warn;
rmSync(ssrDir, { recursive: true, force: true });
