# Submission

The text entered in the Zecathon submission form.

## Project name

Unseal

## Track

04 · Core & Tooling

A library, a command line tool and a reference site implementing a draft ZIP (311) on the official librustzcash crates.

## Short description

Receipts for shielded Zcash payments. Prove one payment to an accountant, a client or a court, with its amount, recipient
and memo, without handing over a viewing key that opens your whole wallet. Anyone can check a receipt in their browser
against the chain in a few seconds. Implements the output side of ZIP 311 (payment disclosures) for Orchard, Ironwood and
Sapling.

## Long description

Shielded payments are private by default. But people regularly need to show one payment: to an accountant or auditor, a
client who says an invoice is unpaid, a support desk, a court. Today the only tool is a viewing key, which reveals every
payment in the wallet, past and future. So people either overshare or can't prove anything, and that is a real obstacle to
using shielded ZEC for business.

Unseal makes a receipt for exactly one payment. You paste your viewing key and a transaction ID; your browser finds what you
sent or received (the key never leaves the page) and gives you a link for each payment. Whoever opens the link gets a check
that runs in their own browser: it recomputes the transaction ID from the transaction's bytes (ZIP 244), rebuilds the note
from the receipt, derives its ephemeral secret (ZIP 212), decrypts that one output and requires it to match the commitment
on chain, then confirms the transaction is in its block. Change any detail and it fails.

What stays private: the sender, every other output in the transaction, the wallet's balance and history, and whether the
money was spent later (the receipt doesn't reveal the nullifier). The relay that fetches chain data only ever sees a range of
16 blocks, never which payment is being checked, and the receipt travels after the # of the link, which browsers don't send
to servers.

It ships as:

- `zreceipt`, a Rust library on the official orchard, sapling-crypto, zcash_note_encryption, zcash_primitives and
  zcash_address crates
- the same library compiled to WebAssembly for browsers
- `unseal`, a command line tool with JSON output for wallets, shops and payment systems
- a site to make and check receipts, with a dependency free lightwalletd relay anyone can host

It works for all three shielded pools, on mainnet and testnet, and is proven with two real mainnet payments: 0.001 ZEC in
Ironwood (block 3,531,890) and 0.0005 ZEC in Sapling (block 3,532,565).

## Try it

1. Home page, **Check this receipt**: a real mainnet payment, checked step by step in your browser.
2. Home page, the **Forged copy** switch: the same receipt with the amount raised to 1 ZEC fails at the commitment match.
3. **Make a receipt**, **Try it with the demo wallet**: a view only key finds the payment and makes a receipt link, without
   the key leaving the page.

The five minute walkthrough is in [docs/JUDGES.md](../JUDGES.md).

## What's next

Sender signatures (the input side of ZIP 311), a "Share receipt" button inside wallets, QR sized receipts, and block header
checks.

## Links

- Repository: <https://github.com/Modemola/zksnarks>
- Live site: <https://unseall.vercel.app>
- Video: [docs/video/unseal-demo.mp4](../video/unseal-demo.mp4)
