import React from 'react';
import { BarChart2, Loader2, RefreshCw } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import type { BoardHeightEntry } from '../../../types';
import type { DataSourceState } from '../hooks/useSentimentSectionData';

type SentimentHeightPanelProps = {
  boardHeightAxisTicks: { ticks: number[]; max: number };
  boardHeightChartWidth: number;
  boardHeightData: BoardHeightEntry[];
  boardHeightLoading: boolean;
  boardHeightScrollRef: React.RefObject<HTMLDivElement | null>;
  boardHeightSource: DataSourceState;
  formatBoardNames: (names: string[], symbols: string[]) => string;
  handleBoardHeightMouseDown: (event: React.MouseEvent<HTMLDivElement>) => void;
  handleBoardHeightMouseMove: (event: React.MouseEvent<HTMLDivElement>) => void;
  handleRefresh: () => void;
  isBoardHeightDragging: boolean;
  latestBoardHeight: BoardHeightEntry | null;
  mainBoardHighestDot: (props: unknown) => React.ReactNode;
  mainBoardSecondHighestDot: (props: unknown) => React.ReactNode;
  chinextHighestDot: (props: unknown) => React.ReactNode;
  renderSourceBadge: (source: DataSourceState) => React.ReactNode;
  sortedBoardHeightData: BoardHeightEntry[];
  stopBoardHeightDrag: () => void;
};

