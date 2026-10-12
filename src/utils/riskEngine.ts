// src/utils/riskEngine.ts
// ═══════════════════════════════════════════════════════════════════════════
// Account-level risk engine — daily loss limit, position sizing, kill switch
//
// Exports required by App.tsx, aiTradeValidator.ts, cooldownTracker.ts:
//   • getRiskState()          → RiskState
//   • getRiskStatus()         → summary object
//   • approveTrade()          → ApproveResult
//   • registerEntry()         → void
//   • registerExit()          → number
//   • resetRiskState()        → void
//   • isInCooldown()          → boolean
//   • Types: RiskState, OpenPosition, ClosedTrade, TradePlan, ApproveResult
// ═══════════════════════════════════════════════════════════════════════════

import { RISK_CONFIG } from '../config/riskConfig';

const LS_KEY = 'tradesignal_risk_state_v1';

// ───────────────────────────────────────────────────────────────────────────
// TYPES
// ───────────────────────────────────────────────────────────────────────────

export interface RiskState {
  date: string;
  tradesToday: number;
  consecutiveLosses: number;
  dailyPnlPct: number;
  tradingHalted: boolean;
  openPosition: OpenPosition | null;
  lastLossTime: string | null;
  tradeLog: ClosedTrade[];
}

export interface OpenPosition {
  symbol: string;
  side: 'LONG' | 'SHORT';
  entry: number;
  qty: number;
  stop: number;
  target: number;
}

export interface ClosedTrade {
  symbol: string;
  side: 'LONG' | 'SHORT';
  entry: number;
  exit: number;
  qty: number;
  pnlUsdt: number;
  pnlPct: number;
  closedAt: string;
}

export interface TradePlan {
  symbol: string;
  quantity: number;
  entryPrice: number;
  stopPrice: number;
  targetPrice: number;
  stopDistance: number;
  riskUsdt: number;
  notional: number;
}

export interface ApproveResult {
  approved: boolean;
  plan?: TradePlan;
  reason?: string;
}

export interface RiskStatus {
  tradesToday: number;
  consecutiveLosses: number;
  dailyPnlPct: number;
  halted: boolean;
  openPosition: OpenPosition | null;
  inCooldown: boolean;
}

// ───────────────────────────────────────────────────────────────────────────
// STORAGE HELPERS
// ───────────────────────────────────────────────────────────────────────────

function utcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaultState(): RiskState {
  return {
    date: utcDay(),
    tradesToday: 0,
    consecutiveLosses: 0,
    dailyPnlPct: 0,
    tradingHalted: false,
    openPosition: null,
    lastLossTime: null,
    tradeLog: [],
  };
}

function loadState(): RiskState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as RiskState;
    if (parsed.date !== utcDay()) return defaultState();
    return { ...defaultState(), ...parsed };
  } catch {
    return defaultState();
  }
}

function saveState(state: RiskState): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch { /* quota */ }
}

// ───────────────────────────────────────────────────────────────────────────
// PUBLIC STATE ACCESS
// ───────────────────────────────────────────────────────────────────────────

export function getRiskState(): RiskState {
  const state = loadState();
  if (state.date !== utcDay()) {
    const fresh = defaultState();
    saveState(fresh);
    return fresh;
  }
  return state;
}

export function isInCooldown(): boolean {
  const state = getRiskState();
  if (!state.lastLossTime) return false;
  const elapsedMin = (Date.now() - new Date(state.lastLossTime).getTime()) / 60000;
  return elapsedMin < RISK_CONFIG.cooldownAfterLossMinutes;
}

export function getRiskStatus(): RiskStatus {
  const s = getRiskState();
  return {
    tradesToday: s.tradesToday,
    consecutiveLosses: s.consecutiveLosses,
    dailyPnlPct: Number(s.dailyPnlPct.toFixed(4)),
    halted: s.tradingHalted,
    openPosition: s.openPosition,
    inCooldown: isInCooldown(),
  };
}

// ───────────────────────────────────────────────────────────────────────────
// APPROVAL — the gatekeeper
// ───────────────────────────────────────────────────────────────────────────

