// Root-level entry so the site deploys whether Vercel's Root Directory is the
// repository root or web/. The real handler lives in web/api/.
export { default } from "../web/api/tip.js";
