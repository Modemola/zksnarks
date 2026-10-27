import type React from "react";
import { Link } from "react-router-dom";
import { Reveal } from "../components/motion";
import { WaxSeal } from "../components/WaxSeal";
import { PageHead, Panel, useTitle } from "../components/ui";

/** The explainer: three promises, the steps, what a receipt holds, why it can't lie, and the trust model. */
export function HowPage() {
  useTitle("How it works");
  return (
    <>
      <PageHead eyebrow="How it works" title={<>Small enough to share, <em>hard to fake</em></>} art={<WaxSeal size={180} />}>
        A receipt holds the three facts that define one shielded payment, plus the public transaction it sits in. With those, anyone's
        browser can open that payment and nothing else, and check it against the chain.
      </PageHead>
      <div className="points">
        {[
          ["1", "One payment, opened", "The receipt unlocks a single payment: its amount, the address it paid and its note. Every other payment stays encrypted."],
          ["2", "No keys handed over", "Making a receipt reads your viewing key in your browser. The receipt itself contains no key, so it can't show your history or your balance."],
          ["3", "Checked by anyone", "The check runs in the reader's browser against public chain data. They don't have to trust you, or us, about what the receipt says."],
        ].map(([n, t, p]) => (
          <div key={n}>
            <span className="n">{n}</span>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 400, margin: "0.95rem 0 0.5rem" }}>{t}</h2>
            <p>{p}</p>
          </div>
        ))}
      </div>

      <section className="split">
        <div className="stack">
          <Reveal>
            <Panel eyebrow="Step by step" title="What happens">
              <ol className="flow">
                {[
                  ["You find the payment", "Your browser downloads the public transaction and tries your viewing key on each payment in it. It recognises the ones you received, and, with the outgoing part of the key, the ones you sent."],
                  ["You make the receipt", "For the payment you pick, the receipt records the recipient's address, the amount and the payment's random seed, next to the whole transaction. It starts with zr1 and fits in a link."],
                  ["They open the link", "The receipt sits after the # in the link. Browsers never send that part to a server, so the receipt reaches only the person you gave it to."],
                  ["Their browser checks it", "It works out the transaction ID from the transaction's bytes, rebuilds the payment from the three facts, decrypts it, and confirms the transaction is in the block the receipt names."],
                ].map(([t, p], i) => (
                  <li key={t} style={{ "--i": i } as React.CSSProperties}>
                    <strong>{t}</strong>
                    <p>{p}</p>
                  </li>
                ))}
              </ol>
            </Panel>
          </Reveal>

          <Reveal>
            <Panel eyebrow="Why it can't lie" title="Change one detail and the check fails">
              <p className="small" style={{ marginTop: 0, color: "var(--ink-secondary)" }}>
                Every shielded payment is recorded on chain as a commitment: a fingerprint of its recipient, amount and two random values. One
                of those values is public; the receipt carries the other. Your browser rebuilds the payment from the receipt, derives the key
                that encrypted it, decrypts it, and compares the result with the commitment.
              </p>
              <ul className="small" style={{ margin: 0, paddingLeft: "1.1rem", color: "var(--ink-secondary)" }}>
                <li>A higher amount gives a different fingerprint, so the receipt is rejected.</li>
                <li>A different address can't decrypt the payment at all.</li>
                <li>Pointing the receipt at another payment in the same transaction fails the same way.</li>
                <li>Editing the transaction's payment data changes its ID, which then isn't in the block. (Its proofs and signatures sit outside the ID by Zcash's design; the network checked them when it mined it, and they change nothing the receipt states.)</li>
              </ul>
              <details className="more">
                <summary>The cryptography, for the curious</summary>
                <p className="small" style={{ color: "var(--ink-secondary)" }}>
                  An Orchard or Ironwood note is (address, value, ρ, rseed). ρ is the action's nullifier, public on chain. Since ZIP 212 the
                  ephemeral secret esk is derived from rseed and ρ, so the checker computes esk, the shared secret with the address's
                  transmission key, and the symmetric key; decrypts the 580-byte note ciphertext; and the library confirms the decrypted note
                  commits to the on-chain cmx and that esk reproduces the published ephemeral key. The note is then compared in full with
                  the claimed one. The transaction ID is recomputed with ZIP 244 from the raw bytes. Disclosing rseed does not reveal the
                  nullifier, which needs the recipient's nullifier key, so a receipt can't be used to see when the note is spent. This is the
                  output half of what ZIP 311 (payment disclosures, still a draft) describes.
                </p>
              </details>
            </Panel>
          </Reveal>

          <Reveal>
            <Panel eyebrow="Inside a receipt" title="What the zr1… text holds">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Part</th>
                      <th scope="col">Size</th>
                      <th scope="col">Why</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Format version, network, pool", "3 bytes", "Mainnet or testnet; Orchard or Ironwood"],
                      ["Block height", "4 bytes", "Where to look for the transaction"],
                      ["Payment number", "2 bytes", "Which payment in the transaction"],
                      ["Recipient address", "43 bytes", "Who was paid"],
                      ["Amount", "8 bytes", "How much, in zatoshis"],
                      ["Random seed", "32 bytes", "Opens this payment and no other"],
                      ["The transaction", "about 9 to 20 KB", "Public data; lets the checker work offline until the last step"],
                    ].map(([a, b, c]) => (
                      <tr key={a}>
                        <td>{a}</td>
                        <td>{b}</td>
                        <td>{c}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </Reveal>

          <Reveal>
            <section id="developers" style={{ margin: 0 }}>
              <Panel eyebrow="For developers" title="Use it in your wallet or shop">
                <p className="small" style={{ marginTop: 0, color: "var(--ink-secondary)" }}>
                  The receipt engine is a small Rust library, <code>zreceipt</code>, built on the official <code>orchard</code>,{" "}
                  <code>zcash_primitives</code> and <code>zcash_note_encryption</code> crates. The same code runs natively and in the browser as
                  WebAssembly.
                </p>
                <pre>
                  <code>{`// Make receipts for what a viewing key sent or received
let found = zreceipt::find_payments(ufvk, &raw_tx, height)?;
let link = format!("https://…/check#{}", found[0].receipt.encode());

// Check one
let receipt = zreceipt::Receipt::decode(text)?;
let proven = zreceipt::verify(&receipt)?;   // amount, recipient, memo, txid
// then confirm proven.txid is in block proven.height`}</code>
                </pre>
                <p className="small" style={{ color: "var(--ink-secondary)" }}>
                  From a terminal, the <code>unseal</code> command does the same, with <code>--json</code> for scripts and payment systems:
                </p>
                <pre>
                  <code>{`unseal create --key uview1… --txid 3f9c…   # receipts for what you sent or received
unseal check receipt.txt --address u1…      # verify, and confirm it paid your address
unseal inspect zr1…                          # read without checking`}</code>
                </pre>
                <p className="small" style={{ color: "var(--ink-secondary)" }}>
                  The relay the site uses is three stateless functions over a public lightwalletd server: <code>GET /api/tip</code>,{" "}
                  <code>GET /api/blocks?network=&amp;start=&amp;end=</code> (up to 32 blocks) and <code>POST /api/tx</code>. Deploy your own
                  copy to take this site out of the path entirely.
                </p>
                <p className="small" style={{ margin: 0 }}>
                  <a href="https://github.com/modemola/zksnarks">Source code and documentation</a>
                </p>
              </Panel>
            </section>
          </Reveal>
        </div>
        <aside className="stack">
          <Panel className="quiet" eyebrow="What you have to trust">
            <ul className="small" style={{ margin: 0, paddingLeft: "1.1rem", color: "var(--ink-secondary)" }}>
              <li>
                <strong>The cryptography:</strong> the official Zcash libraries, unchanged.
              </li>
              <li>
                <strong>The chain data:</strong> a public lightwalletd server, reached through our relay, says which transactions are in which
                block. A light wallet trusts the same thing. The relay only ever sees a range of 16 blocks.
              </li>
              <li>
                <strong>Making a receipt:</strong> the relay sees the transaction ID you ask for, as any block explorer would. It is sent in
                the request body, not the address, and nothing is stored.
              </li>
              <li>
                <strong>Not proved:</strong> who sent the payment. A receipt is like a paper receipt: whoever holds it can show it.
              </li>
            </ul>
          </Panel>
          <Panel className="quiet" eyebrow="Supported today">
            <ul className="small" style={{ margin: 0, paddingLeft: "1.1rem", color: "var(--ink-secondary)" }}>
              <li>Orchard payments, mainnet and testnet</li>
              <li>Ironwood payments, mainnet and testnet: where wallets now put new shielded funds</li>
              <li>Not yet: Sapling and transparent payments</li>
            </ul>
          </Panel>
          <Panel className="quiet" eyebrow="Ready?">
            <Link viewTransition className="btn block" to="/create">
              Make a receipt
            </Link>
            <Link viewTransition className="btn secondary block" style={{ marginTop: "0.6rem" }} to="/check">
              Check a receipt
            </Link>
          </Panel>
        </aside>
      </section>
    </>
  );
}
