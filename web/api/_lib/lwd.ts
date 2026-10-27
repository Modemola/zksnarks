/**
 * A minimal lightwalletd client: gRPC over HTTP/2 with hand-written protobuf,
 * so the relay has no dependencies. Only the three calls the site needs.
 */
import http2 from "node:http2";
import net from "node:net";
import tls from "node:tls";

export type Network = "mainnet" | "testnet";

const SERVERS: Record<Network, string> = {
  mainnet: process.env.LWD_MAINNET ?? "zec.rocks",
  testnet: process.env.LWD_TESTNET ?? "testnet.zec.rocks",
};
const SERVICE = "/cash.z.wallet.sdk.rpc.CompactTxStreamer/";

// ---- protobuf, just enough -------------------------------------------------------

function varint(n: number | bigint): Buffer {
  let v = BigInt(n);
  const out: number[] = [];
  do {
    let b = Number(v & 0x7fn);
    v >>= 7n;
    if (v) b |= 0x80;
    out.push(b);
  } while (v);
  return Buffer.from(out);
}

const field = (num: number, wire: number) => varint((num << 3) | wire);
const bytesField = (num: number, b: Buffer) => Buffer.concat([field(num, 2), varint(b.length), b]);
const uintField = (num: number, n: number) => Buffer.concat([field(num, 0), varint(n)]);

type Field = { num: number; wire: number; value: bigint | Buffer };

export function decode(buf: Buffer): Field[] {
  const out: Field[] = [];
  let i = 0;
  const readVarint = () => {
    let v = 0n;
    let s = 0n;
    for (;;) {
      const b = buf[i++];
      if (b === undefined) throw new Error("truncated message");
      v |= BigInt(b & 0x7f) << s;
      s += 7n;
      if (b < 0x80) return v;
    }
  };
  while (i < buf.length) {
    const key = Number(readVarint());
    const num = key >> 3;
    const wire = key & 7;
    if (wire === 0) out.push({ num, wire, value: readVarint() });
    else if (wire === 2) {
      const n = Number(readVarint());
      out.push({ num, wire, value: buf.subarray(i, i + n) });
      i += n;
    } else if (wire === 1) {
      out.push({ num, wire, value: buf.subarray(i, i + 8) });
      i += 8;
    } else if (wire === 5) {
      out.push({ num, wire, value: buf.subarray(i, i + 4) });
      i += 4;
    } else throw new Error(`unsupported wire type ${wire}`);
  }
  return out;
}

const all = (f: Field[], num: number) => f.filter((x) => x.num === num).map((x) => x.value);
const one = (f: Field[], num: number) => all(f, num)[0];

// ---- transport -----------------------------------------------------------------

/** Opens a TLS socket to host:443, through an HTTPS_PROXY tunnel when one is set (local development). */
function connectSocket(host: string): Promise<tls.TLSSocket> {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  const wrap = (socket?: net.Socket) =>
    new Promise<tls.TLSSocket>((resolve, reject) => {
      const s = tls.connect({ host, port: 443, servername: host, ALPNProtocols: ["h2"], ...(socket ? { socket } : {}) }, () => resolve(s));
      s.once("error", reject);
    });
  if (!proxy) return wrap();
  const p = new URL(proxy);
  return new Promise((resolve, reject) => {
    const sock = net.connect(Number(p.port || 80), p.hostname, () => {
      sock.write(`CONNECT ${host}:443 HTTP/1.1\r\nHost: ${host}:443\r\n\r\n`);
    });
    sock.once("error", reject);
    let head = "";
    const onData = (d: Buffer) => {
      head += d.toString("latin1");
      if (!head.includes("\r\n\r\n")) return;
      sock.off("data", onData);
      if (!/^HTTP\/1\.\d 200/.test(head)) return reject(new Error(`proxy refused: ${head.split("\r\n")[0]}`));
      wrap(sock).then(resolve, reject);
    };
    sock.on("data", onData);
  });
}

/**
 * One HTTP/2 session per server, kept open and reused while the process stays
 * warm, so a check costs one TLS handshake at most instead of one per call.
 */
const sessions = new Map<string, Promise<http2.ClientHttp2Session>>();