export function approveTrade(
  symbol: string,
  price: number,
  atr: number,
): ApproveResult {
  const state = getRiskState();

  if (state.tradingHalted) {
    return { approved: false, reason: 'HALTED: daily loss limit already hit' };
  }
  if (state.tradesToday >= RISK_CONFIG.maxTradesPerDay) {
    return {
      approved: false,
      reason: `MAX TRADES: ${state.tradesToday}/${RISK_CONFIG.maxTradesPerDay}`,
    };
  }
  if (state.consecutiveLosses >= RISK_CONFIG.maxConsecutiveLosses) {
    return {
      approved: false,
      reason: `COOLDOWN: ${state.consecutiveLosses} consecutive losses`,
    };
  }
  if (isInCooldown()) {
    return {
      approved: false,
      reason: `COOLDOWN: waiting ${RISK_CONFIG.cooldownAfterLossMinutes}m after loss`,
    };
  }
  if (state.openPosition !== null) {
    return { approved: false, reason: 'POSITION OPEN: wait for close' };
  }
  if (state.dailyPnlPct >= RISK_CONFIG.dailyProfitTargetPct) {
    return { approved: false, reason: 'TARGET HIT: done for the day' };
  }
  if (!Number.isFinite(atr) || atr <= 0) {
    return { approved: false, reason: 'INVALID ATR' };
  }

  const riskUsdt = RISK_CONFIG.capital * (RISK_CONFIG.riskPerTradePct / 100);
  const stopDistance = atr * RISK_CONFIG.atr.stopMultiplier;

  if (stopDistance <= 0) {
    return { approved: false, reason: 'INVALID STOP DISTANCE' };
  }

  const quantity = riskUsdt / stopDistance;
  const notional = quantity * price;
  const maxNotional = RISK_CONFIG.capital * RISK_CONFIG.maxLeverage;

  if (notional > maxNotional) {
    return {
      approved: false,
      reason: `LEVERAGE CAP: ${notional.toFixed(2)} > ${maxNotional.toFixed(2)}`,
    };
  }
  if (quantity <= 0) {
    return { approved: false, reason: 'QUANTITY ZERO' };
  }

  const plan: TradePlan = {
    symbol,
    quantity: Number(quantity.toFixed(6)),
    entryPrice: price,
    stopPrice: price - stopDistance,
    targetPrice: price + atr * RISK_CONFIG.atr.targetMultiplier,
    stopDistance,
    riskUsdt,
    notional,
  };

  return { approved: true, plan };
}

// ───────────────────────────────────────────────────────────────────────────
// ENTRY / EXIT REGISTRATION
// ───────────────────────────────────────────────────────────────────────────

export function registerEntry(plan: TradePlan, side: 'LONG' | 'SHORT'): void {
  const state = getRiskState();
  state.tradesToday += 1;
  state.openPosition = {
    symbol: plan.symbol,
    side,
    entry: plan.entryPrice,
    qty: plan.quantity,
    stop: plan.stopPrice,
    target: plan.targetPrice,
  };
  saveState(state);
}

export function registerExit(exitPrice: number): number {
  const state = getRiskState();
  const pos = state.openPosition;
  if (!pos) return 0;

  const pnlUsdt =
    pos.side === 'LONG'
      ? (exitPrice - pos.entry) * pos.qty
      : (pos.entry - exitPrice) * pos.qty;

  const pnlPct = (pnlUsdt / RISK_CONFIG.capital) * 100;
  state.dailyPnlPct += pnlPct;

  if (pnlUsdt < 0) {
    state.consecutiveLosses += 1;
    state.lastLossTime = new Date().toISOString();
  } else {
    state.consecutiveLosses = 0;
  }

  state.tradeLog.push({
    symbol: pos.symbol,
    side: pos.side,
    entry: pos.entry,
    exit: exitPrice,
    qty: pos.qty,
    pnlUsdt: Number(pnlUsdt.toFixed(4)),
    pnlPct: Number(pnlPct.toFixed(4)),
    closedAt: new Date().toISOString(),
  });

  state.openPosition = null;

  // Kill switch
  const loss = Math.abs(Math.min(state.dailyPnlPct, 0));
  if (loss >= RISK_CONFIG.dailyLossLimitPct) {
    state.tradingHalted = true;
    console.warn(
      `🛑 KILL SWITCH: daily loss ${state.dailyPnlPct.toFixed(2)}% ≥ limit ${RISK_CONFIG.dailyLossLimitPct}%`,
    );
  }

  saveState(state);
  return pnlPct;
}

export function resetRiskState(): void {
  saveState(defaultState());
}