# Demo video script (2 minutes)

**The one idea:** *prove one payment without opening your wallet, and let anyone check it in a browser.*

About 260 words of voice-over at a calm pace. Numbers in [brackets] are read off the screen at recording time. Record at
1440 × 900, 100% zoom, light theme, a fresh browser profile. Captions burned in: many judges watch muted.

| Time | On screen | Voice-over | Caption |
|---|---|---|---|
| 0:00–0:12 | Home page; the headline rises word by word | "Zcash keeps payments private. But sometimes you have to prove one: to an accountant, a client, a court. Today that means handing over a viewing key, and a viewing key opens your entire wallet." | Proving one payment shouldn't open your whole wallet |
| 0:12–0:20 | Scroll to the hero receipt card, stamp lands | "Unseal makes a receipt for one payment instead." | Unseal: receipts for shielded payments |
| 0:20–0:50 | **The signature moment.** Click **Check this receipt**. Steps tick one by one; the opened payment appears beside the sealed ones; the Paid stamp lands | "This is a real payment on Zcash mainnet. One click, and my browser rebuilds the transaction ID from the transaction itself, opens the one payment the receipt names, matches it to the commitment on chain, and finds it in its block. [Amount] ZEC, to this address, with the note '[memo]'. The other [N] outputs in that transaction stay sealed." | Checked in the browser. Nothing installed |
| 0:50–1:00 | Scroll "What stayed private" | "What stayed private: the sender, the other payments, and whether the money ever moved again." | What stayed private |
| 1:00–1:12 | Check page: paste the forged copy (amount raised), check again; the step turns red | "Raise the amount in the receipt, and it fails, at the exact step that broke." | Forge it: it fails |
| 1:12–1:35 | Make a receipt page: paste a viewing key and a transaction ID; the payments appear; click **Copy link** | "Making one: paste your viewing key and the transaction ID. The key stays in this page. Unseal finds what you sent or received, and gives you a link for each payment. Share the link, not your key." | Your key never leaves the page |
| 1:35–1:48 | Terminal: `unseal check receipt.txt --address u1…` printing the result | "For wallets, shops and payment systems, the same engine is a Rust library and a command-line tool, with JSON output." | Rust library · CLI · WebAssembly |
| 1:48–2:00 | How it works page, then back to the home page headline | "Built on the official Zcash libraries. It implements ZIP 311 payment disclosures, works for both Orchard and Ironwood, the pool new payments land in today. Unseal: prove one payment, keep the rest sealed." | unseall.vercel.app · github.com/modemola/zksnarks |

## Honesty rules

- Everything shown is real: a mainnet payment, a live chain lookup. If the network is slow, say "sped up" in the caption rather
  than cutting the steps.
- Don't show a real viewing key that holds anything you care about. Use the demo wallet's key, or blur it.
- Never claim in the video what the README's "What's real today" doesn't.

## Recording checklist

- Run the check once before recording, so the relay is warm and you know it works.
- Copy the forged receipt in advance: `docs/forged-receipt.txt` is the demo receipt with its amount raised. (Only the first ~3,000 characters, the payment data, are covered by the transaction ID; edits to the proofs and signatures after that change no fact and are ignored by design.)
- Have the terminal open in a large font (18 pt+), with the command typed but not run.
- Move the mouse slowly; the cards tilt toward the pointer.
- Export 1080p, 30 fps, under 2:00. If it runs long, cut the terminal shot first.
