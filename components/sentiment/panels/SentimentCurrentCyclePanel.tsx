import React from 'react';
import { Area, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import type {
  CycleOverview,
  HighRiskEntry,
  LeaderEntry,
  VolumeTrendEntry,
} from '../hooks/useSentimentSectionData';

type SentimentCurrentCyclePanelProps = {
  cycleOverview: CycleOverview | null;
  currentBigFaceRepairRate: number | null;
  currentBrokenRepairRate: number | null;
  currentLeader: { name: string; symbol: string; label: string } | null;
  currentLeaderNextClose: number | null;
  highRiskData: HighRiskEntry[];
  overviewLoading: boolean;
  selectedLeaderEntry: LeaderEntry | null;
  volumeTrendAxisDomain: [number, number];
  volumeTrendData: VolumeTrendEntry[];
  formatVolumeAxisTick: (value: number) => string;
};

const stageClassMap = {
  冰点: 'text-cyan-500',
  试错: 'text-amber-500',
  主升: 'text-rose-500',
  分歧: 'text-violet-500',
  修复: 'text-emerald-500',
  退潮: 'text-red-500',
} as const;

const riskClassMap = {
  低风险: 'text-emerald-500',
  中风险: 'text-amber-500',
  高风险: 'text-red-500',
} as const;

const SentimentCurrentCyclePanel: React.FC<SentimentCurrentCyclePanelProps> = ({
  cycleOverview,
  currentBigFaceRepairRate,
  currentBrokenRepairRate,
  currentLeader,
  currentLeaderNextClose,
  highRiskData,
  overviewLoading,
  selectedLeaderEntry,
  volumeTrendAxisDomain,
  volumeTrendData,
  formatVolumeAxisTick,
}) => {
  const latestRisk = highRiskData[highRiskData.length - 1] ?? null;

  return (
    <div className="px-4 pt-4 pb-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
        <div className="rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-400">周期阶段</div>
          <div className={`mt-2 text-3xl font-bold ${cycleOverview ? stageClassMap[cycleOverview.stage] : 'text-slate-400'}`}>
            {cycleOverview?.stage ?? (overviewLoading ? '加载中' : '—')}
          </div>
          <div className="mt-1 text-xs text-slate-500">置信度 {cycleOverview?.confidence ?? 0}%</div>
        </div>
        <div className="rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-400">量能状态</div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{cycleOverview?.volumeState ?? '—'}</div>
          <div className="mt-1 text-xs text-slate-500">
            {cycleOverview?.latestVolumeAmount ? `${cycleOverview.latestVolumeAmount} 亿` : '—'}
            {cycleOverview?.volumeChangeRate !== null && cycleOverview?.volumeChangeRate !== undefined
              ? ` / ${cycleOverview.volumeChangeRate >= 0 ? '+' : ''}${cycleOverview.volumeChangeRate.toFixed(2)}%`
              : ''}
          </div>
        </div>
        <div className="rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-400">龙头反馈</div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {selectedLeaderEntry?.leaderName ?? currentLeader?.name ?? '—'}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {selectedLeaderEntry?.nextClosePct !== null && selectedLeaderEntry?.nextClosePct !== undefined
              ? `${selectedLeaderEntry.nextClosePct >= 0 ? '+' : ''}${selectedLeaderEntry.nextClosePct.toFixed(2)}% / ${selectedLeaderEntry.statusLabel}`
              : currentLeaderNextClose !== null
                ? `${currentLeaderNextClose >= 0 ? '+' : ''}${currentLeaderNextClose.toFixed(2)}% / ${currentLeader?.label ?? ''}`
                : '待确认'}
          </div>
        </div>
        <div className="rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-400">炸板修复率</div>
          <div className="mt-2 text-3xl font-mono font-bold text-emerald-500">{currentBrokenRepairRate?.toFixed(1) ?? '—'}%</div>
          <div className="mt-1 text-xs text-slate-500">大面修复 {currentBigFaceRepairRate?.toFixed(1) ?? '—'}%</div>
        </div>
        <div className="rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-400">高位风险</div>
          <div className={`mt-2 text-2xl font-bold ${cycleOverview ? riskClassMap[cycleOverview.riskLevel] : 'text-slate-400'}`}>
            {cycleOverview?.riskLevel ?? '—'}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            A杀 {latestRisk?.aKillCount ?? 0} 家 / 炸板率 {latestRisk?.brokenRate?.toFixed(1) ?? '0.0'}%
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-stretch">
        <div className="rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4 min-h-[18rem] flex flex-col">
          <div className="flex items-center justify-between mb-3 flex-shrink-0">
            <div>
              <div className="text-sm font-semibold text-slate-800 dark:text-white">量能趋势</div>
              <div className="text-xs text-slate-500">核心看趋势，不看固定金额</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-400">最新状态</div>
              <div className="text-sm font-semibold text-cyan-500">{cycleOverview?.volumeState ?? '—'}</div>
            </div>
          </div>
          {volumeTrendData.length > 0 ? (
            <div className="flex-1 min-h-[13rem]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={volumeTrendData} margin={{ top: 10, right: 6, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.12)" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <YAxis
                    yAxisId="amount"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    width={56}
                    domain={volumeTrendAxisDomain}
                    tickFormatter={formatVolumeAxisTick}
                  />
                  <YAxis
                    yAxisId="changeRate"
                    orientation="right"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#f59e0b', fontSize: 10 }}
                    width={40}
                    domain={['auto', 'auto']}
                    tickFormatter={(value: number) => `${value.toFixed(1)}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      borderColor: 'rgba(255,255,255,0.1)',
                      color: '#f8fafc',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number, name: string) =>
                      name === 'amount' ? [`${value} 亿`, '成交额'] : [`${value}%`, '变化率']
                    }
                  />
                  <Area yAxisId="amount" type="monotone" dataKey="amount" stroke="#38bdf8" fill="url(#volumeGradient)" strokeWidth={2} />
                  <Line yAxisId="changeRate" type="monotone" dataKey="changeRate" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} />
                  <defs>
                    <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm">量能数据加载中...</div>
          )}
        </div>

        <div className="rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4 min-h-[18rem] flex flex-col">
          <div className="flex items-center justify-between mb-3 flex-shrink-0">
            <div>
              <div className="text-sm font-semibold text-slate-800 dark:text-white">高位风险面板</div>
              <div className="text-xs text-slate-500">看 A 杀、弱转弱和炸板扩散</div>
            </div>
            <div
              className={`text-sm font-semibold ${
                latestRisk?.riskLevel === 'high'
                  ? 'text-red-500'
                  : latestRisk?.riskLevel === 'medium'
                    ? 'text-amber-500'
                    : 'text-emerald-500'
              }`}
            >
              {latestRisk?.riskLevel === 'high' ? '高危' : latestRisk?.riskLevel === 'medium' ? '预警' : '可控'}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 flex-shrink-0">
            <div className="rounded-xl bg-white/70 dark:bg-slate-900/40 p-3">
              <div className="text-xs text-slate-400">4板以上样本</div>
              <div className="mt-2 text-2xl font-mono font-bold text-slate-900 dark:text-white">{latestRisk?.highBoardCount ?? 0}</div>
            </div>
            <div className="rounded-xl bg-white/70 dark:bg-slate-900/40 p-3">
              <div className="text-xs text-slate-400">高位A杀</div>
              <div className="mt-2 text-2xl font-mono font-bold text-red-500">{latestRisk?.aKillCount ?? 0}</div>
            </div>
            <div className="rounded-xl bg-white/70 dark:bg-slate-900/40 p-3">
              <div className="text-xs text-slate-400">高位转弱</div>
              <div className="mt-2 text-2xl font-mono font-bold text-amber-500">{latestRisk?.weakCount ?? 0}</div>
            </div>
            <div className="rounded-xl bg-white/70 dark:bg-slate-900/40 p-3">
              <div className="text-xs text-slate-400">当日炸板率</div>
              <div className="mt-2 text-2xl font-mono font-bold text-cyan-500">{latestRisk?.brokenRate?.toFixed(1) ?? '0.0'}%</div>
            </div>
          </div>
          <div className="mt-3 text-xs text-slate-500 space-y-1 flex-1">
            {(cycleOverview?.reasons ?? []).map((reason) => (
              <div key={reason}>• {reason}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SentimentCurrentCyclePanel;
