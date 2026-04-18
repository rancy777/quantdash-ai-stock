import React from 'react';
import { ChevronRight, Globe2, Loader2, RefreshCw } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type {
  BullBearSignalSnapshot,
  EmotionIndicatorEntry,
  IndexFuturesLongShortSeries,
} from '../../../types';
import type { DataSourceState } from '../hooks/useSentimentSectionData';

type EmotionSeriesOption = {
  id: keyof EmotionIndicatorEntry;
  label: string;
  unit: string;
  color: string;
};

type EmotionSeriesCard = EmotionSeriesOption & {
  latestValue: number | null | undefined;
  change: number | null;
};

type EmotionComparisonRow = EmotionIndicatorEntry & Record<string, number | string | null>;

type SentimentEmotionPanelProps = {
  bullBearBarData: BullBearSignalSnapshot['rangeBuckets'];
  bullBearDateOptions: BullBearSignalSnapshot[];
  bullBearSignal: BullBearSignalSnapshot | null;
  emotionComparisonData: EmotionComparisonRow[];
  emotionIndicatorData: EmotionIndicatorEntry[];
  emotionIndicatorLoading: boolean;
  emotionIndicatorSource: DataSourceState;
  emotionSeriesOptions: EmotionSeriesOption[];
  formatAmountYi: (value: number | null | undefined) => string;
  formatBullBearDate: (value: string | null | undefined) => string;
  formatEmotionValue: (id: keyof EmotionIndicatorEntry, value: number) => string;
  formatPositionAxisTick: (value: number) => string;
  formatPositionCount: (value: number | null | undefined) => string;
  getPreviousEmotionValueAt: (index: number, id: keyof EmotionIndicatorEntry) => number | null;
  handleRefresh: () => void;
  indexFuturesLongShortData: IndexFuturesLongShortSeries[];
  latestIndexFuturesPoint: IndexFuturesLongShortSeries['history'][number] | null;
  longPositionChangePct: number | null;
  onSelectBullBearDate: (date: string) => void;
  onSelectIndexFuturesCode: (code: 'IF' | 'IC' | 'IH' | 'IM') => void;
  renderSourceBadge: (source: DataSourceState) => React.ReactNode;
  selectedEmotionSeries: string[];
  selectedEmotionSeriesCards: EmotionSeriesCard[];
  selectedIndexFuturesCode: 'IF' | 'IC' | 'IH' | 'IM';
  selectedIndexFuturesSeries: IndexFuturesLongShortSeries | null;
  shortPositionChangePct: number | null;
  toggleEmotionSeries: (seriesId: string) => void;
};

