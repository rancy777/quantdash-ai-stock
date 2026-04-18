import React from 'react';
import { AlertCircle, Layers, SearchCheck, Zap } from 'lucide-react';

import Badge from '../ui/Badge';
import { Stock } from '../../types';

interface ScreenerResultsPaneProps {
  conceptStats: [string, number][];
  idleHint: string;
  isPywencaiMode: boolean;
  isScanning: boolean;
  results: Stock[];
  scanError: string;
  scanProgress: {
    current: number;
    total: number;
  };
  scanStatus: string;
  strategyTagText: string;
  onMouseEnter: (event: React.MouseEvent, stock: Stock) => void;
  onMouseMove: (event: React.MouseEvent) => void;
  onMouseLeave: () => void;
}

const Sparkline = ({ color }: { color: string }) => (
  <svg width="100%" height="40" viewBox="0 0 100 40" className="opacity-70">
    <path d={`M0,35 Q10,30 20,32 T40,25 T60,28 T80,10 L100,5`} fill="none" stroke={color} strokeWidth="2" />
    <path d={`M0,35 Q10,30 20,32 T40,25 T60,28 T80,10 L100,5 L100,40 L0,40 Z`} fill={color} fillOpacity="0.1" />
  </svg>
);

const ScreenerResultsPane: React.FC<ScreenerResultsPaneProps> = ({
  conceptStats,
  idleHint,
  isPywencaiMode,
  isScanning,
  results,
  scanError,
  scanProgress,
  scanStatus,
  strategyTagText,
  onMouseEnter,
  onMouseMove,
  onMouseLeave,
}) => (
  <div className="flex-1 min-h-0 flex flex-col">
    <div className="mb-4 flex items-center justify-between bg-white/40 dark:bg-white/5 p-3 rounded-xl border border-white/50 dark:border-white/5 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-cyan-500/20 rounded-lg text-cyan-600 dark:text-cyan-400">
          <SearchCheck size={20} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
            筛选结果
            {!isScanning && (
              <span className="ml-2 text-xs font-normal text-slate-500 bg-slate-200 dark:bg-white/10 px-2 py-0.5 rounded-full">
                {results.length} 只标的
              </span>
            )}
          </h3>
          <div className="text-xs text-slate-400 mt-0.5">
            {isScanning ? scanStatus : (scanStatus || idleHint)}
          </div>
        </div>
      </div>

      {isScanning && scanProgress.total > 0 && (
        <div className="flex flex-col items-end w-48">
          <div className="flex justify-between w-full text-xs text-slate-400 mb-1">
            <span>进度</span>
            <span>{Math.round((scanProgress.current / scanProgress.total) * 100)}%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-cyan-500 transition-all duration-300 ease-out"
              style={{ width: `${(scanProgress.current / scanProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>

    {conceptStats.length > 0 && (
      <div className="mb-4 p-4 rounded-2xl border border-white/60 dark:border-white/10 bg-white/70 dark:bg-white/[0.04] backdrop-blur">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-white">
            <Layers size={16} className="text-cyan-500" />
            概念涨停统计
          </div>
          <span className="text-xs text-slate-400">{conceptStats.length} 个概念</span>
        </div>
        <div className="flex flex-wrap gap-3">
          {conceptStats.map(([concept, count]) => (
            <div
              key={concept}
              className="px-3 py-2 rounded-xl bg-cyan-50/80 dark:bg-cyan-500/10 border border-cyan-100 dark:border-cyan-500/30 shadow-sm"
            >
              <p className="text-xs font-semibold text-slate-600 dark:text-white">{concept}</p>
              <p className="text-[11px] text-cyan-600 dark:text-cyan-300 mt-0.5">{count} 个涨停</p>
            </div>
          ))}
        </div>
      </div>
    )}

    <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 relative">
      {isScanning && results.length === 0 ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-4 opacity-50">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center font-mono text-xs text-cyan-500">
              {isPywencaiMode ? 'WC' : 'AI'}
            </div>
          </div>
          <p className="animate-pulse">
            {isPywencaiMode ? '正在等待 pywencai 返回结果...' : '深度扫描全市场K线形态...'}
          </p>
        </div>
      ) : results.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-20">
          {results.map((stock) => (
            <div
              key={stock.symbol}
              className="backdrop-blur border rounded-xl p-4 transition-all cursor-pointer group hover:-translate-y-1 hover:shadow-lg
              bg-white/40 dark:bg-white/[0.03]
              border-white/50 dark:border-white/5
              hover:bg-white/80 dark:hover:bg-white/[0.08]
              hover:border-cyan-500/20
              hover:shadow-black/5 dark:hover:shadow-black/20"
              onMouseEnter={(event) => onMouseEnter(event, stock)}
              onMouseMove={onMouseMove}
              onMouseLeave={onMouseLeave}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-gray-100 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">{stock.name}</h4>
                  <span className="text-xs font-mono text-slate-500 dark:text-gray-500 bg-slate-100 dark:bg-black/20 px-1 rounded">{stock.symbol}</span>
                </div>
                <Badge variant={stock.pctChange >= 0 ? 'red' : 'green'}>
                  {stock.pctChange > 0 ? '+' : ''}{stock.pctChange}%
                </Badge>
              </div>

              <div className="h-10 w-full my-2">
                <Sparkline color={stock.pctChange >= 0 ? '#ef4444' : '#10b981'} />
              </div>

              <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-slate-200/50 dark:border-white/5">
                <span className="text-xs text-slate-500">{stock.industry}</span>
                <div className="flex-1" />
                <span className="text-xs text-slate-400 font-mono">PE: {stock.pe}</span>
              </div>

              <div className="mt-2 flex">
                <span className="text-[10px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded flex items-center gap-1">
                  <Zap size={10} />
                  {strategyTagText}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        !isScanning && (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-3 border border-dashed border-slate-300 dark:border-white/10 rounded-xl m-4">
            <AlertCircle size={32} className="opacity-50" />
            <p>{scanError || idleHint}</p>
          </div>
        )
      )}
    </div>
  </div>
);

export default ScreenerResultsPane;
