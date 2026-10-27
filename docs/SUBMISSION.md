# Submission form text

Copy each field into the Zecathon submission form. Fill the two links before submitting.

## Project name

Unseal

## Track

**04 // Core & Tooling.** It's a library, a CLI and a reference site implementing a draft ZIP (311) on the official librustzcash
crates. That fits "SDKs, testing tools, better integrations" and "librustzcash", and it's the problem developers keep hitting.

Alternative if you'd rather compete on the user story: **01 // Shielded Payments** ("invoices… paying or getting paid").
Pick one; the rules allow exactly one track.

## Description (short)

Receipts for shielded Zcash payments. Prove one payment to an accountant, a client or a court, with its amount, recipient and
memo, without handing over a viewing key that opens your whole wallet. Anyone can check a receipt in their browser against the
chain in a few seconds. Implements the output side of ZIP 311 (payment disclosures) for Orchard and Ironwood.

## Description (long)

Shielded payments are private by default. But people regularly need to show one payment: to an accountant or auditor, a
client who says an invoice is unpaid, a support desk, a court. Today the only tool is a viewing key, which reveals every payment
in the wallet, past and future. So people either overshare or can't prove anything, and that's a real obstacle to using shielded
ZEC for business.

Unseal makes a receipt for exactly one payment. You paste your viewing key and a transaction ID; your browser finds what you
sent or received (the key never leaves the page) and gives you a link per payment. Whoever opens the link gets a check that runs
in their own browser: it recomputes the transaction ID from the transaction's bytes (ZIP 244), rebuilds the note from the
receipt, derives its ephemeral secret (ZIP 212), decrypts that one output and requires it to match the on-chain commitment, then
confirms the transaction is in its block. Change any detail and it fails.

What stays private: the sender, every other output in the transaction, the wallet's balance and history, and whether the money
was spent later (the receipt doesn't reveal the nullifier). The relay that fetches chain data only ever sees a range of 16 blocks,
never which payment is being checked, and the receipt travels after the # of the link, which browsers don't send to servers.

It ships as:
- `zreceipt`, a Rust library on the official orchard, zcash_note_encryption, zcash_primitives and zcash_address crates
- the same library compiled to WebAssembly for browsers
- `unseal`, a CLI with JSON output for wallets, shops and payment systems
- a site to make and check receipts, with a dependency-free lightwalletd relay you can self-host

It works for both Orchard and Ironwood payments on mainnet and testnet. That matters now: our own mainnet test funds landed in Ironwood, which is where current wallets put new shielded payments.

## Repository

https://github.com/modemola/zksnarks (make it public before the deadline: Oct 28, 23:59 UTC)

## Demo

_Vercel URL_

## Video (2 minutes)

_Video link_ (script: `docs/DEMO_SCRIPT.md`)

## Before pressing SUBMIT

- [ ] The repository is public and the README's links are filled in
- [ ] The live site opens on a phone and a laptop, signed out, and the home page check passes
- [ ] The video is under 2:00 with captions
- [ ] One track selected
- [ ] SUBMIT seals the entry; you can save drafts before that
