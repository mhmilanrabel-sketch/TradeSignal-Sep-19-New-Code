// src/utils/aiTradeValidator.ts
// ============================================================================
// AI Trade Validator — Gemini REST API (no SDK dependency).
// ============================================================================

export type AiVerdict = 'APPROVE' | 'CAUTION' | 'REJECT';

export interface AiRecentTrade {
  symbol: string;
  direction: string;
  outcome: string;
  pnlPct: number;
}

export interface AiTradeContext {
  symbol: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  score5m: number;
  score15m: number;
  score1h: number;
  direction5m: string;
  direction15m: string;
  direction1h: string;
  reasons5m: string[];
  reasons15m: string[];
  reasons1h: string[];
  atrPct: number;
  dailyPnlPct: number;
  recentTrades: AiRecentTrade[];
  killZoneName: string;
  killZoneWeight: number;
  recentWinRatePct: number;
  recentLossStreak: number;
  fundingRate: number;
}

export interface AiValidationResult {
  verdict: AiVerdict;
  confidence: number;
  reason: string;
  positionSizeMultiplier: number;
}

const SYSTEM_PROMPT = `You are a crypto futures scalp trade VALIDATOR for a bot trading Binance USDT-M Futures.

The bot runs a 5-minute multi-indicator confluence strategy on this whitelist:
BTC, ETH, SOL, BNB, XRP, ADA, DOGE, AVAX, LINK, DOT (all /USDT).

You are shown a CANDIDATE TRADE that already passed the bot's rules engine.
Your job is to catch setups the rules engine got WRONG.

Historical failure patterns you MUST guard against:
1. LONG entries during a 15m or 1h DOWNTREND — the rules engine's 5m EMAs lag by 10-20 minutes
2. SHORT entries during a 15m or 1h UPTREND — same lag problem
3. Entering after price has already extended >1.5% from recent swing — chasing
4. Entering during low ATR chop (ATR < 0.3% of price on 5m)
5. Entering when the daily P&L is already > -3% (bot is "tilted", should slow down)
6. Entering in off-killzone hours (Asian session low liquidity)

Additional context:
- candidate.fundingRatePct: current funding rate as a percentage.
  * Positive (>0.02%) = longs paying shorts = crowded longs → reversal risk for LONGs.
  * Negative (<-0.02%) = shorts paying longs = crowded shorts → reversal risk for SHORTs.
  * Extreme (|funding| > 0.06%) = very crowded. Treat same-direction entries as CAUTION or REJECT.
- botState.recentWinRatePct: win rate of the bot's last 20 closed trades.
- botState.recentLossStreak: consecutive losses at the head of that window.
  * If recentLossStreak >= 3, be MORE conservative.
  * If recentWinRatePct < 40, lean toward CAUTION even on clean setups.

Decision rules:
- APPROVE: 5m, 15m, and (if directional) 1h all agree. Funding not extreme.
- CAUTION: mixed signals OR funding is elevated (0.03%-0.06%).
- REJECT: hard failure pattern present, OR 15m contradicts 5m,
  OR daily P&L < -3% with recent consecutive losses, OR funding extreme (>0.08%).

You MUST respond with ONLY valid JSON in this exact shape:
{
  "verdict": "APPROVE" | "CAUTION" | "REJECT",
  "confidence": <number 0-100>,
  "reason": "<one sentence under 200 characters>"
}

Do not include markdown. Do not include explanations outside the JSON.`;

const LS_KEY_NAME = 'VITE_GEMINI_API_KEY';
const SS_KEY_NAME = 'tradesignal_gemini_key';
const COOKIE_KEY_NAME = 'tradesignal_gk';
const WINDOW_NAME_PREFIX = 'gk:';
const IDB_NAME = 'tradesignal';
const IDB_STORE = 'keys';
const IDB_KEY = 'gemini';

