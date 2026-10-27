import { tipHeight } from "./_lib/lwd.js";
import { network, query, send, upstream, type Req, type Res } from "./_lib/http.js";

/** GET /api/tip?network=mainnet: the current block height. */
export default async function handler(req: Req, res: Res) {
  const net = network(query(req).get("network"));
  if (!net) return send(res, 400, { error: "Choose mainnet or testnet." });
  try {
    send(res, 200, { tip: await tipHeight(net) }, "public, max-age=15");
  } catch (e) {
    upstream(res, e);
  }
}
