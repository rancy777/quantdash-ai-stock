
import React, { useEffect, useState } from 'react';
import GlassCard from './ui/GlassCard';
import { getSectorRotationData, getSectorPersistenceData } from '../services/sectorService';
import { SectorBoardType, SectorCycleData, SectorPersistenceData } from '../types';
import { Loader2, TrendingUp, Repeat, Flame } from 'lucide-react';

const SectorCycleSection: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SectorCycleData | null>(null);
  const [persistence, setPersistence] = useState<SectorPersistenceData | null>(null);
  const [hoveredSector, setHoveredSector] = useState<string | null>(null);
  const [boardType, setBoardType] = useState<SectorBoardType>('concept');

  useEffect(() => {
    const loadData = async () => {
        setLoading(true);
        const [res, persistenceRes] = await Promise.all([
          getSectorRotationData(boardType),
          getSectorPersistenceData(boardType),
        ]);
        setData(res);
        setPersistence(persistenceRes);
        setLoading(false);
    };
    loadData();
  }, [boardType]);

  if (loading || !data) {
    return (
        <div className="h-full flex items-center justify-center text-slate-500 gap-2">
            <Loader2 className="animate-spin" /> 正在计算真实板块轮动...
        </div>
    );
  }

  const { dates, ranks, data: matrix } = data;

  if (!dates.length) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500">
        暂时拿不到板块历史数据，请稍后重试。
      </div>
    );
  }

  const getHeatmapColor = (pct: number) => {
     if (pct >= 4) return 'bg-red-500/80 text-white shadow-lg shadow-red-500/40';
     if (pct >= 2) return 'bg-red-500/50 text-white';
     if (pct >= 0) return 'bg-red-500/20 text-red-500';
     return 'bg-green-500/20 text-green-500';
  };

  const latestEntry = persistence?.entries?.[persistence.entries.length - 1] ?? null;
  const strengthDeltaLabel = latestEntry?.strengthDelta === null || latestEntry?.strengthDelta === undefined
    ? '新晋领涨'
    : `${latestEntry.strengthDelta >= 0 ? '+' : ''}${latestEntry.strengthDelta.toFixed(2)}%`;

  return (
    <div className="h-full flex flex-col gap-6">
       {persistence && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <GlassCard className="min-h-[124px]">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-400">当前最强题材</div>
                <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{persistence.currentLeaderName}</div>
                <div className="mt-1 text-sm font-mono text-red-500">+{persistence.currentLeaderPctChange.toFixed(2)}%</div>
              </div>
              <TrendingUp className="text-red-400" size={18} />
            </div>
          </GlassCard>
          <GlassCard className="min-h-[124px]">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-400">连续领涨天数</div>
                <div className="mt-2 text-3xl font-mono font-bold text-cyan-500">{persistence.currentStreakDays}</div>
                <div className="mt-1 text-sm text-slate-500">连续站上当日第 1 名</div>
              </div>
              <Flame className="text-cyan-400" size={18} />
            </div>
          </GlassCard>
          <GlassCard className="min-h-[124px]">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-400">近 5 日 Top3 次数</div>
                <div className="mt-2 text-3xl font-mono font-bold text-amber-500">{persistence.currentTopThreeAppearances}</div>
                <div className="mt-1 text-sm text-slate-500">当前题材进入前三的次数</div>
              </div>
              <Repeat className="text-amber-400" size={18} />
            </div>
          </GlassCard>
          <GlassCard className="min-h-[124px]">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-400">持续性标签</div>
                <div className="mt-2 text-xl font-bold text-slate-900 dark:text-white">{persistence.strongestRepeatName}</div>
                <div className="mt-1 text-sm text-slate-500">
                  近 5 日出现 {persistence.strongestRepeatCount} 次
                  <span className="ml-2 font-mono text-emerald-500">{strengthDeltaLabel}</span>
                </div>
              </div>
              <Flame className="text-rose-400" size={18} />
            </div>
          </GlassCard>
        </div>
       )}
       <GlassCard
          title={`板块轮动表 (${boardType === 'concept' ? '概念板块' : '行业板块'})`}
          className="flex-1"
          noPadding
          action={
            <div className="flex items-center gap-2">
              <div className="rounded-full bg-slate-100 p-1 dark:bg-white/10">
                <button
                  className={`px-3 py-1 text-xs rounded-full transition-colors ${boardType === 'concept' ? 'bg-cyan-500 text-white' : 'text-slate-500'}`}
                  onClick={() => setBoardType('concept')}
                >
                  概念
                </button>
                <button
                  className={`px-3 py-1 text-xs rounded-full transition-colors ${boardType === 'industry' ? 'bg-cyan-500 text-white' : 'text-slate-500'}`}
                  onClick={() => setBoardType('industry')}
                >
                  行业
                </button>
              </div>
              <div className="text-xs text-slate-400 flex items-center gap-1">
                <div className="w-3 h-3 bg-red-500/80 rounded"></div>
                近 5 个交易日
              </div>
            </div>
          }
       >
          <div className="h-full overflow-auto custom-scrollbar p-6">
             <div className="min-w-[800px]">
                {/* Header: Dates */}
                <div className="flex mb-4">
                   <div className="w-24 flex-shrink-0 font-bold text-slate-500 dark:text-gray-400 text-sm flex items-end justify-center pb-2">排名</div>
                   <div className="flex-1 flex justify-around">
                       {dates.map((date, i) => (
                           <div key={date} className={`text-center flex-1 font-mono text-sm ${i===0 ? 'text-cyan-500 font-bold' : 'text-slate-500 dark:text-gray-400'}`}>
                               {date} {i===0 && '(最新)'}
                           </div>
                       ))}
                   </div>
                </div>

                {/* Rows: Ranks */}
                <div className="space-y-3">
                    {ranks.map(rank => (
                        <div key={rank} className="flex items-center h-16 group/row">
                            {/* Rank Label */}
                            <div className="w-24 flex-shrink-0 flex justify-center">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm
                                    ${rank === 1 ? 'bg-yellow-500 text-white shadow-yellow-500/50 shadow-md' : 
                                      rank === 2 ? 'bg-slate-300 text-slate-700' :
                                      rank === 3 ? 'bg-orange-400 text-white' : 'bg-slate-100 dark:bg-white/10 text-slate-500'}
                                `}>
                                    {rank}
                                </div>
                            </div>
                            
                            {/* Columns */}
                            <div className="flex-1 flex justify-around gap-4">
                                {dates.map(date => {
                                    const sector = matrix[date] ? matrix[date][rank] : null;
                                    // Highlight Logic: If hovering a sector, dim others not matching the name
                                    const isDimmed = hoveredSector && sector && sector.name !== hoveredSector;
                                    const isHighlighted = hoveredSector && sector && sector.name === hoveredSector;

                                    return (
                                        <div key={`${date}-${rank}`} className="flex-1">
                                            {sector ? (
                                                <div 
                                                    className={`h-full rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all duration-300
                                                        ${getHeatmapColor(sector.pctChange)}
                                                        ${isDimmed ? 'opacity-20 scale-95 grayscale' : 'opacity-100'}
                                                        ${isHighlighted ? 'scale-110 shadow-xl ring-2 ring-white z-10' : ''}
                                                    `}
                                                    onMouseEnter={() => setHoveredSector(sector.name)}
                                                    onMouseLeave={() => setHoveredSector(null)}
                                                >
                                                    <span className="font-bold text-sm">{sector.name}</span>
                                                    <span className="text-xs font-mono">{sector.pctChange > 0 ? '+' : ''}{sector.pctChange}%</span>
                                                </div>
                                            ) : (
                                                <div className="h-full rounded-xl bg-slate-100 dark:bg-white/5 opacity-50"></div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
                {persistence && (
                  <div className="mt-6 pt-6 border-t border-slate-200 dark:border-white/10">
                    <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">题材持续性轨迹</div>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                      {persistence.entries.map((entry) => (
                        <div key={entry.date} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/5">
                          <div className="text-xs font-mono text-slate-400">{entry.date}</div>
                          <div className="mt-2 font-bold text-slate-900 dark:text-white">{entry.leaderName}</div>
                          <div className="mt-1 text-sm font-mono text-red-500">{entry.leaderPctChange > 0 ? '+' : ''}{entry.leaderPctChange.toFixed(2)}%</div>
                          <div className="mt-3 text-xs text-slate-500">连冠 {entry.streakDays} 天</div>
                          <div className="mt-1 text-xs text-slate-500">Top3 出现 {entry.topThreeAppearances} 次</div>
                          <div className="mt-1 text-xs text-slate-500">
                            强度变化 {entry.strengthDelta === null ? '新晋领涨' : `${entry.strengthDelta >= 0 ? '+' : ''}${entry.strengthDelta.toFixed(2)}%`}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
             </div>
          </div>
       </GlassCard>
    </div>
  );
};

export default SectorCycleSection;
