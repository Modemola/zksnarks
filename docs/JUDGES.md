# Trying Unseal in five minutes

Everything below runs against **Zcash mainnet**, on real payments. There is nothing to install and no account: a browser is
enough. A wallet is only needed to make a receipt for a payment of your own.

**Live site:** <https://unseall.vercel.app>

## 1. Check a real receipt (one minute)

Open the site and press **Check this receipt** in the "Check a real receipt yourself" section.

Your browser runs six steps and names what each one proved:

| Step | What happened in your browser |
|---|---|
| Read the receipt | Mainnet, block 3,531,890, Ironwood pool |
| Rebuild the transaction ID | Hashed from the transaction's own bytes (ZIP 244): `04f89f77…e2d1` |
| Open the one payment | Payment 2 of 2; the other one stays sealed |
| Match it to the commitment | 0.001 ZEC to the recipient, memo included, equal to what the chain committed to |
| Fetch blocks | 16 blocks around the stated height, from a public lightwalletd server |
| Find the transaction | Its ID is in block 3,531,890 |

Then the ledger shows the opened output beside the sealed one, and the wax seal cracks. Below it, "What just happened" and
"What stayed private" explain the result in plain words.

The transaction is real: look up `04f89f774842deb5b61a444c0932a569a9ae27cd5834f7625c26eefe9df6e2d1` in any Zcash block
explorer. The explorer shows a shielded transaction and nothing about who paid whom. The receipt shows exactly one of its
payments.

## 2. Try to cheat (thirty seconds)

On the same section, flip the switch from **Genuine receipt** to **Forged copy**. It is the same receipt with one change:
the amount raised from 0.001 to 1 ZEC.

The check fails at **Match it to the commitment recorded on chain**, and the page says the receipt did not check out. The
cryptography refuses it; no server was asked.

The check page has the same thing as **Try a forged copy**.

## 3. A Sapling payment (thirty seconds)

Open **Check a receipt** and press **Try a Sapling receipt**. This is a second real payment: 0.0005 ZEC to a Sapling only
address, mined in block 3,532,565 (`a3eae065…0e35`). Same steps, different shielded pool.

Then paste `zs1vp67zys00c34zu9d7420jpxutuxfcxv5adhkt0xed92sqygt60wdjrvzw95nyhs9zzf7x0sv35k` into **Was it paid to you?**
The page answers yes: a merchant can confirm a payment reached the address they published, in its older `zs1` form too.

## 4. Make a receipt (one minute)

Open **Make a receipt** and press **Try it with the demo wallet**. It fills in the demo shop's view only key and the demo
transaction, then finds the payment that key received and gives:

- a link with the receipt after the `#` (browsers never send that part to a server),
- the receipt as a file,
- a button that checks it straight away.

The key is used inside the page and never sent anywhere. To see that, open the browser's network panel: the only requests
are for public chain data.

With your own wallet, paste its unified full viewing key (`uview1…`) and the ID of any shielded payment it sent or received.

## 5. The command line (one minute)

```bash
git clone https://github.com/Modemola/zksnarks && cd zksnarks
cargo run --release -p unseal-cli -- check core/tests/data/mainnet-demo.zr
cargo run --release -p unseal-cli -- check core/tests/data/mainnet-forged.zr      # rejected
cargo run --release -p unseal-cli -- check core/tests/data/mainnet-sapling.zr --address zs1vp67zys00c34zu9d7420jpxutuxfcxv5adhkt0xed92sqygt60wdjrvzw95nyhs9zzf7x0sv35k
```

Add `--json` to any command for output a payment system can read.

## 6. Checking the claims

```bash
cargo test --workspace
```

14 tests. The ones worth reading, all in `core/src/lib.rs`:

- `mainnet::demo_receipt_verifies` and `mainnet::sapling_receipt_verifies`: the two real mainnet receipts, checked offline
  down to the amount, memo and transaction ID.
- `mainnet::forged_demo_receipt_is_rejected` and `mainnet::altered_sapling_receipts_are_rejected`: a raised amount, another
  output, or the wrong pool all fail.
- `tests::orchard_receipts`, `tests::ironwood_receipts` and `sapling::sapling_receipts`: build fresh transactions, make
  receipts from the payer's and the payee's keys, and try every kind of tampering (amount up and down, another recipient,
  another seed, another output).
- `tests::real_testnet_transaction`: a real NU7 testnet transaction.

`node tools/e2e/receipts.mjs` drives every flow on the live site in a real browser: 51 checks, listed with their results in
[QUALITY.md](QUALITY.md).

## What to read next

- [SECURITY.md](SECURITY.md): what a receipt proves, what it doesn't, and what the checker trusts.
- [QUALITY.md](QUALITY.md): every test and audit, with results.
- The **How it works** page on the site: the same story with the cryptography in a fold out.
