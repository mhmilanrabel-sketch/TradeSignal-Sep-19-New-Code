import React from 'react';
import { AssetClass, Timeframe } from '../types';
import { Search, Filter, SlidersHorizontal } from 'lucide-react';

interface SignalFiltersProps {
  selectedAssetClass: AssetClass;
  setSelectedAssetClass: (val: AssetClass) => void;
  selectedTimeframe: Timeframe | 'all';
  setSelectedTimeframe: (val: Timeframe | 'all') => void;
  directionFilter: 'all' | 'buy' | 'sell';
  setDirectionFilter: (val: 'all' | 'buy' | 'sell') => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  minConfidence: number;
  setMinConfidence: (val: number) => void;
  totalSignals: number;
}

export const SignalFilters: React.FC<SignalFiltersProps> = ({
  selectedAssetClass,
  setSelectedAssetClass,
  selectedTimeframe,
  setSelectedTimeframe,
  directionFilter,
  setDirectionFilter,
  searchQuery,
  setSearchQuery,
  minConfidence,
  setMinConfidence,
  totalSignals,
}) => {
  const assetClasses: { id: AssetClass; label: string }[] = [
    { id: 'all', label: 'All Assets' },
    { id: 'crypto', label: 'Crypto' },
    { id: 'forex', label: 'Forex' },
    { id: 'commodities', label: 'Commodities' },
    { id: 'stocks', label: 'Stocks & Indices' },
  ];

  const timeframes: (Timeframe | 'all')[] = ['all', '15m', '1h', '4h', '1d'];

  return (
    <div id="signals-filter-bar" className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 sm:p-4 mb-6 space-y-3">
      {/* Top row: Search input + Asset Class filters */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Asset Class Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {assetClasses.map((item) => (
            <button
              key={item.id}
              id={`filter-asset-${item.id}`}
              type="button"
              onClick={() => setSelectedAssetClass(item.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                selectedAssetClass === item.id
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'bg-slate-950/60 text-slate-400 border border-slate-800/80 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Search Field */}
        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="signals-search-input"
            type="text"
            placeholder="Search symbol (BTC, EUR, Gold)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-950/70 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
          />
        </div>
      </div>

      {/* Bottom row: Timeframe + Direction + Confidence + Count */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-slate-800/60 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          {/* Timeframe selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium text-[11px] flex items-center gap-1">
              <Filter className="w-3 h-3 text-slate-400" />
              Timeframe:
            </span>
            <div className="flex items-center gap-1">
              {timeframes.map((tf) => (
                <button
                  key={tf}
                  id={`filter-timeframe-${tf}`}
                  type="button"
                  onClick={() => setSelectedTimeframe(tf)}
                  className={`px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                    selectedTimeframe === tf
                      ? 'bg-slate-800 text-white font-semibold border border-slate-700'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  {tf.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Direction Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium text-[11px]">Direction:</span>
            <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800">
              <button
                id="filter-direction-all"
                type="button"
                onClick={() => setDirectionFilter('all')}
                className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  directionFilter === 'all' ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All
              </button>
              <button
                id="filter-direction-buy"
                type="button"
                onClick={() => setDirectionFilter('buy')}
                className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  directionFilter === 'buy' ? 'bg-emerald-950/70 text-emerald-300 font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Buy Only
              </button>
              <button
                id="filter-direction-sell"
                type="button"
                onClick={() => setDirectionFilter('sell')}
                className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  directionFilter === 'sell' ? 'bg-rose-950/70 text-rose-300 font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Sell Only
              </button>
            </div>
          </div>

          {/* Min Confidence filter */}
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-slate-400 font-medium text-[11px] flex items-center gap-1">
              <SlidersHorizontal className="w-3 h-3 text-slate-400" />
              Min Confidence:
            </span>
            <input
              id="filter-confidence-range"
              type="range"
              min={70}
              max={95}
              step={5}
              value={minConfidence}
              onChange={(e) => setMinConfidence(Number(e.target.value))}
              className="w-20 accent-emerald-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <span className="font-mono text-[11px] text-emerald-400 font-semibold">{minConfidence}%+</span>
          </div>
        </div>

        {/* Counter */}
        <div className="text-slate-400 text-xs font-mono ml-auto">
          Showing <span className="text-slate-100 font-semibold">{totalSignals}</span> matching signals
        </div>
      </div>
    </div>
  );
};
