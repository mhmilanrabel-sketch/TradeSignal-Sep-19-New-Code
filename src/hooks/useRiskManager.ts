// src/hooks/useRiskManager.ts
// ═══════════════════════════════════════════════════════════════════════════
// React hook that exposes the risk engine to your App component.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from 'react';
import {
  approveTrade,
  getRiskStatus,
  registerEntry,
  registerExit,
  type ApproveResult,
  type TradePlan,
} from '../utils/riskEngine';
import { sessionBlockReason, anySessionOpen } from '../utils/sessionFilter';
import { shouldBlockForCooldown } from '../utils/cooldownTracker';
import { telegram } from '../utils/telegramAlert';

export function useRiskManager() {
  const [status, setStatus] = useState(getRiskStatus());
  const [lastReason, setLastReason] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setStatus(getRiskStatus());
  }, []);

  useEffect(() => {
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, [refresh]);

  const tryApprove = useCallback(
    (symbol: string, price: number, atr: number): ApproveResult => {
      // Session gate first
      const sessReason = sessionBlockReason();
      if (sessReason) {
        setLastReason(sessReason);
        telegram.sessionBlocked(sessReason);
        return { approved: false, reason: sessReason };
      }

      // Cooldown gate
      const cd = shouldBlockForCooldown();
      if (cd.blocked) {
        setLastReason(cd.reason!);
        return { approved: false, reason: cd.reason };
      }

      // Risk engine
      const result = approveTrade(symbol, price, atr);
      setLastReason(result.reason ?? null);
      return result;
    },
    [],
  );

  const confirmEntry = useCallback(
    (plan: TradePlan, side: 'LONG' | 'SHORT') => {
      registerEntry(plan, side);
      telegram.entry(plan.symbol, side, plan.quantity, plan.entryPrice, plan.stopPrice, plan.targetPrice);
      refresh();
    },
    [refresh],
  );

  const confirmExit = useCallback(
    (exitPrice: number) => {
      const pnlPct = registerExit(exitPrice);
      const pnlUsdt = (pnlPct / 100) * 10000; // capital
      telegram.exit('POSITION', pnlPct, pnlUsdt);
      if (getRiskStatus().halted) {
        telegram.killSwitch(getRiskStatus().dailyPnlPct);
      }
      refresh();
    },
    [refresh],
  );

  return {
    status,
    lastReason,
    anySessionOpen: anySessionOpen(),
    tryApprove,
    confirmEntry,
    confirmExit,
    refresh,
  };
}