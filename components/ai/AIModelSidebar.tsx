import React from 'react';

import { CheckCircle2, ChevronDown, Cpu, KeyRound, Plus } from 'lucide-react';

import { maskApiKey, type ProviderConnectionTestResult } from '../../services/modelIntegrationService';
import { ModelProviderConfig, ModelProviderMode } from '../../types';
import { providerTypeLabel, PROVIDER_SELECT_CARD_CLASS_NAME } from './config';
import Badge from '../ui/Badge';
import GlassCard from '../ui/GlassCard';

type AIModelSidebarProps = {
  providersCount: number;
  configuredProvidersCount: number;
  configuredCloudProvidersCount: number;
  localProvidersCount: number;
  selectedProvider: ModelProviderConfig | null;
  selectedProviderId: string | null;
  selectedProviderTestResult?: ProviderConnectionTestResult;
  isProviderDropdownOpen: boolean;
  providerDropdownRef: React.RefObject<HTMLDivElement | null>;
  cloudProviders: ModelProviderConfig[];
  localProviders: ModelProviderConfig[];
  onToggleDropdown: () => void;
  onSelectProvider: (providerId: string) => void;
  onAddProvider: (mode: ModelProviderMode) => void;
};

function ProviderBucket({
  title,
  providers,
  selectedProviderId,
  onSelectProvider,
}: {
  title: string;
  providers: ModelProviderConfig[];
  selectedProviderId: string | null;
  onSelectProvider: (providerId: string) => void;
}) {
  if (providers.length === 0) return null;

  return (
    <div className={title === '云端模型' ? 'mb-2' : undefined}>
      <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-gray-500">
        {title}
      </div>
      <div className="space-y-1">
        {providers.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectProvider(item.id)}
            className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
              selectedProviderId === item.id
                ? 'border-cyan-200 bg-cyan-50 text-cyan-700 shadow-[0_10px_24px_rgba(34,211,238,0.12)] dark:border-cyan-500/20 dark:bg-cyan-500/10 dark:text-cyan-300'
                : 'border-transparent bg-slate-50/70 hover:border-slate-200 hover:bg-white dark:bg-white/[0.03] dark:hover:border-white/10 dark:hover:bg-white/[0.05]'
            }`}
          >
            <div className="flex items-start gap-3">
              <span
                className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                  item.enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-gray-600'
                }`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{item.displayName}</span>
                  {item.enabled && <Badge variant="green">已启用</Badge>}
                </div>
                <div className="mt-1 truncate text-xs text-slate-500 dark:text-gray-400">
                  {item.model || '未设置模型'}
                </div>
                <div className="mt-1 truncate text-[11px] text-slate-400 dark:text-gray-500">
                  {maskApiKey(item.apiKey)}
                </div>
              </div>
              <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-500 dark:border-white/10 dark:bg-slate-900 dark:text-gray-400">
                {item.protocol}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function AIModelSidebar({
  providersCount,
  configuredProvidersCount,
  configuredCloudProvidersCount,
  localProvidersCount,
  selectedProvider,
  selectedProviderId,
  selectedProviderTestResult,
  isProviderDropdownOpen,
  providerDropdownRef,
  cloudProviders,
  localProviders,
  onToggleDropdown,
  onSelectProvider,
  onAddProvider,
}: AIModelSidebarProps) {
  return (
    <>
      <GlassCard title="模型线路">
        <div className="grid grid-cols-1 gap-3">
          <div className="rounded-xl border border-slate-200/70 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-cyan-500/15 p-2 text-cyan-500">
                <Cpu size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-gray-100">{providersCount} 条模型线路</p>
                <p className="text-xs text-slate-500 dark:text-gray-400">云端 token 和本地模型统一管理</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200/70 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-500/15 p-2 text-emerald-500">
                <CheckCircle2 size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-gray-100">{configuredProvidersCount} 条可用配置</p>
                <p className="text-xs text-slate-500 dark:text-gray-400">
                  云端按已填写 API Key 统计，本地按已手动启用统计
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200/70 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-violet-500/15 p-2 text-violet-500">
                <KeyRound size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-gray-100">{configuredCloudProvidersCount} 条云端已填 Key</p>
                <p className="text-xs text-slate-500 dark:text-gray-400">{localProvidersCount} 条本地线路可单独启用</p>
              </div>
            </div>
          </div>
        </div>
      </GlassCard>

      <GlassCard title="模型列表">
        <div className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700 dark:text-gray-300">选择模型线路</span>
            <div ref={providerDropdownRef} className="relative">
              <button
                type="button"
                onClick={onToggleDropdown}
                className={`${PROVIDER_SELECT_CARD_CLASS_NAME} flex items-center justify-between gap-3`}
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">
                    {selectedProvider?.displayName ?? '请选择模型'}
                  </div>
                  <div className="mt-1 truncate text-xs text-slate-500 dark:text-gray-400">
                    {selectedProvider
                      ? `${providerTypeLabel[selectedProvider.mode]} · ${selectedProvider.model || '未设置模型'}`
                      : '云端模型 / 本地模型'}
                  </div>
                </div>
                <ChevronDown
                  size={16}
                  className={`shrink-0 text-slate-400 transition-transform dark:text-gray-500 ${
                    isProviderDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isProviderDropdownOpen && (
                <div className="absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_20px_40px_rgba(15,23,42,0.12)] dark:border-white/10 dark:bg-slate-950">
                  <div className="custom-scrollbar max-h-80 overflow-auto p-2">
                    <ProviderBucket
                      title="云端模型"
                      providers={cloudProviders}
                      selectedProviderId={selectedProviderId}
                      onSelectProvider={onSelectProvider}
                    />
                    <ProviderBucket
                      title="本地模型"
                      providers={localProviders}
                      selectedProviderId={selectedProviderId}
                      onSelectProvider={onSelectProvider}
                    />
                  </div>
                </div>
              )}
            </div>
          </label>

          {selectedProvider && (
            <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-[0_14px_32px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-slate-950 dark:shadow-none">
              <div className="flex items-start gap-3">
                <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-300">
                  <Cpu size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800 dark:text-gray-100">{selectedProvider.displayName}</span>
                    <Badge variant={selectedProvider.mode === 'cloud' ? 'blue' : 'purple'}>{providerTypeLabel[selectedProvider.mode]}</Badge>
                    {selectedProvider.enabled ? <Badge variant="green">已启用</Badge> : <Badge variant="outline">未启用</Badge>}
                    {selectedProviderTestResult?.kind === 'success' && <Badge variant="blue">连通成功</Badge>}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-gray-400">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        selectedProvider.enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-gray-600'
                      }`}
                    />
                    <span>{selectedProvider.enabled ? '当前已加入 AI 生成功能，可再单独做连通性测试' : '当前不会参与 AI 生成功能'}</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 px-3 py-3 dark:bg-white/[0.04]">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400 dark:text-gray-500">模型</div>
                  <div className="mt-1 truncate text-sm text-slate-700 dark:text-gray-200">{selectedProvider.model || '未设置'}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 px-3 py-3 dark:bg-white/[0.04]">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400 dark:text-gray-500">协议</div>
                  <div className="mt-1 truncate text-sm text-slate-700 dark:text-gray-200">{selectedProvider.protocol}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 px-3 py-3 dark:bg-white/[0.04]">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400 dark:text-gray-500">Token</div>
                  <div className="mt-1 truncate text-sm text-slate-700 dark:text-gray-200">{maskApiKey(selectedProvider.apiKey)}</div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              onClick={() => onAddProvider('cloud')}
              className="inline-flex items-center justify-center gap-1 rounded-lg border border-cyan-500/30 px-3 py-2 text-sm font-medium text-cyan-600 hover:bg-cyan-500/10 dark:text-cyan-300"
            >
              <Plus size={14} />
              新增云端模型
            </button>
            <button
              onClick={() => onAddProvider('local')}
              className="inline-flex items-center justify-center gap-1 rounded-lg border border-cyan-500/30 px-3 py-2 text-sm font-medium text-cyan-600 hover:bg-cyan-500/10 dark:text-cyan-300"
            >
              <Plus size={14} />
              新增本地模型
            </button>
          </div>
        </div>
      </GlassCard>
    </>
  );
}
