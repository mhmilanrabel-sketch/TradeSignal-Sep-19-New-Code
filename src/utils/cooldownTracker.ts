// src/utils/cooldownTracker.ts
// ═══════════════════════════════════════════════════════════════════════════
// Tracks consecutive losses and cooldown windows
// ═══════════════════════════════════════════════════════════════════════════

import { getRiskState, isInCooldown } from './riskEngine';
import { RISK_CONFIG } from '../config/riskConfig';

export function cooldownRemainingMinutes(): number {
  const state = getRiskState();
  if (!state.lastLossTime) return 0;
  const elapsed = (Date.now() - new Date(state.lastLossTime).getTime()) / 60000;
  return Math.max(0, RISK_CONFIG.cooldownAfterLossMinutes - elapsed);
}

export function shouldBlockForCooldown(): { blocked: boolean; reason?: string } {
  if (isInCooldown()) {
    return {
      blocked: true,
      reason: `Cooldown active — ${cooldownRemainingMinutes().toFixed(1)}m remaining`,
    };
  }
  const state = getRiskState();
  if (state.consecutiveLosses >= RISK_CONFIG.maxConsecutiveLosses) {
    return {
      blocked: true,
      reason: `Consecutive loss limit reached (${state.consecutiveLosses})`,
    };
  }
  return { blocked: false };
}