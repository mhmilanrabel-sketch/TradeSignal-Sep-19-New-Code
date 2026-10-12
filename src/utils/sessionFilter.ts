// src/utils/sessionFilter.ts
// ═══════════════════════════════════════════════════════════════════════════
// Session gate — blocks trading outside allowed UTC windows.
// ═══════════════════════════════════════════════════════════════════════════
import { RISK_CONFIG } from '../config/riskConfig';

function parseUtcTime(t: string): { h: number; m: number } {
  const [h, m] = t.split(':').map(Number);
  return { h, m };
}

function nowUtcMinutes(): number {
  const d = new Date();
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

export function isSessionOpen(sessionName: keyof typeof RISK_CONFIG.sessions): boolean {
  const cfg = RISK_CONFIG.sessions[sessionName];
  if (!cfg.enabled) return false;

  const start = parseUtcTime(cfg.startUtc);
  const end = parseUtcTime(cfg.endUtc);
  const now = nowUtcMinutes();
  const startMin = start.h * 60 + start.m;
  const endMin = end.h * 60 + end.m;

  return now >= startMin && now <= endMin;
}

export function anySessionOpen(): boolean {
  return (Object.keys(RISK_CONFIG.sessions) as Array<keyof typeof RISK_CONFIG.sessions>)
    .some((name) => isSessionOpen(name));
}

export function openSessionNames(): string[] {
  return (Object.keys(RISK_CONFIG.sessions) as Array<keyof typeof RISK_CONFIG.sessions>)
    .filter((name) => isSessionOpen(name));
}

/** Returns a human-readable reason if trading is blocked. */
export function sessionBlockReason(): string | null {
  if (anySessionOpen()) return null;
  const enabled = Object.entries(RISK_CONFIG.sessions)
    .filter(([, v]) => v.enabled)
    .map(([k]) => k);
  return `Outside trading session. Enabled: ${enabled.join(', ') || 'none'}`;
}