# Demo video

[`video/unseal-demo.mp4`](video/unseal-demo.mp4): two minutes, 1920 × 1080, captions burned in.

Everything on screen is the production site at <https://unseall.vercel.app> working against Zcash mainnet, recorded in a
real browser. The terminal shows the real output of `unseal check` on the demo receipt and its forged copy. The voice is
Microsoft's neural voice for Nigerian English (`en-NG-AbeoNeural`).

## Script

| Time | On screen | Voice |
|---|---|---|
| 0:00 | The home page | Zcash keeps payments private. But sometimes, you have to prove one: to an accountant, a client, or a court. Today, that means handing over a viewing key. And a viewing key opens your entire wallet. |
| 0:17 | The receipt in the hero | Unseal makes a receipt for one payment instead. |
| 0:22 | **Check this receipt**: the steps, the ledger, the seal cracking, the facts | This is a real payment on Zcash mainnet. With one click, my browser rebuilds the transaction ID from the transaction itself, opens the one payment the receipt names, matches it to the commitment on chain, and finds it in its block. 0.001 ZEC, to this address, with this note. The other output in that transaction stays sealed. |
| 0:47 | What stayed private | What stayed private? The sender, the other payments, and whether the money ever moved again. |
| 0:55 | The **Forged copy** switch fails at the match step | Now, the same receipt with one change: the amount is raised to 1 ZEC. Same steps, same code. And it fails at the exact step that broke. |
| 1:07 | **Try it with the demo wallet**, then **Copy link** | Making a receipt takes a wallet's viewing key and the transaction ID. The key never leaves this page. Unseal finds what you sent or received, and gives you a link for each payment. Share the link, not your key. |
| 1:23 | **Try a Sapling receipt** | It works in every shielded pool: Orchard, the new Ironwood pool, and Sapling. This is a second real payment, to a Sapling address. |
| 1:35 | `unseal check` in a terminal, then the forged copy rejected | For wallets, shops and payment systems, the same engine is a Rust library and a command line tool, with JSON output. |
| 1:46 | How it works, then the end card | Built on the official Zcash libraries, it implements the output side of ZIP 311. Unseal: prove one payment. Keep the rest sealed. |

## Making it again

The video is built from the live site by four scripts in `tools/video`:

```bash
node tools/video/record.mjs rec                        # records each scene from the site, frame by frame
python3 tools/video/voice.py voice                     # speaks the lines in tools/video/lines.json
node tools/video/card.mjs card.png                     # renders the end card
python3 tools/video/edit.py rec voice card.png fonts docs/video/unseal-demo.mp4
```

`record.mjs` captures Chrome's screencast at 1920 × 1080 with each frame's time, and draws the site's own cursor, since a
headless browser has none. `edit.py` rebuilds every scene at a constant 30 frames a second, holds each scene for its line of
voice, burns in captions from the voice's own timings, dissolves into the end card, and levels the sound to -16 LUFS, the usual loudness for online video.
`fonts` is a folder holding IBM Plex Sans Medium as a TTF file, for the captions. The scripts need Playwright, ffmpeg with
libass, Pillow, and `pip install edge-tts`.
