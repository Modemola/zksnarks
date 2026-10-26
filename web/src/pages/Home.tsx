import { Link } from "react-router-dom";
import { CountUp, Reveal, useTilt } from "../components/motion";
import { ReceiptCheck } from "../components/ReceiptCheck";
import { Story } from "../components/Story";
import { Panel, Stamp, useTitle, Words } from "../components/ui";
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
        <HeroCard />
      </section>

      <ClaimAndCheck />

      <section>
        <div className="bento">
          <Reveal className="tile ink span-2 tall" i={0}>
            <div>
              <span className="label">What a receipt opens</span>
              <div className="big">
                <CountUp value={1} ms={900} /> payment
              </div>
              <p>Amount, recipient and note of one payment. Not the sender, not the balance, not the history.</p>
            </div>
          </Reveal>
          <Reveal className="tile glass span-2" i={1}>
            <div className="row">
              <div>
                <span className="label">Keys you hand over</span>
                <div className="mid">
                  <CountUp value={0} />
                </div>
                <p>Your viewing key never leaves your browser. The receipt holds no key at all.</p>
              </div>
              <div className="block3d" aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
            </div>
          </Reveal>
          <Reveal className="tile" i={2}>
            <span className="label">Blocks fetched per check</span>
            <div className="mid">
              <CountUp value={16} />
            </div>
            <p>a whole range, so no server learns which payment you checked</p>
          </Reveal>
          <Reveal className="tile" i={3}>
            <span className="label">Accounts or installs</span>
            <div className="mid">
              <CountUp value={0} />
            </div>
            <p>open the link; the check runs in the page</p>
          </Reveal>
        </div>
      </section>

      <Story
        label="How it works"
        eyebrow="How it works"
        title={
          <>
            Three steps. <em>One</em> payment shown.
          </>
        }
        steps={[
          {
            title: "Find the payment",
            text: "Paste your wallet's viewing key and the transaction ID. Your browser finds the payments you sent or received in it. The key stays on your device.",
            card: { label: "Step 1", value: "Found" },
          },
          {
            title: "Make the receipt",
            text: "Pick one payment. Unseal writes a receipt with just the facts that define it, plus the public transaction. Share it as a link or a file.",
            card: { label: "Step 2", value: "Sealed" },
          },
          {
            title: "Anyone checks it",
            text: "The recipient of the link opens it. Their browser decrypts that one payment, checks it against the chain, and shows what it proves.",
            card: { label: "Step 3", value: "Paid" },
          },
        ]}
      />

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
            <li>It works for Orchard payments (most of today's mainnet) and Ironwood (from the NU7 upgrade). Sapling is not supported yet.</li>
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

/** A receipt, drawn: one payment open, the rest sealed. Purely illustrative. */
function HeroCard() {
  const deck = useTilt<HTMLDivElement>();
  return (
    <div className="scene">
      <div className="deck-float">
        <div className="deck" ref={deck}>
          <div className="shadow" aria-hidden="true" />
          <div className="ghost g2" aria-hidden="true" />
          <div className="ghost g1" aria-hidden="true" />
          <div className="front">
            <Panel className="glass" eyebrow="Receipt" title="Invoice #1042" sub="One shielded payment, opened" serial="zr1…">
              <dl className="rows">
                <div>
                  <dt>Amount</dt>
                  <dd>2.5 ZEC</dd>
                </div>
                <div>
                  <dt>Paid to</dt>
                  <dd>u1f24h…frayp</dd>
                </div>
                <div>
                  <dt>Sender</dt>
                  <dd>Sealed</dd>
                </div>
                <div>
                  <dt>Other payments</dt>
                  <dd>Sealed</dd>
                </div>
              </dl>
              <p className="say">
                Checked against the chain <em>in your browser</em>.
              </p>
              <p className="small muted" style={{ margin: "0.5rem 0 0" }}>
                An illustration. <a href="#check">Check a real one below</a>.
              </p>
            </Panel>
          </div>
          <div className="float-stamp">
            <Stamp value="Paid" label="Verified" delay={1.5} />
          </div>
        </div>
      </div>
    </div>
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
          <p className="claim-score">{SAMPLE.claim.amount} ZEC</p>
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
