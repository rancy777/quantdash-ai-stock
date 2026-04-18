import { Calendar, Loader2, RefreshCw, Users } from 'lucide-react';

import type { ExpertHoldingSnapshot } from '../../types';
import Badge from '../ui/Badge';

type InfoGatheringExpertSidebarProps = {
  expertSnapshots: ExpertHoldingSnapshot[];
  expertSyncMessage: string;
  loadingExperts: boolean;
  onSelectSnapshot: (snapshot: ExpertHoldingSnapshot) => void;
  onSyncExperts: () => void;
  selectedExpertSnapshotId?: string | null;
  syncingExperts: boolean;
};

const InfoGatheringExpertSidebar = ({
  expertSnapshots,
  expertSyncMessage,
  loadingExperts,
  onSelectSnapshot,
  onSyncExperts,
  selectedExpertSnapshotId,
  syncingExperts,
}: InfoGatheringExpertSidebarProps) => {
  if (loadingExperts) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500 dark:text-gray-400 gap-2">
        <Loader2 className="animate-spin" /> 正在加载高手数据...
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="p-4 border-b border-slate-200 dark:border-white/10 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500 dark:text-gray-400">数据来源：本地缓存</span>
          <button
            onClick={onSyncExperts}
            disabled={syncingExperts}
            className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center hover:bg-slate-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            title="刷新本地高手缓存"
          >
            {syncingExperts ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          </button>
        </div>
        <div className="text-xs leading-5 text-slate-500 dark:text-gray-400">
          公开仓库中此按钮只刷新本地缓存。抓取最新高手 CSV 请在终端运行 <span className="font-mono">npm run sync:experts</span>。
        </div>
        {expertSyncMessage && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
            {expertSyncMessage}
          </div>
        )}
      </div>
      <div className="overflow-y-auto p-4 space-y-3 flex-1 custom-scrollbar">
        {expertSnapshots.map((snapshot) => (
          <div
            key={snapshot.id}
            onClick={() => onSelectSnapshot(snapshot)}
            className={`p-4 rounded-xl border transition-all cursor-pointer ${
              selectedExpertSnapshotId === snapshot.id
                ? 'bg-cyan-50/50 dark:bg-white/10 border-cyan-500/30 shadow-md'
                : 'bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-white/5'
            }`}
          >
            <div className="flex justify-between items-start mb-2 gap-3">
              <span className="text-xs text-slate-400 dark:text-gray-500 font-mono flex items-center gap-1">
                <Calendar size={10} /> {snapshot.date}
              </span>
              <Badge variant="outline">{snapshot.recordCount} 条</Badge>
            </div>
            <h4 className={`text-sm font-medium leading-relaxed ${selectedExpertSnapshotId === snapshot.id ? 'text-cyan-700 dark:text-cyan-100' : 'text-slate-700 dark:text-gray-300'}`}>
              {snapshot.fileName}
            </h4>
            <div className="mt-2 text-xs text-slate-400 dark:text-gray-500 flex items-center justify-between gap-2">
              <span>{snapshot.groups.join(' / ')}</span>
              <span className="bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded uppercase">CSV</span>
            </div>
          </div>
        ))}
        {expertSnapshots.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 py-10 gap-2">
            <Users className="opacity-40" />
            <span>暂无高手持仓数据</span>
            <span className="text-xs">点击上方按钮同步最新 CSV 数据</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default InfoGatheringExpertSidebar;
