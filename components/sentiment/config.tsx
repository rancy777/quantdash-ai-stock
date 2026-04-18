import { Activity, AlertTriangle, BarChart2, Globe2, TrendingDown, TrendingUp, Zap, type LucideIcon } from 'lucide-react';

import type { DataSourceState, SentimentMetricId } from './hooks/useSentimentSectionData';

export type SentimentMetricDefinition = {
  id: SentimentMetricId;
  label: string;
  icon: LucideIcon;
  color: string;
};

export const SENTIMENT_METRICS: SentimentMetricDefinition[] = [
  { id: 'currentCycle', label: '当前周期', icon: Activity, color: 'text-cyan-500' },
  { id: 'emotion', label: '情绪指标', icon: Globe2, color: 'text-cyan-500' },
  { id: 'pressure', label: '砸盘系数', icon: TrendingDown, color: 'text-green-500' },
  { id: 'premium', label: '涨停溢价', icon: Zap, color: 'text-red-500' },
  { id: 'broken', label: '炸板率', icon: AlertTriangle, color: 'text-yellow-500' },
  { id: 'structure', label: '涨停结构', icon: Activity, color: 'text-sky-500' },
  { id: 'repair', label: '修复率', icon: TrendingUp, color: 'text-emerald-500' },
  { id: 'leader', label: '龙头状态', icon: BarChart2, color: 'text-violet-500' },
  { id: 'height', label: '高度趋势', icon: BarChart2, color: 'text-rose-500' },
];

const sourceLabelMap: Record<DataSourceState, string> = {
  local: '本地缓存',
  api: '实时接口',
  unknown: '未知',
};

const sourceClassMap: Record<DataSourceState, string> = {
  local: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
  api: 'bg-sky-100 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300',
  unknown: 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300',
};

const formatUpdatedAt = (value: string | null | undefined) => {
  if (!value) return '未记录';
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

export const renderSentimentSourceBadge = (source: DataSourceState, updatedAt?: string | null) => (
  <div className="flex flex-wrap items-center justify-end gap-2">
    <span className={`text-[10px] px-2 py-1 rounded-full font-mono tracking-wide ${sourceClassMap[source]}`}>
      数据来源: {sourceLabelMap[source]}
    </span>
    <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-mono tracking-wide text-slate-500 dark:bg-white/10 dark:text-slate-300">
      更新时间: {formatUpdatedAt(updatedAt)}
    </span>
  </div>
);
