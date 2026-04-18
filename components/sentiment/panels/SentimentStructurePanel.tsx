import React from 'react';
import { Activity, Info, Loader2 } from 'lucide-react';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import type { DataSourceState, StructureEntry } from '../hooks/useSentimentSectionData';

type SentimentStructurePanelProps = {
  currentFirstBoardCount: number | null;
  currentFirstBoardRatio: number | null;
  currentHighBoardCount: number | null;
  currentRelayCount: number | null;
  currentStructureDate: string | null;
  renderSourceBadge: (source: DataSourceState) => React.ReactNode;
  selectedStructureEntry: StructureEntry | null;
  structureData: StructureEntry[];
  structureLoading: boolean;
  structureLoadingMode: DataSourceState;
  structureSource: DataSourceState;
};

const SentimentStructurePanel: React.FC<SentimentStructurePanelProps> = ({
  currentFirstBoardCount,
  currentFirstBoardRatio,
  currentHighBoardCount,
  currentRelayCount,
  currentStructureDate,
  renderSourceBadge,
  selectedStructureEntry,
  structureData,
  structureLoading,
  structureLoadingMode,
  structureSource,
}) => {
  if (structureLoading && structureData.length === 0) {
    const loadingText =
      structureLoadingMode === 'local'
        ? '正在读取本地缓存...'
        : structureLoadingMode === 'api'
          ? '正在获取接口数据...'
          : '统计涨停结构中...';
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
        <Loader2 className="animate-spin" /> {loadingText}
      </div>
    );
  }

  if (structureData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
        <Activity className="opacity-20" size={48} />
        <span>暂无涨停结构数据</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      <div className="absolute top-0 left-0 z-10 p-4 flex gap-6 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">首板家数</div>
          <div className="text-4xl font-mono font-bold text-cyan-500 dark:text-cyan-400">
            {selectedStructureEntry?.firstBoardCount ?? currentFirstBoardCount}{' '}
            <span className="text-base font-sans text-slate-500 dark:text-slate-400">家</span>
          </div>
          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
            最新结构日 {selectedStructureEntry?.date ?? currentStructureDate ?? '?'}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">接力家数</div>
          <div className="text-4xl font-mono font-bold text-amber-500 dark:text-amber-400">
            {selectedStructureEntry?.relayCount ?? currentRelayCount}{' '}
            <span className="text-base font-sans text-slate-500 dark:text-slate-400">家</span>
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">高标家数</div>
          <div className="text-4xl font-mono font-bold text-rose-500 dark:text-rose-400">
            {selectedStructureEntry?.highBoardCount ?? currentHighBoardCount}{' '}
            <span className="text-base font-sans text-slate-500 dark:text-slate-400">家</span>
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">首板占比</div>
          <div className="text-4xl font-mono font-bold text-emerald-500 dark:text-emerald-400">
            {(selectedStructureEntry?.firstBoardRatio ?? currentFirstBoardRatio ?? 0).toFixed(1)}%
          </div>
        </div>
      </div>
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        {renderSourceBadge(structureSource)}
        <div className="group cursor-help relative">
          <div className="bg-slate-200 dark:bg-white/10 p-2 rounded-full text-slate-500 dark:text-gray-400">
            <Info size={16} />
          </div>
          <div className="absolute right-0 top-10 w-72 p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl shadow-xl text-xs text-slate-600 dark:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto z-30">
            <h4 className="font-bold mb-2 text-slate-800 dark:text-white">涨停结构说明</h4>
            <div className="space-y-2 opacity-80">
              <p>首板高说明市场仍在试错扩散，接力和高标同步抬升，才更像主线主升。</p>
              <p>图中蓝柱为首板，黄柱为 2 板，橙柱为 3 板，红柱为 4 板及以上，绿线为首板占比。</p>
            </div>
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={structureData} margin={{ top: 90, right: 10, left: 0, bottom: 20 }}>
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
            label={{ value: '涨停家数', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 11 }}
          />
          <YAxis
            yAxisId="ratio"
            orientation="right"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#10b981', fontSize: 10 }}
            domain={[0, 100]}
            width={30}
            label={{ value: '首板占比(%)', angle: 90, position: 'insideRight', fill: '#10b981', fontSize: 11 }}
          />
          <Tooltip
            cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
            contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderColor: 'rgba(255,255,255,0.1)', color: '#f8fafc', borderRadius: '8px' }}
            labelStyle={{ color: '#94a3b8' }}
            formatter={(value: number, name: string) => {
              if (name === 'firstBoardCount') return [value, '首板'];
              if (name === 'secondBoardCount') return [value, '2板'];
              if (name === 'thirdBoardCount') return [value, '3板'];
              if (name === 'highBoardCount') return [value, '4板及以上'];
              if (name === 'firstBoardRatio') return [`${value}%`, '首板占比'];
              return [value, name];
            }}
          />
          <Legend verticalAlign="top" align="right" height={36} iconSize={8} wrapperStyle={{ paddingRight: '80px', paddingTop: '0px' }} />
          <Bar yAxisId="count" dataKey="firstBoardCount" name="首板" stackId="structure" fill="#38bdf8" barSize={18} radius={[0, 0, 0, 0]} />
          <Bar yAxisId="count" dataKey="secondBoardCount" name="2板" stackId="structure" fill="#facc15" barSize={18} radius={[0, 0, 0, 0]} />
          <Bar yAxisId="count" dataKey="thirdBoardCount" name="3板" stackId="structure" fill="#fb923c" barSize={18} radius={[0, 0, 0, 0]} />
          <Bar yAxisId="count" dataKey="highBoardCount" name="4板及以上" stackId="structure" fill="#f43f5e" barSize={18} radius={[4, 4, 0, 0]} />
          <Line yAxisId="ratio" type="monotone" dataKey="firstBoardRatio" name="首板占比" stroke="#10b981" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SentimentStructurePanel;
