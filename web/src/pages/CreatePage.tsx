import { useState } from "react";
import { Link } from "react-router-dom";
import { PageHead, Panel, Plain, useTitle } from "../components/ui";
import { friendlyError } from "../lib/errors";
import { engine, findPayments, keyNetwork, memoText, receiptLink, type Payment } from "../lib/receipts";
import { useToasts } from "../lib/toasts";

const KEY_RE = /^uview(test)?1[02-9ac-hj-np-z]+$/;
const TXID_RE = /^[0-9a-fA-F]{64}$/;

function problems(key: string, txid: string) {
  const p: { key?: string; txid?: string } = {};
  const k = key.trim();
  if (!k) p.key = "Paste your wallet's unified full viewing key.";
  else if (k.startsWith("uivk")) p.key = "That is an incoming viewing key. Use the full viewing key (uview…), which can also find payments you sent.";
  else if (k.startsWith("zxview") || k.startsWith("zviews")) p.key = "That is a Sapling-only key. Receipts need a unified key (uview…) with an Orchard part.";
  else if (!KEY_RE.test(k)) p.key = "A unified full viewing key starts with uview1 (mainnet) or uviewtest1 (testnet).";
  const t = txid.trim();
  if (!t) p.txid = "Paste the transaction ID from your wallet's history.";
  else if (!TXID_RE.test(t)) p.txid = `A transaction ID is 64 characters of 0-9 and a-f (${t.length} now).`;
  return p;
}

