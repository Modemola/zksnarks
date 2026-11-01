# Unseal launch film: the brief

**Prompt**

Make a 45 second launch film for Unseal, receipts for shielded Zcash payments, as fast, punchy motion graphics: a premium
product launch cut to the beat. No narrator: bold kinetic type and a driving score carry the story. It must be entirely our
own: our brand, our symbol, our footage, our score. Borrow nothing from any other company's film (no shared typography,
slogans, logos, objects, layouts or music).

**The idea to land in one viewing:** every shielded payment is sealed; today proving one breaks all the seals; Unseal opens
exactly one, and anyone can check it.

**Rules of the cut**

- Everything lands on a 124 bpm grid: every word, every cut, every impact. Nothing drifts in; things punch in with a little
  overshoot and leave fast.
- Never more than one idea on screen. Never a still moment longer than two beats.
- Five impacts carry the story: the stamp, the tear, the crack, the forgery, the end. Each gets a flash and a camera shake.
- The product is shown for real: the live site checking a real mainnet receipt, at 1.6 times speed, in a browser that whips
  in and out.

**Visual language**

- Night ink `#0b0d11`, paper `#f4f1e9`, seal gold `#f4b728`, and one red `#ff5a4a` used only for the tear and the forgery.
- The hero is a real 3D wax seal with a keyhole, in warm gold, lit like jewellery. It slams down, recedes into a ledger of
  sealed receipts, and cracks in two along the same line the site's own seal cracks on.
- Type: Instrument Serif, very large, one word at a time; IBM Plex Mono for labels.

**Structure** (bars of four beats; a bar is 1.94 s)

| Bars | Time | On screen | On the beat |
|---|---|---|---|
| 0 to 1 | 0 to 4 s | "Every shielded payment" word by word; the seal slams down: "is sealed." | Ticks, then the first impact |
| 2 to 3 | 4 to 8 s | The seal recedes into a ledger of sealed receipts. "Private by default." | The groove starts |
| 4 to 5 | 8 to 12 s | "To prove one payment, a viewing key opens" and a key whips in; every receipt tears open: "everything." in red | The tear, in red |
| 6 | 12 to 14 s | Black. "Until now." | Breakdown and a rising roll |
| 7 to 8 | 14 to 17 s | The seal cracks in two with light through the crack. "Unseal." "Prove one payment. Keep the rest sealed." | The crack; half time in D major |
| 9 to 12 | 17 to 25 s | The live site checks a real receipt; four callouts snap in | Full groove with arpeggios |
| 13 to 14 | 25 to 29 s | "0.001 ZEC" scrambles to "1.000" and is struck out: rejected | The forgery hit; the drums stop |
| 15 to 16 | 29 to 33 s | Three seals slam down: Orchard, Ironwood, Sapling. "Every shielded pool." | One hit per seal |
| 17 to 18 | 33 to 37 s | A code card types the library call and the command line; Rust, WebAssembly, CLI | Groove |
| 19 to 20 | 37 to 41 s | 1 payment shown. 0 keys shared. 16 blocks seen by the server. | One hit per number |
| 21 to 22 | 41 to 46 s | The seal, "Unseal", the address | The last impact; D major |

**Sound**

An original score synthesized for the cut at 124 bpm in D minor: kick, clap, hats, a pumping bass, offbeat chord stabs and
plucked arpeggios; a breakdown before the crack; impacts with flashes on the five story beats; the end resolves to D major.
Balanced to sound full on phone and laptop speakers, levelled to -14 LUFS.

**Delivery**

1920 × 1080, 30 frames a second, H.264 with AAC, 46 seconds.

## Making it

The film is [`docs/video/unseal-film.mp4`](../../docs/video/unseal-film.mp4). Every frame is drawn by `film.html` as a
function of time, so it renders the same on any machine:

```bash
(cd tools && npm install)                          # Playwright, three.js
node tools/video/record.mjs rec                    # the real site, for the product scene
node tools/film/render.mjs frames rec 0 46         # 1,380 frames at 1920 × 1080
python3 tools/film/score.py score.wav              # the score (numpy, scipy)
python3 tools/film/finish.py frames score.wav unseal-film.mp4
```