const SentimentEmotionPanel: React.FC<SentimentEmotionPanelProps> = ({
  bullBearBarData,
  bullBearDateOptions,
  bullBearSignal,
  emotionComparisonData,
  emotionIndicatorData,
  emotionIndicatorLoading,
  emotionIndicatorSource,
  emotionSeriesOptions,
  formatAmountYi,
  formatBullBearDate,
  formatEmotionValue,
  formatPositionAxisTick,
  formatPositionCount,
  getPreviousEmotionValueAt,
  handleRefresh,
  indexFuturesLongShortData,
  latestIndexFuturesPoint,
  longPositionChangePct,
  onSelectBullBearDate,
  onSelectIndexFuturesCode,
  renderSourceBadge,
  selectedEmotionSeries,
  selectedEmotionSeriesCards,
  selectedIndexFuturesCode,
  selectedIndexFuturesSeries,
  shortPositionChangePct,
  toggleEmotionSeries,
}) => {
  if (emotionIndicatorLoading && emotionIndicatorData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
        <Loader2 className="animate-spin" /> 正在加载跨市场情绪指标...
      </div>
    );
  }

  if (emotionIndicatorData.length === 0 && indexFuturesLongShortData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
        <Globe2 className="opacity-20" size={48} />
        <span>暂无情绪指标数据</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      <div className="px-4 pt-5 pb-4 space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">情绪指标</div>
            <div className="text-xs text-slate-400">东方财富跨市场与期指持仓口径</div>
          </div>
          <div className="flex items-center gap-2">
            {renderSourceBadge(emotionIndicatorSource)}
            <button
              onClick={handleRefresh}
              className="p-2 rounded-full bg-slate-200 dark:bg-white/10 text-slate-500 dark:text-gray-400 hover:text-cyan-500 transition-all"
              title="刷新情绪指标"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {indexFuturesLongShortData.length > 0 && (
          <div className="rounded-[30px] border border-slate-200/90 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-slate-950/40">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-baseline gap-3 flex-wrap">
                  <div className="text-[2rem] font-semibold tracking-tight text-slate-900 dark:text-white">期指多空</div>
                  <div className="text-base text-slate-400">指数涨跌方向</div>
                </div>
              </div>
            </div>

            <div className="mt-6 inline-flex flex-wrap gap-2 rounded-2xl bg-slate-100/90 p-2 dark:bg-white/5">
              {indexFuturesLongShortData.map((item) => (
                <button
                  key={item.code}
                  onClick={() => onSelectIndexFuturesCode(item.code)}
                  className={`rounded-xl px-4 py-2 text-sm transition-all ${
                    selectedIndexFuturesCode === item.code
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-white/10 dark:text-white'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  {item.code} ({item.label})
                </button>
              ))}
            </div>

            {selectedIndexFuturesSeries && (
              <>
                <div className="mt-8 flex items-center gap-2 text-slate-500 dark:text-slate-300">
                  <span className="text-[1.1rem]">主力合约:</span>
                  <span className="font-mono text-[2rem] text-slate-800 dark:text-white">{selectedIndexFuturesSeries.mainContract}</span>
                  <ChevronRight size={22} className="text-slate-300" />
                </div>

                <div className="mt-7 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-red-100/80 bg-white p-4 dark:border-red-500/15 dark:bg-red-500/5">
                    <div className="flex items-center gap-3">
                      <span className="inline-block h-1.5 w-7 rounded-full bg-red-500" />
                      <span className="text-[1.05rem] text-slate-500 dark:text-slate-300">多单</span>
                    </div>
                    <div className="mt-2 text-[2.1rem] font-semibold text-red-500">
                      {formatPositionCount(latestIndexFuturesPoint?.longPosition)}
                    </div>
                    <div className={`mt-1 text-sm ${longPositionChangePct === null ? 'text-slate-400' : 'text-red-500'}`}>
                      {longPositionChangePct === null ? '暂无环比' : `${longPositionChangePct >= 0 ? '+' : ''}${longPositionChangePct.toFixed(2)}%`}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-emerald-100/80 bg-white p-4 dark:border-emerald-500/15 dark:bg-emerald-500/5">
                    <div className="flex items-center gap-3">
                      <span className="inline-block h-1.5 w-7 rounded-full bg-emerald-500" />
                      <span className="text-[1.05rem] text-slate-500 dark:text-slate-300">空单</span>
                    </div>
                    <div className="mt-2 text-[2.1rem] font-semibold text-red-500 dark:text-red-400">
                      {formatPositionCount(latestIndexFuturesPoint?.shortPosition)}
                    </div>
                    <div className={`mt-1 text-sm ${shortPositionChangePct === null ? 'text-slate-400' : 'text-red-500'}`}>
                      {shortPositionChangePct === null ? '暂无环比' : `${shortPositionChangePct >= 0 ? '+' : ''}${shortPositionChangePct.toFixed(2)}%`}
                    </div>
                  </div>
                </div>

                <div className="mt-6 h-[340px] rounded-3xl bg-slate-50/70 px-1 py-3 dark:bg-white/[0.03]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={selectedIndexFuturesSeries.history} margin={{ top: 10, right: 10, left: 2, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="0" vertical={false} stroke="rgba(148,163,184,0.18)" />
                      <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#94a3b8', fontSize: 10 }}
                        dy={8}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#94a3b8', fontSize: 10 }}
                        width={42}
                        tickFormatter={formatPositionAxisTick}
                      />
                      <Tooltip
                        cursor={{ stroke: 'rgba(148,163,184,0.25)', strokeWidth: 1 }}
                        contentStyle={{
                          backgroundColor: 'rgba(255,255,255,0.96)',
                          borderColor: 'rgba(226,232,240,0.9)',
                          color: '#0f172a',
                          borderRadius: '14px',
                        }}
                        formatter={(value: number, name: string) => [formatPositionCount(value), name === 'longPosition' ? '多单' : '空单']}
                      />
                      <Line type="monotone" dataKey="longPosition" name="多单" stroke="#ef4444" strokeWidth={2.25} dot={false} activeDot={{ r: 4 }} />
                      <Line type="monotone" dataKey="shortPosition" name="空单" stroke="#16a34a" strokeWidth={2.25} dot={false} activeDot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-6 rounded-3xl bg-slate-50 p-5 text-[1rem] leading-9 text-slate-600 dark:bg-white/5 dark:text-slate-300">
                  <span className="mr-2 font-semibold text-amber-600">解读</span>
                  股指期货相较现货更灵活，主力机构在 IF、IC、IH、IM 主力合约上的多空持仓变化，通常能更早反映对指数方向的预判。这里展示的是东方财富期指持仓口径下的主力合约多单与空单变化。
                </div>
              </>
            )}
          </div>
        )}

        {bullBearSignal && (
          <div className="rounded-[30px] border border-slate-200/90 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-slate-950/40">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-baseline gap-3 flex-wrap">
                  <div className="text-[2rem] font-semibold tracking-tight text-slate-900 dark:text-white">牛熊风向标</div>
                  <div className="text-base text-slate-400">{formatBullBearDate(bullBearSignal.date)} 已收盘</div>
                </div>
                {bullBearDateOptions.length > 1 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {bullBearDateOptions.map((item) => {
                      const isActive = item.date === bullBearSignal.date;
                      return (
                        <button
                          key={item.date}
                          type="button"
                          onClick={() => onSelectBullBearDate(item.date)}
                          className={`rounded-full border px-3 py-1.5 text-sm transition ${
                            isActive
                              ? 'border-orange-200 bg-orange-50 text-orange-600 dark:border-orange-500/40 dark:bg-orange-500/10 dark:text-orange-300'
                              : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400 dark:hover:text-slate-200'
                          }`}
                        >
                          {formatBullBearDate(item.date)}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-7">
              <div className="text-[1.9rem] font-semibold tracking-tight text-slate-900 dark:text-white">涨跌统计</div>
              <div className="mt-5 grid grid-cols-2 gap-x-8 gap-y-3 md:grid-cols-3">
                <div className="flex items-center gap-3 text-[1.05rem]">
                  <span className="h-3 w-3 rounded bg-red-500" />
                  <span className="text-slate-600 dark:text-slate-300">上涨</span>
                  <span className="font-semibold text-red-500">{bullBearSignal.riseCount}</span>
                  <span className="text-slate-400">家</span>
                </div>
                <div className="flex items-center gap-3 text-[1.05rem]">
                  <span className="h-3 w-3 rounded bg-red-300" />
                  <span className="text-slate-600 dark:text-slate-300">涨停</span>
                  <span className="font-semibold text-red-500">{bullBearSignal.limitUpCount}</span>
                  <span className="text-slate-400">家</span>
                </div>
                <div className="flex items-center gap-3 text-[1.05rem]">
                  <span className="h-3 w-3 rounded bg-rose-200" />
                  <span className="text-slate-600 dark:text-slate-300">自然涨停</span>
                  <span className="font-semibold text-red-500">{bullBearSignal.naturalLimitUpCount}</span>
                  <span className="text-slate-400">家</span>
                </div>
                <div className="flex items-center gap-3 text-[1.05rem]">
                  <span className="h-3 w-3 rounded bg-green-500" />
                  <span className="text-slate-600 dark:text-slate-300">下跌</span>
                  <span className="font-semibold text-green-500">{bullBearSignal.fallCount}</span>
                  <span className="text-slate-400">家</span>
                </div>
                <div className="flex items-center gap-3 text-[1.05rem]">
                  <span className="h-3 w-3 rounded bg-green-300" />
                  <span className="text-slate-600 dark:text-slate-300">跌停</span>
                  <span className="font-semibold text-green-500">{bullBearSignal.limitDownCount}</span>
                  <span className="text-slate-400">家</span>
                </div>
                <div className="flex items-center gap-3 text-[1.05rem]">
                  <span className="h-3 w-3 rounded bg-emerald-200" />
                  <span className="text-slate-600 dark:text-slate-300">自然跌停</span>
                  <span className="font-semibold text-green-500">{bullBearSignal.naturalLimitDownCount}</span>
                  <span className="text-slate-400">家</span>
                </div>
              </div>

              <div className="mt-6 h-[300px] rounded-3xl bg-slate-50/70 px-2 py-3 dark:bg-white/[0.03]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bullBearBarData} margin={{ top: 28, right: 8, left: 8, bottom: 8 }}>
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <YAxis hide />
                    <Tooltip
                      cursor={{ fill: 'rgba(148,163,184,0.08)' }}
                      contentStyle={{
                        backgroundColor: 'rgba(255,255,255,0.96)',
                        borderColor: 'rgba(226,232,240,0.9)',
                        color: '#0f172a',
                        borderRadius: '14px',
                      }}
                      formatter={(value: number) => [`${value} 家`, '数量']}
                    />
                    <Bar dataKey="count" radius={[14, 14, 0, 0]} fill="#d1d5db">
                      <LabelList dataKey="count" position="top" fill="#334155" fontSize={11} />
                      {bullBearBarData.map((entry, index) => {
                        const fill =
                          entry.tone === 'up'
                            ? index === 0
                              ? '#fca5a5'
                              : index === 1
                                ? '#f87171'
                                : '#ef4444'
                            : entry.tone === 'down'
                              ? index === bullBearBarData.length - 1
                                ? '#86efac'
                                : index >= bullBearBarData.length - 3
                                  ? '#22c55e'
                                  : '#4ade80'
                              : '#a8a29e';
                        return <Cell key={`bull-bear-cell-${entry.label}`} fill={fill} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="mt-8">
              <div className="flex items-center gap-3">
                <div className="text-[1.9rem] font-semibold tracking-tight text-slate-900 dark:text-white">成交分析</div>
                <div className="text-lg text-slate-400">15:00</div>
              </div>
              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-3xl bg-slate-50 p-5 dark:bg-white/5">
                  <div className="text-base text-slate-500">沪深京三市总成交额</div>
                  <div className="mt-3 text-[2.2rem] font-semibold text-slate-900 dark:text-white">
                    {formatAmountYi(bullBearSignal.totalAmount)}
                  </div>
                  <div
                    className={`mt-3 text-lg ${
                      bullBearSignal.amountChangeRate === null
                        ? 'text-slate-400'
                        : bullBearSignal.amountChangeRate >= 0
                          ? 'text-red-500'
                          : 'text-green-500'
                    }`}
                  >
                    {bullBearSignal.amountChangeRate === null
                      ? '暂无对比'
                      : `较前一日 ${bullBearSignal.amountChangeRate >= 0 ? '+' : ''}${bullBearSignal.amountChangeRate.toFixed(2)}%`}
                  </div>
                </div>
                <div className="rounded-3xl bg-slate-50 p-5 dark:bg-white/5">
                  <div className="text-base text-slate-500">市场状态</div>
                  <div className="mt-3 text-[2.2rem] font-semibold text-slate-900 dark:text-white">
                    {bullBearSignal.riseCount >= bullBearSignal.fallCount ? '偏强' : '偏弱'}
                  </div>
                  <div className="mt-3 text-lg text-slate-500">
                    上涨 {bullBearSignal.riseCount} 家， 下跌 {bullBearSignal.fallCount} 家， 平盘 {bullBearSignal.flatCount} 家
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mx-4 mt-1 rounded-[26px] border border-slate-200/80 bg-white px-4 py-4 dark:border-white/10 dark:bg-slate-950/30">
        <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">跨市场对比走势</div>
        <div className="text-xs text-slate-500 dark:text-slate-400 mb-3">显示真实值卡片，下方折线为较前一交易日涨跌幅，可多选</div>
        <div className="flex flex-wrap gap-4">
          {emotionSeriesOptions.map((option) => (
            <label key={option.id} className="flex items-center gap-2 text-sm cursor-pointer text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                value={option.id}
                checked={selectedEmotionSeries.includes(option.id)}
                onChange={() => toggleEmotionSeries(option.id)}
                className="accent-cyan-500"
              />
              <span style={{ color: option.color }}>{option.label}</span>
            </label>
          ))}
        </div>
        {selectedEmotionSeriesCards.length > 0 && (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {selectedEmotionSeriesCards.map((series) => (
              <div key={series.id} className="rounded-2xl border border-slate-200/80 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="text-[11px] uppercase tracking-wide text-slate-400">{series.label}</div>
                <div className="mt-2 text-2xl font-mono font-bold" style={{ color: series.color }}>
                  {typeof series.latestValue === 'number' ? formatEmotionValue(series.id, series.latestValue) : '—'}
                </div>
                <div className={`mt-1 text-xs ${series.change === null ? 'text-slate-400' : series.change >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                  {series.change === null ? '暂无较前一交易日对比' : `较前一交易日 ${series.change >= 0 ? '+' : ''}${series.change.toFixed(2)}%`}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="relative mx-4 mt-4 mb-4 h-[440px] min-h-[440px] rounded-[26px] border border-slate-200/80 bg-white p-3 dark:border-white/10 dark:bg-slate-950/30 md:h-[500px] md:min-h-[500px]">
        {selectedEmotionSeries.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-400 z-10">
            <div className="text-center">
              <p className="font-medium mb-1">请选择上方的指标以显示对比走势</p>
              <p className="text-xs">默认使用归一化后走势，避免不同量纲互相遮挡。</p>
            </div>
          </div>
        )}
        {selectedEmotionSeries.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={emotionComparisonData} margin={{ top: 12, right: 18, left: 4, bottom: 12 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.12)" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} width={52} domain={['auto', 'auto']} tickFormatter={(value: number) => `${value.toFixed(1)}%`} />
              <Tooltip
                cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
                contentStyle={{
                  backgroundColor: 'rgba(15, 23, 42, 0.95)',
                  borderColor: 'rgba(255,255,255,0.1)',
                  color: '#f8fafc',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: '#94a3b8' }}
                formatter={(value: number, name: string, item: { payload?: EmotionComparisonRow }) => {
                  const matched = emotionSeriesOptions.find((series) => `${series.id}DailyChangePct` === name);
                  if (!matched) {
                    return [value, name];
                  }
                  const row = item?.payload;
                  const rawValue = row?.[matched.id];
                  const previousRawValue = getPreviousEmotionValueAt(
                    emotionComparisonData.findIndex((entry) => entry.date === row?.date),
                    matched.id
                  );
                  return [
                    `现值 ${
                      typeof rawValue === 'number' ? formatEmotionValue(matched.id, rawValue) : '—'
                    } / 前值 ${previousRawValue === null ? '—' : formatEmotionValue(matched.id, previousRawValue)} / ${value.toFixed(2)}%`,
                    matched.label,
                  ];
                }}
              />
              <Legend verticalAlign="top" align="right" height={36} iconSize={8} wrapperStyle={{ paddingRight: '80px', paddingTop: '0px' }} />
              {emotionSeriesOptions
                .filter((series) => selectedEmotionSeries.includes(series.id))
                .map((series) => (
                  <Line
                    key={series.id}
                    type="monotone"
                    dataKey={`${series.id}DailyChangePct`}
                    name={series.label}
                    stroke={series.color}
                    strokeWidth={2.5}
                    dot={{ r: 2 }}
                    activeDot={{ r: 5 }}
                  />
                ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default SentimentEmotionPanel;
