import { getBlocks, tipHeight } from "./_lib/lwd";
import { network, query, send, upstream, type Req, type Res } from "./_lib/http";

const MAX_RANGE = 32;

/**
 * GET /api/blocks?network=mainnet&start=H&end=H
 *
 * Block hashes and the IDs of their shielded transactions, plus the chain tip.
 * Pages ask for a whole range of blocks, never a single transaction, so this
 * relay cannot tell which payment is being checked.
 */
export default async function handler(req: Req, res: Res) {
  const q = query(req);
  const net = network(q.get("network"));
  const start = Number(q.get("start"));
  const end = Number(q.get("end"));
  if (!net || !Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start || end - start >= MAX_RANGE)
    return send(res, 400, { error: `Ask for 1 to ${MAX_RANGE} blocks on mainnet or testnet.` });
  try {
    const [tip, blocks] = await Promise.all([tipHeight(net), getBlocks(net, start, end)]);
    // Blocks well below the tip don't change; let the CDN keep them.
    const settled = end < tip - 100;
    send(res, 200, { tip, blocks }, settled ? "public, max-age=3600, s-maxage=86400" : "public, max-age=15");
  } catch (e) {
    upstream(res, e);
  }
}
