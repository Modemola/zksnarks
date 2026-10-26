import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin, type ViteDevServer } from "vite";

/**
 * Serves the relay functions in api/ during development, the way Vercel does
 * in production: /api/name runs the default export of api/name.ts.
 */
function devApi(): Plugin {
  return {
    name: "dev-api",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const m = req.url?.match(/^\/api\/([a-z]+)(?:\?|$)/);
        if (!m) return next();
        try {
          const mod = await server.ssrLoadModule(`/api/${m[1]}.ts`);
          await mod.default(req, res);
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(e) }));
        }
      });
    },
  };
}

/**
 * Preload the fonts the first screen uses, so text doesn't reflow when they
 * arrive. Their file names carry a content hash, so they're found in the
 * finished bundle. Change the patterns if you change fonts.
 */
function preloadFonts(patterns: RegExp[]): Plugin {
  return {
    name: "preload-fonts",
    transformIndexHtml: {
      order: "post",
      handler(_html, ctx) {
        if (!ctx.bundle) return [];
        return Object.keys(ctx.bundle)
          .filter((f) => f.endsWith(".woff2") && patterns.some((p) => p.test(f)))
          .map((f) => ({ tag: "link", attrs: { rel: "preload", as: "font", type: "font/woff2", href: `/${f}`, crossorigin: "" }, injectTo: "head" as const }));
      },
    },
  };
}

export default defineConfig({
  plugins: [react(), devApi(), preloadFonts([/fraunces-latin-300-normal/, /geist-latin-400-normal/])],
  build: { sourcemap: true },
});
