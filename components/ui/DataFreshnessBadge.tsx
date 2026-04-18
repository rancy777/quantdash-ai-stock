import type { DataFreshnessMeta } from '../../types';

type DataFreshnessBadgeProps = {
  meta: DataFreshnessMeta | null;
};

const sourceClassMap: Record<NonNullable<DataFreshnessMeta['source']>, string> = {
  cache: 'bg-sky-100 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300',
  live: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-300',
  local: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  mock: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  secondary: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300',
  snapshot: 'bg-violet-100 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300',
  unknown: 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300',
};

const sourceLabelMap: Record<NonNullable<DataFreshnessMeta['source']>, string> = {
  cache: '代理缓存',
  live: '实时采集',
  local: '本地文件',
  mock: '模拟回退',
  secondary: '第二数据源',
  snapshot: '最近快照',
  unknown: '未知',
};

const formatUpdatedAt = (value: string | null | undefined) => {
  if (!value) return '未记录时间';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', {
    hour12: false,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const DataFreshnessBadge = ({ meta }: DataFreshnessBadgeProps) => {
  if (!meta) return null;

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <span className={`rounded-full px-2 py-1 text-[10px] font-mono tracking-wide ${sourceClassMap[meta.source]}`}>
        数据来源: {meta.detail ?? sourceLabelMap[meta.source]}
      </span>
      {meta.isSnapshotFallback && (
        <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-mono tracking-wide text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
          快照回退
        </span>
      )}
      {meta.isCached && meta.source !== 'local' && (
        <span className="rounded-full bg-sky-100 px-2 py-1 text-[10px] font-mono tracking-wide text-sky-600 dark:bg-sky-500/10 dark:text-sky-300">
          缓存命中
        </span>
      )}
      <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-mono tracking-wide text-slate-500 dark:bg-white/10 dark:text-slate-300">
        更新时间: {formatUpdatedAt(meta.updatedAt)}
      </span>
    </div>
  );
};

export default DataFreshnessBadge;
