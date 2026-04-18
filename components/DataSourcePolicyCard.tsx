import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Database, Loader2, Save, Stethoscope } from 'lucide-react';
import type {
  DataSourcePolicyMode,
  DataSourcePolicyState,
  SecondaryHealthProbeResult,
  SecondaryHealthState,
} from '../types';
import {
  loadDataSourceStatus,
  probeDataSourceHealth,
  updateDataSourcePolicy,
} from '../services/dataSourcePolicyService';

interface DataSourcePolicyCardProps {
  isDark: boolean;
}

const MODE_OPTIONS: Array<{ value: DataSourcePolicyMode; label: string; description: string }> = [
  {
    value: 'primary_only',
    label: '主源优先',
    description: '默认只走 EastMoney，第二源仅保留状态和手动切换能力。',
  },
  {
    value: 'auto_fallback',
    label: '失败自动切第二源',
    description: '主源超时或失败时自动切到第二源，适合网络不稳时使用。',
  },
  {
    value: 'prefer_secondary',
    label: '优先第二源',
    description: '支持的数据集优先走第二源，主源作为兜底。',
  },
];

const formatTime = (value?: string | null) => {
  if (!value) return '未记录';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const DataSourcePolicyCard: React.FC<DataSourcePolicyCardProps> = ({ isDark }) => {
  const [policy, setPolicy] = useState<DataSourcePolicyState | null>(null);
  const [health, setHealth] = useState<SecondaryHealthState | null>(null);
  const [globalMode, setGlobalMode] = useState<DataSourcePolicyMode>('primary_only');
  const [datasetOverrides, setDatasetOverrides] = useState<Record<string, DataSourcePolicyMode>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [probing, setProbing] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const nextStatus = await loadDataSourceStatus();
        if (cancelled) return;
        setPolicy(nextStatus.providerPolicy);
        setHealth(nextStatus.secondaryHealth);
        setGlobalMode(nextStatus.providerPolicy.globalMode);
        setDatasetOverrides(nextStatus.providerPolicy.datasetOverrides);
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : '读取数据源策略失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeOption = useMemo(
    () => MODE_OPTIONS.find((option) => option.value === globalMode) ?? MODE_OPTIONS[0],
    [globalMode],
  );

  const isDirty = useMemo(() => {
    if (!policy) return false;
    const currentOverrides = JSON.stringify(policy.datasetOverrides);
    const nextOverrides = JSON.stringify(datasetOverrides);
    return policy.globalMode !== globalMode || currentOverrides !== nextOverrides;
  }, [datasetOverrides, globalMode, policy]);

  const availabilityTone = policy?.secondaryAvailable
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-amber-600 dark:text-amber-400';

  const healthTone = health?.lastError
    ? 'text-amber-600 dark:text-amber-400'
    : 'text-slate-700 dark:text-gray-200';

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      const nextPolicy = await updateDataSourcePolicy(globalMode, datasetOverrides);
      setPolicy(nextPolicy);
      setGlobalMode(nextPolicy.globalMode);
      setDatasetOverrides(nextPolicy.datasetOverrides);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存数据源策略失败');
    } finally {
      setSaving(false);
    }
  };

  const handleProbe = async () => {
    try {
      setProbing(true);
      setError(null);
      const nextHealth = await probeDataSourceHealth();
      setHealth(nextHealth);
    } catch (probeError) {
      setError(probeError instanceof Error ? probeError.message : '第二数据源探测失败');
    } finally {
      setProbing(false);
    }
  };

  const isBusy = loading || saving || probing;

  return (
    <div
      className={`mb-4 rounded-xl border p-4 transition-colors ${
        isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white/80'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500 dark:text-gray-500">
            Data Source
          </p>
          <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-gray-100">
            <Database size={15} className="text-cyan-500" />
            <span>第二数据源策略</span>
          </div>
        </div>
        {isBusy && <Loader2 size={15} className="shrink-0 animate-spin text-cyan-500" />}
      </div>

      <div className="mt-4 space-y-2 text-xs">
        <div className="flex items-center justify-between gap-3">
          <span className="text-slate-500 dark:text-gray-500">第二源</span>
          <span className={`font-medium ${availabilityTone}`}>
            {policy?.secondaryAvailable ? 'mootdx 可用' : 'mootdx 未就绪'}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-slate-500 dark:text-gray-500">全局策略</span>
          <span className="font-medium text-slate-700 dark:text-gray-200">{activeOption.label}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-slate-500 dark:text-gray-500">已支持数据集</span>
          <span className="font-medium text-slate-700 dark:text-gray-200">
            {policy?.supportedDatasets.length ?? 0}
          </span>
        </div>
      </div>

      <div className={`mt-4 rounded-lg px-3 py-3 ${isDark ? 'bg-black/20' : 'bg-slate-50'}`}>
        <label
          htmlFor="data-source-global-mode"
          className="mb-2 block text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-gray-500"
        >
          全局切换策略
        </label>
        <select
          id="data-source-global-mode"
          value={globalMode}
          onChange={(event) => setGlobalMode(event.target.value as DataSourcePolicyMode)}
          disabled={loading}
          className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors ${
            isDark
              ? 'border-white/10 bg-slate-900/80 text-gray-100 focus:border-cyan-500/60'
              : 'border-slate-200 bg-white text-slate-800 focus:border-cyan-400'
          }`}
        >
          {MODE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-gray-300">
          {activeOption.description}
        </p>
        {!policy?.secondaryAvailable && (
          <p className="mt-2 text-xs leading-5 text-amber-600 dark:text-amber-400">
            {policy?.secondaryReason ?? '当前环境未检测到可用的第二数据源库。'}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowAdvanced((prev) => !prev)}
        className={`mt-3 flex w-full items-center justify-between rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
          isDark
            ? 'border-white/10 bg-white/5 text-gray-200 hover:bg-white/[0.07]'
            : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
        }`}
      >
        <span>按数据集覆盖设置</span>
        {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {showAdvanced && (
        <div className="mt-3 space-y-3">
          {policy?.supportedDatasets.map((dataset) => (
            <div
              key={dataset.dataset}
              className={`rounded-lg border px-3 py-3 ${
                isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-800 dark:text-gray-100">
                    {dataset.label}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-gray-400">
                    覆盖动作: {dataset.actions.join(' / ')}
                  </div>
                </div>
                <select
                  value={datasetOverrides[dataset.dataset] ?? globalMode}
                  onChange={(event) =>
                    setDatasetOverrides((prev) => ({
                      ...prev,
                      [dataset.dataset]: event.target.value as DataSourcePolicyMode,
                    }))
                  }
                  className={`min-w-[132px] rounded-lg border px-3 py-2 text-xs outline-none transition-colors ${
                    isDark
                      ? 'border-white/10 bg-slate-900/80 text-gray-100 focus:border-cyan-500/60'
                      : 'border-slate-200 bg-white text-slate-800 focus:border-cyan-400'
                  }`}
                >
                  {MODE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}

          {policy?.primaryOnlyDatasets.length ? (
            <div
              className={`rounded-lg border px-3 py-3 text-xs leading-5 ${
                isDark ? 'border-white/10 bg-black/20 text-gray-300' : 'border-slate-200 bg-slate-50 text-slate-600'
              }`}
            >
              仍固定走主源的数据集：
              {policy.primaryOnlyDatasets.map((item) => item.label).join('、')}
            </div>
          ) : null}
        </div>
      )}

      <div className={`mt-4 rounded-lg border px-3 py-3 ${isDark ? 'border-white/10 bg-black/20' : 'border-slate-200 bg-slate-50'}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-gray-500">
            <Stethoscope size={13} />
            <span>第二源健康状态</span>
          </div>
          <button
            type="button"
            onClick={handleProbe}
            disabled={probing}
            className={`rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
              probing
                ? 'cursor-not-allowed bg-slate-200 text-slate-400 dark:bg-white/10 dark:text-gray-500'
                : isDark
                  ? 'bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/15'
                  : 'bg-cyan-50 text-cyan-700 hover:bg-cyan-100'
            }`}
          >
            {probing ? '探测中...' : '运行探测'}
          </button>
        </div>

        <div className={`mt-3 space-y-2 text-xs ${healthTone}`}>
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500 dark:text-gray-500">最近探测</span>
            <span>{formatTime(health?.lastCheckedAt)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500 dark:text-gray-500">最近成功</span>
            <span>{formatTime(health?.lastSuccessAt)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500 dark:text-gray-500">平均耗时</span>
            <span>{health?.lastLatencyMs ? `${health.lastLatencyMs} ms` : '未记录'}</span>
          </div>
          <div className="text-slate-500 dark:text-gray-500">
            最近错误: {health?.lastError ?? '无'}
          </div>
        </div>

        {health?.probeResults && Object.keys(health.probeResults).length > 0 && (
          <div className="mt-3 space-y-2">
            {Object.entries(health.probeResults as Record<string, SecondaryHealthProbeResult>).map(([dataset, result]) => (
              <div
                key={dataset}
                className={`flex items-center justify-between gap-3 rounded-md px-2 py-2 text-[11px] ${
                  isDark ? 'bg-white/5 text-gray-300' : 'bg-white text-slate-600'
                }`}
              >
                <div>
                  <div className="font-semibold text-slate-700 dark:text-gray-100">{dataset}</div>
                  <div className="mt-1 text-slate-500 dark:text-gray-400">{result.detail}</div>
                </div>
                <div className="text-right">
                  <div className={result.ok ? 'text-emerald-500' : 'text-amber-500'}>
                    {result.ok ? '通过' : '失败'}
                  </div>
                  <div className="mt-1 text-slate-500 dark:text-gray-400">
                    {result.latencyMs ? `${result.latencyMs} ms` : '未测速'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <p className="mt-3 text-xs leading-5 text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}

      <button
        onClick={handleSave}
        disabled={isBusy || !isDirty}
        className={`mt-4 flex w-full items-center justify-center gap-2 rounded-lg border py-2 text-xs font-semibold transition-colors ${
          isBusy || !isDirty
            ? 'cursor-not-allowed border-slate-300/50 text-slate-400 dark:border-white/10 dark:text-gray-500'
            : isDark
              ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/15'
              : 'border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100'
        }`}
      >
        <Save size={14} />
        <span>{saving ? '正在保存...' : isDirty ? '保存策略' : '策略已同步'}</span>
      </button>
    </div>
  );
};

export default DataSourcePolicyCard;
