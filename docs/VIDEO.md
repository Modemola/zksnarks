# Demo video script (two minutes)

**The one idea:** prove one payment without opening your wallet, and let anyone check it in a browser.

About 270 words of voice over at a calm pace. Numbers in [brackets] are read off the screen at recording time. Record at
1440 × 900, 100% zoom, a fresh browser profile. Burn in captions: many judges watch muted.

| Time | On screen | Voice over | Caption |
|---|---|---|---|
| 0:00 to 0:12 | Home page; the headline rises word by word | "Zcash keeps payments private. But sometimes you have to prove one: to an accountant, a client, a court. Today that means handing over a viewing key, and a viewing key opens your entire wallet." | Proving one payment shouldn't open your whole wallet |
| 0:12 to 0:20 | The paper receipt in the hero, sealed with wax | "Unseal makes a receipt for one payment instead." | Unseal: receipts for shielded payments |
| 0:20 to 0:50 | **The signature moment.** Click **Check this receipt**. The steps tick one by one; the opened payment appears beside the sealed one; the wax seal cracks open | "This is a real payment on Zcash mainnet. One click, and my browser rebuilds the transaction ID from the transaction itself, opens the one payment the receipt names, matches it to the commitment on chain, and finds it in its block. [Amount] ZEC, to this address, with the note '[memo]'. The other output in that transaction stays sealed." | Checked in the browser. Nothing installed |
| 0:50 to 1:00 | Scroll to "What stayed private" | "What stayed private: the sender, the other payments, and whether the money ever moved again." | What stayed private |
| 1:00 to 1:10 | Same section: click the **Forged copy** switch; the claim reads 1 ZEC and the check fails at "Match it to the commitment" | "Now the same receipt with one change: the amount raised to 1 ZEC. Same steps, same code, and it fails at the exact step that broke." | Forge it: it fails |
| 1:10 to 1:30 | Make a receipt page: click **Try it with the demo wallet**; the key and transaction fill in, the payment appears ("You received"); click **Copy link** | "Making one takes a wallet's viewing key and the transaction ID. The key stays in this page. Unseal finds what you sent or received and gives you a link for each payment. Share the link, not your key." | Your key never leaves the page |
| 1:30 to 1:40 | Check page: **Try a Sapling receipt** passes; the facts say "Sapling" | "It works in every shielded pool: Orchard, the new Ironwood pool, and Sapling. This one is a second real payment, to a Sapling address." | Orchard · Ironwood · Sapling |
| 1:40 to 1:50 | Terminal: `unseal check receipt.txt --address u1…` printing the result | "For wallets, shops and payment systems, the same engine is a Rust library and a command line tool with JSON output." | Rust library · CLI · WebAssembly |
| 1:50 to 2:00 | How it works page, then back to the home page headline | "Built on the official Zcash libraries, implementing the output side of ZIP 311. Unseal: prove one payment, keep the rest sealed." | unseall.vercel.app · github.com/Modemola/zksnarks |

## Honesty rules

- Everything shown is real: two mainnet payments and a live chain lookup. If the network is slow, say "sped up" in the
  caption rather than cutting the steps.
- Show only the demo wallet's view only key. Never show a key that holds anything you care about.
- Claim nothing in the video that the README's Status table doesn't.

## Recording checklist

- Run the home page check once before recording, so the relay is warm.
- The forged copy is one click: the **Forged copy** switch on the home page, or **Try a forged copy** on the check page. For
  the terminal shot it is `core/tests/data/mainnet-forged.zr`.
- Have the terminal open in a large font (18 pt or more), with the command typed but not yet run.
- Move the mouse slowly; the receipt cards tilt toward the pointer.
- Let the seal crack fully (about half a second) before scrolling on.
- Export 1080p, 30 fps, under 2:00. If it runs long, cut the terminal shot first.
