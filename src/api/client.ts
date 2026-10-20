// Thin fetch wrapper. The access token lives in memory only; the refresh token
// is an httpOnly cookie the browser sends to /api/v1/auth/*. On a 401 we try one
// silent refresh, then retry the original request.

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string,
    public fields?: { field: string; message: string }[]) {
    super(message);
  }
}

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_SAFE_RETRIES = 2;
const RETRYABLE_STATUSES = new Set([408, 425, 429, 502, 503, 504]);

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

function retryAfterMs(res: Response): number {
  const raw = res.headers.get("Retry-After");
  if (!raw) return 0;
  const seconds = Number(raw);
  if (Number.isFinite(seconds)) return Math.min(5_000, Math.max(0, seconds * 1_000));
  const at = Date.parse(raw);
  return Number.isNaN(at) ? 0 : Math.min(5_000, Math.max(0, at - Date.now()));
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

async function request(input: RequestInfo | URL, init: RequestInit, safeRetry: boolean): Promise<Response> {
  const attempts = safeRetry ? MAX_SAFE_RETRIES + 1 : 1;
  let lastError: unknown = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const res = await fetchWithTimeout(input, init);
      if (!safeRetry || !RETRYABLE_STATUSES.has(res.status) || attempt === attempts - 1) return res;
      const wait = retryAfterMs(res) || Math.min(2_000, 250 * 2 ** attempt + Math.random() * 250);
      await sleep(wait);
      continue;
    } catch (err) {
      lastError = err;
      if (!safeRetry || attempt === attempts - 1) throw err;
      await sleep(Math.min(2_000, 250 * 2 ** attempt + Math.random() * 250));
    }
  }
  throw lastError ?? new Error("Request failed");
}

let accessToken: string | null = null;
let onSessionLost: (() => void) | null = null;
let refreshing: Promise<boolean> | null = null;

export const setAccessToken = (t: string | null) => { accessToken = t; };
export const getAccessToken = () => accessToken;
export const setSessionLostHandler = (fn: () => void) => { onSessionLost = fn; };

async function parseError(res: Response): Promise<ApiError> {
  let body: any = null;
  try { body = await res.json(); } catch { /* non-JSON error */ }
  const fields = Array.isArray(body?.errors) ? body.errors : undefined;
  const detail = typeof body?.detail === "string" ? body.detail : res.statusText;
  const msg = fields?.length ? fields.map((f: any) => `${f.field}: ${f.message}`).join("; ") : detail;
  return new ApiError(res.status, body?.code ?? "error", msg, fields);
}

export async function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const res = await fetchWithTimeout("/api/v1/auth/refresh", { method: "POST", credentials: "include" });
      if (!res.ok) return false;
      accessToken = (await res.json()).access_token;
      return true;
    } catch { return false; }
    finally { setTimeout(() => { refreshing = null; }, 0); }
  })();
  return refreshing;
}

interface Opts { method?: string; body?: unknown; query?: Record<string, unknown>; headers?: Record<string, string>; auth?: boolean }

export async function api<T = unknown>(path: string, opts: Opts = {}, retried = false): Promise<T> {
  const url = new URL(`/api/v1${path}`, window.location.origin);
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  const headers: Record<string, string> = { ...opts.headers };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.auth !== false && accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const method = (opts.method ?? (opts.body !== undefined ? "POST" : "GET")).toUpperCase();
  const res = await request(url, {
    method,
    headers, credentials: "include",
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  }, method === "GET" || method === "HEAD" || method === "OPTIONS");

  if (res.status === 401 && opts.auth !== false && !retried) {
    if (await refreshSession()) return api<T>(path, opts, true);
    accessToken = null;
    onSessionLost?.();
  }
  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
