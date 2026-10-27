//! Browser bindings. Every function takes and returns plain strings/bytes and
//! JSON, so the web app needs no generated types.

use serde_json::{json, Value};
use wasm_bindgen::prelude::*;

use crate::{
    address_contains, find_payments, format_zec, network_name, parse_viewing_key, transaction_id,
    verify, Direction, Error, Memo, Receipt,
};

fn memo_json(m: &Memo) -> Value {
    match m {
        Memo::Empty => json!({ "kind": "empty" }),
        Memo::Text(t) => json!({ "kind": "text", "text": t }),
        Memo::Binary(h) => json!({ "kind": "binary", "hex": h }),
    }
}

fn err(e: Error) -> String {
    json!({ "ok": false, "error": e.to_string() }).to_string()
}

/// Reads a receipt without checking it: network, height and size, so the page
/// can start fetching the block while the check runs.
#[wasm_bindgen(js_name = receiptInfo)]
pub fn receipt_info(text: &str) -> String {
    match Receipt::decode(text) {
        Ok(r) => json!({
            "ok": true,
            "network": network_name(r.network),
            "height": r.height,
            "pool": r.pool.name(),
            "bytes": r.to_bytes().len(),
        })
        .to_string(),
        Err(e) => err(e),
    }
}

/// The transaction ID inside a receipt, computed from the transaction's bytes.
#[wasm_bindgen(js_name = receiptTransactionId)]
pub fn receipt_transaction_id(text: &str) -> String {
    match Receipt::decode(text).and_then(|r| transaction_id(&r)) {
        Ok(txid) => json!({ "ok": true, "txid": txid }).to_string(),
        Err(e) => err(e),
    }
}

/// Checks a receipt against the transaction inside it.
#[wasm_bindgen(js_name = verifyReceipt)]
pub fn verify_receipt(text: &str) -> String {
    let r = match Receipt::decode(text) {
        Ok(r) => r,
        Err(e) => return err(e),
    };
    match verify(&r) {
        Ok(p) => json!({
            "ok": true,
            "txid": p.txid,
            "height": p.height,
            "network": network_name(p.network),
            "pool": p.pool.name(),
            "actionIndex": p.action_index,
            "actionCount": p.action_count,
            "value": p.value,
            "valueZec": format_zec(p.value),
            "recipient": p.recipient,
            "memo": memo_json(&p.memo),
        })
        .to_string(),
        Err(e) => err(e),
    }
}

/// Finds the payments a viewing key received or sent in a transaction, each
/// with its receipt. Runs locally; the key never leaves the page.
#[wasm_bindgen(js_name = findPayments)]
pub fn find_payments_js(ufvk: &str, raw_tx: &[u8], height: u32) -> String {
    match find_payments(ufvk, raw_tx, height) {
        Ok(found) => json!({
            "ok": true,
            "payments": found.iter().map(|f| json!({
                "direction": match f.direction { Direction::Received => "received", Direction::Sent => "sent" },
                "pool": f.pool.name(),
                "actionIndex": f.action_index,
                "value": f.value,
                "valueZec": format_zec(f.value),
                "recipient": f.recipient,
                "memo": memo_json(&f.memo),
                "receipt": f.receipt.encode(),
            })).collect::<Vec<_>>(),
        })
        .to_string(),
        Err(e) => err(e),
    }
}

/// The network a viewing key belongs to, or an error.
#[wasm_bindgen(js_name = viewingKeyNetwork)]
pub fn viewing_key_network(ufvk: &str) -> String {
    match parse_viewing_key(ufvk) {
        Ok((n, _)) => json!({ "ok": true, "network": network_name(n) }).to_string(),
        Err(e) => err(e),
    }
}

/// Whether a published address includes the receipt's recipient.
#[wasm_bindgen(js_name = addressMatches)]
pub fn address_matches(address: &str, receipt: &str) -> bool {
    Receipt::decode(receipt)
        .map(|r| address_contains(address, r.network, r.pool, &r.recipient))
        .unwrap_or(false)
}
