//! `unseal`: make and check receipts for shielded Zcash payments.
//!
//! The cryptography runs locally (the `zreceipt` library). Chain data comes
//! from an Unseal relay: the public site's by default, or your own with
//! `--relay`. Checking asks the relay for a range of blocks, never for the
//! transaction itself.

use std::{fs, io::Read, process::ExitCode, time::Duration};

use clap::{Parser, Subcommand};
use serde_json::Value;
use zreceipt::{
    address_contains, find_payments, format_zec, network_name, parse_viewing_key,
    recipient_address, transaction_id, verify, Direction, Memo, Proven, Receipt,
};

/// Blocks are fetched in aligned windows of this size (the site does the same).
const WINDOW: u32 = 16;

#[derive(Parser)]
#[command(
    name = "unseal",
    version,
    about = "Receipts for shielded Zcash payments: prove one payment, keep the rest sealed."
)]
struct Cli {
    /// Relay to fetch chain data from (an Unseal site, or your own deployment of its api/).
    #[arg(
        long,
        global = true,
        env = "UNSEAL_RELAY",
        default_value = "https://unseall.vercel.app"
    )]
    relay: String,
    /// Print JSON instead of text.
    #[arg(long, global = true)]
    json: bool,
    #[command(subcommand)]
    cmd: Cmd,
}

#[derive(Subcommand)]
enum Cmd {
    /// Check a receipt: open its payment locally, then confirm the transaction was mined.
    Check {
        /// The receipt (zr1…), a receipt link, a file containing one, or - for stdin.
        receipt: String,
        /// Also say whether the payment went to this unified address.
        #[arg(long)]
        address: Option<String>,
        /// Skip the chain lookup; check only what the receipt itself proves.
        #[arg(long)]
        offline: bool,
    },
    /// Find the payments a viewing key sent or received in a transaction, with their receipts.
    Create {
        /// Unified full viewing key (uview1…), a file containing it, or - for stdin.
        /// The key is used locally and never sent anywhere.
        #[arg(long, env = "UNSEAL_VIEWING_KEY", hide_env_values = true)]
        key: String,
        /// Transaction ID. The relay is asked for this transaction.
        #[arg(long, conflicts_with = "raw_tx")]
        txid: Option<String>,
        /// Use a raw transaction from a file (hex or binary) instead of fetching it.
        #[arg(long, requires = "height")]
        raw_tx: Option<String>,
        /// Block height of --raw-tx.
        #[arg(long)]
        height: Option<u32>,
        /// Base URL of the check page, for printing links.
        #[arg(long, default_value = "https://unseall.vercel.app/check")]
        link_base: String,
    },
    /// Show what a receipt says, without checking it.
    Inspect {
        /// The receipt (zr1…), a receipt link, a file containing one, or - for stdin.
        receipt: String,
    },
}

fn main() -> ExitCode {
    let cli = Cli::parse();
    let result = match &cli.cmd {
        Cmd::Check {
            receipt,
            address,
            offline,
        } => check(&cli, receipt, address.as_deref(), *offline),
        Cmd::Create {
            key,
            txid,
            raw_tx,
            height,
            link_base,
        } => create(
            &cli,
            key,
            txid.as_deref(),
            raw_tx.as_deref(),
            *height,
            link_base,
        ),
        Cmd::Inspect { receipt } => inspect(&cli, receipt),
    };
    match result {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            if cli.json {
                println!("{}", serde_json::json!({ "ok": false, "error": e }));
            } else {
                eprintln!("unseal: {e}");
            }
            ExitCode::FAILURE
        }
    }
}

/// An argument that may be the value itself, a file, or - for stdin.
fn read_arg(arg: &str) -> Result<String, String> {
    if arg == "-" {
        let mut s = String::new();
        std::io::stdin()
            .read_to_string(&mut s)
            .map_err(|e| format!("reading stdin: {e}"))?;
        return Ok(s.trim().to_owned());
    }
    if arg.starts_with("zr1") || arg.starts_with("uview") || arg.contains("#zr1") {
        return Ok(arg.to_owned());
    }
    match fs::read_to_string(arg) {
        Ok(s) => Ok(s.trim().to_owned()),
        Err(_) => Ok(arg.to_owned()),
    }
}

/// An HTTP client. The environment's proxy is used only for remote HTTPS
/// relays, so a relay on localhost is always reached directly.
fn agent(url: &str) -> ureq::Agent {
    let local = url.starts_with("http://localhost") || url.starts_with("http://127.0.0.1");
    ureq::AgentBuilder::new()
        .try_proxy_from_env(!local)
        .timeout(Duration::from_secs(30))
        .build()
}

fn relay_get(relay: &str, path: &str) -> Result<Value, String> {
    let url = format!("{}{path}", relay.trim_end_matches('/'));
    agent(&url)
        .get(&url)
        .call()
        .map_err(|e| relay_error(relay, e))?
        .into_json()
        .map_err(|e| format!("the relay sent something unexpected: {e}"))
}

