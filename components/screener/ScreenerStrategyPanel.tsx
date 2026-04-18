import React from 'react';
import { ChevronRight, Eye, EyeOff, Layers, Loader2, Play } from 'lucide-react';

import Badge from '../ui/Badge';
import GlassCard from '../ui/GlassCard';
import { ScreenerStrategyOption } from './config';

interface ScreenerStrategyPanelProps {
  activeStrategy: string;
  actionLabel: string;
  hiddenStrategyCards: Record<string, boolean>;
  isPywencaiMode: boolean;
  isScanning: boolean;
  scanError: string;
  stockQuery: string;
  strategies: ScreenerStrategyOption[];
  onSelectStrategy: (strategyId: string) => void;
  onStartScan: () => void;
  onStockQueryChange: (value: string) => void;
  onToggleStrategyCardVisibility: (strategyId: string) => void;
}

const getPrimaryActionButtonClass = (isScanning: boolean, isPywencaiMode: boolean) =>
  `inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
    isScanning
      ? 'cursor-not-allowed bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
      : isPywencaiMode
        ? 'bg-[#da7756] text-white hover:bg-[#c86747] shadow-[0_10px_30px_rgba(218,119,86,0.18)]'
        : 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:from-cyan-500 hover:to-blue-500 shadow-cyan-900/20'
  }`;

const ScreenerStrategyPanel: React.FC<ScreenerStrategyPanelProps> = ({
  activeStrategy,
  actionLabel,
  hiddenStrategyCards,
  isPywencaiMode,
  isScanning,
  scanError,
  stockQuery,
  strategies,
  onSelectStrategy,
  onStartScan,
  onStockQueryChange,
  onToggleStrategyCardVisibility,
}) => (
  <GlassCard
    title="策略选股"
    className="w-full lg:w-1/4 flex-shrink-0 flex flex-col"
    action={<Layers size={18} className="text-cyan-500" />}
  >
    <div className="mb-4 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-white/[0.03]">
      <label className="block text-xs font-medium tracking-[0.08em] text-slate-500 dark:text-gray-400">
        {isPywencaiMode ? 'pywencai 一句话条件' : '策略选股输入'}
      </label>
      {isPywencaiMode ? (
        <textarea
          value={stockQuery}
          onChange={(event) => onStockQueryChange(event.target.value)}
          placeholder="例如：近20日涨停过，今日成交额大于5亿，非ST，主板股票"
          rows={4}
          className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm leading-6 text-slate-800 outline-none transition-colors focus:border-[#da7756] focus:ring-2 focus:ring-[#da7756]/15 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
        />
      ) : (
        <input
          value={stockQuery}
          onChange={(event) => onStockQueryChange(event.target.value)}
          placeholder="输入股票代码或名称，例如 600519 / 贵州茅台"
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition-colors focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
        />
      )}
      <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-gray-400">
        {isPywencaiMode
          ? '这里填写一句完整自然语言条件，不是股票代码。返回结果直接来自 pywencai。'
          : '留空时按策略默认股票池扫描；输入后只校验匹配到的标的。'}
      </p>
      {scanError && <p className="mt-2 text-xs leading-5 text-rose-500">{scanError}</p>}
      <button
        onClick={onStartScan}
        disabled={isScanning}
        className={`mt-3 ${getPrimaryActionButtonClass(isScanning, isPywencaiMode)}`}
      >
        {isScanning ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} fill="currentColor" />}
        {isScanning ? (isPywencaiMode ? '正在向 pywencai 选股...' : '正在扫描市场...') : actionLabel}
      </button>
    </div>

    <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-1">
      {strategies.map((strategy) => {
        const isTextHidden = Boolean(hiddenStrategyCards[strategy.id]);
        return (
          <button
            key={strategy.id}
            onClick={() => onSelectStrategy(strategy.id)}
            className={`w-full text-left p-4 rounded-xl border transition-all duration-300 group relative overflow-hidden
              ${activeStrategy === strategy.id
                ? 'bg-cyan-500/10 border-cyan-500/50 shadow-md'
                : 'bg-white/5 border-transparent hover:bg-white/10 hover:border-white/10'
              }`}
          >
            <div className={`flex items-center justify-between ${isTextHidden ? '' : 'mb-2'}`}>
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-lg bg-slate-100 dark:bg-slate-800 ${strategy.color}`}>
                  {strategy.icon}
                </div>
                {!isTextHidden && (
                  <span className={`font-bold ${activeStrategy === strategy.id ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-700 dark:text-gray-200'}`}>
                    {strategy.name}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {activeStrategy === strategy.id && <ChevronRight size={16} className="text-cyan-500" />}
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleStrategyCardVisibility(strategy.id);
                  }}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-500 transition-colors hover:border-cyan-300 hover:text-cyan-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-400 dark:hover:border-cyan-500/30 dark:hover:text-cyan-300"
                  title={isTextHidden ? '显示文字' : '隐藏文字'}
                >
                  {isTextHidden ? <Eye size={15} /> : <EyeOff size={15} />}
                </button>
              </div>
            </div>

            {!isTextHidden && (
              <div className="flex gap-2 mb-2">
                <Badge variant="outline" className="text-[10px]">{strategy.badge}</Badge>
              </div>
            )}

            {!isTextHidden && (
              <p className="text-xs text-slate-500 dark:text-gray-400 leading-relaxed pl-1">
                {strategy.desc}
              </p>
            )}

            {activeStrategy === strategy.id && (
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-cyan-500" />
            )}
          </button>
        );
      })}
    </div>

    <div className="pt-4 mt-2 border-t border-slate-200 dark:border-white/10">
      <button
        onClick={onStartScan}
        disabled={isScanning}
        className={getPrimaryActionButtonClass(isScanning, isPywencaiMode)}
      >
        {isScanning ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} fill="currentColor" />}
        {isScanning ? (isPywencaiMode ? '正在向 pywencai 选股...' : '正在扫描市场...') : actionLabel}
      </button>
    </div>
  </GlassCard>
);

export default ScreenerStrategyPanel;
