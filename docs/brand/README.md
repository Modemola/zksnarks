# Brand assets

The mark is a wax seal with a keyhole: the seal a receipt breaks to open one payment, while everything else stays sealed. It
is the same seal the site draws, and on a check it cracks in two.

| File | Use |
|---|---|
| `unseal-logo.png` | 1024 × 1024 square logo with the wordmark: the submission's project logo |
| `unseal-icon.png` | 1024 × 1024 mark alone: avatars and app icons |
| `unseal-cover.png` | 1600 × 900 cover: headline, the receipt slip, and four facts |
| `unseal-mark.svg` | Vector source, for any size not covered above |
| `../../web/public/og.png` | 1200 × 630 social preview card |
| `../../web/public/favicon.svg` | Favicon and the logo in the site's header |
| `../../web/public/apple-touch-icon.png` | 180 × 180 home screen icon |

The palette is "Ledger": paper `#f4f1e9`, ink `#15171c`, seal gold `#f4b728` shading to `#b77c06`, and a deep gold accent
`#8a5a00`. Type is Instrument Serif for display and IBM Plex Sans and IBM Plex Mono for interface and figures: the same
font files the site ships.

Every image here is rendered from `tools/brand/mark.svg` by one script, in the site's own fonts:

```bash
(cd web && npm ci)          # the fonts come from web/node_modules
node tools/brand/render.mjs
```

The figures on the cover (one payment opened, no keys inside a receipt, three shielded pools, sixteen blocks seen by the
relay) are facts of the protocol, described in [SECURITY.md](../SECURITY.md).

Change the mark in `tools/brand/mark.svg` and run the script; the site's favicon and header logo follow, since they are the
same file. The animated seal on the site is drawn in `web/src/components/WaxSeal.tsx`.
