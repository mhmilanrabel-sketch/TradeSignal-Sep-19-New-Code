// src/config/riskConfig.ts
// ═══════════════════════════════════════════════════════════════════════════
// Central risk configuration. All times are UTC.
// ═══════════════════════════════════════════════════════════════════════════

export const RISK_CONFIG = {
  // ── Account ──────────────────────────────────────────────────────────
  capital: 10000,
  riskPerTradePct: 0.5,
  dailyLossLimitPct: 4.0,
  dailyProfitTargetPct: 6.0,
  maxTradesPerDay: 3,
  maxConsecutiveLosses: 2,
  maxLeverage: 5,
  cooldownAfterLossMinutes: 30,

  // ── Sessions (UTC) ───────────────────────────────────────────────────
  sessions: {
    NEW_YORK_AM: { enabled: true,  startUtc: '12:00', endUtc: '16:00' },
    LONDON:      { enabled: false, startUtc: '07:00', endUtc: '12:00' },
    ASIA:        { enabled: false, startUtc: '00:00', endUtc: '07:00' },
  },

  // ── ATR / Stops ──────────────────────────────────────────────────────
  atr: {
    period: 14,
    timeframe: '15m',
    stopMultiplier: 1.5,
    targetMultiplier: 3.0,
  },

  // ── Telegram (optional) ──────────────────────────────────────────────
  telegram: {
    enabled: false,
    botToken: '',
    chatId: '',
  },
} as const;

export type RiskConfig = typeof RISK_CONFIG;