#!/bin/sh
# Builds the receipt library for the browser into web/src/zreceipt/.
# The output is committed, so the site builds without a Rust toolchain.
set -e
cd "$(dirname "$0")/.."
cargo build --release --target wasm32-unknown-unknown -p zreceipt
wasm-bindgen --target web --out-dir web/src/zreceipt --out-name zreceipt target/wasm32-unknown-unknown/release/zreceipt.wasm
if command -v wasm-opt >/dev/null; then wasm-opt -Oz web/src/zreceipt/zreceipt_bg.wasm -o web/src/zreceipt/zreceipt_bg.wasm; fi
ls -la web/src/zreceipt
