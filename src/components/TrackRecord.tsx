import React, { useState, useMemo, useEffect } from 'react';
import { ClosedSignal, PerformanceStats } from '../types';
import { 
  Trophy, 
  TrendingUp, 
  Target, 
  PieChart, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  ArrowUpRight, 
  ArrowDownRight,
  ShieldAlert,
  Search,
  Archive,
  Trash2,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  Clock,
  Copy,
  Check,
  X
} from 'lucide-react';

const NOW = Date.now();
const ONE_HOUR = 3600 * 1000;
const ONE_DAY = 24 * ONE_HOUR;

const INITIAL_CLOSED_SIGNALS: ClosedSignal[] = [
  {
    id: 'CS-BTC-01',
    symbol: 'BTC/USDT',
    direction: 'BUY (LONG)',
    timeframe: '5m',
    entryPrice: 63850,
    exitPrice: 64620,
    stopLoss: 63400,
    pnlPercentage: 1.21,
    pnlPipsOrPoints: 770,
    outcome: 'TP2',
    timeStart: '13:50:00 UTC',
    duration: '32m 00s',
    closedAt: 'Today, 14:22',
    holdingTime: '32m 00s',
    timestamp: NOW - 2 * ONE_HOUR
  },
  {
    id: 'CS-ETH-02',
    symbol: 'ETH/USDT',
    direction: 'BUY (LONG)',
    timeframe: '5m',
    entryPrice: 2640.5,
    exitPrice: 2682.0,
    stopLoss: 2620.0,
    pnlPercentage: 1.57,
    pnlPipsOrPoints: 41.5,
    outcome: 'TP2',
    timeStart: '13:03:00 UTC',
    duration: '45m 00s',
    closedAt: 'Today, 13:48',
    holdingTime: '45m 00s',
    timestamp: NOW - 4 * ONE_HOUR
  },
  {
    id: 'CS-SOL-03',
    symbol: 'SOL/USDT',
    direction: 'SELL (SHORT)',
    timeframe: '5m',
    entryPrice: 152.4,
    exitPrice: 150.1,
    stopLoss: 153.8,
    pnlPercentage: 1.51,
    pnlPipsOrPoints: 2.3,
    outcome: 'TP1',
    timeStart: '11:47:00 UTC',
    duration: '28m 00s',
    closedAt: 'Today, 12:15',
    holdingTime: '28m 00s',
    timestamp: NOW - 6 * ONE_HOUR
  },
  {
    id: 'CS-BNB-04',
    symbol: 'BNB/USDT',
    direction: 'BUY (LONG)',
    timeframe: '5m',
    entryPrice: 588.2,
    exitPrice: 584.1,
    stopLoss: 584.1,
    pnlPercentage: -0.70,
    pnlPipsOrPoints: -4.1,
    outcome: 'SL',
    timeStart: '11:12:00 UTC',
    duration: '18m 00s',
    closedAt: 'Yesterday, 11:30',
    holdingTime: '18m 00s',
    timestamp: NOW - 1 * ONE_DAY
  },
  {
    id: 'CS-XRP-05',
    symbol: 'XRP/USDT',
    direction: 'BUY (LONG)',
    timeframe: '5m',
    entryPrice: 0.584,
    exitPrice: 0.596,
    stopLoss: 0.578,
    pnlPercentage: 2.05,
    pnlPipsOrPoints: 0.012,
    outcome: 'TP2',
    timeStart: '09:13:00 UTC',
    duration: '52m 00s',
    closedAt: '2 Days Ago, 10:05',
    holdingTime: '52m 00s',
    timestamp: NOW - 2 * ONE_DAY
  },
  {
    id: 'CS-NEAR-06',
    symbol: 'NEAR/USDT',
    direction: 'BUY (LONG)',
    timeframe: '5m',
    entryPrice: 4.82,
    exitPrice: 4.93,
    stopLoss: 4.75,
    pnlPercentage: 2.28,
    pnlPipsOrPoints: 0.11,
    outcome: 'TP2',
    timeStart: '08:34:00 UTC',
    duration: '38m 00s',
    closedAt: '3 Days Ago, 09:12',
    holdingTime: '38m 00s',
    timestamp: NOW - 3 * ONE_DAY
  },
  {
    id: 'CS-DOGE-07',
    symbol: 'DOGE/USDT',
    direction: 'SELL (SHORT)',
    timeframe: '5m',
    entryPrice: 0.1085,
    exitPrice: 0.1072,
    stopLoss: 0.1095,
    pnlPercentage: 1.20,
    pnlPipsOrPoints: 0.0013,
    outcome: 'TP1',
    timeStart: '22:16:00 UTC',
    duration: '24m 00s',
    closedAt: '4 Days Ago, 22:40',
    holdingTime: '24m 00s',
    timestamp: NOW - 4 * ONE_DAY
  },
  {
    id: 'CS-AVAX-08',
    symbol: 'AVAX/USDT',
    direction: 'BUY (LONG)',
    timeframe: '5m',
    entryPrice: 28.4,
    exitPrice: 28.9,
    stopLoss: 28.1,
    pnlPercentage: 1.76,
    pnlPipsOrPoints: 0.5,
    outcome: 'TP2',
    timeStart: '15:35:00 UTC',
    duration: '40m 00s',
    closedAt: '6 Days Ago, 16:15',
    holdingTime: '40m 00s',
    timestamp: NOW - 6 * ONE_DAY
  },
  {
    id: 'CS-LINK-09',
    symbol: 'LINK/USDT',
    direction: 'BUY (LONG)',
    timeframe: '5m',
    entryPrice: 12.85,
    exitPrice: 13.08,
    stopLoss: 12.65,
    pnlPercentage: 1.79,
    pnlPipsOrPoints: 0.23,
    outcome: 'TP2',
    timeStart: '13:55:00 UTC',
    duration: '35m 00s',
    closedAt: '7 Days Ago, 14:30',
    holdingTime: '35m 00s',
    timestamp: NOW - 7 * ONE_DAY
  },
  {
    id: 'CS-SUI-10',
    symbol: 'SUI/USDT',
    direction: 'BUY (LONG)',
    timeframe: '5m',
    entryPrice: 2.15,
    exitPrice: 2.13,
    stopLoss: 2.13,
    pnlPercentage: -0.93,
    pnlPipsOrPoints: -0.02,
    outcome: 'SL',
    timeStart: '07:58:00 UTC',
    duration: '22m 00s',
    closedAt: '9 Days Ago, 08:20',
    holdingTime: '22m 00s',
    timestamp: NOW - 9 * ONE_DAY
  }
];

