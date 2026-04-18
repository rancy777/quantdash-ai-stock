import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, RefreshCw } from 'lucide-react';
import { SyncRuntimeStatus, SyncStatusPayload } from '../types';
import { triggerStartupSync } from '../services/syncStatusService';

interface SyncStatusCardProps {
  isDark: boolean;
  status: SyncStatusPayload | null;
  runtimeStatus: SyncRuntimeStatus;
  loading: boolean;
  onRefresh: () => Promise<void> | void;
}

const formatTime = (value?: string | null) => {
  if (!value) return '未知';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const formatDuration = (value?: number | null) => {
  if (typeof value !== 'number' || value < 0) return '未知';
  if (value < 1000) return `${value}ms`;
  if (value < 60_000) return `${(value / 1000).toFixed(1)}s`;
  return `${(value / 60_000).toFixed(1)}m`;
};

const SyncStatusCard: React.FC<SyncStatusCardProps> = ({ isDark, status, runtimeStatus, loading, onRefresh }) => {
  const [submitting, setSubmitting] = useState(false);
  const failedStage = status?.stages.find((item) => item.status === 'failed') ?? null;
  const isRunning = runtimeStatus.state === 'running';
  const isBusy = loading || submitting || isRunning;
  const primaryLabel = useMemo(() => {
    if (isRunning) return '同步进行中';
    if (status?.overallStatus === 'failed') return '同步异常';
    if (loading) return '读取中...';
    return '同步正常';
  }, [isRunning, status?.overallStatus, loading]);
  const statusTone = status?.overallStatus === 'failed'
    ? {
        icon: <AlertTriangle size={16} className="text-amber-500" />,
        textClass: 'text-amber-600 dark:text-amber-400',
      }
    : {
        icon: <CheckCircle2 size={16} className="text-emerald-500" />,
        textClass: 'text-emerald-600 dark:text-emerald-400',
      };

  const handleTriggerSync = async () => {
    try {
      setSubmitting(true);
      await triggerStartupSync('startup');
      await onRefresh();
    } catch (error) {
      console.error('Failed to trigger startup sync', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`p-4 rounded-xl border mb-4 transition-colors ${
      isDark ? 'bg-white/5 border-white/10' : 'bg-white/80 border-slate-200'
    }`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500 dark:text-gray-500">
            Data Status
          </p>
          <div className={`mt-1 flex items-center gap-2 text-sm font-semibold ${statusTone.textClass}`}>
            {statusTone.icon}
            <span>{primaryLabel}</span>
          </div>
        </div>
        <RefreshCw size={15} className={`shrink-0 ${isBusy ? 'animate-spin text-cyan-500' : 'text-slate-400 dark:text-gray-500'}`} />
      </div>

      <div className="mt-4 space-y-2 text-xs">
        <div className="flex items-center justify-between gap-3">
          <span className="text-slate-500 dark:text-gray-500">最新交易日</span>
          <span className="font-medium text-slate-700 dark:text-gray-200">
            {status?.onlineTradingDate ?? '未知'}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-slate-500 dark:text-gray-500">最近同步</span>
          <span className="font-medium text-slate-700 dark:text-gray-200">
            {formatTime(status?.finishedAt)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-slate-500 dark:text-gray-500">耗时</span>
          <span className="font-medium text-slate-700 dark:text-gray-200">
            {formatDuration(status?.durationMs)}
          </span>
        </div>
      </div>

      <div className={`mt-4 rounded-lg px-3 py-2 ${
        isDark ? 'bg-black/20' : 'bg-slate-50'
      }`}>
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-gray-500">
          <Clock3 size={13} />
          <span>
            来源: {isRunning ? `${runtimeStatus.trigger ?? 'startup-sync'} / 运行中` : status?.trigger ?? '未记录'}
          </span>
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-gray-300">
          {failedStage?.reason
            ? `${failedStage.name}: ${failedStage.reason}`
            : isRunning
              ? `任务已启动，模式 ${runtimeStatus.mode ?? 'startup'}，开始于 ${formatTime(runtimeStatus.startedAt)}`
            : status
              ? `情绪 ${status.latestSnapshots.sentiment ?? '未知'} / 周期 ${status.latestSnapshots.cycle ?? '未知'}`
              : '尚未生成同步状态文件'}
        </p>
      </div>

      <button
        onClick={handleTriggerSync}
        disabled={isBusy}
        className={`mt-4 w-full py-2 text-xs font-semibold rounded-lg border transition-colors ${
          isBusy
            ? 'cursor-not-allowed border-slate-300/50 text-slate-400 dark:border-white/10 dark:text-gray-500'
            : isDark
              ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/15'
              : 'border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100'
        }`}
      >
        {isRunning ? '同步执行中...' : submitting ? '正在提交...' : '立即同步'}
      </button>
    </div>
  );
};

export default SyncStatusCard;
