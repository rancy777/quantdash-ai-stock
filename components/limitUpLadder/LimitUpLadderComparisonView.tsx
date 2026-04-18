import React from 'react';

import { LadderComparisonPair } from './types';
import { formatPct } from './utils';

interface LimitUpLadderComparisonViewProps {
  previousDayLabel: string;
  selectedDateLabel: string;
  comparisonPairs: LadderComparisonPair[];
  singleDayCloseMap: Record<string, number>;
  missingSymbolsSet: Set<string>;
}

const LimitUpLadderComparisonView: React.FC<LimitUpLadderComparisonViewProps> = ({
  previousDayLabel,
  selectedDateLabel,
  comparisonPairs,
  singleDayCloseMap,
  missingSymbolsSet,
}) => (
  <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-6 py-5">
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-700 dark:text-gray-200">
        <span>昨 {previousDayLabel}</span>
        <span className="text-slate-400 text-xs">vs</span>
        <span>今 {selectedDateLabel}</span>
      </div>
      <span className="text-xs text-slate-400">逐级对齐对比昨日与今日的封板节奏</span>
    </div>
    <div className="space-y-4">
      {comparisonPairs.map((pair) => (
        <div
          key={pair.key}
          className="border border-slate-200 dark:border-slate-600 rounded-2xl p-4 bg-white dark:bg-white/5"
        >
          <div className="grid grid-cols-[1fr_auto_1fr] items-center text-[11px] font-semibold text-slate-500 dark:text-gray-300 mb-3">
            <div>昨 {pair.prevBoardLabel} ({pair.prevBoardCount})</div>
            <div className="text-slate-300 dark:text-slate-600 text-xl text-center">⟶</div>
            <div className="text-right text-rose-500 dark:text-rose-300">今 {pair.currBoardLabel} ({pair.currBoardCount})</div>
          </div>
          <div className="space-y-2">
            {pair.rows.map((row) => {
              const pctClass = (value?: number) => (value !== undefined && value >= 0 ? 'text-red-500' : 'text-green-500');
              const fallbackToday = row.curr ? undefined : row.today;
              const displayStock = row.curr ?? fallbackToday?.stock ?? row.prev;
              const showManual = !row.curr;
              const manualPct = showManual ? singleDayCloseMap[row.symbol] : undefined;
              const awaitingManual = showManual && manualPct === undefined && missingSymbolsSet.has(row.symbol);

              return (
                <div
                  key={row.symbol}
                  className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-2 items-stretch"
                >
                  <div
                    className={`p-2 rounded-xl border text-xs flex flex-col justify-between ${
                      row.prev
                        ? 'bg-white dark:bg-white/5 border-slate-200 dark:border-slate-600'
                        : row.curr
                          ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-400/30'
                          : 'bg-slate-50 dark:bg-white/5 border-dashed border-slate-200 dark:border-slate-600 text-slate-400'
                    }`}
                  >
                    {row.prev ? (
                      <>
                        <div className="font-semibold text-slate-700 dark:text-gray-100">{row.prev.name}</div>
                        <div className="text-[10px] text-slate-400">{row.prev.symbol}</div>
                        <div className={`${pctClass(row.prev.pctChange)} font-bold`}>
                          {formatPct(row.prev.pctChange)}
                        </div>
                      </>
                    ) : row.curr ? (
                      <>
                        <div className="font-semibold text-slate-700 dark:text-gray-100 flex items-center justify-between gap-1">
                          <span>{row.curr.name}</span>
                          <span className="text-[10px] text-emerald-500">今日新晋</span>
                        </div>
                        <div className="text-[10px] text-slate-400">{row.curr.symbol}</div>
                        <div className={`${pctClass(row.curr.pctChange)} font-bold`}>
                          {formatPct(row.curr.pctChange)}
                        </div>
                      </>
                    ) : (
                      <div className="flex-1 flex items-center text-[11px]">暂无数据</div>
                    )}
                  </div>
                  <div className="flex items-center justify-center text-slate-300 dark:text-slate-600 text-base">⟶</div>
                  <div
                    className={`p-2 rounded-xl border text-xs flex flex-col justify-between ${
                      row.curr
                        ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-100 dark:border-rose-400/30'
                        : fallbackToday
                          ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-400/30 text-amber-600 dark:text-amber-200'
                          : 'bg-slate-50 dark:bg-white/5 border-dashed border-slate-200 dark:border-slate-600 text-slate-400'
                    }`}
                  >
                    {displayStock ? (
                      <>
                        <div className="font-semibold text-slate-700 dark:text-gray-100 flex items-center justify-between gap-1">
                          <span>{displayStock.name}</span>
                          {!row.curr && (
                            <span className="text-[10px] text-amber-500">
                              {fallbackToday ? `停留在 ${fallbackToday.boardLabel}` : '未晋级'}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400">{displayStock.symbol}</div>
                        {showManual ? (
                          awaitingManual ? (
                            <div className="text-slate-400 text-[11px] font-medium">加载收盘数据...</div>
                          ) : (
                            <>
                              <div className={`${pctClass(manualPct)} font-bold`}>
                                {manualPct !== undefined ? formatPct(manualPct) : '--'}
                              </div>
                              <div className="text-[10px] text-slate-400 mt-1">收盘涨跌幅</div>
                            </>
                          )
                        ) : (
                          <div className={`${pctClass(displayStock.pctChange)} font-bold`}>
                            {formatPct(displayStock.pctChange)}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex-1 flex items-center text-[11px]">暂无数据</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default LimitUpLadderComparisonView;
