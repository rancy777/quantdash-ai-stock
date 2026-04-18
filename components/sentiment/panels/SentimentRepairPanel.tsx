import React from 'react';
import { Info, Loader2, TrendingUp } from 'lucide-react';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import type { DataSourceState, RepairEntry } from '../hooks/useSentimentSectionData';

type SentimentRepairPanelProps = {
  currentBigFaceCount: number | null;
  currentBigFaceRepairRate: number | null;
  currentBrokenRepairRate: number | null;
  currentRepairBrokenCount: number | null;
  currentRepairDate: string | null;
  renderSourceBadge: (source: DataSourceState) => React.ReactNode;
  repairData: RepairEntry[];
  repairLoading: boolean;
  repairLoadingMode: DataSourceState;
  repairSource: DataSourceState;
};

const SentimentRepairPanel: React.FC<SentimentRepairPanelProps> = ({
  currentBigFaceCount,
  currentBigFaceRepairRate,
  currentBrokenRepairRate,
  currentRepairBrokenCount,
  currentRepairDate,
  renderSourceBadge,
  repairData,
  repairLoading,
  repairLoadingMode,
  repairSource,
}) => {
  if (repairLoading && repairData.length === 0) {
    const loadingText = repairLoadingMode === 'api' ? '正在统计修复率...' : '正在读取数据...';
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
        <Loader2 className="animate-spin" /> {loadingText}
      </div>
    );
  }

  if (repairData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
        <TrendingUp className="opacity-20" size={48} />
        <span>暂无修复率数据</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      <div className="absolute top-0 left-0 z-10 p-4 flex gap-6 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">炸板修复率</div>
          <div className="text-4xl font-mono font-bold text-emerald-500 dark:text-emerald-400">
            {currentBrokenRepairRate?.toFixed(1)}%
          </div>
          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
            最新统计日 {currentRepairDate ?? '?'}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">大面修复率</div>
          <div className="text-4xl font-mono font-bold text-cyan-500 dark:text-cyan-400">
            {currentBigFaceRepairRate?.toFixed(1)}%
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">昨日炸板样本</div>
          <div className="text-4xl font-mono font-bold text-amber-500 dark:text-amber-400">
            {currentRepairBrokenCount} <span className="text-base font-sans text-slate-500 dark:text-slate-400">只</span>
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">昨日大面样本</div>
          <div className="text-4xl font-mono font-bold text-rose-500 dark:text-rose-400">
            {currentBigFaceCount} <span className="text-base font-sans text-slate-500 dark:text-slate-400">只</span>
          </div>
        </div>
      </div>
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        {renderSourceBadge(repairSource)}
        <div className="group cursor-help relative">
          <div className="bg-slate-200 dark:bg-white/10 p-2 rounded-full text-slate-500 dark:text-gray-400">
            <Info size={16} />
          </div>
          <div className="absolute right-0 top-10 w-80 p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl shadow-xl text-xs text-slate-600 dark:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto z-30">
            <h4 className="font-bold mb-2 text-slate-800 dark:text-white">修复率说明</h4>
            <div className="space-y-2 opacity-80">
              <p>炸板修复率 = 昨日炸板股中，次日收盘红盘的占比。</p>
              <p>大面修复率 = 昨日炸板池里收盘跌幅大于等于 5% 的个股中，次日收盘红盘的占比。</p>
              <p>这两项更适合判断退潮是否衰竭，以及分歧后是否出现可参与修复。</p>
            </div>
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={repairData} margin={{ top: 90, right: 10, left: 0, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} dy={10} />
          <YAxis
            yAxisId="left"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#10b981', fontSize: 10 }}
            domain={[0, 100]}
            width={30}
            label={{ value: '修复率(%)', angle: -90, position: 'insideLeft', fill: '#10b981', fontSize: 11 }}
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
            label={{ value: '样本数', angle: 90, position: 'insideRight', fill: '#94a3b8', fontSize: 11 }}
          />
          <Tooltip
            cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
            contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderColor: 'rgba(255,255,255,0.1)', color: '#f8fafc', borderRadius: '8px' }}
            labelStyle={{ color: '#94a3b8' }}
            formatter={(value: number, name: string) => {
              if (name === 'brokenRepairRate') return [`${value}%`, '炸板修复率'];
              if (name === 'bigFaceRepairRate') return [`${value}%`, '大面修复率'];
              if (name === 'brokenCount') return [value, '炸板样本'];
              if (name === 'bigFaceCount') return [value, '大面样本'];
              return [value, name];
            }}
          />
          <Legend verticalAlign="top" align="right" height={36} iconSize={8} wrapperStyle={{ paddingRight: '80px', paddingTop: '0px' }} />
          <Bar yAxisId="right" dataKey="brokenCount" name="炸板样本" fill="#f59e0b" barSize={16} radius={[4, 4, 0, 0]} />
          <Bar yAxisId="right" dataKey="bigFaceCount" name="大面样本" fill="#f43f5e" barSize={16} radius={[4, 4, 0, 0]} />
          <Line yAxisId="left" type="monotone" dataKey="brokenRepairRate" name="炸板修复率" stroke="#10b981" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          <Line yAxisId="left" type="monotone" dataKey="bigFaceRepairRate" name="大面修复率" stroke="#38bdf8" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SentimentRepairPanel;
