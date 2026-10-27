/** Talking to the relay: JSON, a timeout, and errors friendlyError understands. */
export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

/** AbortSignal.timeout, with a fallback for browsers that lack it (Safari before 16). */
function timeout(ms: number): AbortSignal {
  if (typeof AbortSignal.timeout === "function") return AbortSignal.timeout(ms);
  const c = new AbortController();
  setTimeout(() => c.abort(new DOMException("timed out", "TimeoutError")), ms);
  return c.signal;
}

async function request<T>(path: string, { timeoutMs = 8000, ...init }: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const res = await fetch(API_URL + path, { ...init, signal: timeout(timeoutMs) }).catch((e: Error) => {
    throw new Error(e.name === "TimeoutError" || e.name === "AbortError" ? "timed out" : e.message);
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error && res.status === 400 ? body.error : `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export const getJson = <T>(path: string, init?: RequestInit & { timeoutMs?: number }) => request<T>(path, init);

export const postJson = <T>(path: string, body: unknown, init?: RequestInit & { timeoutMs?: number }) =>
  request<T>(path, { ...init, method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
