import { useEffect, useId, useState } from "react";
import { Link } from "react-router-dom";
import { ReceiptCheck } from "../components/ReceiptCheck";
import { PageHead, Panel, useTitle } from "../components/ui";
import { brand } from "../brand";
import { addressMatches, warmEngine, type Checked } from "../lib/receipts";
import { FORGED, SAMPLE } from "../lib/sample";

const fromHash = () => (typeof location === "undefined" ? "" : decodeURIComponent(location.hash.slice(1)));

/** Check a receipt from a link (after #) or pasted in. */
export function CheckPage() {
  useTitle("Check a receipt");
  const [text, setText] = useState("");
  const [active, setActive] = useState("");
  const [fromLink, setFromLink] = useState(false);
  const [result, setResult] = useState<Checked | null>(null);
  useEffect(warmEngine, []);
  // The tab says what was proved, so a verified receipt reads at a glance.
  useEffect(() => {
    if (result) document.title = `Paid ${result.valueZec} ZEC · ${brand.name}`;
  }, [result]);

  // A receipt in the link is checked straight away. Read after the first render,
  // so the pre-rendered page and the browser agree.
  useEffect(() => {
    const read = () => {
      const h = fromHash();
      if (h) {
        setText(h);
        setActive(h);
        setFromLink(true);
      }
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  const trimmed = text.trim();
  const looksRight = trimmed.startsWith("zr1") || trimmed.includes("#zr1");
  const [source, setSource] = useState("The receipt you pasted");
  const submit = () => {
    setResult(null);
    setFromLink(false);
    setSource("The receipt you pasted");
    setActive(trimmed);
  };
  /** One click to see it work, for anyone without a receipt to hand. */
  const tryOne = (receipt: string, label: string) => {
    setResult(null);
    setFromLink(false);
    setSource(label);
    setText(receipt);
    setActive(receipt);
  };
  const tryButtons = (
    <div className="try">
      <span className="small muted">No receipt to hand?</span>
      <button type="button" className="btn small secondary" onClick={() => tryOne(SAMPLE.receipt, "The demo receipt")}>
        Try the demo receipt
      </button>
      <button type="button" className="btn small secondary" onClick={() => tryOne(FORGED.receipt, "A forged copy: amount raised to 1 ZEC")}>
        Try a forged copy
      </button>
    </div>
  );

  return (
    <>
      <PageHead eyebrow="Check a receipt" title={<>Was it <em>really</em> paid?</>}>
        Paste a receipt or open a receipt link. Your browser checks it against the Zcash chain and shows the one payment it proves. Nothing
        you paste here leaves the page except a request for a range of public blocks.
      </PageHead>
      <section className="split" style={{ marginTop: 0 }}>
        <div className="stack">
          {active ? (
            <ReceiptCheck
              key={active}
              receipt={active}
              autoStart
              eyebrow={fromLink ? "From the link you opened" : source}
              title="The check"
              onResult={setResult}
            />
          ) : (
            <Panel eyebrow="Step 1" title="Paste the receipt">
              <ReceiptInput text={text} setText={setText} looksRight={looksRight} onSubmit={submit} />
              {tryButtons}
            </Panel>
          )}
          {active && (
            <details className="more">
              <summary>Check a different receipt</summary>
              <ReceiptInput text={text} setText={setText} looksRight={looksRight} onSubmit={submit} />
              {tryButtons}
            </details>
          )}
        </div>
        <aside className="stack">
          <MatchAddress receipt={active} result={result} />
          <Panel className="quiet" eyebrow="What a receipt is">
            <p className="small" style={{ margin: 0, color: "var(--ink-secondary)" }}>
              A receipt opens one payment in one shielded transaction: its amount, the address it paid and its note. It doesn't show the
              sender or anything else in their wallet, and it can't be used to follow the money afterwards.{" "}
              <Link viewTransition to="/how">
                How it works
              </Link>
            </p>
          </Panel>
          <Panel className="quiet" eyebrow="Need a receipt?">
            <p className="small" style={{ marginTop: 0, color: "var(--ink-secondary)" }}>
              Ask whoever paid you to make one, or make one for a payment you sent or received.
            </p>
            <Link viewTransition className="btn secondary block" to="/create">
              Make a receipt
            </Link>
          </Panel>
        </aside>
      </section>
    </>
  );
}

function ReceiptInput({ text, setText, looksRight, onSubmit }: { text: string; setText: (s: string) => void; looksRight: boolean; onSubmit: () => void }) {
  const id = useId().replace(/:/g, "");
  const showHint = text.trim().length > 0 && !looksRight;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (looksRight) onSubmit();
      }}
    >
      <label className="field">
        <span id={`${id}-label`}>Receipt or receipt link</span>
        <textarea
          className="receipt-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="zr1… or https://…/check#zr1…"
          aria-labelledby={`${id}-label`}
          spellCheck={false}
          autoComplete="off"
          aria-invalid={showHint}
          aria-describedby={`${id}-help`}
        />
        <small id={`${id}-help`} className={showHint ? "bad" : ""}>
          {showHint ? "Receipts start with zr1. Paste the whole thing; line breaks are fine." : "Receipts start with zr1 and are long; that's the transaction inside."}
        </small>
      </label>
      <button className="btn block" type="submit" disabled={!looksRight}>
        Check it
      </button>
    </form>
  );
}

/** "Was this paid to me?": compares the receipt's recipient with an address the reader published. */
function MatchAddress({ receipt, result }: { receipt: string; result: Checked | null }) {
  const [address, setAddress] = useState("");
  const [match, setMatch] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    const a = address.trim();
    if (!receipt || !result || a.length < 20) {
      setMatch(null);
      return;
    }
    addressMatches(a, receipt).then((m) => live && setMatch(m));
    return () => {
      live = false;
    };
  }, [address, receipt, result]);
  return (
    <Panel className="glass" eyebrow="Optional" title="Was it paid to you?" level={2}>
      <label className="field" style={{ marginBottom: 0 }}>
        <span id="match-label">Your Zcash address</span>
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="u1…"
          aria-labelledby="match-label"
          spellCheck={false}
          autoComplete="off"
          aria-describedby="match-help"
        />
        <small id="match-help" className={match === false ? "bad" : ""}>
          {!result
            ? "After the check passes, paste the unified address you gave the payer."
            : match === null
              ? "Paste the unified address you gave the payer. It is compared in this page only."
              : match
                ? "Yes. This payment went to your address."
                : "No. This payment did not go to that address. Check you pasted the address you gave the payer."}
        </small>
      </label>
      {match && (
        <p className="status good" style={{ marginTop: "0.6rem" }}>
          Paid to you
        </p>
      )}
    </Panel>
  );
}
