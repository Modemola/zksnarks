import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { friendlyError } from "../lib/errors";
import { checkReceipt, freshSteps, memoText, short, type Checked, type Step } from "../lib/receipts";
import { Panel, Plain, Stamp } from "./ui";

/**
 * The signature moment: one click checks a receipt in the visitor's browser,
 * step by step, then shows the one payment it opened beside the ones that
 * stay sealed, and says in plain words what was proved and what wasn't.
 */
export function ReceiptCheck({
  receipt,
  title = "Check it yourself",
  eyebrow = "Don't take our word for it",
  intro,
  button = "Check this receipt",
  autoStart = false,
  onResult,
}: {
  receipt: string;
  title?: string;
  eyebrow?: string;
  intro?: ReactNode;
  button?: string;
  autoStart?: boolean;
  onResult?: (r: Checked | null) => void;
}) {
  const [steps, setSteps] = useState<Step[]>(freshSteps);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Checked | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const started = useRef(false);

  const start = async () => {
    setErr(null);
    setResult(null);
    onResult?.(null);
    setRunning(true);
    setSteps(freshSteps());
    try {
      const r = await checkReceipt(receipt, setSteps);
      setResult(r);
      onResult?.(r);
    } catch (e) {
      setErr(friendlyError(e));
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    if (autoStart && !started.current && receipt) {
      started.current = true;
      void start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, receipt]);

  const begun = running || result || err;
  return (
    <Panel className="glass" eyebrow={eyebrow} title={title}>
      {intro && (
        <p className="small" style={{ color: "var(--ink-secondary)" }}>
          {intro}
        </p>
      )}
      <button className="btn block" onClick={start} disabled={running || !receipt}>
        {running ? "Checking…" : result || err ? "Check again" : button}
      </button>
      {begun && (
        <ol className="check-steps" aria-label="Steps of the check">
          {steps.map((s) => (
            <li key={s.id} className={s.state}>
              <span className="mark" aria-hidden="true" />
              <span className="sr-only">{{ waiting: "Waiting:", running: "Working:", done: "Done:", failed: "Failed:" }[s.state]}</span>
              <span className="what">{s.label}</span>
              {s.detail && <span className="detail">{s.id === "txid" && s.state === "done" ? short(s.detail, 14, 10) : s.detail}</span>}
            </li>
          ))}
        </ol>
      )}
      {err && (
        <div className="note critical" role="alert" style={{ margin: "0.9rem 0 0" }}>
          <strong>This receipt did not check out.</strong> {err}
        </div>
      )}
      {result && <Outcome r={result} />}
    </Panel>
  );
}

/** The opened payment beside the sealed ones, the stamp, and the facts. */
function Outcome({ r }: { r: Checked }) {
  const others = r.actionCount - 1;
  return (
    <>
      <div className="outputs" aria-hidden="true">
        {Array.from({ length: r.actionCount }, (_, k) => (
          <span key={k} className={`out ${k === r.actionIndex ? "open" : "sealed"}`} style={{ "--d": `${(k * 0.08).toFixed(2)}s` } as CSSProperties}>
            {k === r.actionIndex ? `${r.valueZec} ZEC` : "Sealed"}
          </span>
        ))}
      </div>
      <div className="vseal">
        <Stamp value="Paid" label="checked in your browser" delay={0.5} />
        <span className="small muted">
          One payment opened{others > 0 ? `; ${others} other${others === 1 ? "" : "s"} in the same transaction stay sealed` : ""}.
        </span>
      </div>
      <div className="note good" role="status" style={{ margin: "0.9rem 0 0" }}>
        <strong>
          {r.valueZec} ZEC was paid to this address{r.memo.kind === "text" ? `, with the note "${r.memo.text}"` : ""}.
        </strong>{" "}
        Mined in block {r.height.toLocaleString("en-US")} on Zcash {r.network}, {r.confirmations.toLocaleString("en-US")} confirmation
        {r.confirmations === 1 ? "" : "s"} ago.
      </div>
      <dl className="rows receipt-facts">
        <div>
          <dt>Amount</dt>
          <dd>{r.valueZec} ZEC</dd>
        </div>
        <div>
          <dt>Paid to</dt>
          <dd>
            <Plain value={r.recipient} />
          </dd>
        </div>
        <div>
          <dt>Note (memo)</dt>
          <dd className="memo">{memoText(r.memo)}</dd>
        </div>
        <div>
          <dt>Transaction</dt>
          <dd>
            <Plain value={r.txid} />
          </dd>
        </div>
        <div>
          <dt>Block</dt>
          <dd>
            {r.height.toLocaleString("en-US")}
            {r.block.time ? `, ${new Date(r.block.time * 1000).toISOString().slice(0, 16).replace("T", " ")} UTC` : ""}
          </dd>
        </div>
        <div>
          <dt>Shielded pool</dt>
          <dd>{r.pool}</dd>
        </div>
      </dl>
      <div className="verify-explain">
        <p className="eyebrow">What just happened</p>
        <ol className="explain-steps">
          <li>
            <strong>The receipt carried the whole transaction.</strong> Your browser worked out its ID from the bytes themselves, so the
            payment data can't have been swapped or edited.
          </li>
          <li>
            <strong>It opened exactly one payment.</strong> The receipt holds the three facts that define that payment. Your browser rebuilt
            it and decrypted it; this only works if every detail matches the encrypted record on chain.
          </li>
          <li>
            <strong>It confirmed the transaction was mined.</strong> It fetched blocks {r.range[0].toLocaleString("en-US")} to{" "}
            {r.range[1].toLocaleString("en-US")} and found this ID in block {r.height.toLocaleString("en-US")}. The server it asked saw a
            range of blocks, not which payment you were checking.
          </li>
        </ol>
        <p className="eyebrow" style={{ marginTop: "1rem" }}>
          What stayed private
        </p>
        <ul className="small" style={{ margin: 0, paddingLeft: "1.1rem", color: "var(--ink-secondary)" }}>
          <li>Who sent it: the receipt names no sender address and no wallet.</li>
          <li>{others > 0 ? `The other ${others} payment${others === 1 ? "" : "s"} in this transaction.` : "Every other payment in the wallet."}</li>
          <li>Whether or when the recipient spent it: the receipt can't be used to follow the money.</li>
        </ul>
      </div>
    </>
  );
}