fn relay_post(relay: &str, path: &str, body: Value) -> Result<Value, String> {
    let url = format!("{}{path}", relay.trim_end_matches('/'));
    agent(&url)
        .post(&url)
        .send_json(body)
        .map_err(|e| relay_error(relay, e))?
        .into_json()
        .map_err(|e| format!("the relay sent something unexpected: {e}"))
}

fn relay_error(relay: &str, e: ureq::Error) -> String {
    match e {
        ureq::Error::Status(404, _) => "the Zcash network has no transaction with that ID".into(),
        ureq::Error::Status(code, r) => {
            let msg = r
                .into_json::<Value>()
                .ok()
                .and_then(|v| v["error"].as_str().map(str::to_owned));
            msg.unwrap_or_else(|| format!("the relay answered {code}"))
        }
        ureq::Error::Transport(t) => format!("can't reach the relay at {relay}: {t}"),
    }
}

fn memo_text(m: &Memo) -> String {
    match m {
        Memo::Empty => "(no memo)".into(),
        Memo::Text(t) => t.clone(),
        Memo::Binary(h) => format!("(binary) {h}"),
    }
}

fn memo_json(m: &Memo) -> Value {
    match m {
        Memo::Empty => serde_json::json!({ "kind": "empty" }),
        Memo::Text(t) => serde_json::json!({ "kind": "text", "text": t }),
        Memo::Binary(h) => serde_json::json!({ "kind": "binary", "hex": h }),
    }
}

