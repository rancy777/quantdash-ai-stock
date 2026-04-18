import Badge from '../ui/Badge';
import type { ExpertHoldingSnapshot } from '../../types';

type InfoGatheringExpertDetailProps = {
  selectedExpertSnapshot: ExpertHoldingSnapshot | null;
};

const InfoGatheringExpertDetail = ({ selectedExpertSnapshot }: InfoGatheringExpertDetailProps) => {
  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-200 dark:border-white/10">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white leading-snug">
            {selectedExpertSnapshot ? `高手持仓快照 ${selectedExpertSnapshot.date}` : '暂无高手持仓数据'}
          </h2>
          <div className="mt-2 flex items-center gap-3 text-sm text-slate-500 dark:text-gray-400">
            <span>{selectedExpertSnapshot?.recordCount ?? 0} 条记录</span>
            <Badge variant="outline">CSV</Badge>
          </div>
        </div>
      </div>
      {selectedExpertSnapshot ? (
        <div className="flex-1 min-h-0 flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl bg-slate-50 dark:bg-white/5 p-4">
              <div className="text-xs text-slate-400">组别数量</div>
              <div className="mt-2 text-2xl font-mono font-bold text-cyan-500">{selectedExpertSnapshot.groups.length}</div>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-white/5 p-4">
              <div className="text-xs text-slate-400">当日收益为正人数</div>
              <div className="mt-2 text-2xl font-mono font-bold text-emerald-500">
                {selectedExpertSnapshot.records.filter((item) => (item.dailyReturnPct ?? -999) > 0).length}
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-white/5 p-4">
              <div className="text-xs text-slate-400">空仓/无持仓描述</div>
              <div className="mt-2 text-2xl font-mono font-bold text-amber-500">
                {selectedExpertSnapshot.records.filter((item) => /空仓|无/.test(item.holdings)).length}
              </div>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-auto custom-scrollbar rounded-xl border border-slate-200 dark:border-white/10">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900 z-10">
                <tr className="text-left text-slate-500 dark:text-gray-400">
                  <th className="px-4 py-3">组别</th>
                  <th className="px-4 py-3">昵称</th>
                  <th className="px-4 py-3">资产(万)</th>
                  <th className="px-4 py-3">当日%</th>
                  <th className="px-4 py-3">本周%</th>
                  <th className="px-4 py-3">核心持仓</th>
                  <th className="px-4 py-3">操作要点</th>
                </tr>
              </thead>
              <tbody>
                {selectedExpertSnapshot.records.map((item, index) => (
                  <tr key={`${item.nickname}-${index}`} className="border-t border-slate-200 dark:border-white/10 align-top">
                    <td className="px-4 py-3 whitespace-nowrap">{item.group}</td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-800 dark:text-white">{item.nickname}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{item.assetScaleWan ?? '—'}</td>
                    <td className={`px-4 py-3 whitespace-nowrap ${(item.dailyReturnPct ?? 0) > 0 ? 'text-red-500' : (item.dailyReturnPct ?? 0) < 0 ? 'text-green-500' : 'text-slate-500'}`}>{item.dailyReturnPct ?? '—'}</td>
                    <td className={`px-4 py-3 whitespace-nowrap ${(item.weeklyReturnPct ?? 0) > 0 ? 'text-red-500' : (item.weeklyReturnPct ?? 0) < 0 ? 'text-green-500' : 'text-slate-500'}`}>{item.weeklyReturnPct ?? '—'}</td>
                    <td className="px-4 py-3 min-w-[180px]">{item.holdings || '—'}</td>
                    <td className="px-4 py-3 min-w-[320px] text-slate-600 dark:text-gray-300">{item.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="h-full flex items-center justify-center text-slate-400">暂无高手持仓数据</div>
      )}
    </div>
  );
};

export default InfoGatheringExpertDetail;
