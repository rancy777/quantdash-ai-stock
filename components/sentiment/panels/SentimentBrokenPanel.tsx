import React from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import type { BrokenEntry, DataSourceState } from '../hooks/useSentimentSectionData';

type SentimentBrokenPanelProps = {
  brokenData: BrokenEntry[];
  brokenLoading: boolean;
  brokenLoadingMode: DataSourceState;
  currentBrokenCount: number | null;
  currentBrokenLimitUp: number | null;
  currentBrokenRate: number | null;
  renderSourceBadge: (source: DataSourceState) => React.ReactNode;
  source: DataSourceState;
};

const SentimentBrokenPanel: React.FC<SentimentBrokenPanelProps> = ({
  brokenData,
  brokenLoading,
  brokenLoadingMode,
  currentBrokenCount,
  currentBrokenLimitUp,
  currentBrokenRate,
  renderSourceBadge,
  source,
}) => {
  if (brokenLoading && brokenData.length === 0) {
    const loadingText =
      brokenLoadingMode === 'local'
        ? '正在读取本地缓存...'
        : brokenLoadingMode === 'api'
          ? '正在获取接口数据...'
          : '统计炸板率中...';
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
        <Loader2 className="animate-spin" /> {loadingText}
      </div>
    );
  }

  if (brokenData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
        <AlertTriangle className="opacity-20" size={48} />
        <span>暂无炸板数据</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      <div className="absolute top-0 left-0 z-10 p-4 flex gap-6 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">炸板率</div>
          <div className="text-4xl font-mono font-bold text-orange-500 dark:text-orange-400">
            {currentBrokenRate?.toFixed(1)}%
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">炸板家数</div>
          <div className="text-4xl font-mono font-bold text-rose-500 dark:text-rose-400">
            {currentBrokenCount} <span className="text-base font-sans text-slate-500 dark:text-slate-400">家</span>
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">当日涨停</div>
          <div className="text-4xl font-mono font-bold text-emerald-500 dark:text-emerald-400">
            {currentBrokenLimitUp} <span className="text-base font-sans text-slate-500 dark:text-slate-400">家</span>
          </div>
        </div>
      </div>
      <div className="absolute top-4 right-4 z-10">
        {renderSourceBadge(source)}
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={brokenData} margin={{ top: 90, right: 10, left: 0, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} dy={10} />
          <YAxis
            yAxisId="left"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#f97316', fontSize: 10 }}
            domain={[0, 100]}
            width={30}
            label={{ value: '炸板率(%)', angle: -90, position: 'insideLeft', fill: '#f97316', fontSize: 11 }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            domain={[0, 'auto']}
            allowDecimals={false}
            width={30}
            label={{ value: '家数', angle: 90, position: 'insideRight', fill: '#94a3b8', fontSize: 11 }}
          />
          <Tooltip
            cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
            contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderColor: 'rgba(255,255,255,0.1)', color: '#f8fafc', borderRadius: '8px' }}
            labelStyle={{ color: '#94a3b8' }}
            formatter={(value: number, name: string) => {
              if (name === 'brokenRate') return [`${value}%`, '炸板率'];
              if (name === 'brokenCount') return [value, '炸板家数'];
              if (name === 'limitUpCount') return [value, '涨停家数'];
              return [value, name];
            }}
          />
          <Legend verticalAlign="top" align="right" height={36} iconSize={8} wrapperStyle={{ paddingRight: '80px', paddingTop: '0px' }} />
          <Bar yAxisId="right" dataKey="brokenCount" name="炸板家数" fill="#fb7185" barSize={18} radius={[4, 4, 0, 0]} />
          <Line yAxisId="left" type="monotone" dataKey="brokenRate" name="炸板率" stroke="#f97316" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          <Line yAxisId="right" type="monotone" dataKey="limitUpCount" name="涨停家数" stroke="#facc15" strokeDasharray="6 4" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SentimentBrokenPanel;