function idbGet(): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') { resolve(null); return; }
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        try { req.result.createObjectStore(IDB_STORE); } catch { /* exists */ }
      };
      req.onsuccess = () => {
        try {
          const db = req.result;
          const tx = db.transaction(IDB_STORE, 'readonly');
          const getReq = tx.objectStore(IDB_STORE).get(IDB_KEY);
          getReq.onsuccess = () => resolve(typeof getReq.result === 'string' ? getReq.result : null);
          getReq.onerror = () => resolve(null);
        } catch { resolve(null); }
      };
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}

function idbSet(value: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') { resolve(); return; }
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        try { req.result.createObjectStore(IDB_STORE); } catch { /* exists */ }
      };
      req.onsuccess = () => {
        try {
          const db = req.result;
          const tx = db.transaction(IDB_STORE, 'readwrite');
          tx.objectStore(IDB_STORE).put(value, IDB_KEY);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch { resolve(); }
      };
      req.onerror = () => resolve();
    } catch { resolve(); }
  });
}

let __asyncKeyCache: string = '';
let __noKeyWarnedOnce = false;

function getGeminiApiKey(): string {
  try {
    const env: any = (import.meta as any)?.env ?? {};
    const fromEnv = env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || '';
    if (typeof fromEnv === 'string' && fromEnv.trim().length > 0) return fromEnv.trim();

    if (typeof window !== 'undefined') {
      const g = (window as any).__GEMINI_API_KEY__;
      if (typeof g === 'string' && g.trim().length > 0) return g.trim();
    }

    if (typeof window !== 'undefined' && window.location.hash) {
      const m = window.location.hash.match(/(?:^|[#&])gk=([^&]+)/);
      if (m && m[1]) {
        const k = decodeURIComponent(m[1]).trim();
        if (k) return k;
      }
    }

    if (typeof window !== 'undefined') {
      try {
        const ls = window.localStorage.getItem(LS_KEY_NAME);
        if (ls && ls.trim().length > 0) return ls.trim();
      } catch { /* blocked */ }
    }

    if (typeof window !== 'undefined') {
      try {
        const ss = window.sessionStorage.getItem(SS_KEY_NAME);
        if (ss && ss.trim().length > 0) return ss.trim();
      } catch { /* blocked */ }
    }

    if (typeof document !== 'undefined' && document.cookie) {
      try {
        const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_KEY_NAME}=([^;]+)`));
        if (m && m[1]) {
          const k = decodeURIComponent(m[1]).trim();
          if (k) return k;
        }
      } catch { /* blocked */ }
    }

    if (typeof window !== 'undefined' && typeof window.name === 'string') {
      if (window.name.startsWith(WINDOW_NAME_PREFIX)) {
        const k = window.name.slice(WINDOW_NAME_PREFIX.length).trim();
        if (k) return k;
      }
    }

    return __asyncKeyCache;
  } catch {
    return __asyncKeyCache;
  }
}

async function hydrateFromIndexedDb(): Promise<void> {
  try {
    const k = await idbGet();
    if (k && k.trim().length > 0) {
      const v = k.trim();
      (window as any).__GEMINI_API_KEY__ = v;
      __asyncKeyCache = v;
      try { window.localStorage.setItem(LS_KEY_NAME, v); } catch { /* ignore */ }
      try { window.sessionStorage.setItem(SS_KEY_NAME, v); } catch { /* ignore */ }
      try { document.cookie = `${COOKIE_KEY_NAME}=${encodeURIComponent(v)}; path=/; max-age=31536000; SameSite=Lax`; } catch { /* ignore */ }
      console.log('%c🔑 Gemini key restored from IndexedDB', 'color:#00E676;font-weight:bold');
    }
  } catch { /* ignore */ }
}

export function isAiValidatorConfigured(): boolean {
  return getGeminiApiKey().length > 0;
}

const GEMINI_MODEL_FALLBACKS = [
  'gemini-3.8-flash',
  'gemini-3.5-flash',
  'gemini-2.5-flash',
  'gemini-1.5-flash',
] as const;

const GEMINI_ENDPOINT_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

let __workingModel: string | null = null;

async function callGeminiRest(
  apiKey: string,
  systemPrompt: string,
  userJson: string,
): Promise<string | null> {
  const modelsToTry: string[] = __workingModel
    ? [__workingModel, ...GEMINI_MODEL_FALLBACKS.filter((m) => m !== __workingModel)]
    : [...GEMINI_MODEL_FALLBACKS];

  for (const model of modelsToTry) {
    const url = `${GEMINI_ENDPOINT_BASE}/${model}:generateContent`;

    const body = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userJson }] }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
        maxOutputTokens: 400,
      },
    };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(body),
      });

      const text = await res.text();

      if (res.status === 503) {
        console.warn(`[aiValidator] Gemini 503 on "${model}" — server overloaded, aborting AI call`);
        return null;
      }

      if (res.status === 404) {
        console.warn(
          `[aiValidator] Model "${model}" returned 404 (deprecated) — trying next fallback…`
        );
        continue;
      }

      if (!res.ok) {
        console.warn(`[aiValidator] Gemini HTTP ${res.status} on "${model}" — body: ${text.slice(0, 400)}`);
        if (res.status === 401 || res.status === 403 || res.status === 429) return null;
        continue;
      }

      let data: any;
      try { data = JSON.parse(text); }
      catch {
        console.warn('[aiValidator] Non-JSON response from Gemini');
        continue;
      }

      const candidate = data?.candidates?.[0];
      const partText = candidate?.content?.parts?.[0]?.text;
      if (typeof partText === 'string' && partText.length > 0) {
        if (__workingModel !== model) {
          __workingModel = model;
          console.log(
            `%c[aiValidator] ✅ Using model: ${model}`,
            'color:#00E676;font-weight:bold'
          );
        }
        return partText;
      }

      console.warn(`[aiValidator] Model "${model}" returned no text part. Raw:`, text.slice(0, 300));
    } catch (err: any) {
      console.warn(`[aiValidator] Network error on "${model}": ${err.message}`);
      return null;
    }
  }

  console.warn(
    '[aiValidator] ❌ All Gemini models failed. Check the "testGeminiKey" console helper for a list of available models.'
  );
  return null;
}

export async function validateTradeWithAi(
  ctx: AiTradeContext,
  timeoutMs: number = 6000,
): Promise<AiValidationResult | null> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    await hydrateFromIndexedDb();
    const retry = getGeminiApiKey();
    if (!retry) {
      if (!__noKeyWarnedOnce) {
        __noKeyWarnedOnce = true;
        console.warn(
          '%c[aiValidator] No Gemini key loaded. ' +
          'Set one with: await window.setGeminiKey("YOUR_KEY") — ' +
          'or append #gk=YOUR_KEY to the URL. ' +
          'Validator disabled for this session.',
          'color:#FFB300;font-weight:bold'
        );
      }
      return null;
    }
  }

  const finalKey = apiKey || getGeminiApiKey();

  const userPayload = {
    candidate: {
      symbol: ctx.symbol,
      direction: ctx.direction,
      entry: ctx.entryPrice,
      stopLoss: ctx.stopLoss,
      takeProfit: ctx.takeProfit,
      riskPct: Number(((Math.abs(ctx.entryPrice - ctx.stopLoss) / ctx.entryPrice) * 100).toFixed(3)),
      rewardPct: Number(((Math.abs(ctx.takeProfit - ctx.entryPrice) / ctx.entryPrice) * 100).toFixed(3)),
      fundingRate: ctx.fundingRate,
      fundingRatePct: Number((ctx.fundingRate * 100).toFixed(4)),
    },
    timeframeAlignment: {
      '5m':  { score: ctx.score5m,  direction: ctx.direction5m,  reasons: ctx.reasons5m },
      '15m': { score: ctx.score15m, direction: ctx.direction15m, reasons: ctx.reasons15m },
      '1h':  { score: ctx.score1h,  direction: ctx.direction1h,  reasons: ctx.reasons1h },
    },
    volatility: { atrPct: Number((ctx.atrPct * 100).toFixed(3)) },
    session: { killZone: ctx.killZoneName, killZoneWeight: ctx.killZoneWeight },
    botState: {
      dailyPnlPct: ctx.dailyPnlPct,
      recentWinRatePct: ctx.recentWinRatePct,
      recentLossStreak: ctx.recentLossStreak,
      recentTrades: ctx.recentTrades.slice(0, 8),
    },
  };

  const userJson = JSON.stringify(userPayload);

  const race = (async (): Promise<AiValidationResult | null> => {
    const rawText = await callGeminiRest(finalKey, SYSTEM_PROMPT, userJson);
    if (!rawText) return null;

    const cleaned = rawText.replace(/```json|```/g, '').trim();

    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (!match) {
        console.warn('[aiValidator] Non-JSON response:', cleaned.slice(0, 200));
        return null;
      }
      try { parsed = JSON.parse(match[0]); }
      catch { console.warn('[aiValidator] Salvage parse failed'); return null; }
    }

    const rawVerdict = String(parsed.verdict || '').toUpperCase();
    const verdict: AiVerdict =
      rawVerdict === 'APPROVE' || rawVerdict === 'REJECT' ? rawVerdict : 'CAUTION';

    const confidence = Math.max(0, Math.min(100, Number(parsed.confidence) || 50));
    const reason = String(parsed.reason || 'No reason provided').slice(0, 240);
    const multiplier = verdict === 'APPROVE' ? 1.0 : verdict === 'CAUTION' ? 0.5 : 0;

    return { verdict, confidence, reason, positionSizeMultiplier: multiplier };
  })();

  const timeout = new Promise<AiValidationResult | null>((resolve) =>
    setTimeout(() => {
      console.warn(`[aiValidator] Timeout after ${timeoutMs}ms — falling back to rules only`);
      resolve(null);
    }, timeoutMs),
  );

  return Promise.race([race, timeout]);
}

if (typeof window !== 'undefined') {
  (window as any).setGeminiKey = async (key: string) => {
    if (typeof key !== 'string' || key.trim().length === 0) {
      console.log('%c❌ setGeminiKey: empty/invalid key', 'color:#FF3366;font-weight:bold');
      return;
    }
    const v = key.trim();
    let storedCount = 0;

    try { window.localStorage.setItem(LS_KEY_NAME, v); storedCount++; }
    catch { /* blocked */ }

    try { window.sessionStorage.setItem(SS_KEY_NAME, v); storedCount++; }
    catch { /* blocked */ }

    try {
      document.cookie = `${COOKIE_KEY_NAME}=${encodeURIComponent(v)}; path=/; max-age=31536000; SameSite=Lax`;
      storedCount++;
    } catch { /* blocked */ }

    try {
      window.name = `${WINDOW_NAME_PREFIX}${v}`;
      storedCount++;
    } catch { /* blocked */ }

    try {
      await idbSet(v);
      storedCount++;
    } catch { /* blocked */ }

    (window as any).__GEMINI_API_KEY__ = v;
    __asyncKeyCache = v;
    __noKeyWarnedOnce = false;
    __workingModel = null;

    if (storedCount > 0) {
      console.log(`%c✅ Key stored in ${storedCount} storage layer(s) — reloading in 1s…`, 'color:#00E676;font-weight:bold');
      setTimeout(() => window.location.reload(), 1000);
    } else {
      console.log('%c⚠️ All storage blocked. Use the URL hash method:', 'color:#FFB300;font-weight:bold');
      console.log('   Append "#gk=YOUR_KEY" to the preview URL, then reload.');
    }
  };

  (window as any).clearGeminiKey = () => {
    try { window.localStorage.removeItem(LS_KEY_NAME); } catch { /* ignore */ }
    try { window.sessionStorage.removeItem(SS_KEY_NAME); } catch { /* ignore */ }
    try { document.cookie = `${COOKIE_KEY_NAME}=; path=/; max-age=0`; } catch { /* ignore */ }
    try { if (window.name.startsWith(WINDOW_NAME_PREFIX)) window.name = ''; } catch { /* ignore */ }
    try {
      if (typeof indexedDB !== 'undefined') {
        const req = indexedDB.open(IDB_NAME, 1);
        req.onsuccess = () => {
          try { req.result.transaction(IDB_STORE, 'readwrite').objectStore(IDB_STORE).delete(IDB_KEY); } catch { /* ignore */ }
        };
      }
    } catch { /* ignore */ }
    (window as any).__GEMINI_API_KEY__ = undefined;
    __asyncKeyCache = '';
    __noKeyWarnedOnce = false;
    __workingModel = null;
    console.log('%c🗑️ Key cleared from all storage layers', 'color:#FFB300;font-weight:bold');
  };

  (window as any).testGeminiKey = async () => {
    await hydrateFromIndexedDb();
    const key = getGeminiApiKey();

    if (!key) {
      console.log('%c❌ No key loaded', 'color:#FF3366; font-weight:bold');
      console.log('   → Run: setGeminiKey("AQ.Ab8RN6...")');
      console.log('   → Or append #gk=YOUR_KEY to the URL and reload.');
      return;
    }

    console.log(`%c🔑 Key loaded — first 10 chars: ${key.slice(0, 10)}...`, 'color:#00D8F6');

    try {
      const res = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models',
        { headers: { 'x-goog-api-key': key } },
      );
      const data = await res.json();

      if (data?.error) {
        console.log(`%c❌ Key rejected: ${data.error.message}`, 'color:#FF3366; font-weight:bold');
        console.log('   HTTP status:', res.status);
      } else if (Array.isArray(data?.models)) {
        console.log(`%c✅ Key works — ${data.models.length} Gemini models available`, 'color:#00E676; font-weight:bold');

        const availableNames = data.models
          .map((m: any) => String(m?.name || '').replace(/^models\//, ''))
          .filter(Boolean);

        console.log('%c🔎 Validator preference check:', 'color:#9D4EDD; font-weight:bold');
        for (const pref of GEMINI_MODEL_FALLBACKS) {
          const isAvailable = availableNames.includes(pref);
          const mark = isAvailable ? '✅' : '❌';
          const color = isAvailable ? 'color:#00E676' : 'color:#FF3366';
          console.log(`%c   ${mark} ${pref}`, color);
        }

        const firstWorking = GEMINI_MODEL_FALLBACKS.find((m) => availableNames.includes(m));
        if (firstWorking) {
          console.log(
            `%c🎯 Validator will use: ${firstWorking}`,
            'color:#00E676; font-weight:bold'
          );
        } else {
          console.log(
            '%c⚠️ NONE of the preferred models are available! Update GEMINI_MODEL_FALLBACKS.',
            'color:#FF3366; font-weight:bold'
          );
          console.log('   Available models on your key:');
          console.log('  ', availableNames.slice(0, 20).join(', '));
        }
      } else {
        console.log('⚠️ Unexpected response shape:', data);
      }
    } catch (err: any) {
      console.log(`%c❌ Network error: ${err.message}`, 'color:#FF3366; font-weight:bold');
    }
  };

  try {
    const m = window.location.hash.match(/(?:^|[#&])gk=([^&]+)/);
    if (m && m[1]) {
      const hashKey = decodeURIComponent(m[1]).trim();
      if (hashKey) {
        try { window.localStorage.setItem(LS_KEY_NAME, hashKey); } catch { /* ignore */ }
        try { window.sessionStorage.setItem(SS_KEY_NAME, hashKey); } catch { /* ignore */ }
        try { document.cookie = `${COOKIE_KEY_NAME}=${encodeURIComponent(hashKey)}; path=/; max-age=31536000; SameSite=Lax`; } catch { /* ignore */ }
        try { window.name = `${WINDOW_NAME_PREFIX}${hashKey}`; } catch { /* ignore */ }
        try { idbSet(hashKey); } catch { /* ignore */ }
        (window as any).__GEMINI_API_KEY__ = hashKey;
        __asyncKeyCache = hashKey;
        __noKeyWarnedOnce = false;
        console.log('%c🔑 Key picked up from URL hash — persisted to all layers', 'color:#00E676;font-weight:bold');
      }
    }
  } catch { /* ignore */ }

  try { hydrateFromIndexedDb(); } catch { /* ignore */ }

  console.log('%c🧠 Gemini test ready — type `await window.testGeminiKey()`', 'color:#9D4EDD; font-style:italic');
}