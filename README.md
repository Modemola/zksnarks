# Unseal

**Receipts for shielded Zcash payments: prove one payment to anyone, keep everything else private.**

Shielded Zcash payments are private by default, which is the point. But people regularly need to show *one* payment: to an
accountant, an auditor, a client who says the invoice is unpaid, a support desk, a court. Today the only tool is a viewing key,
and a viewing key opens the whole wallet: every payment, past and future. So people either overshare or can't prove anything.

Unseal makes a **receipt for one payment**. Anyone can check it in their browser, against the chain, in a few seconds. It shows
that payment's amount, recipient and memo, and nothing else: not the sender, not the other payments in the transaction, not the
balance, not the history. It implements the output side of [ZIP 311 (Zcash Payment Disclosures)](https://zips.z.cash/zip-0311),
which has been a draft with no shipping implementation.

> Live site: https://unseall.vercel.app · Demo video: _add link_ · Track: 04 Core & Tooling

---

## Try it in two minutes

| Do this | You'll see |
|---|---|
| Open the site and press **Check this receipt** | A real mainnet receipt checked step by step in your browser: transaction ID rebuilt from its bytes, one payment opened, matched to the on-chain commitment, found in its block. The opened payment sits beside the sealed ones, then "What just happened" and "What stayed private". |
| Open **Check a receipt** and paste your own address into "Was it paid to you?" | The page says whether the receipt's payment went to that address. |
| Flip the switch to **Forged copy** (the same receipt with the amount raised to 1 ZEC) | The check fails at "Match it to the commitment", and the page says so plainly. |
| Open **Make a receipt** and press **Try it with the demo wallet** (or paste your own `uview1…` key and a transaction ID) | The payments that key sent or received, each with a link, a file download and a check button. The key never leaves the page. |
| `unseal check <receipt>` in a terminal | The same check from the CLI, with `--json` for scripts. |

## How it works

```
 sender's or recipient's wallet                         anyone
 ─────────────────────────────                         ──────
 viewing key + txid ──► find payments (in browser)
                         │
                         ▼
          receipt = recipient · value · rseed · raw tx  ──link──►  check (in browser)
                                                                    │ 1. txid = ZIP 244 hash of the raw tx
                                                                    │ 2. rebuild the note, derive esk (ZIP 212)
                                                                    │ 3. decrypt that one output; compare with cmx
                                                                    │ 4. fetch a 16-block window ─► relay ─► lightwalletd
                                                                    ▼    txid in block?  ──►  PAID
```

1. **Find.** You paste your viewing key and a transaction ID. The page downloads the public transaction and tries the key on each
   output: the incoming key finds payments you received, the outgoing key finds payments you sent. The key stays in the page.
2. **Make.** For the payment you choose, the receipt records the three private facts that define it (recipient, value, `rseed`)
   plus the raw transaction. It starts with `zr1` and travels after the `#` of a link, which browsers never send to servers.
3. **Check.** The reader's browser recomputes the transaction ID from the bytes, rebuilds the note, derives its ephemeral secret
   (ZIP 212), decrypts exactly that output and compares the note with the on-chain commitment. Then it asks for a whole window of
   16 blocks and confirms the transaction is in the block the receipt names.

## What each part guarantees

| Claim | Why you can believe it |
|---|---|
| The amount, recipient and memo are what was paid | The note is rebuilt from the receipt and must equal the one committed on chain (`cmx`); the memo only decrypts with the key derived from that exact note. A higher amount, another address or another output in the same transaction fails. Tested in `core/src/lib.rs`. |
| The transaction is the one on chain | Its ID is recomputed from the receipt's bytes (ZIP 244). Editing the payment data (amounts, outputs, memos, anything the ID covers) changes the ID, which is then not in the block. The proofs and signatures are deliberately outside the ID in Zcash, so the checker doesn't rely on them: the network verified them when it mined the transaction, and editing them can't change any fact the receipt states. |
| It was mined | The transaction ID appears in the block at the stated height, fetched from a public lightwalletd server. |
| Nothing else is revealed | The receipt holds no key. `rseed` opens one note; it does not reveal its nullifier (that needs the recipient's nullifier key), so it can't be used to see when or whether the money moved on. |
| The relay can't tell what you checked | Checking asks for an aligned 16-block range, never a transaction. Making a receipt sends the txid in a POST body (not the URL, so not in request logs) and nothing is stored. |

**What it does not prove:** who sent the payment. A receipt is like a paper receipt: anyone holding it can show it. To know a
payment reached *you*, compare the address; the check page and `unseal check --address` do this.

## Technology used

- **Zcash Orchard and Ironwood** shielded pools. Receipts work for both, on mainnet and testnet. Current wallets put new shielded
  funds into Ironwood (our own mainnet test funds landed there), so both are needed today.
- **librustzcash crates**, unchanged: `orchard` 0.16 (notes, keys, note encryption domains), `zcash_note_encryption` 0.5
  (`try_output_recovery_with_pkd_esk`, `try_note_decryption`, `try_output_recovery_with_ovk`), `zcash_primitives` 0.31
  (v5/v6 transaction parsing, ZIP 244 txids), `zcash_address` 0.14 (unified addresses and viewing keys).
- **ZIP 212** (recipient-derivable ephemeral secret), **ZIP 244** (txid), **ZIP 316** (unified addresses/keys), **ZIP 302** (memos),
  **ZIP 311** (payment disclosures, draft).
- **lightwalletd** gRPC (`GetBlockRange`, `GetTransaction`, `GetLatestBlock`) on zec.rocks, through a dependency-free relay.
- **WebAssembly** (wasm-bindgen): the same Rust code runs in the browser.
- The site is Vite + React + TypeScript; the relay is three Vercel functions.

## What's real today

| Piece | Status |
|---|---|
| Receipt library (`core/`): make and check, Orchard and Ironwood | **Working.** `cargo test -p zreceipt` (6 tests: both pools, every kind of tampering, a real NU7 testnet transaction) |
| Browser engine (WebAssembly) | **Working.** Used by every check on the site |
| Relay (`web/api/`) against mainnet and testnet lightwalletd | **Working** |
| Check page, make page, CLI | **Working** |
| The home page's sample receipt | _Pending_: a real mainnet payment made for this demo; added as soon as the test funds confirm |
| Sapling and transparent payments | _Not supported_ (see Limits) |

Nothing on the site is simulated. The illustration in the home page hero is labelled as one.

## Limits

- **Orchard and Ironwood only.** Sapling outputs need a different note encryption domain; it's the next addition.
- **Chain inclusion trusts the lightwalletd server**, as a light wallet does. You can run your own relay (it's three stateless
  functions) to take this site out of the path; a future version could check block headers' proof of work.
- **Receipts are about 12 to 20 KB** because they carry the transaction, so they work as links and files rather than QR codes.
  This keeps the check independent of any server until the last step.
- **The sender isn't identified.** Signing a receipt with the spend authorization key (the other half of ZIP 311) would add that.
- **Making a receipt reveals the transaction ID to the relay** (as any block explorer would). The CLI accepts a raw transaction
  file to avoid even that.

## Run it yourself

```sh
# Library and CLI
cargo test -p zreceipt
cargo run --release -p unseal-cli -- --help

# Site (the relay runs inside the dev server)
cd web && npm install && npm run dev        # http://localhost:5173

# Rebuild the browser engine after changing core/ (output is committed)
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.129
scripts/build-wasm.sh
```

Deploy: import the repository in Vercel (Root Directory `web`, or the repository root: both work). No environment variables are needed; `LWD_MAINNET` and
`LWD_TESTNET` override the lightwalletd servers.

## Repository

| Path | What |
|---|---|
| `core/` | `zreceipt`: the receipt library (Rust), plus its WebAssembly bindings |
| `cli/` | `unseal`: the command-line tool |
| `web/` | The site; `web/api/` is the relay; `web/src/zreceipt/` is the generated WebAssembly |
| `scripts/build-wasm.sh` | Rebuilds the browser engine |
| `audit/` | Interface audits (accessibility, 16 screen sizes, outages, speed) |
| `docs/` | Demo script, submission text, design brief |

## License

MIT or Apache-2.0, at your option.