const SentimentHeightPanel: React.FC<SentimentHeightPanelProps> = ({
  boardHeightAxisTicks,
  boardHeightChartWidth,
  boardHeightData,
  boardHeightLoading,
  boardHeightScrollRef,
  boardHeightSource,
  formatBoardNames,
  handleBoardHeightMouseDown,
  handleBoardHeightMouseMove,
  handleRefresh,
  isBoardHeightDragging,
  latestBoardHeight,
  mainBoardHighestDot,
  mainBoardSecondHighestDot,
  chinextHighestDot,
  renderSourceBadge,
  sortedBoardHeightData,
  stopBoardHeightDrag,
}) => {
  if (boardHeightLoading && boardHeightData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
        <Loader2 className="animate-spin" /> 正在加载连板高度趋势...
      </div>
    );
  }

  if (boardHeightData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
        <BarChart2 className="opacity-20" size={48} />
        <span>暂无连板高度趋势数据</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      <style>{`
        .board-height-pan::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      <div className="px-3 pt-3 pb-3 border-b border-slate-200 dark:border-white/5 space-y-3 flex-shrink-0">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-sm font-semibold text-slate-800 dark:text-white">连板高度趋势</div>
            <div className="text-xs text-slate-500">跟踪主板最高板、主板次高板、创业板最高板，并直接带出对应股票名。</div>
          </div>
          <div className="flex items-center gap-2">
            {renderSourceBadge(boardHeightSource)}
            <button
              onClick={handleRefresh}
              className="p-2 rounded-full bg-slate-200 dark:bg-white/10 text-slate-500 dark:text-gray-400 hover:text-cyan-500 transition-all"
              title="刷新高度趋势"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-400">主板最高板</div>
            <div className="mt-1.5 text-2xl font-mono font-bold text-rose-500">
              {latestBoardHeight?.mainBoardHighest ?? '—'}
              <span className="ml-1 text-sm font-sans text-slate-500">板</span>
            </div>
            <div className="mt-1.5 text-[11px] leading-5 text-slate-500">
              {latestBoardHeight
                ? formatBoardNames(latestBoardHeight.mainBoardHighestNames, latestBoardHeight.mainBoardHighestSymbols)
                : '—'}
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-400">主板次高板</div>
            <div className="mt-1.5 text-2xl font-mono font-bold text-amber-500">
              {latestBoardHeight?.mainBoardSecondHighest ?? '—'}
              <span className="ml-1 text-sm font-sans text-slate-500">板</span>
            </div>
            <div className="mt-1.5 text-[11px] leading-5 text-slate-500">
              {latestBoardHeight
                ? formatBoardNames(latestBoardHeight.mainBoardSecondHighestNames, latestBoardHeight.mainBoardSecondHighestSymbols)
                : '—'}
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-400">创业板最高板</div>
            <div className="mt-1.5 text-2xl font-mono font-bold text-cyan-500">
              {latestBoardHeight?.chinextHighest ?? '—'}
              <span className="ml-1 text-sm font-sans text-slate-500">板</span>
            </div>
            <div className="mt-1.5 text-[11px] leading-5 text-slate-500">
              {latestBoardHeight
                ? formatBoardNames(latestBoardHeight.chinextHighestNames, latestBoardHeight.chinextHighestSymbols)
                : '—'}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-[760px] pb-2 pl-2 pr-1">
        <div className="mb-2 flex flex-wrap items-center justify-end gap-3 pr-3 text-[11px] text-slate-500">
          <div className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
            <span>主板最高板</span>
          </div>
          <div className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
            <span>主板次高板</span>
          </div>
          <div className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-cyan-500" />
            <span>创业板最高板</span>
          </div>
        </div>
        <div className="flex h-full min-h-[760px]">
          <div className="w-14 flex-shrink-0 pt-14 pb-12 pr-2">
            <div className="flex h-full flex-col-reverse justify-between text-right text-[10px] font-medium text-slate-400">
              {boardHeightAxisTicks.ticks.map((tick) => (
                <div key={`board-axis-${tick}`} className="leading-none">
                  {tick}
                </div>
              ))}
            </div>
          </div>
          <div
            ref={boardHeightScrollRef}
            className={`board-height-pan flex-1 min-w-0 overflow-x-auto overflow-y-hidden select-none outline-none ${isBoardHeightDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            onMouseDown={handleBoardHeightMouseDown}
            onMouseMove={handleBoardHeightMouseMove}
            onMouseUp={stopBoardHeightDrag}
            onMouseLeave={stopBoardHeightDrag}
          >
            <div className="h-full min-h-[760px] pl-2 pr-8 outline-none" style={{ width: boardHeightChartWidth + 20 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sortedBoardHeightData} margin={{ top: 72, right: 40, left: 0, bottom: 48 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.12)" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} dy={10} />
                  <YAxis hide domain={[0, boardHeightAxisTicks.max]} ticks={boardHeightAxisTicks.ticks} allowDecimals={false} />
                  <Tooltip
                    cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderColor: 'rgba(255,255,255,0.1)', color: '#f8fafc', borderRadius: '8px' }}
                    labelStyle={{ color: '#94a3b8' }}
                    formatter={(value: number | string, name: string, item: { payload?: BoardHeightEntry }) => {
                      const row = item?.payload;
                      if (name === 'mainBoardHighest') {
                        return [`${value} 板 / ${formatBoardNames(row?.mainBoardHighestNames ?? [], row?.mainBoardHighestSymbols ?? [])}`, '主板最高板'];
                      }
                      if (name === 'mainBoardSecondHighest') {
                        return [`${value} 板 / ${formatBoardNames(row?.mainBoardSecondHighestNames ?? [], row?.mainBoardSecondHighestSymbols ?? [])}`, '主板次高板'];
                      }
                      if (name === 'chinextHighest') {
                        return [`${value} 板 / ${formatBoardNames(row?.chinextHighestNames ?? [], row?.chinextHighestSymbols ?? [])}`, '创业板最高板'];
                      }
                      return [value, name];
                    }}
                    labelFormatter={(label: React.ReactNode, payload: readonly { payload?: BoardHeightEntry }[]) => {
                      const row = payload?.[0]?.payload;
                      return typeof label === 'string' && row?.fullDate ? `${label} (${row.fullDate})` : label;
                    }}
                  />
                  <Line type="monotone" dataKey="mainBoardHighest" name="主板最高板" stroke="#f43f5e" strokeWidth={3} dot={mainBoardHighestDot} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="mainBoardSecondHighest" name="主板次高板" stroke="#f59e0b" strokeWidth={2.5} dot={mainBoardSecondHighestDot} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="chinextHighest" name="创业板最高板" stroke="#06b6d4" strokeWidth={2.5} dot={chinextHighestDot} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SentimentHeightPanel;
