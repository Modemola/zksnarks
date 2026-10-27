import { Link } from "react-router-dom";
import { Reveal } from "../components/motion";
import { ReceiptCheck } from "../components/ReceiptCheck";
import { Slip } from "../components/Slip";
import { Panel, useTitle, Words } from "../components/ui";
import { SAMPLE } from "../lib/sample";

/**
 * The landing page, in the order a judge reads it: the problem (hero), the
 * proof they can run themselves, the figures, how it works, who it's for,
 * the fine print, and one call to action.
 */
export function Home() {
  useTitle();
  return (
    <>
      <section className="hero" style={{ marginTop: 0 }}>
        <div>
          <p className="eyebrow">Receipts for shielded Zcash payments</p>
          <h1>
            <Words text="Prove one payment. Keep the rest sealed." accent={["sealed."]} />
          </h1>
          <p className="lede">
            Your accountant, a shop or a court needs proof you paid. Today that means handing over a viewing key that opens your whole
            wallet. Unseal makes a receipt for one payment instead, and anyone can check it in their browser.
          </p>
          <div className="actions">
            <a className="btn" href="#check">
              Check a real receipt
            </a>
            <Link viewTransition className="btn secondary" to="/create">
              Make your own
            </Link>
          </div>
        </div>
        <Slip />
      </section>

      <ClaimAndCheck />

      <Reveal as="section">
        <div className="section-head">
          <p className="eyebrow">How it works</p>
          <h2>
            Sealed on chain. <em>Unsealed</em> for one reader.
          </h2>
          <p>A shielded transaction is a row of encrypted outputs. A receipt carries the facts that open exactly one of them.</p>
        </div>
        <div className="flow3">
          <Panel level={3} title="On chain: all sealed">
            <p>Anyone can see the transaction exists. Nobody can read its outputs.</p>
            <ul className="mini-ledger" aria-label="Outputs on chain">
              <li>
                <span>Output 1</span>
                <span className="redact" />
              </li>
              <li>
                <span>Output 2</span>
                <span className="redact" />
              </li>
              <li>
                <span>Sender</span>
                <span className="redact" />
              </li>
            </ul>
          </Panel>
          <div className="arrow" aria-hidden="true">
            →
          </div>
          <Panel level={3} title="The receipt: one key">
            <p>
              Made in your browser from your viewing key. It holds three facts about one output, and no key at all.
            </p>
            <ul className="mini-ledger" aria-label="What a receipt holds">
              <li>
                <span>Recipient</span>
                <span className="lit">u1egp0qx…</span>
              </li>
              <li>
                <span>Amount</span>
                <span className="lit">0.001 ZEC</span>
              </li>
              <li>
                <span>Seed</span>
                <span className="lit">32 bytes</span>
              </li>
            </ul>
          </Panel>
          <div className="arrow" aria-hidden="true">
            →
          </div>
          <Panel level={3} className="glass" title="Checked: one opened">
            <p>The reader's browser opens that output, matches it to the chain, and nothing else.</p>
            <ul className="mini-ledger" aria-label="What the reader sees">
              <li>
                <span>Output 1</span>
                <span className="redact" />
              </li>
              <li>
                <span>Output 2</span>
                <span className="lit">0.001 ZEC · Invoice #1042</span>
              </li>
              <li>
                <span>Sender</span>
                <span className="redact" />
              </li>
            </ul>
          </Panel>
        </div>
      </Reveal>

      <Reveal as="section">
        <div className="section-head">
          <p className="eyebrow">Who it's for</p>
          <h2>
            When privacy meets <em>paperwork</em>
          </h2>
          <p>Shielded payments are private by default. These are the moments someone still needs to see one of them.</p>
        </div>
        <div className="grid cols-3">
          {[
            ["Freelancers and shops", "Show a client the invoice was paid, with the invoice number in the note, without showing what else you earn."],
            ["Accounts and tax", "Give an accountant or auditor a receipt per payment, instead of a key that shows every transaction you have ever made."],
            ["Disputes and refunds", "Settle \"I never received it\" with a check anyone can run, from a link."],
            ["Donations and grants", "Prove a donation reached the cause's address while the donor's wallet stays private."],
            ["Payroll", "An employee can show a landlord one salary payment without exposing the employer's books."],
            ["Exchanges and support desks", "Confirm a deposit someone says they sent, without asking for their keys."],
          ].map(([t, p]) => (
            <Panel key={t} className="quiet" level={3} title={t}>
              <p className="small" style={{ margin: 0, color: "var(--ink-secondary)" }}>
                {p}
              </p>
            </Panel>
          ))}
        </div>
      </Reveal>

      <Reveal as="section">
        <Panel eyebrow="Read a receipt fairly" title="What a receipt proves, and what it doesn't" className="quiet">
          <ul className="small" style={{ margin: 0, paddingLeft: "1.1rem", color: "var(--ink-secondary)" }}>
            <li>
              It proves that an amount, with a note, was paid to an address in a mined transaction. It doesn't say who paid: anyone holding the
              receipt can show it, so treat it like a paper receipt.
            </li>
            <li>
              To be sure it paid <em>you</em>, compare the address. The check page does this for you if you paste the address you published.
            </li>
            <li>
              The check asks a Zcash server, through our relay, for a range of blocks. It trusts that server to report the chain honestly, as
              a light wallet does. Run your own relay to remove us from that path.
            </li>
            <li>It works for Orchard and Ironwood payments, the two pools wallets use for unified addresses. Sapling is not supported yet.</li>
          </ul>
        </Panel>
      </Reveal>

      <Reveal as="section">
        <div className="panel closing">
          <p className="eyebrow">Try it</p>
          <h2>
            Make a receipt for your <em>own</em> payment
          </h2>
          <p>You need a shielded wallet that shows its viewing key, and the ID of a transaction. It takes about a minute.</p>
          <div className="actions">
            <Link viewTransition className="btn" to="/create">
              Make a receipt
            </Link>
            <Link viewTransition className="btn secondary" to="/how">
              How it works
            </Link>
          </div>
        </div>
      </Reveal>
    </>
  );
}

/** A real receipt next to the action that proves it, run in the visitor's own browser. */
function ClaimAndCheck() {
  return (
    <section id="check">
      <div className="section-head">
        <p className="eyebrow">Don't take our word for it</p>
        <h2>
          Check a real receipt <em>yourself</em>
        </h2>
        <p>This is a receipt for a real payment on Zcash mainnet. Checking it needs no account and sends nothing about you anywhere.</p>
      </div>
      <div className="check-grid">
        <div className="panel quiet claim">
          <p className="eyebrow">The claim</p>
          <p className="claim-score">
            {SAMPLE.claim.amount}
            <small>ZEC</small>
          </p>
          <p className="claim-what">
            was paid to <strong>{SAMPLE.claim.to}</strong> with the note <em>"{SAMPLE.claim.memo}"</em>, in a shielded transaction on
            mainnet.
          </p>
          <p className="small" style={{ margin: 0 }}>
            <Link viewTransition to={`/check#${SAMPLE.receipt}`}>
              Open it on the check page
            </Link>
          </p>
        </div>
        <ReceiptCheck
          receipt={SAMPLE.receipt}
          title="The check"
          eyebrow="In your browser"
          intro={<>Reads the receipt, opens the one payment it names, and confirms the transaction is on the chain. A few seconds; nothing to install.</>}
        />
      </div>
    </section>
  );
}
