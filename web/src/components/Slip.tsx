import { SAMPLE } from "../lib/sample";
import { WaxSeal } from "./WaxSeal";

/**
 * The hero: a paper receipt for the real demo payment. The facts a receipt
 * opens are printed; everything it keeps sealed is blacked out.
 */
export function Slip() {
  return (
    <figure className="slip-wrap" aria-label="An Unseal receipt for a real mainnet payment">
      <div className="slip">
        <div className="slip-head">
          <span className="slip-brand">Unseal</span>
          <span className="slip-no">Receipt · zr1</span>
        </div>
        <p className="slip-title">Payment receipt</p>
        <dl className="slip-lines">
          <div>
            <dt>Amount</dt>
            <dd>{SAMPLE.claim.amount} ZEC</dd>
          </div>
          <div>
            <dt>Paid to</dt>
            <dd>{SAMPLE.claim.to}</dd>
          </div>
          <div>
            <dt>Note</dt>
            <dd>{SAMPLE.claim.memo}</dd>
          </div>
          <div>
            <dt>Block</dt>
            <dd>3,531,890 · mainnet</dd>
          </div>
          <div className="sealed">
            <dt>Sender</dt>
            <dd>
              <span className="redact" style={{ width: "62%" }} />
            </dd>
          </div>
          <div className="sealed">
            <dt>Other outputs</dt>
            <dd>
              <span className="redact" style={{ width: "48%" }} />
            </dd>
          </div>
          <div className="sealed">
            <dt>Wallet balance</dt>
            <dd>
              <span className="redact" style={{ width: "55%" }} />
            </dd>
          </div>
        </dl>
        <div className="slip-foot">
          <WaxSeal size={64} />
          <p>
            One payment shown.
            <br />
            Everything else sealed.
          </p>
        </div>
      </div>
      <figcaption className="small muted">
        A real shielded payment on Zcash mainnet. <a href="#check">Check it yourself</a>.
      </figcaption>
    </figure>
  );
}
