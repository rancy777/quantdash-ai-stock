import React from 'react';
import { Loader2, Zap } from 'lucide-react';
import { Area, Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import type { DataSourceState, PremiumEntry } from '../hooks/useSentimentSectionData';

type SentimentPremiumPanelProps = {
  currentFollowThrough: number | null;
  currentPremium: number | null;
  currentPremiumDate: string | null;
  currentSuccessRate: number | null;
  premiumData: PremiumEntry[];
  premiumLoading: boolean;
  premiumLoadingMode: DataSourceState;
  selectedPremiumEntry: PremiumEntry | null;
};

const SentimentPremiumPanel: React.FC<SentimentPremiumPanelProps> = ({
  currentFollowThrough,
  currentPremium,
  currentPremiumDate,
  currentSuccessRate,
  premiumData,
  premiumLoading,
  premiumLoadingMode,
  selectedPremiumEntry,
}) => {
  if (premiumLoading && premiumData.length === 0) {
    const loadingText =
      premiumLoadingMode === 'local'
        ? '正在读取本地缓存...'
        : premiumLoadingMode === 'api'
          ? '正在获取接口数据...'
          : '统计涨停溢价中...';
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
        <Loader2 className="animate-spin" /> {loadingText}
      </div>
    );
  }

  if (premiumData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
        <Zap className="opacity-20" size={48} />
        <span>暂无涨停溢价数据</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      <div className="absolute top-0 left-0 z-10 p-4 flex gap-6 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">最新溢价</div>
          <div className="text-4xl font-mono font-bold text-rose-500 dark:text-rose-400">
            {(selectedPremiumEntry?.premium ?? currentPremium ?? 0).toFixed(2)}%
          </div>
          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
            最新溢价?{selectedPremiumEntry?.date ?? currentPremiumDate ?? '?'}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">次日成功率</div>
          <div className="text-4xl font-mono font-bold text-emerald-500 dark:text-emerald-400">
            {(selectedPremiumEntry?.successRate ?? currentSuccessRate ?? 0).toFixed(1)}%
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">晋级家数</div>
          <div className="text-4xl font-mono font-bold text-amber-500 dark:text-amber-400">
            {selectedPremiumEntry?.followThroughCount ?? currentFollowThrough} <span className="text-base font-sans text-slate-500 dark:text-slate-400">家</span>
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={premiumData} margin={{ top: 90, right: 10, left: 0, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} dy={10} />
          <YAxis
            yAxisId="left"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#fb7185', fontSize: 10 }}
            domain={[0, 15]}
            width={30}
            label={{ value: '溢价(%)', angle: -90, position: 'insideLeft', fill: '#fb7185', fontSize: 11 }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#10b981', fontSize: 10 }}
            domain={[0, 100]}
            width={30}
            label={{ value: '成功率(%)', angle: 90, position: 'insideRight', fill: '#10b981', fontSize: 11 }}
          />
          <YAxis yAxisId="count" orientation="right" domain={[0, 'auto']} hide />
          <Tooltip
            cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
            contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderColor: 'rgba(255,255,255,0.1)', color: '#f8fafc', borderRadius: '8px' }}
            labelStyle={{ color: '#94a3b8' }}
            formatter={(value: number, name: string) => {
              if (name === 'premium') return [`${value}%`, '涨停溢价'];
              if (name === 'successRate') return [`${value}%`, '次日成功率'];
              if (name === 'followThroughCount') return [value, '晋级家数'];
              return [value, name];
            }}
          />
          <Legend verticalAlign="top" align="right" height={36} iconSize={8} wrapperStyle={{ paddingRight: '80px', paddingTop: '0px' }} />
          <Area yAxisId="left" type="monotone" dataKey="premium" name="涨停溢价" stroke="#fb7185" fill="url(#premiumGradient)" strokeWidth={2} activeDot={{ r: 4 }} />
          <Line yAxisId="right" type="monotone" dataKey="successRate" name="次日成功率" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
          <Bar yAxisId="count" dataKey="followThroughCount" name="晋级家数" fill="#facc15" barSize={16} radius={[4, 4, 0, 0]} />
          <defs>
            <linearGradient id="premiumGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fb7185" stopOpacity={0.6} />
              <stop offset="100%" stopColor="#fb7185" stopOpacity={0.05} />
            </linearGradient>
          </defs>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SentimentPremiumPanel;
