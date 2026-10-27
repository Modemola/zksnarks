# Deploying and building

## The site on Vercel

Import the repository in Vercel. Either layout works with no settings changed:

| Root Directory | What Vercel uses |
|---|---|
| The repository root | `vercel.json` at the root: installs and builds `web/`, serves `web/dist`, and deploys the relay from `api/` (each file there re-exports its function from `web/api/`) |
| `web` | `web/vercel.json`: the same build and headers, with the relay in `web/api/` |

No environment variables are needed. Two are optional:

| Variable | Default | Use |
|---|---|---|
| `LWD_MAINNET` | `zec.rocks` | The lightwalletd server for mainnet |
| `LWD_TESTNET` | `testnet.zec.rocks` | The lightwalletd server for testnet |

The build type checks the site and the relay, builds the site, and pre-renders the home, check, make and how it works pages
into static HTML. Addresses that match no page are answered by `404.html` with a real 404 status, and the app draws its own
not found page. Both `vercel.json` files set the security headers listed in [SECURITY.md](SECURITY.md).

`web/.env` holds `VITE_SITE_URL`, the public address used in canonical links and social cards. Change it when deploying under
another address.

## Running your own relay

The relay is three stateless functions with no dependencies beyond Node:

| Endpoint | Answers |
|---|---|
| `GET /api/tip?network=mainnet` | The current block height |
| `GET /api/blocks?network=mainnet&start=…&end=…` | Up to 32 compact blocks, trimmed to the chain tip |
| `POST /api/tx` with `{"network":"mainnet","txid":"…"}` | The raw transaction and its height, or `{"found":false}` |

They speak gRPC to lightwalletd over HTTP/2 directly, so there is no generated code or gRPC library. Deploy your own copy of
the site, or point the command line tool at any deployment with `--relay` or `UNSEAL_RELAY`.

## Running the site locally

```bash
cd web
npm ci
npm run dev          # http://localhost:5173, with the relay inside the dev server
npm run build        # what the host runs
npm run preview      # serves the built site
```

## The receipt engine in the browser

The site uses the Rust engine compiled to WebAssembly. The build output is committed in `web/src/zreceipt/`, so hosting the
site needs no Rust toolchain. After changing `core/`, rebuild it:

```bash
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.129
scripts/build-wasm.sh
```

Two rebuilds on the same machine produce byte identical files. CI compiles the engine for the browser on every push.

## Tests and tools

```bash
cargo test --workspace                       # the engine: 14 tests, offline
(cd tools && npm install)                    # browser tooling, once
node tools/e2e/receipts.mjs [site]           # every flow against the live chain (default: the production site)
sh tools/audit/run.sh                        # accessibility, keyboard, 16 screen sizes, outages, Lighthouse
node tools/brand/render.mjs                  # brand images, from tools/brand/mark.svg
node tools/brand/screens.mjs [site]          # the screenshots in docs/screens
```

Without `npm install` in `tools/`, the scripts use a global Playwright install if there is one.
