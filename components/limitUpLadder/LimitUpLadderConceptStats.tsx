import React from 'react';

interface LimitUpLadderConceptStatsProps {
  selectedDate: string;
  conceptStats: [string, number][];
}

const LimitUpLadderConceptStats: React.FC<LimitUpLadderConceptStatsProps> = ({
  selectedDate,
  conceptStats,
}) => (
  <div className="px-6 py-4 border-b border-slate-200/80 dark:border-slate-700 bg-white/80 dark:bg-white/[0.03] backdrop-blur-sm">
    <div className="flex items-center justify-between mb-3">
      <div className="text-sm font-semibold text-slate-700 dark:text-gray-100 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 inline-block" />
        概念涨停统计
      </div>
      <span className="text-xs text-slate-400 font-mono">
        {selectedDate} ｜ {conceptStats.length} 个概念
      </span>
    </div>
    <div className="flex flex-wrap gap-3">
      {conceptStats.map(([concept, count]) => (
        <div
          key={concept}
          className="px-3 py-2 rounded-xl bg-cyan-50/80 dark:bg-cyan-500/10 border border-cyan-100 dark:border-cyan-500/30 shadow-sm"
        >
          <p className="text-xs font-semibold text-slate-600 dark:text-white">{concept}</p>
          <p className="text-[11px] text-cyan-700 dark:text-cyan-300 mt-0.5">{count} 次涨停</p>
        </div>
      ))}
    </div>
  </div>
);

export default LimitUpLadderConceptStats;
