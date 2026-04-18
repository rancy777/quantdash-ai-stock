import React from 'react';
import { BarChart2, Info, Loader2 } from 'lucide-react';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import type { DataSourceState, LeaderEntry } from '../hooks/useSentimentSectionData';

type SentimentLeaderPanelProps = {
  currentLeader: { name: string; symbol: string; label: string } | null;
  currentLeaderBoard: number | null;
  currentLeaderNextClose: number | null;
  currentThreePlusCount: number | null;
  leaderData: LeaderEntry[];
  leaderLoading: boolean;
  leaderLoadingMode: DataSourceState;
  leaderSource: DataSourceState;
  renderSourceBadge: (source: DataSourceState) => React.ReactNode;
  selectedLeaderEntry: LeaderEntry | null;
};

const SentimentLeaderPanel: React.FC<SentimentLeaderPanelProps> = ({
  currentLeader,
  currentLeaderBoard,
  currentLeaderNextClose,
  currentThreePlusCount,
  leaderData,
  leaderLoading,
  leaderLoadingMode,
  leaderSource,
  renderSourceBadge,
  selectedLeaderEntry,
}) => {
  if (leaderLoading && leaderData.length === 0) {
    const loadingText = leaderLoadingMode === 'api' ? '正在跟踪龙头状态...' : '正在读取数据...';
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
        <Loader2 className="animate-spin" /> {loadingText}
      </div>
    );
  }

  if (leaderData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
        <BarChart2 className="opacity-20" size={48} />
        <span>暂无龙头状态数据</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      <div className="absolute top-0 left-0 z-10 p-4 flex gap-6 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">核心龙头</div>
          <div className="text-3xl font-bold text-violet-500 dark:text-violet-400">
            {selectedLeaderEntry?.leaderName ?? currentLeader?.name ?? '—'}
          </div>
          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
            {selectedLeaderEntry?.leaderSymbol ?? currentLeader?.symbol ?? '—'} / {selectedLeaderEntry?.statusLabel ?? currentLeader?.label ?? '待观察'}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">最高板</div>
          <div className="text-4xl font-mono font-bold text-rose-500 dark:text-rose-400">
            {selectedLeaderEntry?.leaderBoardCount ?? currentLeaderBoard} <span className="text-base font-sans text-slate-500 dark:text-slate-400">板</span>
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">3板以上家数</div>
          <div className="text-4xl font-mono font-bold text-amber-500 dark:text-amber-400">
            {selectedLeaderEntry?.threePlusCount ?? currentThreePlusCount} <span className="text-base font-sans text-slate-500 dark:text-slate-400">家</span>
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">龙头次日反馈</div>
          <div
            className={`text-4xl font-mono font-bold ${
              (selectedLeaderEntry?.nextClosePct ?? currentLeaderNextClose ?? -1) >= 0
                ? 'text-emerald-500 dark:text-emerald-400'
                : 'text-cyan-500 dark:text-cyan-400'
            }`}
          >
            {selectedLeaderEntry?.nextClosePct !== null && selectedLeaderEntry?.nextClosePct !== undefined
              ? `${selectedLeaderEntry.nextClosePct.toFixed(2)}%`
              : currentLeaderNextClose !== null
                ? `${currentLeaderNextClose.toFixed(2)}%`
                : '—'}
          </div>
        </div>
      </div>
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        {renderSourceBadge(leaderSource)}
        <div className="group cursor-help relative">
          <div className="bg-slate-200 dark:bg-white/10 p-2 rounded-full text-slate-500 dark:text-gray-400">
            <Info size={16} />
          </div>
          <div className="absolute right-0 top-10 w-80 p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl shadow-xl text-xs text-slate-600 dark:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto z-30">
            <h4 className="font-bold mb-2 text-slate-800 dark:text-white">龙头状态说明</h4>
            <div className="space-y-2 opacity-80">
              <p>用每日最高连板股作为核心龙头样本，观察它的高度、抱团数量、3板以上梯队，以及次日反馈。</p>
              <p>标签优先看一字加速、强势晋级、高位分歧、退潮承压，帮助区分主升与退潮。</p>
            </div>
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={leaderData} margin={{ top: 90, right: 10, left: 0, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} dy={10} />
          <YAxis
            yAxisId="count"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            domain={[0, 'auto']}
            allowDecimals={false}
            width={30}
            label={{ value: '板数/家数', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 11 }}
          />
          <YAxis
            yAxisId="pct"
            orientation="right"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#10b981', fontSize: 10 }}
            domain={['auto', 'auto']}
            width={36}
            label={{ value: '次日涨跌(%)', angle: 90, position: 'insideRight', fill: '#10b981', fontSize: 11 }}
          />
          <Tooltip
            cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
            contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderColor: 'rgba(255,255,255,0.1)', color: '#f8fafc', borderRadius: '8px' }}
            labelStyle={{ color: '#94a3b8' }}
            formatter={(value: number | string | null, name: string, item: any) => {
              if (name === 'leaderBoardCount') return [value, '最高板'];
              if (name === 'threePlusCount') return [value, '3板以上家数'];
              if (name === 'leaderCount') return [value, '同高度龙头数'];
              if (name === 'nextClosePct') return [value === null ? '—' : `${value}%`, '次日收盘反馈'];
              if (name === 'nextOpenPct') return [value === null ? '—' : `${value}%`, '次日开盘反馈'];
              return [value, item?.payload?.statusLabel ?? name];
            }}
            labelFormatter={(label, payload) => {
              const row = payload?.[0]?.payload;
              if (!row) return label;
              return `${label} ${row.leaderName} (${row.leaderSymbol}) ${row.statusLabel}`;
            }}
          />
          <Legend verticalAlign="top" align="right" height={36} iconSize={8} wrapperStyle={{ paddingRight: '80px', paddingTop: '0px' }} />
          <Bar yAxisId="count" dataKey="leaderBoardCount" name="最高板" fill="#8b5cf6" barSize={16} radius={[4, 4, 0, 0]} />
          <Bar yAxisId="count" dataKey="threePlusCount" name="3板以上家数" fill="#f59e0b" barSize={16} radius={[4, 4, 0, 0]} />
          <Line yAxisId="count" type="monotone" dataKey="leaderCount" name="同高度龙头数" stroke="#f43f5e" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          <Line yAxisId="pct" type="monotone" dataKey="nextClosePct" name="次日收盘反馈" stroke="#10b981" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          <Line yAxisId="pct" type="monotone" dataKey="nextOpenPct" name="次日开盘反馈" stroke="#38bdf8" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SentimentLeaderPanel;
