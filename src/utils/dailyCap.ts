// src/utils/dailyCap.ts
// ═══════════════════════════════════════════════════════════════════════════
// Per-symbol daily entry counters. Now integrated with the account-level
// risk engine — the account cap is enforced by riskEngine.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { RISK_CONFIG } from '../config/riskConfig';

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
  } catch { /* quota */ }
}

export function ensureDayRollover(): boolean {
  const today = utcDay();
  if (_lastPersistedDay !== today) {
    _counts = {};
    _lastPersistedDay = today;
    persist();
    console.log(`[DAILY-CAP] Rollover for ${today}`);
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
  console.log(`[DAILY-CAP] ${symbol}: ${_counts[key]}/${MAX_ENTRIES_PER_SYMBOL_PER_DAY}`);
  return _counts[key];
}

export function debugDailyCaps(): { day: string; counts: CountMap } {
  return { day: _lastPersistedDay, counts: { ..._counts } };
}

export const MAX_ENTRIES = MAX_ENTRIES_PER_SYMBOL_PER_DAY;