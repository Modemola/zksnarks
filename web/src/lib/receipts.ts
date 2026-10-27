/**
 * Receipts, end to end, in the browser. The cryptography runs in WebAssembly
 * (core/ in the repository); this file only fetches public chain data and
 * walks through the steps so the page can show each one.
 */
import wasmUrl from "../zreceipt/zreceipt_bg.wasm?url";
import { getJson, postJson } from "./api";

type Wasm = typeof import("../zreceipt/zreceipt");
let wasm: Promise<Wasm> | null = null;

/** Loads the receipt engine once. Safe to call early to warm it up. */
export function engine(): Promise<Wasm> {
  wasm ??= import("../zreceipt/zreceipt")
    .then(async (m) => {
      await m.default({ module_or_path: wasmUrl });
      return m;
    })
    .catch((e: unknown) => {
      wasm = null; // the next click tries again
      throw new Error(`engine: ${e instanceof Error ? e.message : String(e)}`);
    });
  return wasm;
}

/**
 * Starts downloading the engine once the page is idle, so the first click
 * doesn't wait for it. Pages that check or make receipts call this on mount.
 */
export function warmEngine() {
  if (typeof window === "undefined" || wasm) return;
  const go = () => void engine().catch(() => undefined); // the real click retries
  if ("requestIdleCallback" in window) window.requestIdleCallback(go, { timeout: 3000 });
  else setTimeout(go, 1500);
}

export type Network = "mainnet" | "testnet";

export type Memo = { kind: "empty" } | { kind: "text"; text: string } | { kind: "binary"; hex: string };

export interface Proven {
  txid: string;
  height: number;
  network: Network;
  pool: "Orchard" | "Ironwood";
  actionIndex: number;
  actionCount: number;
  value: number;
  valueZec: string;
  recipient: string;
  memo: Memo;
}

export interface Block {
  height: number;
  hash: string;
  time: number;
  txids: string[];
}

export interface Checked extends Proven {
  block: Block;
  tip: number;
  confirmations: number;
  /** The blocks fetched, so the page can say how many the relay saw. */
  range: [number, number];
}

/** One step of the check, for the page to draw. */
export interface Step {
  id: string;
  label: string;
  state: "waiting" | "running" | "done" | "failed";
  detail?: string;
}

const STEPS: Omit<Step, "state">[] = [
  { id: "read", label: "Read the receipt" },
  { id: "txid", label: "Rebuild the transaction ID from the transaction itself" },
  { id: "open", label: "Open the one payment the receipt names" },
  { id: "match", label: "Match it to the commitment recorded on chain" },
  { id: "fetch", label: "Fetch a range of blocks from the Zcash network" },
  { id: "find", label: "Find the transaction in its block" },
];

export const freshSteps = (): Step[] => STEPS.map((s) => ({ ...s, state: "waiting" }));

/** A thrown error the page can show as is. */
export class Plain extends Error {
  readonly plain = true;
}

type Fail = { ok: false; error: string };
const parse = <T>(json: string): T => {
  const r = JSON.parse(json) as ({ ok: true } & T) | Fail;
  if (!r.ok) throw new Plain(r.error);
  return r as T;
};

/** Blocks are fetched in aligned windows, so the relay learns a range, never the payment. */
export const WINDOW = 16;
/** The aligned window of blocks around a height. The relay trims it to the chain tip. */
const windowFor = (height: number): [number, number] => {
  const start = height - (height % WINDOW);
  return [start, start + WINDOW - 1];
};

/**
 * Checks a receipt: the cryptography locally, then that the transaction was
 * mined where the receipt says. Calls `onStep` as each step changes.
 */
