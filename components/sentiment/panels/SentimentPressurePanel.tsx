import React from 'react';
import { BarChart2, Info, Loader2, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';
import { CartesianGrid, ComposedChart, LabelList, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import type { CoeffEntry, DataSourceState } from '../hooks/useSentimentSectionData';

type SentimentPressurePanelProps = {
  coeffData: CoeffEntry[];
  currentHeight: number | null;
  currentLimitUpCount: number | null;
  currentRiseCount: number | null;
  currentScore: number | null;
  handleRefresh: () => void;
  isRefreshing: boolean;
  loading: boolean;
  realTimeBreadth: { rise: number; fall: number; flat: number } | null;
  renderSourceBadge: (source: DataSourceState) => React.ReactNode;
  selectedCoeffEntry: CoeffEntry | null;
  selectedSeries: string[];
  sentimentLoadingMode: DataSourceState;
  sentimentSource: DataSourceState;
  lineSeriesOptions: Array<{ id: string; label: string }>;
  toggleSeries: (seriesId: string) => void;
};

const SentimentPressurePanel: React.FC<SentimentPressurePanelProps> = ({
  coeffData,
  currentHeight,
  currentLimitUpCount,
  currentRiseCount,
  currentScore,
  handleRefresh,
  isRefreshing,
  loading,
  realTimeBreadth,
  renderSourceBadge,
  selectedCoeffEntry,
  selectedSeries,
  sentimentLoadingMode,
  sentimentSource,
  lineSeriesOptions,
  toggleSeries,
}) => {
  if (loading && coeffData.length === 0) {
    const loadingText =
      sentimentLoadingMode === 'local'
        ? '正在读取本地缓存...'
        : sentimentLoadingMode === 'api'
          ? '正在获取接口数据...'
          : '计算全市场情绪指标中...';
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
        <Loader2 className="animate-spin" /> {loadingText}
      </div>
    );
  }

  if (coeffData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
        <BarChart2 className="opacity-20" size={48} />
        <span>暂无足够数据计算系数</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      <div className="px-4 pb-3 border-b border-slate-200 dark:border-white/5">
        <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">折线指标 (可多选)</div>
        <div className="flex flex-wrap gap-4">
          {lineSeriesOptions.map((option) => (
            <label key={option.id} className="flex items-center gap-2 text-sm cursor-pointer text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                value={option.id}
                checked={selectedSeries.includes(option.id)}
                onChange={() => toggleSeries(option.id)}
                className="accent-cyan-500"
              />
              {option.label}
            </label>
          ))}
        </div>
      </div>

      <div className="flex-1 relative">
        {selectedSeries.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-400">
            <div className="text-center">
              <p className="font-medium mb-1">请选择上方的指标以显示折线图</p>
              <p className="text-xs">支持砸盘系数、连板高度、涨跌家数等数据</p>
            </div>
          </div>
        )}

        <div className="absolute top-0 left-0 z-10 p-4 flex gap-6 md:gap-8 flex-wrap">
          <div>
            <div className="text-4xl font-mono font-bold text-slate-800 dark:text-white flex items-end gap-2">
              {(selectedCoeffEntry?.value ?? currentScore ?? 0).toFixed(2)} <span className="text-sm font-sans font-normal text-slate-500 mb-1">系数</span>
            </div>
            <div className="text-xs text-slate-400 mt-1">基于连板晋级率</div>
          </div>

          <div className="pl-6 border-l border-slate-200 dark:border-white/10 hidden md:block">
            <div className="text-4xl font-mono font-bold text-red-500 dark:text-red-400 flex items-end gap-2">
              {selectedCoeffEntry?.height ?? currentHeight} <span className="text-sm font-sans font-normal text-slate-500 mb-1">最高板</span>
            </div>
            <div className="text-xs text-slate-400 mt-1">市场连板高度</div>
          </div>

          <div className="pl-6 border-l border-slate-200 dark:border-white/10 hidden lg:block">
            <div className="text-4xl font-mono font-bold text-amber-500 dark:text-amber-400 flex items-end gap-2">
              {selectedCoeffEntry?.limitUpCount ?? currentLimitUpCount} <span className="text-sm font-sans font-normal text-slate-500 mb-1">家</span>
            </div>
            <div className="text-xs text-slate-400 mt-1">今日涨停 (实盘)</div>
          </div>

          <div className="pl-6 border-l border-slate-200 dark:border-white/10 hidden xl:block">
            <div className="text-4xl font-mono font-bold text-sky-500 dark:text-sky-400 flex items-end gap-2">
              {selectedCoeffEntry?.riseCount ?? currentRiseCount ?? '—'} <span className="text-sm font-sans font-normal text-slate-500 mb-1">家</span>
            </div>
            <div className="text-xs text-slate-400 mt-1">上涨家数</div>
          </div>

          {realTimeBreadth && (
            <div className="pl-6 border-l border-slate-200 dark:border-white/10 hidden xl:block">
              <div className="flex flex-col justify-center h-full gap-1">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-red-500 font-bold flex items-center">
                    <TrendingUp size={12} className="mr-1" /> {realTimeBreadth.rise}
                  </span>
                  <span className="text-slate-400">上涨</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-green-500 font-bold flex items-center">
                    <TrendingDown size={12} className="mr-1" /> {realTimeBreadth.fall}
                  </span>
                  <span className="text-slate-400">下跌</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
          {renderSourceBadge(sentimentSource)}
          <button
            onClick={handleRefresh}
            className={`p-2 rounded-full bg-slate-200 dark:bg-white/10 text-slate-500 dark:text-gray-400 hover:text-cyan-500 transition-all ${isRefreshing ? 'animate-spin text-cyan-500' : ''}`}
            title="重置并更新数据"
          >
            <RefreshCw size={16} />
          </button>

          <div className="group cursor-help relative">
            <div className="bg-slate-200 dark:bg-white/10 p-2 rounded-full text-slate-500 dark:text-gray-400">
              <Info size={16} />
            </div>
            <div className="absolute right-0 top-10 w-72 p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl shadow-xl text-xs text-slate-600 dark:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto z-30">
              <h4 className="font-bold mb-2 text-slate-800 dark:text-white">指标算法说明</h4>
              <div className="mb-2 space-y-2">
                <div>
                  <span className="font-bold text-green-500">砸盘系数:</span>
                  <p className="mt-1 opacity-80">系数 = (当日各阶段晋级率之和 ÷ 阶段数) × 10</p>
                </div>
                <div>
                  <span className="font-bold text-amber-500">数据源:</span>
                  <p className="mt-1 opacity-80">近期数据源自交易所真实统计。因API限制，部分远期历史数据可能基于指数波动模型回溯模拟，以保证趋势连续性。</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {selectedSeries.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={coeffData} margin={{ top: 90, right: 10, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} dy={10} />
              <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: '#10b981', fontSize: 10 }} domain={[0, 'auto']} width={30} />
              <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: '#ef4444', fontSize: 10 }} domain={[0, 'auto']} allowDecimals={false} width={30} />
              <YAxis yAxisId="count" orientation="right" domain={[0, 'auto']} hide />
              <Tooltip
                cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
                contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderColor: 'rgba(255,255,255,0.1)', color: '#f8fafc', borderRadius: '8px' }}
                labelStyle={{ color: '#94a3b8' }}
                formatter={(value: number, name: string) => {
                  if (name === 'value') return [value, '砸盘系数'];
                  if (name === 'height') return [value, '连板高度'];
                  if (name === 'limitUpCount') return [value, '涨停家数'];
                  if (name === 'limitDownCount') return [value, '跌停家数'];
                  if (name === 'riseCount') return [value, '上涨家数'];
                  return [value, name];
                }}
              />
              <Legend verticalAlign="top" align="right" height={36} iconSize={8} wrapperStyle={{ paddingRight: '80px', paddingTop: '0px' }} />

              {selectedSeries.includes('limitUpCount') && (
                <Line yAxisId="count" type="monotone" dataKey="limitUpCount" name="涨停家数" stroke="#f59e0b" strokeWidth={2} strokeOpacity={0.8} dot={false} activeDot={{ r: 4, fill: '#f59e0b' }} animationDuration={1500}>
                  <LabelList dataKey="limitUpCount" position="top" offset={5} style={{ fill: '#f59e0b', fontSize: '9px', opacity: 0.8 }} />
                </Line>
              )}

              {selectedSeries.includes('limitDownCount') && (
                <Line yAxisId="count" type="monotone" dataKey="limitDownCount" name="跌停家数" stroke="#22d3ee" strokeWidth={1} strokeOpacity={0.6} dot={false} activeDot={{ r: 4, fill: '#22d3ee' }} animationDuration={1500} />
              )}

              {selectedSeries.includes('riseCount') && (
                <Line yAxisId="count" type="monotone" dataKey="riseCount" name="上涨家数" stroke="#38bdf8" strokeWidth={2} strokeOpacity={0.8} dot={false} activeDot={{ r: 4, fill: '#38bdf8' }} animationDuration={1500}>
                  <LabelList dataKey="riseCount" position="top" offset={10} style={{ fill: '#38bdf8', fontSize: '9px', opacity: 0.8 }} />
                </Line>
              )}

              {selectedSeries.includes('height') && (
                <Line yAxisId="right" type="step" dataKey="height" name="连板高度" stroke="#ef4444" strokeWidth={1} strokeDasharray="4 4" dot={{ r: 3, fill: '#ef4444', strokeWidth: 0 }} activeDot={{ r: 5 }} animationDuration={1500}>
                  <LabelList dataKey="height" position="top" offset={5} style={{ fill: '#ef4444', fontSize: '10px', fontWeight: 'bold' }} />
                </Line>
              )}

              {selectedSeries.includes('value') && (
                <Line yAxisId="left" type="monotone" dataKey="value" name="砸盘系数" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} animationDuration={1500}>
                  <LabelList dataKey="value" position="top" offset={10} style={{ fill: '#10b981', fontSize: '10px', fontWeight: 'bold' }} formatter={(val: number) => val.toFixed(1)} />
                </Line>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default SentimentPressurePanel;