/** Find the payments a viewing key can see in a transaction, then make a receipt for one. */
export function CreatePage() {
  useTitle("Make a receipt");
  const [key, setKey] = useState("");
  const [txid, setTxid] = useState("");
  const [touched, setTouched] = useState<{ key?: boolean; txid?: boolean }>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [found, setFound] = useState<{ height: number; payments: Payment[] } | null>(null);
  const toasts = useToasts();
  const p = problems(key, txid);
  const shown = (k: "key" | "txid") => (touched[k] ? p[k] : undefined);

  const submit = async () => {
    setTouched({ key: true, txid: true });
    if (p.key || p.txid) return;
    setBusy(true);
    setErr(null);
    setFound(null);
    try {
      await engine();
      await keyNetwork(key);
      setFound(await findPayments(key, txid));
    } catch (e) {
      setErr(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const copy = (text: string, what: string) =>
    navigator.clipboard?.writeText(text).then(
      () => toasts.start(what)("Done", "Copied to the clipboard."),
      () => toasts.start(what)("Failed", "Your browser blocked the clipboard. Select the text and copy it instead."),
    );

  const download = (p: Payment) => {
    const blob = new Blob([p.receipt + "\n"], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `zcash-receipt-${txid.trim().slice(0, 8)}-${p.actionIndex + 1}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <>
      <PageHead eyebrow="Make a receipt" title={<>One payment, <em>nothing else</em></>}>
        Find a payment you sent or received, then share a receipt for it. Your viewing key is read in this page and never sent anywhere.
      </PageHead>
      <section className="split" style={{ marginTop: 0 }}>
        <div className="stack">
          <Panel eyebrow="Step 1" title="Find the payment" sub="Both come from your wallet's settings and history.">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <label className="field">
                <span>Unified full viewing key</span>
                <textarea
                  className="receipt-input"
                  style={{ minHeight: "5rem" }}
                  value={key}
                  onChange={(e) => {
                    setKey(e.target.value);
                    setTouched((t) => ({ ...t, key: true }));
                  }}
                  placeholder="uview1…"
                  spellCheck={false}
                  autoComplete="off"
                  aria-invalid={!!shown("key")}
                  aria-describedby="key-help"
                />
                <small id="key-help" className={shown("key") ? "bad" : ""}>
                  {shown("key") ?? "It can see your payments but cannot spend. It stays in this page; only the transaction ID below is sent, to fetch the public transaction."}
                </small>
              </label>
              <label className="field">
                <span>Transaction ID</span>
                <input
                  type="text"
                  value={txid}
                  onChange={(e) => {
                    setTxid(e.target.value);
                    setTouched((t) => ({ ...t, txid: true }));
                  }}
                  placeholder="64 characters, 0-9 and a-f"
                  spellCheck={false}
                  autoComplete="off"
                  aria-invalid={!!shown("txid")}
                  aria-describedby="txid-help"
                />
                <small id="txid-help" className={shown("txid") ? "bad" : ""}>
                  {shown("txid") ?? "In your wallet, open the payment and copy its transaction ID."}
                </small>
              </label>
              <button className="btn block" type="submit" disabled={busy}>
                {busy ? "Looking…" : "Find my payments"}
              </button>
            </form>
            {err && (
              <div className="note critical" role="alert" style={{ marginTop: "0.9rem" }}>
                {err} Nothing was saved or shared.
              </div>
            )}
          </Panel>

          {found && (
            <Panel eyebrow="Step 2" title={found.payments.length ? "Choose the payment" : "No payments found"}>
              {found.payments.length === 0 ? (
                <p className="small" style={{ margin: 0, color: "var(--ink-secondary)" }}>
                  This key didn't send or receive any Orchard or Ironwood payment in that transaction. Check that the key is from the wallet that
                  made or got the payment. Sapling payments are not supported yet.
                </p>
              ) : (
                <ul className="payments">
                  {found.payments.map((pay) => (
                    <li key={`${pay.pool}-${pay.actionIndex}`}>
                      <div className="top">
                        <span className="amount">{pay.valueZec} ZEC</span>
                        <span className={`status ${pay.direction === "received" ? "good" : "muted"}`}>
                          {pay.direction === "received" ? "You received" : "You sent"}
                        </span>
                      </div>
                      <dl className="rows">
                        <div>
                          <dt>To</dt>
                          <dd>
                            <Plain value={pay.recipient} />
                          </dd>
                        </div>
                        <div>
                          <dt>Note</dt>
                          <dd style={{ fontStyle: "italic" }}>{memoText(pay.memo)}</dd>
                        </div>
                        <div>
                          <dt>Pool</dt>
                          <dd>{pay.pool}</dd>
                        </div>
                      </dl>
                      <span className="link-box">{receiptLink(pay.receipt)}</span>
                      <div className="actions">
                        <button type="button" className="btn small" onClick={() => copy(receiptLink(pay.receipt), "Copying the receipt link")}>
                          Copy link
                        </button>
                        <button type="button" className="btn small secondary" onClick={() => download(pay)}>
                          Download
                        </button>
                        <Link className="btn small secondary" to={`/check#${pay.receipt}`}>
                          Check it now
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}
        </div>
        <aside className="stack">
          <Panel className="glass" eyebrow="What you share" title="Exactly this">
            <dl className="rows">
              <div>
                <dt>Amount and note</dt>
                <dd>Shown</dd>
              </div>
              <div>
                <dt>Address paid</dt>
                <dd>Shown</dd>
              </div>
              <div>
                <dt>Your viewing key</dt>
                <dd>Never</dd>
              </div>
              <div>
                <dt>Other payments</dt>
                <dd>Sealed</dd>
              </div>
              <div className="total">
                <dt>Cost</dt>
                <dd>Free</dd>
              </div>
            </dl>
            <p className="risk">
              A receipt can't be taken back once shared: anyone with it can see that one payment. It never lets anyone spend or watch your
              wallet.
            </p>
          </Panel>
          <Panel className="quiet" eyebrow="Where to find the key">
            <p className="small" style={{ margin: 0, color: "var(--ink-secondary)" }}>
              Most shielded wallets can export a unified full viewing key (it starts with <code>uview1</code>), usually under settings or
              backup. Developers can use <code>zcash-devtool</code> or the <code>zreceipt</code> library directly.{" "}
              <Link viewTransition to="/how#developers">
                For developers
              </Link>
            </p>
          </Panel>
        </aside>
      </section>
    </>
  );
}