fn proven_json(p: &Proven) -> Value {
    serde_json::json!({
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
}

fn check(cli: &Cli, arg: &str, address: Option<&str>, offline: bool) -> Result<(), String> {
    let receipt = Receipt::decode(&read_arg(arg)?).map_err(|e| e.to_string())?;
    let proven = verify(&receipt).map_err(|e| e.to_string())?;
    let paid_to_you =
        address.map(|a| address_contains(a, receipt.network, receipt.pool, &receipt.recipient));

    // Confirm the transaction is in the block the receipt names, asking for a
    // whole window of blocks so the relay can't tell which payment this is.
    let mined = if offline {
        None
    } else {
        let net = network_name(receipt.network);
        let start = receipt.height - receipt.height % WINDOW;
        // The relay trims the window to the chain tip.
        let end = start + WINDOW - 1;
        let got = relay_get(
            &cli.relay,
            &format!("/api/blocks?network={net}&start={start}&end={end}"),
        )?;
        let block = got["blocks"]
            .as_array()
            .and_then(|b| {
                b.iter()
                    .find(|b| b["height"].as_u64() == Some(receipt.height as u64))
            })
            .cloned();
        let found = block
            .as_ref()
            .and_then(|b| b["txids"].as_array())
            .is_some_and(|t| t.iter().any(|t| t.as_str() == Some(proven.txid.as_str())));
        if !found {
            return Err(match block {
                Some(_) => format!(
                    "the receipt is internally consistent, but transaction {} is not in block {}; it may name the wrong block or was never mined",
                    proven.txid, receipt.height
                ),
                None => format!("block {} is not on the network yet; try again in a few minutes", receipt.height),
            });
        }
        let tip = got["tip"].as_u64().unwrap_or(receipt.height as u64) as u32;
        Some((tip.saturating_sub(receipt.height) + 1, start, end.min(tip)))
    };

    if cli.json {
        let mut v = proven_json(&proven);
        v["ok"] = true.into();
        v["mined"] = mined
            .map(|(c, s, e)| serde_json::json!({ "confirmations": c, "blocksFetched": [s, e] }))
            .unwrap_or(Value::Null);
        v["paidToAddress"] = paid_to_you.map(Value::from).unwrap_or(Value::Null);
        println!("{v}");
        return Ok(());
    }
    println!("Receipt checks out.");
    println!();
    println!("  Amount     {} ZEC", format_zec(proven.value));
    println!("  Paid to    {}", proven.recipient);
    println!("  Memo       {}", memo_text(&proven.memo));
    println!("  Tx         {}", proven.txid);
    println!(
        "  Block      {} ({})",
        proven.height,
        network_name(proven.network)
    );
    println!(
        "  Pool       {}, payment {} of {}",
        proven.pool.name(),
        proven.action_index + 1,
        proven.action_count
    );
    match mined {
        Some((c, s, e)) => println!("  Mined      yes, {c} confirmations (fetched blocks {s}-{e})"),
        None => println!("  Mined      not checked (--offline)"),
    }
    if let Some(m) = paid_to_you {
        println!(
            "  Your addr  {}",
            if m {
                "yes, this paid your address"
            } else {
                "NO, this did not pay that address"
            }
        );
    }
    println!();
    println!("Not revealed: the sender, the other {} payment(s) in the transaction, and any later spend.", proven.action_count - 1);
    Ok(())
}

fn create(
    cli: &Cli,
    key: &str,
    txid: Option<&str>,
    raw_tx: Option<&str>,
    height: Option<u32>,
    link_base: &str,
) -> Result<(), String> {
    // Keys never contain whitespace; drop any that copying added (line breaks, spaces).
    let key: String = read_arg(key)?.split_whitespace().collect();
    let (network, _) = parse_viewing_key(&key).map_err(|e| e.to_string())?;
    let (raw, height) = match (txid, raw_tx) {
        (Some(txid), _) => {
            let txid: String = txid.split_whitespace().collect::<String>().to_lowercase();
            if txid.len() != 64 || !txid.chars().all(|c| c.is_ascii_hexdigit()) {
                return Err("a transaction ID is 64 characters of 0-9 and a-f".into());
            }
            let r = relay_post(
                &cli.relay,
                "/api/tx",
                serde_json::json!({ "network": network_name(network), "txid": txid }),
            )?;
            if r["found"] == false {
                return Err("the Zcash network has no transaction with that ID".into());
            }
            let h = r["height"].as_u64().unwrap_or(0);
            if h == 0 || h > u32::MAX as u64 {
                return Err(
                    "that transaction has not been mined yet; wait for one confirmation".into(),
                );
            }
            let raw = hex::decode(r["hex"].as_str().unwrap_or(""))
                .map_err(|_| "the relay sent a damaged transaction")?;
            (raw, h as u32)
        }
        (None, Some(path)) => {
            let bytes = fs::read(path).map_err(|e| format!("reading {path}: {e}"))?;
            let text = String::from_utf8_lossy(&bytes);
            let raw = hex::decode(text.trim()).unwrap_or(bytes);
            (raw, height.expect("clap requires --height"))
        }
        (None, None) => return Err("give --txid, or --raw-tx with --height".into()),
    };
    if let Some(txid) = txid {
        // The relay is only trusted for availability: the bytes must hash to the ID asked for.
        let r = Receipt {
            network,
            pool: zreceipt::Pool::Orchard,
            height,
            action_index: 0,
            recipient: [0; 43],
            value: 0,
            rseed: [0; 32],
            tx: raw.clone(),
        };
        let got = transaction_id(&r).map_err(|e| e.to_string())?;
        if got != txid.split_whitespace().collect::<String>().to_lowercase() {
            return Err(format!(
                "the relay returned a different transaction ({got}); not using it"
            ));
        }
    }
    let found = find_payments(&key, &raw, height).map_err(|e| e.to_string())?;
    if cli.json {
        let list: Vec<Value> = found
            .iter()
            .map(|f| {
                serde_json::json!({
                    "direction": match f.direction { Direction::Received => "received", Direction::Sent => "sent" },
                    "pool": f.pool.name(),
                    "actionIndex": f.action_index,
                    "value": f.value,
                    "valueZec": format_zec(f.value),
                    "recipient": f.recipient,
                    "memo": memo_json(&f.memo),
                    "receipt": f.receipt.encode(),
                    "link": format!("{link_base}#{}", f.receipt.encode()),
                })
            })
            .collect();
        println!(
            "{}",
            serde_json::json!({ "ok": true, "height": height, "payments": list })
        );
        return Ok(());
    }
    if found.is_empty() {
        println!(
            "This key didn't send or receive any Orchard or Ironwood payment in that transaction."
        );
        return Ok(());
    }
    for (i, f) in found.iter().enumerate() {
        let dir = match f.direction {
            Direction::Received => "received",
            Direction::Sent => "sent",
        };
        println!(
            "[{}] {} {} ZEC  ({}, payment {})",
            i + 1,
            dir,
            format_zec(f.value),
            f.pool.name(),
            f.action_index + 1
        );
        println!("    to    {}", f.recipient);
        println!("    memo  {}", memo_text(&f.memo));
        println!("    link  {link_base}#{}", f.receipt.encode());
        println!();
    }
    println!("Share one link per payment. Each opens that payment and nothing else.");
    Ok(())
}

fn inspect(cli: &Cli, arg: &str) -> Result<(), String> {
    let r = Receipt::decode(&read_arg(arg)?).map_err(|e| e.to_string())?;
    let v = serde_json::json!({
        "ok": true,
        "network": network_name(r.network),
        "pool": r.pool.name(),
        "height": r.height,
        "actionIndex": r.action_index,
        "claimedValueZec": format_zec(r.value),
        "recipient": recipient_address(r.network, r.pool, &r.recipient),
        "transactionBytes": r.tx.len(),
        "checked": false,
    });
    if cli.json {
        println!("{v}");
    } else {
        println!("Unchecked receipt (run `unseal check` to verify it):");
        println!("  Network    {}", network_name(r.network));
        println!("  Block      {}", r.height);
        println!(
            "  Pool       {}, payment {}",
            r.pool.name(),
            r.action_index + 1
        );
        println!(
            "  Claims     {} ZEC to {}",
            format_zec(r.value),
            recipient_address(r.network, r.pool, &r.recipient)
        );
        println!("  Tx bytes   {}", r.tx.len());
    }
    Ok(())
}
