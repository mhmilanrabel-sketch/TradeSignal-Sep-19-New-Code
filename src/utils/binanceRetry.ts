// src/utils/binanceRetry.ts
// ═══════════════════════════════════════════════════════════════════════════
// FIXES BUG #7: rate-limit unaware reconcile hitting /userTrades repeatedly
// FIXES BUG #8: kill switch tripping on HTTP 5xx (Binance maintenance) as if
//               the network was down.
//
// Provides:
//   - classifyError(): distinguishes NETWORK vs RATE_LIMIT vs SERVER_5XX
//   - fetchWithBackoff(): exponential retry for transient failures
//   - weight-based rate limiter for Binance REST endpoints
// ═══════════════════════════════════════════════════════════════════════════

export type ErrorClass = 'network' | 'rate_limit' | 'server_5xx' | 'client_4xx' | 'auth' | 'unknown';

export interface ClassifiedError {
  kind: ErrorClass;
  retryable: boolean;
  shouldTripKillSwitch: boolean;
  message: string;
}

export function classifyHttpError(status: number, bodySnippet: string): ClassifiedError {
  if (status === 0 || status === 408 || status === 502 || status === 503 || status === 504) {
    return {
      kind: 'network',
      retryable: true,
      shouldTripKillSwitch: false,
      message: `HTTP ${status} — transient network/server, will retry`,
    };
  }
  if (status === 429) {
    return {
      kind: 'rate_limit',
      retryable: true,
      shouldTripKillSwitch: false,
      message: `HTTP 429 — rate limited, backing off`,
    };
  }
  if (status === 418) {
    return {
      kind: 'rate_limit',
      retryable: true,
      shouldTripKillSwitch: false,
      message: `HTTP 418 — IP banned by Binance, backing off HARD`,
    };
  }
  if (status >= 500 && status < 600) {
    return {
      kind: 'server_5xx',
      retryable: true,
      shouldTripKillSwitch: false,
      message: `HTTP ${status} — Binance server error, will retry`,
    };
  }
  if (status === 401 || status === 403) {
    return {
      kind: 'auth',
      retryable: false,
      shouldTripKillSwitch: false,
      message: `HTTP ${status} — auth/geo issue`,
    };
  }
  if (status >= 400 && status < 500) {
    return {
      kind: 'client_4xx',
      retryable: false,
      shouldTripKillSwitch: false,
      message: `HTTP ${status} — client error: ${bodySnippet.slice(0, 120)}`,
    };
  }
  return { kind: 'unknown', retryable: false, shouldTripKillSwitch: false, message: `HTTP ${status}` };
}

export function classifyFetchError(err: unknown): ClassifiedError {
  const msg = String((err as any)?.message ?? err ?? '');
  const isNetwork =
    msg.includes('Failed to fetch') ||
    msg.includes('NetworkError') ||
    msg.includes('ERR_INTERNET') ||
    msg.includes('ERR_NETWORK') ||
    msg.includes('ERR_CONNECTION') ||
    msg.includes('ERR_TIMED_OUT') ||
    msg.includes('AbortError');
  if (isNetwork) {
    return {
      kind: 'network',
      retryable: true,
      shouldTripKillSwitch: false,
      message: `Network error: ${msg}`,
    };
  }
  return { kind: 'unknown', retryable: false, shouldTripKillSwitch: false, message: msg };
}

// ─────────────────────────────────────────────────────────────────────────
// fetchWithBackoff — exponential backoff with jitter
// ─────────────────────────────────────────────────────────────────────────

export interface BackoffOptions {
  maxAttempts?: number;
  baseMs?: number;
  maxMs?: number;
}

export async function fetchWithBackoff(
  url: string,
  init: RequestInit = {},
  opts: BackoffOptions = {},
): Promise<Response> {
  const { maxAttempts = 3, baseMs = 400, maxMs = 5000 } = opts;
  let lastErr: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.status === 429 || res.status === 418) {
        const retryAfter = Number(res.headers.get('retry-after') ?? '0');
        const waitMs = retryAfter > 0 ? retryAfter * 1000 : Math.min(maxMs, baseMs * 2 ** attempt);
        console.warn(`[binance-retry] ${res.status} on attempt ${attempt} — sleeping ${waitMs}ms`);
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }
      }
      // 5xx — retryable
      if (res.status >= 500 && res.status < 600 && attempt < maxAttempts) {
        const waitMs = Math.min(maxMs, baseMs * 2 ** attempt) + Math.random() * 200;
        console.warn(`[binance-retry] HTTP ${res.status} on attempt ${attempt} — sleeping ${Math.round(waitMs)}ms`);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      const cls = classifyFetchError(err);
      if (!cls.retryable || attempt >= maxAttempts) throw err;
      const waitMs = Math.min(maxMs, baseMs * 2 ** attempt) + Math.random() * 200;
      console.warn(`[binance-retry] ${cls.message} on attempt ${attempt} — sleeping ${Math.round(waitMs)}ms`);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  throw lastErr ?? new Error('fetchWithBackoff exhausted');
}

// ─────────────────────────────────────────────────────────────────────────
// Simple weight-based rate limiter
//
// Binance futures REST: 2400 weight/min per IP.
// We assume the endpoint costs 5 weight per call → ~480 calls/min max.
// Rate limiter throttles to 60 calls/min per endpoint key to be safe.
// ─────────────────────────────────────────────────────────────────────────

const _endpointTimestamps = new Map<string, number[]>();
const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_CALLS = 60;

export function rateLimit(endpointKey: string, maxCalls = DEFAULT_MAX_CALLS, windowMs = DEFAULT_WINDOW_MS): void {
  const now = Date.now();
  const arr = _endpointTimestamps.get(endpointKey) ?? [];
  const fresh = arr.filter((t) => now - t < windowMs);
  if (fresh.length >= maxCalls) {
    const oldest = fresh[0];
    const waitMs = windowMs - (now - oldest) + 50;
    console.warn(`[rate-limit] ${endpointKey}: throttling ${waitMs}ms (${fresh.length}/${maxCalls} in window)`);
    throw new Error(`RATE_LIMIT_LOCAL:${endpointKey}:${waitMs}`);
  }
  fresh.push(now);
  _endpointTimestamps.set(endpointKey, fresh);
}