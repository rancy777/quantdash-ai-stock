import React from 'react';

import { LadderData, Stock } from '../../types';
import LimitUpLadderStockCard from './LimitUpLadderStockCard';

interface LimitUpLadderTableViewProps {
  ladderData: LadderData;
  selectedDateLabel: string;
  selectedStockSymbol: string | null;
  showColorChain: boolean;
  getStockStyle: (stockName: string) => React.CSSProperties;
  onMouseEnter: (event: React.MouseEvent<HTMLDivElement>, stock: Stock) => void;
  onMouseMove: (event: React.MouseEvent<HTMLDivElement>) => void;
  onMouseLeave: () => void;
  onToggleSelectedStock: (symbol: string) => void;
}

const LimitUpLadderTableView: React.FC<LimitUpLadderTableViewProps> = ({
  ladderData,
  selectedDateLabel,
  selectedStockSymbol,
  showColorChain,
  getStockStyle,
  onMouseEnter,
  onMouseMove,
  onMouseLeave,
  onToggleSelectedStock,
}) => (
  <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto custom-scrollbar relative flex flex-col">
    <table className="w-max border-collapse min-w-[2200px]">
      <thead className="sticky top-0 z-20 bg-slate-100/90 dark:bg-[#161a25]/95 backdrop-blur shadow-sm">
        <tr>
          <th className="p-0 min-w-[120px] h-[60px] border-b border-r border-slate-300 dark:border-slate-600 sticky left-0 z-30 bg-slate-100 dark:bg-[#161a25]">
            <div className="relative w-full h-full">
              <svg className="absolute inset-0 w-full h-full" width="100%" height="100%">
                <line x1="0" y1="0" x2="100%" y2="100%" className="stroke-slate-400 dark:stroke-slate-500" strokeWidth="1" />
              </svg>
              <span className="absolute top-2 right-3 text-xs font-bold text-slate-600 dark:text-gray-300">日期</span>
              <span className="absolute bottom-2 left-3 text-xs font-bold text-slate-600 dark:text-gray-300">连板</span>
            </div>
          </th>
          {ladderData.dates.map((date) => (
            <th
              key={date}
              className={`p-3 text-center min-w-[140px] border-b border-l border-slate-300 dark:border-slate-600 font-mono text-sm ${
                date === selectedDateLabel
                  ? 'text-cyan-600 dark:text-cyan-400 font-bold bg-cyan-50/50 dark:bg-cyan-900/10'
                  : 'text-slate-700 dark:text-gray-200'
              }`}
            >
              {date}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-300 dark:divide-slate-700">
        {ladderData.boardCounts.map((row) => (
          <tr key={row.label} className="group hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
            <td className="p-4 font-bold text-slate-700 dark:text-white sticky left-0 bg-slate-50/90 dark:bg-[#0f1219]/95 border-r border-b border-slate-300 dark:border-slate-600 z-10 text-sm shadow-[1px_0_0_0_rgba(255,255,255,0.05)]">
              <div
                className={`inline-flex items-center justify-center px-3 py-1.5 rounded-lg w-full text-center ${
                  row.count >= 5
                    ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                    : 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20'
                }`}
              >
                {row.label}
              </div>
            </td>
            {ladderData.dates.map((date) => {
              const stocks = row.data[date] || [];
              const isSelectedDate = date === selectedDateLabel;

              return (
                <td
                  key={`${row.label}-${date}`}
                  className={`p-2 align-top border-r border-slate-300 dark:border-slate-600 last:border-r-0 min-h-[100px] ${
                    isSelectedDate ? 'bg-cyan-50/20 dark:bg-cyan-900/5' : ''
                  }`}
                >
                  <div className="flex flex-col gap-2 min-h-[60px]">
                    {stocks.map((stock) => (
                      <LimitUpLadderStockCard
                        key={`${stock.symbol}-${date}`}
                        stock={stock}
                        groupCount={row.count}
                        selected={selectedStockSymbol === stock.symbol}
                        showColorChain={showColorChain}
                        compact
                        style={getStockStyle(stock.name)}
                        onMouseEnter={onMouseEnter}
                        onMouseMove={onMouseMove}
                        onMouseLeave={onMouseLeave}
                        onToggleSelected={onToggleSelectedStock}
                      />
                    ))}
                  </div>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default LimitUpLadderTableView;
