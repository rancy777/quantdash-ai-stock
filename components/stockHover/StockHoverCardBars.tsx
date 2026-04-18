import React from 'react';
import { PERIOD_TABS } from './constants';
import { ActiveTech, HoverCardDataPoint } from './types';

type StockHoverCardBarsProps = {
  period: number;
  activeItem: HoverCardDataPoint | null;
  showMA: boolean;
  showChanStructure: boolean;
  activeTech: ActiveTech;
  chanSummaryLabel: string;
  onSelectPeriod: (value: number) => void;
};

const formatNumber = (value: unknown, digits = 2): string =>
  typeof value === 'number' ? value.toFixed(digits) : '-';

export default function StockHoverCardBars({
  period,
  activeItem,
  showMA,
  showChanStructure,
  activeTech,
  chanSummaryLabel,
  onSelectPeriod,
}: StockHoverCardBarsProps) {
  return (
    <>
      <div className="flex border-b border-slate-200 dark:border-slate-700 text-sm bg-slate-50 dark:bg-[#161a25] z-20 relative">
        {PERIOD_TABS.map((tab) => (
          <button
            key={tab.label}
            onClick={() => onSelectPeriod(tab.val)}
            className={`px-4 py-1.5 cursor-pointer hover:text-[#f0b90b] transition-colors ${period === tab.val ? 'text-[#f0b90b] border-b-2 border-[#f0b90b]' : 'text-slate-500 dark:text-[#848e9c]'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="px-2 py-1 flex text-xs font-mono justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161a25] z-20 relative h-[24px]">
        {activeItem ? (
          <>
            <span className="text-slate-900 dark:text-[#e1e4ea]">{activeItem.date}</span>
            <span>
              <span className="text-slate-400 dark:text-[#848e9c] mr-1">开</span>
              <span className={activeItem.isUp ? 'text-[#f6465d]' : 'text-[#0ecb81]'}>
                {formatNumber(activeItem.open)}
              </span>
            </span>
            <span>
              <span className="text-slate-400 dark:text-[#848e9c] mr-1">高</span>
              <span
                className={
                  activeItem.high > activeItem.open ? 'text-[#f6465d]' : 'text-[#0ecb81]'
                }
              >
                {formatNumber(activeItem.high)}
              </span>
            </span>
            <span>
              <span className="text-slate-400 dark:text-[#848e9c] mr-1">低</span>
              <span
                className={
                  activeItem.low < activeItem.open ? 'text-[#0ecb81]' : 'text-[#f6465d]'
                }
              >
                {formatNumber(activeItem.low)}
              </span>
            </span>
            <span>
              <span className="text-slate-400 dark:text-[#848e9c] mr-1">收</span>
              <span className={activeItem.isUp ? 'text-[#f6465d]' : 'text-[#0ecb81]'}>
                {formatNumber(activeItem.close)}
              </span>
            </span>
            <span className={activeItem.isUp ? 'text-[#f6465d]' : 'text-[#0ecb81]'}>
              {formatNumber(activeItem.changePercent)}%
            </span>
          </>
        ) : (
          <span>-</span>
        )}
      </div>

      <div className="px-2 py-1 flex text-[11px] font-mono gap-4 items-center bg-white dark:bg-[#161a25] z-20 relative h-[24px]">
        {activeItem &&
          showMA &&
          (activeTech === 'BOLL' ? (
            <>
              <span className="text-[#fb7185]">UPPER: {formatNumber(activeItem.bollUpper)}</span>
              <span className="text-[#f0b90b]">MID: {formatNumber(activeItem.bollMiddle)}</span>
              <span className="text-[#38bdf8]">LOWER: {formatNumber(activeItem.bollLower)}</span>
            </>
          ) : (
            <>
              <span className="text-[#f0b90b]">MA5: {formatNumber(activeItem.MA5)}</span>
              <span className="text-[#3b82f6]">MA10: {formatNumber(activeItem.MA10)}</span>
              <span className="text-[#a855f7]">MA30: {formatNumber(activeItem.MA30)}</span>
              <span className="text-[#22c55e]">MA60: {formatNumber(activeItem.MA60)}</span>
            </>
          ))}
        {showChanStructure && (
          <span className="ml-auto text-[10px] text-amber-700 dark:text-amber-300">
            缠论 {chanSummaryLabel}
          </span>
        )}
      </div>
    </>
  );
}
