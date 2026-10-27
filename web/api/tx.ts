import { getTransaction } from "./_lib/lwd.js";
import { json, network, send, upstream, type Req, type Res } from "./_lib/http.js";

/**
 * POST /api/tx  { network, txid }
 *
 * The raw transaction, for making a receipt. The ID goes in the body, not the
 * address, so it stays out of request logs. Nothing is stored.
 */
export default async function handler(req: Req, res: Res) {
  if (req.method !== "POST") return send(res, 405, { error: "Use POST." });
  let body: Record<string, unknown>;
  try {
    body = await json(req);
  } catch {
    return send(res, 400, { error: "Send JSON." });
  }
  const net = network(body.network);
  const txid = typeof body.txid === "string" ? body.txid.trim().toLowerCase() : "";
  if (!net || !/^[0-9a-f]{64}$/.test(txid)) return send(res, 400, { error: "A transaction ID is 64 characters of 0-9 and a-f." });
  try {
    send(res, 200, { found: true, ...(await getTransaction(net, txid)) });
  } catch (e) {
    // "No such transaction" is an answer, not a failure: report it as data so
    // a mistyped ID doesn't show up as an error in the browser console.
    if (/not found|NotFound|No such|-5\b/i.test(e instanceof Error ? e.message : String(e))) return send(res, 200, { found: false });
    upstream(res, e);
  }
}
