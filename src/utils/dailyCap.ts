// src/utils/dailyCap.ts
// ═══════════════════════════════════════════════════════════════════════════
// FIXES BUG #4: per-symbol daily entry counters persisted in localStorage
// were being CLEARED by an effect that depended on `[signals]`.
//
// Cause in original code:
//   useEffect(() => {
//     localStorage.setItem(LS_DAILY_ENTRY_COUNT_KEY, JSON.stringify(dailyEntryCountRef.current));
//   }, [signals]);   // ← fires on EVERY signal tick, but ALSO on hydration
//
//   Plus the rollover effect wiped counts unconditionally if the day string
//   didn't match, and the day string was computed from a ref that could be
//   stale during initial hydration.
//
// Fix: separate the "persist" and "rollover" concerns. Persist only when
// the value actually changes. Rollover only runs when the UTC day changes.
// ═══════════════════════════════════════════════════════════════════════════

const LS_KEY = 'tradesignal_daily_entry_count_v2';
const MAX_ENTRIES_PER_SYMBOL_PER_DAY = 2;

type CountMap = Record<string, number>;

function utcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

function makeKey(day: string, symbol: string): string {
  return `${day}|${symbol}`;
}

function loadFromStorage(): CountMap {
  try {
    const today = utcDay();
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    // Strip any keys from previous days
    const filtered: CountMap = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (k.startsWith(`${today}|`) && Number.isFinite(Number(v))) {
        filtered[k] = Number(v);
      }
    }
    return filtered;
  } catch {
    return {};
  }
}

let _counts: CountMap = loadFromStorage();
let _lastPersistedDay = utcDay();

function persist(): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(_counts));
  } catch {
    // Quota errors → ignore
  }
}

/** Call once at boot AND periodically — resets counters when the UTC day rolls. */
export function ensureDayRollover(): boolean {
  const today = utcDay();
  if (_lastPersistedDay !== today) {
    _counts = {};
    _lastPersistedDay = today;
    persist();
    console.log(`[DAILY-CAP] 🔄 Rollover for ${today} — all per-symbol counters reset`);
    return true;
  }
  return false;
}

export function getEntryCount(symbol: string): number {
  ensureDayRollover();
  return _counts[makeKey(_lastPersistedDay, symbol)] ?? 0;
}

export function canEnter(symbol: string): { ok: boolean; count: number; max: number } {
  ensureDayRollover();
  const count = getEntryCount(symbol);
  return { ok: count < MAX_ENTRIES_PER_SYMBOL_PER_DAY, count, max: MAX_ENTRIES_PER_SYMBOL_PER_DAY };
}

export function recordEntry(symbol: string): number {
  ensureDayRollover();
  const key = makeKey(_lastPersistedDay, symbol);
  _counts[key] = (_counts[key] ?? 0) + 1;
  persist();
  console.log(`[DAILY-CAP] 📈 ${symbol}: ${_counts[key]}/${MAX_ENTRIES_PER_SYMBOL_PER_DAY}`);
  return _counts[key];
}

export function debugDailyCaps(): { day: string; counts: CountMap } {
  return { day: _lastPersistedDay, counts: { ..._counts } };
}

export const MAX_ENTRIES = MAX_ENTRIES_PER_SYMBOL_PER_DAY;