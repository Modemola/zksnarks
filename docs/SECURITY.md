# Security model

What a receipt proves, what it does not, what the checker has to trust, and what each party learns.

## What a valid receipt proves

A receipt that passes the check proves four things:

1. **The payment.** A shielded output exists that pays exactly this amount to exactly this address, with exactly this memo.
2. **The transaction.** That output belongs to the transaction whose ID the checker computed from the receipt's bytes.
3. **Inclusion.** That transaction ID is in the block at the height the receipt names, on the network it names.
4. **Nothing more.** The receipt opens that one output and no other.

## How each claim is enforced

### The payment

Every shielded output on chain is published as a note commitment and a note ciphertext. A note is fixed by:

| Pool | Note | Public on chain | Carried by the receipt |
|---|---|---|---|
| Orchard, Ironwood | address, value, ρ, rseed | ρ (the action's nullifier), the commitment `cmx`, the ephemeral key | address, value, rseed |
| Sapling | address, value, rseed | the commitment `cmu`, the ephemeral key | address, value, rseed |

The checker rebuilds the claimed note from the receipt and derives its ephemeral secret from rseed (ZIP 212). It then calls
`try_output_recovery_with_pkd_esk` from the official `zcash_note_encryption` crate, which returns a note only if:

- the ciphertext authenticates (ChaCha20Poly1305) under the key derived from that secret and the address,
- the secret derived from the decrypted note equals the one used,
- the decrypted note commits to the on chain commitment, and
- the ephemeral public key it implies equals the one on chain.

Unseal then requires the decrypted note to equal the claimed note in full. That last comparison matters: the decryption key
depends on the address and the seed, not on the value, so without it a receipt could overstate the amount.

### The transaction

The receipt carries the whole raw transaction. The checker parses it with the official `zcash_primitives` crate and computes
its ID with ZIP 244. Editing any payment data (amounts, outputs, memos, anything the ID covers) changes the ID.

Zcash deliberately keeps proofs and signatures outside the transaction ID. The checker does not rely on them: the network
verified them when it mined the transaction, and editing them cannot change any fact a receipt states.

### Inclusion

The checker asks the relay for an aligned range of 16 compact blocks around the stated height and looks for the computed ID
in the stated block. The relay passes the request to a public lightwalletd server.

### Nothing more

The receipt holds no viewing key, spending key or incoming key. rseed opens one note. It does not reveal the note's nullifier,
which needs the recipient's nullifier key, so a receipt cannot show when or whether the money was spent.

## Tampering, and where it fails

Each case below is a test in `core/src/lib.rs`, and most are also driven through the site by `tools/e2e/receipts.mjs`.

| Change to the receipt | Result |
|---|---|
| Raise or lower the amount | Rejected: the note no longer matches the commitment |
| Name another recipient | Rejected: the output does not decrypt |
| Change the seed | Rejected |
| Point at another output in the same transaction | Rejected |
| Relabel the pool (Sapling as Orchard, Orchard as Ironwood) | Rejected |
| Edit the transaction's payment data | The computed ID changes and is not in the block |
| Name the wrong block | The ID is not found in that block |
| Truncate or corrupt the text | "This receipt is damaged or incomplete" |

## What a receipt does not prove

- **Who sent it.** A receipt is like a paper receipt: anyone who holds it can show it. The input side of ZIP 311 (signing
  with the spend authorization key) would add proof of the sender; it is on the roadmap.
- **That it paid you.** It proves the payment went to the address in the receipt. To know that is your address, compare it:
  the check page's **Was it paid to you?** and `unseal check --address` do this, for unified and `zs1` addresses.
- **That the money is still there.** It proves a payment was made, not what happened to it afterwards.

## What the checker trusts

| Trusted | For | How to remove or reduce it |
|---|---|---|
| The official Zcash crates (`orchard`, `sapling-crypto`, `zcash_note_encryption`, `zcash_primitives`, `zcash_address`) | All of the cryptography | Unchanged upstream code; versions pinned in `Cargo.lock` |
| A lightwalletd server | Reporting which transactions are in which block | The same trust a light wallet places in it. Run your own relay (three stateless functions) against your own server |
| The site's own files | Delivering the checker | Served with a strict Content Security Policy; or use the CLI, which runs the same engine locally |

## What each party learns

| Party | Learns |
|---|---|
| Whoever holds the receipt | The one payment's amount, recipient and memo, and the raw transaction, which is public on chain anyway |
| The relay, during a check | A range of 16 blocks. Not which transaction, not which payment |
| The relay, while making a receipt | The transaction ID asked for, as any block explorer would. It is sent in the request body, not the address, and nothing is stored. The CLI's `--raw-tx` avoids even that |
| Any server, ever | Never a viewing key, never a receipt, never the address typed into "Was it paid to you?" |

A receipt points to its whole transaction. If that transaction also spent transparent funds, those inputs are public on chain
anyway; a fully shielded payment, like both demos, shows nothing about the sender.

## The site

- **Content Security Policy:** scripts only from the site itself (plus WebAssembly), network requests only to its own relay,
  no inline scripts, no framing, no plugins.
- **Other headers:** Strict Transport Security, `Referrer-Policy: no-referrer` (a receipt link never leaks through the
  Referer header), `X-Content-Type-Options`, `Cross-Origin-Opener-Policy`, a restrictive `Permissions-Policy`.
- **No third parties:** fonts are self hosted; there are no analytics, trackers or external scripts. Every request goes to
  the site's own host.
- **No storage:** keys and receipts live in the page's memory only. A checked receipt is kept in the address bar after the
  `#`, which browsers never send to a server.

Each of these was checked by recording every request and every policy violation; the results are in
[QUALITY.md](QUALITY.md).

## Known limits

- The relay is open, like a public lightwalletd. It relies on the host's abuse protection rather than its own rate limits.
- Inclusion rests on one lightwalletd server's answer. Verifying block headers' proof of work would remove that trust; it is
  on the roadmap.
- Sapling receipts cover notes made under ZIP 212, which every wallet has used since Canopy in 2020. Older Sapling notes
  used a random ephemeral key that a receipt cannot reproduce, so they are skipped when making receipts.
