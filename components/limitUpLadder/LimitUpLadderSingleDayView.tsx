import React from 'react';

import { Stock } from '../../types';
import LimitUpLadderStockCard from './LimitUpLadderStockCard';
import { LadderStockGroup } from './types';

interface LimitUpLadderSingleDayViewProps {
  selectedDate: string;
  selectedStockSymbol: string | null;
  showColorChain: boolean;
  rows: LadderStockGroup[];
  getStockStyle: (stockName: string) => React.CSSProperties;
  onMouseEnter: (event: React.MouseEvent<HTMLDivElement>, stock: Stock) => void;
  onMouseMove: (event: React.MouseEvent<HTMLDivElement>) => void;
  onMouseLeave: () => void;
  onToggleSelectedStock: (symbol: string) => void;
}

const LimitUpLadderSingleDayView: React.FC<LimitUpLadderSingleDayViewProps> = ({
  selectedDate,
  selectedStockSymbol,
  showColorChain,
  rows,
  getStockStyle,
  onMouseEnter,
  onMouseMove,
  onMouseLeave,
  onToggleSelectedStock,
}) => (
  <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-6 py-5">
    {rows.length === 0 ? (
      <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2 border border-dashed border-slate-200 dark:border-slate-600 rounded-2xl p-10">
        <span>暂无该日的连板数据</span>
        <span className="text-xs text-slate-400">{selectedDate}</span>
      </div>
    ) : (
      <div className="space-y-4">
        {rows.map((group) => (
          <div
            key={group.label}
            className="border border-slate-200 dark:border-white/10 rounded-2xl bg-white/15 dark:bg-white/[0.03] backdrop-blur px-4 py-4"
          >
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center justify-center px-3 py-1 text-xs font-semibold rounded-lg ${
                    group.count >= 5
                      ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                      : 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20'
                  }`}
                >
                  {group.label}
                </span>
                <span className="text-xs text-slate-400">{group.stocks.length} 只</span>
              </div>
              <span className="text-xs text-slate-400 font-mono">连板数 {group.count}</span>
            </div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {group.stocks.map((stock) => (
                <LimitUpLadderStockCard
                  key={stock.symbol}
                  stock={stock}
                  groupCount={group.count}
                  selected={selectedStockSymbol === stock.symbol}
                  showColorChain={showColorChain}
                  style={getStockStyle(stock.name)}
                  onMouseEnter={onMouseEnter}
                  onMouseMove={onMouseMove}
                  onMouseLeave={onMouseLeave}
                  onToggleSelected={onToggleSelectedStock}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

export default LimitUpLadderSingleDayView;
