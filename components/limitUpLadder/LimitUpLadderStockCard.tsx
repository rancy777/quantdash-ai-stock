import React from 'react';
import { Clock3, TrendingUp } from 'lucide-react';

import { Stock } from '../../types';
import { formatPct } from './utils';

interface LimitUpLadderStockCardProps {
  stock: Stock;
  groupCount: number;
  selected: boolean;
  showColorChain: boolean;
  compact?: boolean;
  style?: React.CSSProperties;
  onMouseEnter: (event: React.MouseEvent<HTMLDivElement>, stock: Stock) => void;
  onMouseMove: (event: React.MouseEvent<HTMLDivElement>) => void;
  onMouseLeave: () => void;
  onToggleSelected: (symbol: string) => void;
}

const LimitUpLadderStockCard: React.FC<LimitUpLadderStockCardProps> = ({
  stock,
  groupCount,
  selected,
  showColorChain,
  compact = false,
  style,
  onMouseEnter,
  onMouseMove,
  onMouseLeave,
  onToggleSelected,
}) => {
  const displayTime = stock.limitUpTime ?? '--:--';

  return (
    <div
      className={`relative transition-all cursor-pointer overflow-hidden group/card border ${
        compact ? 'p-2.5 rounded-lg' : 'p-4 rounded-xl'
      } ${
        !showColorChain
          ? compact
            ? 'bg-white dark:bg-white/5 border-slate-300 dark:border-slate-600 shadow-sm hover:shadow-md hover:border-cyan-500/50'
            : 'bg-white dark:bg-white/5 border-slate-200 dark:border-slate-700 hover:border-cyan-500/40 shadow-sm hover:shadow-md'
          : ''
      } ${selected ? (compact ? 'ring-2 ring-amber-400 shadow-lg bg-amber-100/40 dark:bg-amber-500/10' : 'ring-2 ring-amber-400 bg-amber-50/60 dark:bg-amber-500/10') : ''}`}
      style={style}
      onMouseEnter={(event) => onMouseEnter(event, stock)}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      onClick={() => onToggleSelected(stock.symbol)}
    >
      {stock.concepts?.[0] || stock.industry ? (
        <div
          className={`absolute top-0 right-0 text-[10px] px-1.5 py-0.5 rounded-bl-lg font-medium tracking-tight ${
            showColorChain ? 'bg-black/20 text-white/90' : 'bg-slate-100 dark:bg-black/20 text-slate-500 dark:text-gray-400'
          }`}
        >
          {stock.concepts?.[0] ?? stock.industry}
        </div>
      ) : (
        <div
          className={`absolute top-0 right-0 text-[10px] px-1.5 py-0.5 rounded-bl-lg font-medium tracking-tight ${
            showColorChain ? 'bg-black/20 text-white/90' : 'bg-slate-100 dark:bg-black/20 text-slate-500 dark:text-gray-400'
          }`}
        >
          {groupCount >= 7 ? '7连+' : `${groupCount}连板`}
        </div>
      )}
      <div
        className={`font-bold ${compact ? 'text-sm mb-1 mt-0.5 pr-8' : 'text-base mb-1 mt-1 pr-10'} ${
          showColorChain ? 'text-slate-900 dark:text-white' : 'text-slate-800 dark:text-gray-100'
        }`}
      >
        {stock.name}
      </div>
      <div className="flex items-center justify-between text-xs">
        <span
          className={`${
            compact
              ? `text-[10px] font-mono ${showColorChain ? 'text-slate-700 dark:text-gray-300' : 'text-slate-400'}`
              : showColorChain
                ? 'text-slate-700 dark:text-gray-300'
                : 'text-slate-500'
          }`}
        >
          {stock.symbol}
        </span>
        <span className={`font-bold text-red-500 flex items-center ${compact ? 'text-[11px]' : 'text-xs bg-red-500/5 px-1 rounded'}`}>
          {!compact && <TrendingUp size={10} className="mr-0.5" />}
          {formatPct(stock.pctChange)}
        </span>
      </div>
      <div
        className={`flex items-center gap-1 ${
          compact
            ? `mt-2 text-[10px] ${showColorChain ? 'text-slate-700 dark:text-gray-200' : 'text-slate-400 dark:text-gray-400'}`
            : `mt-2 text-[11px] ${showColorChain ? 'text-slate-600 dark:text-gray-200' : 'text-slate-400 dark:text-gray-400'}`
        }`}
      >
        <Clock3 size={12} className="text-cyan-500" />
        <span>{compact ? `最后涨停：${displayTime}` : `最后涨停 ${displayTime}`}</span>
      </div>
      {!showColorChain && !compact && (
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 via-cyan-500/5 to-cyan-500/0 opacity-0 group/card:opacity-100 pointer-events-none transition-opacity duration-500" />
      )}
    </div>
  );
};

export default LimitUpLadderStockCard;
