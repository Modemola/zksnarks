# Quality record

What was checked, how, and the result. Every check can be rerun from this repository; the commands are in
[DEPLOY.md](DEPLOY.md#tests-and-tools).

## Summary

| What | How | Result |
|---|---|---|
| Receipt engine | `cargo test --workspace` | 14 pass |
| Lints and formatting | `cargo clippy --workspace --all-targets -- -D warnings`, `cargo fmt --check` | Clean |
| Types | `npm run typecheck` in `web/` | Clean, site and relay |
| Every flow in a real browser, against mainnet | `node tools/e2e/receipts.mjs` | 51 of 51 pass on the production site |
| Accessibility, keyboard, layout, outages, copy, pre-rendering | `tools/audit/run.sh` | AUDIT_SUMMARY |
| Lighthouse, phone and desktop | `tools/audit/run.sh` | LIGHTHOUSE_SUMMARY |
| Continuous integration | `.github/workflows/ci.yml` on every push | Engine (format, lints, tests, browser target) and site build |

## The receipt engine

14 tests in `core/src/lib.rs`, all offline:

| Test | Proves |
|---|---|
| `tests::orchard_receipts`, `tests::ironwood_receipts` | A fresh transaction paying two people: the payer's key finds both payments it sent, the payee's key finds the one it received, every receipt opens its own output, and a raised or lowered amount, another recipient, another seed or another output is rejected |
| `sapling::sapling_receipts` | The same for Sapling outputs |
| `tests::wrong_pool_does_not_open` | An Orchard receipt relabelled as Ironwood is rejected |
| `tests::encoding_roundtrip_and_links` | The `zr1` text form survives links, line breaks and whitespace |
| `tests::real_testnet_transaction` | A real NU7 testnet transaction parses and its ID is right |
| `tests::addresses_and_memos`, `sapling::sapling_addresses` | Address matching for unified and `zs1` addresses on the right network; memo decoding (ZIP 302) |
| `mainnet::demo_receipt_verifies` | The real Ironwood receipt: 0.001 ZEC, block 3,531,890, its memo and its transaction ID |
| `mainnet::forged_demo_receipt_is_rejected` | The same receipt with the amount raised to 1 ZEC |
| `mainnet::demo_receipt_against_the_other_output_is_rejected` | Pointed at the other output in its transaction |
| `mainnet::demo_receipt_with_wrong_height_still_proves_the_payment_but_names_the_block` | The height only selects the block to look in; the chain lookup catches a wrong one |
| `mainnet::sapling_receipt_verifies` | The real Sapling receipt: 0.0005 ZEC, block 3,532,565, matched to its `zs1` address |
| `mainnet::altered_sapling_receipts_are_rejected` | Raised amount, other output, relabelled pool |

## Every flow in a real browser

`tools/e2e/receipts.mjs` drives Chromium through the whole site against Zcash mainnet. 51 checks, all passing on the
production site:

| Group | Checks |
|---|---|
| Home page | The header shows mainnet and a live block; the real receipt checks in about 1.4 s including the step animation; the result names the amount and memo; the ledger shows one output opened and one sealed; the seal cracks; "Check again" works |
| Receipt links | A link checks itself on load; "Was it paid to you?" says yes for the shop's address, no for another, and gives no verdict for garbage |
| Forgery | A forged receipt is rejected at "Match it to the commitment" |
| Pasting | A non receipt disables the button with a hint; a receipt with line breaks checks; a pasted link to a forged receipt is rejected |
| Damage | A truncated receipt is rejected in plain words |
| Making a receipt | The payer's key ("You sent") and the shop's key ("You received") produce the identical receipt; copy, download and "Check it now" work |
| Messages | Empty fields, an incoming only key, an older Sapling key, a short transaction ID, an unknown transaction, a key on the other network, a key that took no part, a corrupted key: each gets a plain message |
| Other pages | An unknown address gets the site's own page with a real 404 status and links onward; how it works renders |
| One click demos | The forged switch, the check page's demo and forged buttons, the tab title after a check, the demo wallet, focus moving to the results |
| Sapling | "Try a Sapling receipt" passes and names the pool; a `zs1` address is recognised as the recipient; the shop's key finds its Sapling payment and makes the same receipt |
| Console | No script or console errors anywhere |

## Privacy, verified by recording every request

Across every flow, every request was recorded with its body:

- Hosts contacted: the site only. No fonts, analytics or other third parties.
- Viewing keys: in no request, in full or in part.
- The receipt itself: in no request.
- The address typed into "Was it paid to you?": in no request.
- The whole relay traffic: `GET /api/tip`, `GET /api/blocks` for a 16 block range, and `POST /api/tx` with a network and a
  transaction ID when making a receipt.

## Security headers

- Content Security Policy: scripts only from the site (plus WebAssembly), network requests only to its own relay, no
  framing, no inline scripts. Every page of the production site loads and runs a full check with the policy enforced and
  reports no violations.
- Strict Transport Security, `Referrer-Policy: no-referrer`, `X-Content-Type-Options`, `Cross-Origin-Opener-Policy`, a
  restrictive `Permissions-Policy`.

## Failure behaviour

| Situation | What the visitor sees |
|---|---|
| Relay unreachable, erroring or very slow | "The check couldn't finish", with the reason in plain words; never a false "Paid" |
| Receipt engine fails to download | "The receipt checker didn't download", and the next click retries |
| A page's code is missing (an old tab after a redeploy) | A recovery page with Reload, not a blank screen |
| A reused relay connection dropped silently by the network | Detected after 3 s and retried on a fresh connection, reproduced with a stalling proxy |
| A payment from the last few minutes | Checks normally; the relay trims the block window to the chain tip |
| An address that matches no page | The site's own not found page, with status 404 |

## Interface

- Accessibility: AXE_LINE
- Screen sizes: RESPONSIVE_LINE
- Touch screens: every control at least 44 × 44 px on phone, landscape phone and tablet.
- Text at 200%: no clipping and no sideways scrolling on any page.
- Extreme content: a 512 character memo with no spaces, a 21 million ZEC amount, and mixed emoji, Hebrew and Chinese text
  stay inside their boxes on a 360 px phone and on desktop.
- Mobile typing: key, transaction ID, address and receipt fields have no auto capitalisation, autocorrect or spellcheck, and
  use 16 px text on touch screens so iOS doesn't zoom on focus. Line breaks inside pasted keys and IDs are ignored.
- Print: a verified receipt prints as a record with the verdict, the facts, the steps, the redactions and a stamp of when,
  where and against which chain tip it was checked.

## Speed

- Scrolling: 60 fps on every page, measured while scrolling with the mouse moving.
- A check's chain lookup: about 0.12 s on a warm relay.
- With the CPU slowed six times (a budget Android phone): engine start 0.14 s, a full check including the chain lookup
  0.9 s, finding payments 1.1 s.
- The receipt engine (about 340 KB gzipped) loads in idle time, off the critical path.

## Deployment, verified from a fresh clone

- Cloned into an empty folder and ran exactly what the host runs: `npm --prefix web ci` and `npm --prefix web run build`.
- The relay functions compiled to JavaScript and served by bare Node, in both layouts (repository root or `web/`): all three
  endpoints answer correctly against mainnet.
- Two rebuilds of the WebAssembly engine produce byte identical files, and the committed engine matches the source.

## Bugs found and fixed by these checks

| Found by | Bug | Fix |
|---|---|---|
| Fresh clone on bare Node | The relay imported files without extensions, which plain Node refuses: every check on the live site would have failed | Explicit `.js` imports |
| Browser checks against production | Unknown addresses showed the host's bare 404 page, whose inline scripts the security policy blocked | A pre-rendered `404.html` with a real 404 status |
| Browser checks | A receipt checked within minutes of payment failed: the block window ran past the chain tip | The relay trims the window |
| Stalling proxy | A silently dropped connection made the next request hang for 15 s | Idle and stall detection with a fresh connection |
| Engine tests | The decryption key doesn't depend on the value, so an inflated amount still decrypted | The decrypted note must equal the claimed one in full |
| Link fuzzing | A stray `%` in a receipt link crashed the check page | Safe decoding |

## Dependencies

- `npm audit --omit=dev`: two moderate React Router advisories remain; their fix is the next major version. They do not
  apply: Unseal never builds links or navigation from user input, and pre-rendering ships no router hydration data.
- Development only: an esbuild advisory about the local dev server; it never reaches the deployed site.

## Known limits

- Automated browser checks run in Chromium; Safari and Firefox were reviewed by feature support, not by a test runner.
- The relay is open, like a public lightwalletd, and relies on the host's abuse protection.
- Lighthouse runs against a local server without compression; the host compresses, so real scores are equal or better.