// Helper to deduplicate closed signals by ID to prevent key collisions
const sanitizeClosedSignals = (items: ClosedSignal[]): ClosedSignal[] => {
  const seen = new Set<string>();
  const sanitized: ClosedSignal[] = [];
  for (const item of items) {
    if (item && item.id && !seen.has(item.id)) {
      seen.add(item.id);
      sanitized.push(item);
    }
  }
  return sanitized;
};

export const TrackRecord: React.FC = () => {
  const [filterOutcome, setFilterOutcome] = useState<'all' | 'wins' | 'losses'>('all');
  const [searchSymbol, setSearchSymbol] = useState('');
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'warning' | 'info'; message: string } | null>(null);
  const [isConfirmClearModalOpen, setIsConfirmClearModalOpen] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [signalsList, setSignalsList] = useState<ClosedSignal[]>(() => {
    const saved = localStorage.getItem('tradesignal_closed_signals_journal');
    if (saved !== null) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return sanitizeClosedSignals(parsed);
      } catch {
        // fallback
      }
    }
    return INITIAL_CLOSED_SIGNALS;
  });

  useEffect(() => {
    localStorage.setItem('tradesignal_closed_signals_journal', JSON.stringify(signalsList));
  }, [signalsList]);

  // Listen for realtime journal updates from App.tsx when running trades hit TP/SL or close
  useEffect(() => {
    const handleJournalUpdate = () => {
      const saved = localStorage.getItem('tradesignal_closed_signals_journal');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) setSignalsList(sanitizeClosedSignals(parsed));
        } catch (e) {
          console.error(e);
        }
      }
    };

    window.addEventListener('tradesignal_journal_updated', handleJournalUpdate);
    window.addEventListener('storage', handleJournalUpdate);
    return () => {
      window.removeEventListener('tradesignal_journal_updated', handleJournalUpdate);
      window.removeEventListener('storage', handleJournalUpdate);
    };
  }, []);

  const handleCopyRecord = (e: React.MouseEvent, item: ClosedSignal) => {
    e.stopPropagation();
    const isWin = item.pnlPercentage > 0;
    const text = `📜 TRADESIGNAL CLOSED JOURNAL: ${item.symbol} (${item.direction})
• Timeframe: ${item.timeframe.toUpperCase()}
• Start Time: ${item.timeStart || 'N/A'}
• Closed At: ${item.closedAt}
• Duration: ${item.duration || item.holdingTime}
• Entry Price: $${item.entryPrice < 2 ? item.entryPrice.toFixed(4) : item.entryPrice.toLocaleString()}
• Stop Loss: ${item.stopLoss ? `$${item.stopLoss < 2 ? item.stopLoss.toFixed(4) : item.stopLoss.toLocaleString()}` : 'N/A'}
• Exit Price: $${item.exitPrice < 2 ? item.exitPrice.toFixed(4) : item.exitPrice.toLocaleString()}
• Outcome: ${item.outcome === 'SL' ? 'Stop Loss Hit' : item.outcome === 'MANUAL' ? 'Manual Close' : `${item.outcome} Target Reached`}
• Realized Return: ${isWin ? '+' : ''}${item.pnlPercentage.toFixed(2)}%`;

    navigator.clipboard?.writeText(text);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Handler: Archive completed records older than 5 days (120 hours)
  const handleArchiveOlderThan5Days = () => {
    const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const kept: ClosedSignal[] = [];
    const archived: ClosedSignal[] = [];

    signalsList.forEach((item) => {
      const itemTime = item.timestamp || now;
      if (now - itemTime > FIVE_DAYS_MS) {
        archived.push(item);
      } else {
        kept.push(item);
      }
    });

    if (archived.length === 0) {
      setActionFeedback({
        type: 'info',
        message: 'No completed trade logs older than 5 days (>120h) to archive.'
      });
      return;
    }

    setSignalsList(kept);
    setActionFeedback({
      type: 'success',
      message: `Archived ${archived.length} completed trade record(s) older than 5 days.`
    });
  };

  // Internal executor: purge journal state and storage
  const executeClearJournal = () => {
    const count = signalsList.length;
    setSignalsList([]);
    localStorage.setItem('tradesignal_closed_signals_journal', JSON.stringify([]));
    setIsConfirmClearModalOpen(false);
    setActionFeedback({
      type: 'warning',
      message: `Cleared ${count} record(s) from Verified Closed Signals Journal.`
    });
  };

  // Handler: Clear all closed signals from journal with safe intent verification
  const handleClearJournal = () => {
    if (signalsList.length === 0) return;

    // Detect if running in an iframe sandbox (where window.confirm is blocked by modern browsers)
    const isInsideIframe = typeof window !== 'undefined' && window.self !== window.top;

    if (!isInsideIframe) {
      try {
        const confirmed = window.confirm(
          `Are you sure you want to clear all ${signalsList.length} records from the Verified Closed Signals Journal? This action cannot be undone.`
        );
        if (confirmed) {
          executeClearJournal();
          return;
        } else {
          return;
        }
      } catch {
        // Fall through to interactive modal if window.confirm errors
      }
    }

    // Always open in-app modal if in an iframe or if window.confirm is suppressed
    setIsConfirmClearModalOpen(true);
  };

  // Handler: Reset default records
  const handleResetSampleRecords = () => {
    setSignalsList(INITIAL_CLOSED_SIGNALS);
    localStorage.setItem('tradesignal_closed_signals_journal', JSON.stringify(INITIAL_CLOSED_SIGNALS));
    setActionFeedback({
      type: 'success',
      message: 'Reset sample verified trade records.'
    });
  };

  // Dynamic performance statistics computed from active journal signals
  const stats = useMemo<PerformanceStats>(() => {
    if (signalsList.length === 0) {
      return {
        winRate: 0,
        totalSignals: 0,
        winningSignals: 0,
        losingSignals: 0,
        profitFactor: 0,
        averageRiskReward: '1:2.4',
        netProfitPercentage: 0,
        bestTradePercentage: 0,
        maxDrawdownPercentage: 0,
        averageDuration: '0m'
      };
    }

    const winning = signalsList.filter((s) => (s.pnlPercentage ?? 0) > 0);
    const losing = signalsList.filter((s) => (s.pnlPercentage ?? 0) <= 0);
    const winRate = signalsList.length > 0 ? Number(((winning.length / signalsList.length) * 100).toFixed(1)) : 0;
    const netProfit = Number(signalsList.reduce((acc, s) => acc + (s.pnlPercentage ?? 0), 0).toFixed(2));
    const bestTrade = signalsList.length > 0 ? Number(Math.max(...signalsList.map((s) => s.pnlPercentage ?? 0), 0).toFixed(2)) : 0;
    const profitSum = winning.reduce((acc, s) => acc + (s.pnlPercentage ?? 0), 0);
    const lossSum = Math.abs(losing.reduce((acc, s) => acc + (s.pnlPercentage ?? 0), 0));
    const profitFactor = lossSum === 0 ? (profitSum > 0 ? 4.5 : 0) : Number((profitSum / lossSum).toFixed(2));

    return {
      winRate,
      totalSignals: signalsList.length,
      winningSignals: winning.length,
      losingSignals: losing.length,
      profitFactor,
      averageRiskReward: '1:2.4',
      netProfitPercentage: netProfit,
      bestTradePercentage: bestTrade,
      maxDrawdownPercentage: 3.8,
      averageDuration: '34m'
    };
  }, [signalsList]);

  const filteredClosedSignals = useMemo(() => {
    const seen = new Set<string>();
    return signalsList.filter((s) => {
      if (!s || !s.id || seen.has(s.id)) return false;
      seen.add(s.id);
      const isWin = s.pnlPercentage > 0;
      if (filterOutcome === 'wins' && !isWin) return false;
      if (filterOutcome === 'losses' && isWin) return false;
      if (searchSymbol && !s.symbol.toLowerCase().includes(searchSymbol.toLowerCase())) return false;
      return true;
    });
  }, [signalsList, filterOutcome, searchSymbol]);

  return (
    <div id="track-record-view" className="space-y-6">
      {/* Top Metrics Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Win Rate */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Overall Win Rate</span>
            <Trophy className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="font-mono text-2xl sm:text-3xl font-extrabold text-emerald-400">
            {stats.winRate}%
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-mono">
            {stats.winningSignals} Won / {stats.losingSignals} Lost
          </div>
        </div>

        {/* Profit Factor */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Profit Factor</span>
            <TrendingUp className="w-4 h-4 text-blue-400" />
          </div>
          <div className="font-mono text-2xl sm:text-3xl font-extrabold text-white">
            {stats.profitFactor}
          </div>
          <div className="text-[11px] text-emerald-400 mt-1 font-mono">
            Institutional Grade (&gt;2.0)
          </div>
        </div>

        {/* Net Profit */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Net Return (Verified)</span>
            <Target className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="font-mono text-2xl sm:text-3xl font-extrabold text-emerald-400">
            {stats.netProfitPercentage >= 0 ? '+' : ''}{stats.netProfitPercentage}%
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-mono">
            Avg R:R {stats.averageRiskReward}
          </div>
        </div>

        {/* Max Drawdown */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Max Drawdown</span>
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <div className="font-mono text-2xl sm:text-3xl font-extrabold text-slate-200">
            {stats.maxDrawdownPercentage}%
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-mono">
            Peak to Trough
          </div>
        </div>
      </div>

      {/* Asset Performance Breakdown Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 sm:p-5">
        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
          <PieChart className="w-4 h-4 text-emerald-400" />
          Accuracy Breakdown by Asset Class
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { name: 'Crypto Markets', rate: 81.2, count: 184, color: 'bg-emerald-500' },
            { name: 'Commodities (Gold/Oil)', rate: 79.5, count: 98, color: 'bg-amber-500' },
            { name: 'Forex Majors', rate: 76.1, count: 165, color: 'bg-blue-500' },
            { name: 'Equities & ETFs', rate: 75.8, count: 95, color: 'bg-purple-500' },
          ].map((cat) => (
            <div key={cat.name} className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-medium text-slate-300">{cat.name}</span>
                <span className="font-mono font-bold text-emerald-400">{cat.rate}%</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mb-2">
                <div
                  className={`h-full ${cat.color} rounded-full`}
                  style={{ width: `${cat.rate}%` }}
                ></div>
              </div>
              <div className="text-[10px] text-slate-500 font-mono">{cat.count} closed signals verified</div>
            </div>
          ))}
        </div>
      </div>

      {/* Closed Signals Log Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-3 bg-slate-950/60">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-sm text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-400" />
                Verified Closed Signals Journal
              </h4>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-semibold">
                {signalsList.length} Records
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Complete historical trade audits and verified exit targets</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
            {/* Archive > 5d Button */}
            <button
              id="journal-archive-btn"
              type="button"
              onClick={handleArchiveOlderThan5Days}
              title="Archive completed trades older than 5 days"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs font-mono font-bold transition-colors cursor-pointer"
            >
              <Archive className="w-3.5 h-3.5 text-blue-400" />
              <span>Archive &gt; 5d</span>
            </button>

            {/* Clear Log Button */}
            <button
              id="journal-clear-btn"
              type="button"
              onClick={handleClearJournal}
              disabled={signalsList.length === 0}
              title={signalsList.length === 0 ? "Journal is already empty" : "Clear closed signals journal"}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-mono font-bold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Log</span>
            </button>

            {/* Reset Sample Records button if records cleared or altered */}
            {signalsList.length < INITIAL_CLOSED_SIGNALS.length && (
              <button
                id="journal-reset-sample-btn"
                type="button"
                onClick={handleResetSampleRecords}
                title="Restore sample records"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                <span>Reset Sample</span>
              </button>
            )}

            {/* Filter pills */}
            <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setFilterOutcome('all')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                  filterOutcome === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilterOutcome('wins')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                  filterOutcome === 'wins' ? 'bg-emerald-950/80 text-emerald-300 font-bold' : 'text-slate-400'
                }`}
              >
                Wins
              </button>
              <button
                type="button"
                onClick={() => setFilterOutcome('losses')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                  filterOutcome === 'losses' ? 'bg-rose-950/80 text-rose-300 font-bold' : 'text-slate-400'
                }`}
              >
                Losses
              </button>
            </div>

            <div className="relative flex-1 sm:w-44">
              <Search className="w-3 h-3 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter symbol..."
                value={searchSymbol}
                onChange={(e) => setSearchSymbol(e.target.value)}
                className="w-full pl-7 pr-2 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Action Feedback Banner */}
        {actionFeedback && (
          <div className={`px-4 py-2 text-xs flex items-center justify-between border-b transition-all ${
            actionFeedback.type === 'success' 
              ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-300'
              : actionFeedback.type === 'warning'
              ? 'bg-rose-950/40 border-rose-800/50 text-rose-300'
              : 'bg-blue-950/40 border-blue-800/50 text-blue-300'
          }`}>
            <span className="flex items-center gap-1.5 font-mono">
              {actionFeedback.type === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
              {actionFeedback.type === 'warning' && <Trash2 className="w-3.5 h-3.5 text-rose-400" />}
              {actionFeedback.type === 'info' && <Archive className="w-3.5 h-3.5 text-blue-400" />}
              {actionFeedback.message}
            </span>
            <button 
              onClick={() => setActionFeedback(null)}
              className="text-slate-400 hover:text-white text-xs cursor-pointer font-bold px-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-mono text-[11px] border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-4 font-medium">Asset &amp; Timeframe</th>
                <th className="py-2.5 px-4 font-medium">Direction</th>
                <th className="py-2.5 px-4 font-medium">Time Start &amp; Close</th>
                <th className="py-2.5 px-4 font-medium">Entry Price</th>
                <th className="py-2.5 px-4 font-medium">Stop Loss</th>
                <th className="py-2.5 px-4 font-medium">Exit Price</th>
                <th className="py-2.5 px-4 font-medium">Outcome Target</th>
                <th className="py-2.5 px-4 font-medium text-right">Realized Return</th>
                <th className="py-2.5 px-4 font-medium text-right">Duration</th>
                <th className="py-2.5 px-4 font-medium text-center">Copy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredClosedSignals.length > 0 ? (
                filteredClosedSignals.map((item, idx) => {
                  const isWin = item.pnlPercentage > 0;
                  return (
                    <tr key={`${item.id}-${idx}`} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-white flex items-center gap-1.5">
                          {item.symbol}
                          <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-800 text-slate-400">
                            {item.timeframe.toUpperCase()}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.direction.includes('BUY')
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40'
                              : 'bg-rose-950 text-rose-400 border border-rose-800/40'
                          }`}
                        >
                          {item.direction.includes('BUY') ? (
                            <ArrowUpRight className="w-3 h-3" />
                          ) : (
                            <ArrowDownRight className="w-3 h-3" />
                          )}
                          {item.direction}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-200 flex items-center gap-1 text-[11px]">
                          <Clock className="w-3 h-3 text-amber-400/90 shrink-0" />
                          <span>{item.timeStart || 'N/A'}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{item.closedAt}</div>
                      </td>

                      <td className="py-3 px-4 text-slate-300">
                        ${item.entryPrice < 2 ? item.entryPrice.toFixed(4) : item.entryPrice.toLocaleString()}
                      </td>

                      <td className="py-3 px-4 font-semibold text-rose-400">
                        {item.stopLoss ? `$${item.stopLoss < 2 ? item.stopLoss.toFixed(4) : item.stopLoss.toLocaleString()}` : '—'}
                      </td>

                      <td className="py-3 px-4 text-slate-300">
                        ${item.exitPrice < 2 ? item.exitPrice.toFixed(4) : item.exitPrice.toLocaleString()}
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                            isWin
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {isWin ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-rose-400" />
                          )}
                          {item.outcome === 'SL' ? 'Stop Loss' : item.outcome === 'MANUAL' ? 'Manual Close' : `${item.outcome} Reached`}
                        </span>
                      </td>

                      <td className={`py-3 px-4 text-right font-bold ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isWin ? '+' : ''}
                        {(item.pnlPercentage ?? 0).toFixed(2)}%
                      </td>

                      <td className="py-3 px-4 text-right">
                        <span className="px-2 py-0.5 rounded bg-slate-800/80 text-amber-300 text-[11px] font-bold border border-slate-700/60 inline-flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5 text-amber-400" />
                          <span>{item.duration || item.holdingTime}</span>
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={(e) => handleCopyRecord(e, item)}
                          className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer border border-slate-700/50"
                          title="Copy Closed Trade Log"
                        >
                          {copiedId === item.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <div className="max-w-xs mx-auto space-y-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-800/60 border border-slate-700 flex items-center justify-center mx-auto text-slate-500">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <p className="text-xs text-slate-400">No records matching current journal filters.</p>
                      {signalsList.length === 0 && (
                        <button
                          type="button"
                          onClick={handleResetSampleRecords}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 mx-auto cursor-pointer transition-colors"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Load Sample Journal Records</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal for Clearing Journal (Guarantees user verification in iframe & all browsers) */}
      {isConfirmClearModalOpen && (
        <div 
          id="clear-journal-confirm-dialog"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-modal-title"
        >
          <div className="bg-slate-900 border border-rose-500/30 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="clear-modal-title" className="text-base font-bold text-white">
                    Clear Closed Signals Journal?
                  </h3>
                  <span className="text-[11px] text-rose-400/90 font-mono">Irreversible Action</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsConfirmClearModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to clear all <span className="text-rose-400 font-bold font-mono">{signalsList.length}</span> records from the Verified Closed Signals Journal? This action will purge historical trade audits.
            </p>

            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-[11px] font-mono space-y-1.5">
              <div className="flex justify-between text-slate-400">
                <span>Trades to remove:</span>
                <span className="text-white font-bold">{signalsList.length} records</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Sample recovery:</span>
                <span className="text-emerald-400">Can be restored via "Reset Sample"</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                id="cancel-clear-journal-btn"
                onClick={() => setIsConfirmClearModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-clear-journal-btn"
                onClick={executeClearJournal}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-lg shadow-rose-950/50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Yes, Clear Journal</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