export async function checkReceipt(text: string, onStep: (steps: Step[]) => void): Promise<Checked> {
  const steps = freshSteps();
  const set = (id: string, state: Step["state"], detail?: string) => {
    const s = steps.find((x) => x.id === id)!;
    s.state = state;
    if (detail !== undefined) s.detail = detail;
    onStep(steps.map((x) => ({ ...x })));
  };
  const pause = () => new Promise((r) => setTimeout(r, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 260));
  let current = "read";
  try {
    set("read", "running");
    const w = await engine();
    const info = parse<{ network: Network; height: number; pool: string; bytes: number }>(w.receiptInfo(text));
    set("read", "done", `${info.network}, block ${info.height.toLocaleString("en-US")}, ${info.pool}`);
    // Start the network request now; it runs while the cryptography does.
    const range = windowFor(info.height);
    const blocks = getJson<{ tip: number; blocks: Block[] }>(
      `/api/blocks?network=${info.network}&start=${range[0]}&end=${range[1]}`,
      { timeoutMs: 20000 },
    );
    blocks.catch(() => undefined);

    current = "txid";
    set("txid", "running");
    await pause();
    const { txid } = parse<{ txid: string }>(w.receiptTransactionId(text));
    set("txid", "done", txid);
    current = "open";
    set("open", "running");
    await pause();
    let proven: Proven;
    try {
      proven = parse<Proven>(w.verifyReceipt(text));
    } catch (e) {
      // The engine checks opening and matching together; say which part failed.
      if (e instanceof Plain && /does not match/.test(e.message)) {
        set("open", "done", "Found the payment the receipt points at");
        current = "match";
      }
      throw e;
    }
    set("open", "done", `Payment ${proven.actionIndex + 1} of ${proven.actionCount}; the other ${proven.actionCount - 1} stay sealed`);
    current = "match";
    set("match", "running");
    await pause();
    set("match", "done", `${proven.valueZec} ZEC to the recipient, memo included`);

    current = "fetch";
    set("fetch", "running");
    const got = await blocks;
    const fetched: [number, number] = [range[0], Math.min(range[1], got.tip)];
    set("fetch", "done", `Blocks ${fetched[0].toLocaleString("en-US")} to ${fetched[1].toLocaleString("en-US")}`);
    current = "find";
    set("find", "running");
    await pause();
    const block = got.blocks.find((b) => b.height === proven.height);
    if (!block || !block.txids.includes(proven.txid)) {
      throw new Plain(
        block
          ? `The transaction is not in block ${proven.height.toLocaleString("en-US")}. The receipt may name the wrong block, or the payment was never mined.`
          : `Block ${proven.height.toLocaleString("en-US")} is not on the network yet. If the payment is very recent, try again in a few minutes.`,
      );
    }
    const confirmations = got.tip - proven.height + 1;
    set("find", "done", `${confirmations.toLocaleString("en-US")} confirmation${confirmations === 1 ? "" : "s"}`);
    return { ...proven, block, tip: got.tip, confirmations, range: fetched };
  } catch (e) {
    set(current, "failed", e instanceof Plain ? e.message : undefined);
    throw e;
  }
}

export interface Payment {
  direction: "received" | "sent";
  pool: "Orchard" | "Ironwood";
  actionIndex: number;
  value: number;
  valueZec: string;
  recipient: string;
  memo: Memo;
  receipt: string;
}

/** The network of a viewing key, or a plain-words error. */
export async function keyNetwork(ufvk: string): Promise<Network> {
  const w = await engine();
  return parse<{ network: Network }>(w.viewingKeyNetwork(ufvk)).network;
}

/**
 * Fetches a transaction and finds the payments the viewing key can see. The
 * key stays in the page; only the transaction ID goes to the relay.
 */
export async function findPayments(ufvk: string, txid: string): Promise<{ height: number; payments: Payment[] }> {
  const w = await engine();
  const network = await keyNetwork(ufvk);
  const tx = await postJson<{ found: boolean; height: number; hex: string }>("/api/tx", { network, txid: txid.replace(/\s+/g, "").toLowerCase() }, { timeoutMs: 20000 });
  if (!tx.found) throw new Error("not found");
  if (!tx.height || tx.height > 1e9) throw new Plain("That transaction has not been mined yet. Wait for one confirmation, then try again.");
  const raw = new Uint8Array(tx.hex.match(/../g)!.map((h) => parseInt(h, 16)));
  const r = parse<{ payments: Payment[] }>(w.findPayments(ufvk, raw, tx.height));
  return { height: tx.height, payments: r.payments };
}

/** Whether a published address includes the receipt's recipient. */
export async function addressMatches(address: string, receipt: string): Promise<boolean> {
  return (await engine()).addressMatches(address, receipt);
}

/** The shareable link for a receipt. The receipt sits after #, which browsers never send to a server. */
export const receiptLink = (receipt: string) => `${location.origin}/check#${receipt}`;

export const short = (s: string, head = 10, tail = 8) => (s.length <= head + tail + 1 ? s : `${s.slice(0, head)}…${s.slice(-tail)}`);

export const memoText = (m: Memo) => (m.kind === "text" ? m.text : m.kind === "empty" ? "No memo" : `Binary data (${m.hex.length / 2} bytes)`);
