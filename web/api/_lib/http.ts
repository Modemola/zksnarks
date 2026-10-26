import type { IncomingMessage, ServerResponse } from "node:http";
import type { Network } from "./lwd";

export type Req = IncomingMessage & { body?: unknown };
export type Res = ServerResponse;

export function send(res: Res, status: number, body: unknown, cache = "no-store") {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", cache);
  res.end(JSON.stringify(body));
}

export function query(req: Req): URLSearchParams {
  return new URL(req.url ?? "/", "http://localhost").searchParams;
}

export function network(v: unknown): Network | null {
  return v === "mainnet" || v === "testnet" ? v : null;
}

/** JSON body, whether or not the platform already parsed it. */
export async function json(req: Req): Promise<Record<string, unknown>> {
  if (req.body && typeof req.body === "object") return req.body as Record<string, unknown>;
  if (typeof req.body === "string") return JSON.parse(req.body);
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

/** Upstream failures as a short message the page turns into plain words. */
export function upstream(res: Res, e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  const notFound = /not found|NotFound|-5|No such/i.test(msg);
  send(res, notFound ? 404 : 502, { error: notFound ? "not found" : "The Zcash server did not answer. Try again in a moment." });
}