function session(host: string): Promise<http2.ClientHttp2Session> {
  let s = sessions.get(host);
  if (!s) {
    s = connectSocket(host).then((socket) => {
      const sess = http2.connect(`https://${host}`, { createConnection: () => socket });
      const drop = () => sessions.delete(host);
      sess.on("close", drop);
      sess.on("error", drop);
      sess.on("goaway", drop);
      // Never keep the process alive just for this connection.
      sess.unref();
      sess.setTimeout(60_000, () => sess.close());
      return sess;
    });
    s.catch(() => sessions.delete(host));
    sessions.set(host, s);
  }
  return s;
}

/** One unary or server-streaming gRPC call; returns every response message. Retries once on a stale connection. */
async function call(network: Network, method: string, body: Buffer, timeoutMs = 15000): Promise<Buffer[]> {
  const host = SERVERS[network];
  try {
    return await callOnce(host, method, body, timeoutMs);
  } catch (e) {
    // A reused connection may have been closed by the server between requests.
    if (e instanceof Error && /lightwalletd:|timed out/.test(e.message)) throw e;
    sessions.delete(host);
    return callOnce(host, method, body, timeoutMs);
  }
}

async function callOnce(host: string, method: string, body: Buffer, timeoutMs: number): Promise<Buffer[]> {
  const sess = await session(host);
  if (sess.closed || sess.destroyed) throw new Error("stale session");
  return new Promise<Buffer[]>((resolve, reject) => {
    const frame = Buffer.concat([Buffer.from([0]), Buffer.alloc(4), body]);
    frame.writeUInt32BE(body.length, 1);
    const req = sess.request({
      ":method": "POST",
      ":path": SERVICE + method,
      "content-type": "application/grpc",
      te: "trailers",
    });
    const timer = setTimeout(() => {
      req.close();
      reject(new Error("timed out"));
    }, timeoutMs);
    const chunks: Buffer[] = [];
    let status: string | undefined;
    let message = "";
    const takeStatus = (h: http2.IncomingHttpHeaders) => {
      if (h["grpc-status"] !== undefined) {
        status = String(h["grpc-status"]);
        message = decodeURIComponent(String(h["grpc-message"] ?? ""));
      }
    };
    req.on("response", takeStatus);
    req.on("trailers", takeStatus);
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    req.on("end", () => {
      clearTimeout(timer);
      if (status && status !== "0") return reject(new Error(`lightwalletd: ${message || `status ${status}`}`));
      const raw = Buffer.concat(chunks);
      const msgs: Buffer[] = [];
      for (let i = 0; i + 5 <= raw.length; ) {
        const n = raw.readUInt32BE(i + 1);
        msgs.push(raw.subarray(i + 5, i + 5 + n));
        i += 5 + n;
      }
      resolve(msgs);
    });
    req.end(frame);
  });
}

// ---- the three calls -------------------------------------------------------------

export async function tipHeight(network: Network): Promise<number> {
  const [m] = await call(network, "GetLatestBlock", Buffer.alloc(0));
  return Number(one(decode(m), 1) ?? 0n);
}

/** Full raw transaction by ID (display hex, as wallets and explorers show it). */
export async function getTransaction(network: Network, txidHex: string): Promise<{ height: number; hex: string }> {
  const hash = Buffer.from(txidHex, "hex").reverse();
  const [m] = await call(network, "GetTransaction", bytesField(3, hash));
  const f = decode(m);
  const data = one(f, 1) as Buffer | undefined;
  if (!data?.length) throw new Error("not found");
  return { height: Number(one(f, 2) ?? 0n), hex: data.toString("hex") };
}

export interface BlockSummary {
  height: number;
  hash: string;
  time: number;
  txids: string[];
}

/** Block headers and the IDs of their shielded transactions, for a small range. */
export async function getBlocks(network: Network, start: number, end: number): Promise<BlockSummary[]> {
  const id = (h: number) => uintField(1, h);
  const body = Buffer.concat([bytesField(1, id(start)), bytesField(2, id(end))]);
  const msgs = await call(network, "GetBlockRange", body, 25000);
  return msgs.map((m) => {
    const f = decode(m);
    return {
      height: Number(one(f, 2)),
      hash: Buffer.from(one(f, 3) as Buffer).reverse().toString("hex"),
      time: Number(one(f, 5) ?? 0n),
      txids: all(f, 7).map((tx) => Buffer.from(one(decode(tx as Buffer), 2) as Buffer).reverse().toString("hex")),
    };
  });
}
