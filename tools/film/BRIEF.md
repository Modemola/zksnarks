# Unseal launch film: the brief

**Prompt**

Make a 75 second cinematic launch film for Unseal, receipts for shielded Zcash payments. It is motion graphics in the
manner of a premium product launch: dark, quiet, expensive, every move eased, nothing on screen that isn't saying something.
It must be entirely our own: our brand, our symbol, our footage, our score. Borrow nothing from any other company's film
(no shared typography, slogans, logos, objects, layouts or music).

**The idea to land in one viewing:** every shielded payment is sealed; today proving one breaks all the seals; Unseal opens
exactly one, and anyone can check it.

**Visual language**

- Palette: night ink `#0d0f13` for the stage, paper `#f4f1e9` for documents, seal gold `#f4b728` shading to `#b77c06`, a deep
  gold `#8a5a00` for accents, and one warning red `#e2574c` used once.
- The hero object is a real 3D wax seal with a keyhole, in warm gold, lit like jewellery. It stamps, it multiplies into a
  ledger of sealed receipts, and at the turn of the story it cracks in two with light coming through the crack.
- Type: Instrument Serif for statements, set large and calm, entering word by word; IBM Plex Mono for labels and data,
  widely tracked in capitals. Never more than one statement on screen.
- Motion: slow camera drift on everything, cubic easing, overlaps between scenes instead of hard cuts, depth from
  perspective and blur, gold light that responds to the story beats.
- Product: the real site, recorded on Zcash mainnet, shown in a floating browser frame, with callouts that land exactly as
  each step of the check completes. No mock screens.

**Structure**

| Time | Scene | On screen | Voice |
|---|---|---|---|
| 0 to 6 s | Sealed | Darkness. A gold seal descends and stamps; a ring of light spreads. | Every shielded Zcash payment is sealed. |
| 6 to 13 s | The ledger | The camera pulls back: the seal is one of dozens of sealed receipts on a tilted ledger. | Private by default. |
| 13 to 20 s | The problem | A viewing key swings in and every receipt tears open at once; the glow turns red. | But to prove one payment today, you hand over a viewing key, and it opens everything. |
| 20 to 26 s | Unseal | Black. One seal returns and cracks in two, light pouring out; the name appears between the halves. | Unseal changes that. Prove one payment. Keep the rest sealed. |
| 26 to 45 s | The check | The real site in a floating browser, checking a real mainnet receipt; callouts for each step. | Share a receipt link. Anyone can check it in their browser, against the live Zcash chain. It rebuilds the transaction, opens exactly one payment, and matches it to the commitment on chain. |
| 45 to 52 s | Forgery | Huge numerals: 0.001 ZEC scrambles to 1 ZEC, and is struck out in red. | Change a single detail, and it fails. |
| 52 to 59 s | Every pool | Three seals in a row, lit one by one: Orchard, Ironwood, Sapling. | Orchard. Ironwood. Sapling. |
| 59 to 65 s | For builders | A code card types the library call and the command line. | A Rust library, WebAssembly, and a command line tool. |
| 65 to 70 s | The facts | Three numerals count up: 1 payment shown, 0 keys shared, 16 blocks seen. | No keys shared. Nothing else revealed. |
| 70 to 76 s | End | The seal, the name, the address. | Unseal. Live on Zcash mainnet. |

**Sound**

An original score written for the cut: a slow minor pad with a sub bass, a soft pulse that enters with the product, a
riser into each turn, and three impacts (the stamp, the crack, the forgery). The voice is a Nigerian English male narrator,
calm and assured, mixed above the music, with the music ducking under every line.

**Delivery**

1920 × 1080, 30 frames a second, H.264 with AAC, loudness about -16 LUFS, under 80 seconds.

## Making it

The film is [`docs/video/unseal-film.mp4`](../../docs/video/unseal-film.mp4). Every frame is drawn by `film.html` as a
function of time, so it renders the same on any machine:

```bash
(cd tools && npm install)                                         # Playwright, three.js
node tools/video/record.mjs rec                                   # the real site, for the product scene
python3 tools/video/voice.py voice tools/film/lines.json -8% -2Hz   # the narration, en-NG-AbeoNeural
node tools/film/render.mjs frames rec                             # 2,400 frames at 1920 × 1080
python3 tools/film/score.py score.wav                             # the original score (numpy, scipy)
python3 tools/film/finish.py frames voice score.wav unseal-film.mp4
```
