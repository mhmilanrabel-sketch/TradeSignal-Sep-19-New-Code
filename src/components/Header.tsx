import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Activity, 
  Volume2, 
  VolumeX, 
  BellRing, 
  Calculator, 
  BarChart3, 
  Radio,
  Clock,
  LayoutDashboard,
  Trash2,
  Archive
} from 'lucide-react';

export type NavTab = 'dashboard' | 'activeTrades' | 'chart' | 'calculator' | 'trackRecord';

interface HeaderProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  audioEnabled: boolean;
  setAudioEnabled: (enabled: boolean) => void;
  activeSignalsCount: number;
  onOpenAlertModal: () => void;
  onClearLogs?: () => void;
  onArchiveOldLogs?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  audioEnabled,
  setAudioEnabled,
  activeSignalsCount,
  onOpenAlertModal,
  onClearLogs,
  onArchiveOldLogs,
}) => {
  const [timeUtc, setTimeUtc] = useState<string>('');

  useEffect(() => {
    const updateClock = () => {
      const d = new Date();
      setTimeUtc(d.toUTCString().slice(17, 25) + ' UTC');
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header id="app-header" className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Brand & Live status */}
          <div className="flex items-center gap-4">
            <div 
              id="brand-logo" 
              className="flex items-center gap-2.5 cursor-pointer select-none"
              onClick={() => setActiveTab('dashboard')}
            >
              <div className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-sm">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-lg tracking-tight text-white">TradeSignal</span>
                  <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 rounded">
                    PRO
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="font-mono text-[10px] text-slate-300">STREAMING</span>
                </div>
              </div>
            </div>

            {/* Live UTC Clock & Confluence pill */}
            <div className="hidden lg:flex items-center gap-2.5 border-l border-slate-800/80 pl-4">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono bg-slate-900/60 border border-slate-800 px-2.5 py-1 rounded-md">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>{timeUtc || '00:00:00 UTC'}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs bg-emerald-950/30 border border-emerald-800/40 text-emerald-300 px-2.5 py-1 rounded-md">
                <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span>Market Bias: <strong className="text-emerald-400 font-medium">BULLISH 74%</strong></span>
              </div>
            </div>
          </div>

          {/* Navigation tabs */}
          <nav id="main-navigation" className="hidden md:flex items-center gap-1 bg-slate-900/80 p-1 rounded-lg border border-slate-800">
            <button
              id="nav-tab-dashboard"
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeTab === 'dashboard'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-emerald-400" />
              <span>AI Dashboard</span>
            </button>

            <button
              id="nav-tab-active-trades"
              type="button"
              onClick={() => setActiveTab('activeTrades')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeTab === 'activeTrades'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span>Active Trades</span>
              {activeSignalsCount > 0 && (
                <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 text-[10px] font-bold rounded-full">
                  {activeSignalsCount}
                </span>
              )}
            </button>

            <button
              id="nav-tab-chart"
              type="button"
              onClick={() => setActiveTab('chart')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeTab === 'chart'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
              <span>Chart Studio</span>
            </button>

            <button
              id="nav-tab-calculator"
              type="button"
              onClick={() => setActiveTab('calculator')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeTab === 'calculator'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Calculator className="w-3.5 h-3.5 text-amber-400" />
              <span>Risk Calculator</span>
            </button>

            <button
              id="nav-tab-track-record"
              type="button"
              onClick={() => setActiveTab('trackRecord')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeTab === 'trackRecord'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-purple-400" />
              <span>Track Record</span>
            </button>
          </nav>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Archive Old Completed Logs (>5 Days) */}
            {onArchiveOldLogs && (
              <button
                id="archive-old-logs-btn"
                type="button"
                onClick={onArchiveOldLogs}
                title="Archive completed trades older than 5 days"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-medium transition-colors cursor-pointer"
              >
                <Archive className="w-3.5 h-3.5 text-purple-400" />
                <span className="hidden xl:inline">Archive &gt;5d</span>
              </button>
            )}

            {/* Clear Current Log */}
            {onClearLogs && (
              <button
                id="clear-current-log-btn"
                type="button"
                onClick={onClearLogs}
                title="Clear current log entries"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 hover:border-rose-800/50 text-xs font-medium transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden xl:inline">Clear Log</span>
              </button>
            )}

            {/* Audio Toggle */}
            <button
              id="toggle-audio-alert-btn"
              type="button"
              onClick={() => setAudioEnabled(!audioEnabled)}
              title={audioEnabled ? 'Audio alerts active (Click to mute)' : 'Audio alerts muted (Click to enable)'}
              className={`p-2 rounded-lg border transition-colors cursor-pointer ${
                audioEnabled 
                  ? 'bg-emerald-950/40 border-emerald-700/50 text-emerald-400 hover:bg-emerald-900/40' 
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Custom Alert Trigger Button */}
            <button
              id="open-create-alert-modal-btn"
              type="button"
              onClick={onOpenAlertModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-semibold transition-colors shadow-sm cursor-pointer"
            >
              <BellRing className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Set Custom Alert</span>
              <span className="sm:hidden">Alert</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="md:hidden flex items-center justify-around py-2 border-t border-slate-900 overflow-x-auto">
          <button
            id="mobile-nav-tab-dashboard"
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-1 text-xs py-1 px-2 rounded ${
              activeTab === 'dashboard' ? 'text-emerald-400 font-semibold bg-slate-900' : 'text-slate-400'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Bot</span>
          </button>
          <button
            id="mobile-nav-tab-active-trades"
            type="button"
            onClick={() => setActiveTab('activeTrades')}
            className={`flex items-center gap-1 text-xs py-1 px-2 rounded ${
              activeTab === 'activeTrades' ? 'text-emerald-400 font-semibold bg-slate-900' : 'text-slate-400'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Trades ({activeSignalsCount})</span>
          </button>
          <button
            id="mobile-nav-tab-chart"
            type="button"
            onClick={() => setActiveTab('chart')}
            className={`flex items-center gap-1 text-xs py-1 px-2 rounded ${
              activeTab === 'chart' ? 'text-blue-400 font-semibold bg-slate-900' : 'text-slate-400'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Chart</span>
          </button>
          <button
            id="mobile-nav-tab-calculator"
            type="button"
            onClick={() => setActiveTab('calculator')}
            className={`flex items-center gap-1 text-xs py-1 px-2 rounded ${
              activeTab === 'calculator' ? 'text-amber-400 font-semibold bg-slate-900' : 'text-slate-400'
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>Risk</span>
          </button>
          <button
            id="mobile-nav-tab-track-record"
            type="button"
            onClick={() => setActiveTab('trackRecord')}
            className={`flex items-center gap-1 text-xs py-1 px-2 rounded ${
              activeTab === 'trackRecord' ? 'text-purple-400 font-semibold bg-slate-900' : 'text-slate-400'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Record</span>
          </button>
        </div>
      </div>
    </header>
  );
};
