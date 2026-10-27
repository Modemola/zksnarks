# Quality record

What was checked, how, and the result. Every check can be rerun from this repository.

## How to check it yourself

| What | Command | Result |
|---|---|---|
| Receipt library | `cargo test -p zreceipt` | 10 pass: Orchard and Ironwood round trips, every kind of tampering (amount, recipient, seed, other output, pool), a real NU7 testnet transaction, and the real mainnet demo receipt with its forged copy |
| Lints | `cargo clippy -p zreceipt -p unseal-cli` | No warnings |
| Types | `npm run typecheck` in `web/` | Clean, site and relay |
| Accessibility, keyboard, layout, outages, copy, pre-rendering | `audit/run.sh` | 0 axe violations in light and dark; every control reachable by keyboard with visible focus; 80/80 page and screen-size combinations clean (16 sizes, 280 px fold to 2560 px); layout shift ≤ 0.001; all pages pre-rendered and hydrated without errors |
| Lighthouse (phone / desktop) | `audit/run.sh` | Home 91 / 100, Check 95 / 100, Make 94 / 100 for performance (uncompressed local server; the host compresses); 100 for accessibility, best practices and SEO everywhere |

## End-to-end checks in a real browser (Chromium)

45 scripted checks, all passing, including:

- The home page check of the real mainnet receipt; "Check again"; the Genuine / Forged copy switch (the forgery fails at "Match it to the commitment")
- A receipt opened from a link checks itself; pasted with line breaks, or as a whole link; truncated (rejected in plain words)
- "Was it paid to you?": yes for the shop's address, no for another, no verdict for garbage
- Making a receipt with the payer's key ("You sent") and the shop's key ("You received") gives the identical receipt; copy, download and "Check it now" work; the demo wallet button works
- Every form message: empty fields, incoming-only and Sapling-only keys, short and unknown transaction IDs, a key on the other network, a key that took no part, a corrupted key
- No console errors anywhere

## Failure behaviour

| Situation | What the visitor sees |
|---|---|
| Relay unreachable, erroring or very slow | "The check couldn't finish", with the reason in plain words; never a false "Paid" |
| Receipt engine fails to download | "The receipt checker didn't download", and the next click retries |
| A page's code is missing (old tab after a redeploy) | A recovery page with Reload, not a blank screen |
| A reused relay connection dropped silently by the network | Detected after 3 s and retried on a fresh connection (reproduced with a stalling proxy) |
| A payment from the last few minutes | Checks normally (the relay trims the block window to the chain tip) |

## Responsiveness

- Touch screens: every control at least 44 × 44 px (phone, landscape phone, tablet)
- Text at 200%: no clipping and no sideways scrolling on any page
- Extreme content: a 512-character memo with no spaces, a 21-million-ZEC amount, and mixed emoji, Hebrew and Chinese text stay inside their boxes on a 360 px phone and on desktop

## Security headers

- Content-Security-Policy: scripts only from the site (plus WebAssembly), network requests only to the site's own relay, no framing; no inline scripts. All flows run on the production build with the policy enforced and report 0 violations.
- Strict-Transport-Security, Referrer-Policy `no-referrer` (receipt links never leak through the Referer header), X-Content-Type-Options, Cross-Origin-Opener-Policy, a restrictive Permissions-Policy.

## Speed

- Scrolling: 60 fps on every page (16.7 ms per frame, measured while scrolling with the mouse moving)
- A check's chain lookup: about 0.12 s on a warm relay
- First paint about 0.1 s on a fast connection; the 320 KB (compressed) receipt engine loads in idle time, not on the critical path

## Browser support

Current Chrome, Edge, Firefox and Safari. Fallbacks for `AbortSignal.timeout` and `requestIdleCallback` (older Safari); border and rule colours are plain rgba, so they render correctly without `color-mix()`.

## Deployment, verified from a fresh clone

- Cloned from GitHub into an empty folder and ran exactly what the host runs: `npm --prefix web ci`, `npm --prefix web run build` (all pages pre-rendered; every static file present).
- The relay functions compiled to JavaScript and served by bare Node (no dev tooling), in both layouts (Root Directory `web` or the repository root): all three endpoints answer correctly against mainnet. This caught and fixed a real bug: extensionless imports that plain Node refuses to load.
- `cargo test -p zreceipt` (10 pass) and the CLI build and verify the demo receipt from the fresh clone.
- The committed WebAssembly engine matches the source: two rebuilds produce byte-identical files.

## Privacy, verified by recording every request

Across every flow (home check, link check, address match, making a receipt with a pasted key and with the demo wallet), 156 requests were recorded with their bodies:

- Hosts contacted: the site only (no fonts, analytics or other third parties)
- Viewing keys: in no request, in full or in part
- The receipt itself: in no request
- The address typed into "Was it paid to you?": in no request
- The whole relay traffic: `GET /api/tip`, `GET /api/blocks` for a 16-block range, `POST /api/tx` with a network and a transaction ID

## The cryptographic guarantee, checked in the library source

`try_output_recovery_with_pkd_esk` (zcash_note_encryption 0.5.1) returns a note only if the ciphertext authenticates (ChaCha20-Poly1305), the ephemeral secret derived from the note equals the one used (ZIP 212), the note's commitment equals the on-chain `cmx`, and the derived ephemeral public key equals the on-chain one. Unseal then also requires the note to equal the receipt's claim in full.

## Low-end phones

With the CPU slowed 6× (a budget Android): engine start 0.14 s, a full check including the chain lookup 0.9 s, finding payments 1.1 s.

## Mobile typing and links

- Key, transaction ID, address and receipt fields: no auto-capitalisation, autocorrect or spellcheck; 16 px on touch screens so iOS doesn't zoom on focus.
- Line breaks and spaces inside pasted keys and transaction IDs are ignored (site and CLI).
- A receipt link mangled in transit (a stray `%`) shows "damaged", not a crash. A checked receipt stays in the address bar after `#`, so a refresh keeps it.

## Print

A verified receipt prints as a two-page record: the verdict, the facts, the steps, what stayed private, the redactions (printed in colour), and a stamp of when, where and against which chain tip it was checked.

## Dependencies

- `npm audit --omit=dev`: two moderate React Router advisories remain; their fix is the next major version. Assessed as not applicable: Unseal never builds links or navigation from user input (the only dynamic link is a receipt our engine produced, base64url, no backslashes), and pre-rendering passes `hydrate={false}`, so no router hydration data is shipped.
- Development only: an esbuild advisory about the local dev server; it never reaches the deployed site.
- React Router upgraded 6.28.0 → 6.30.6 and Vite 5.4.11 → 5.4.21 for the advisories that had non-breaking fixes.

## Known limits

- Automated browser checks ran in Chromium; Safari and Firefox were reviewed by feature support, not driven by a test runner.
- The relay is open (any site visitor can request blocks and transactions through it), like a public lightwalletd; it relies on the host's own abuse protection rather than its own rate limits.
- Lighthouse ran against a local server without compression.
