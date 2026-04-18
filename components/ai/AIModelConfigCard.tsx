import React from 'react';

import { KeyRound, Loader2, PlugZap, Save, Sparkles } from 'lucide-react';

import { type ProviderConnectionTestResult } from '../../services/modelIntegrationService';
import { ModelProviderConfig } from '../../types';
import { protocolOptions, SELECT_CLASS_NAME } from './config';
import GlassCard from '../ui/GlassCard';

type AIModelConfigCardProps = {
  selectedProvider: ModelProviderConfig | null;
  selectedProviderTestResult?: ProviderConnectionTestResult;
  pingTesting: boolean;
  testing: boolean;
  settingsUpdatedAt: string;
  onPromptPingTest: () => void;
  onConnectionTest: () => void;
  onSaveSettings: () => void;
  onPatchProvider: (providerId: string, changes: Partial<ModelProviderConfig>) => void;
  onSetPreferredProvider: (providerId: string) => void;
  onDeleteProvider: (providerId: string) => void;
};

export default function AIModelConfigCard({
  selectedProvider,
  selectedProviderTestResult,
  pingTesting,
  testing,
  settingsUpdatedAt,
  onPromptPingTest,
  onConnectionTest,
  onSaveSettings,
  onPatchProvider,
  onSetPreferredProvider,
  onDeleteProvider,
}: AIModelConfigCardProps) {
  return (
    <GlassCard
      title="模型配置"
      action={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            onClick={selectedProvider ? onPromptPingTest : undefined}
            disabled={!selectedProvider || pingTesting}
            className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/30 px-3 py-2 text-sm font-medium text-cyan-600 hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-60 dark:text-cyan-300"
          >
            {pingTesting ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            快速测试
          </button>
          <button
            onClick={selectedProvider ? onConnectionTest : undefined}
            disabled={!selectedProvider || testing}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 px-3 py-2 text-sm font-medium text-emerald-600 hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60 dark:text-emerald-300"
          >
            {testing ? <Loader2 size={16} className="animate-spin" /> : <PlugZap size={16} />}
            连通性测试
          </button>
          <button
            onClick={onSaveSettings}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-500"
          >
            <Save size={16} />
            保存配置
          </button>
        </div>
      }
    >
      {!selectedProvider ? (
        <div className="flex min-h-[220px] items-center justify-center text-sm text-slate-500 dark:text-gray-400">
          先新增一条模型线路。
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700 dark:text-gray-300">显示名称</span>
              <input
                value={selectedProvider.displayName}
                onChange={(event) => onPatchProvider(selectedProvider.id, { displayName: event.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-cyan-500 dark:border-white/10 dark:bg-white/5"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700 dark:text-gray-300">模型名</span>
              <input
                value={selectedProvider.model}
                onChange={(event) => onPatchProvider(selectedProvider.id, { model: event.target.value })}
                placeholder="例如 gpt-5.4 / deepseek-reasoner / qwen2.5:14b-instruct"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-cyan-500 dark:border-white/10 dark:bg-white/5"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700 dark:text-gray-300">线路类型</span>
              <select
                value={selectedProvider.mode}
                onChange={(event) => onPatchProvider(selectedProvider.id, { mode: event.target.value as ModelProviderConfig['mode'] })}
                className={SELECT_CLASS_NAME}
              >
                <option value="cloud">云端模型</option>
                <option value="local">本地模型</option>
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700 dark:text-gray-300">协议</span>
              <select
                value={selectedProvider.protocol}
                onChange={(event) => onPatchProvider(selectedProvider.id, { protocol: event.target.value as ModelProviderConfig['protocol'] })}
                className={SELECT_CLASS_NAME}
              >
                {protocolOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700 dark:text-gray-300">启用状态</span>
              <select
                value={selectedProvider.enabled ? 'enabled' : 'disabled'}
                onChange={(event) => onPatchProvider(selectedProvider.id, { enabled: event.target.value === 'enabled' })}
                className={SELECT_CLASS_NAME}
              >
                <option value="enabled">启用</option>
                <option value="disabled">停用</option>
              </select>
            </label>
          </div>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700 dark:text-gray-300">Base URL</span>
            <input
              value={selectedProvider.baseUrl}
              onChange={(event) => onPatchProvider(selectedProvider.id, { baseUrl: event.target.value })}
              placeholder="例如 https://api.openai.com/v1 或 http://127.0.0.1:11434/v1"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-cyan-500 dark:border-white/10 dark:bg-white/5"
            />
          </label>

          <label className="space-y-2">
            <span className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-gray-300">
              <KeyRound size={14} />
              Token / API Key
            </span>
            <input
              type="password"
              value={selectedProvider.apiKey}
              onChange={(event) => onPatchProvider(selectedProvider.id, { apiKey: event.target.value })}
              placeholder={selectedProvider.mode === 'local' ? '本地模型通常可留空' : '填写你的 API Token'}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-cyan-500 dark:border-white/10 dark:bg-white/5"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700 dark:text-gray-300">备注</span>
            <textarea
              value={selectedProvider.notes ?? ''}
              onChange={(event) => onPatchProvider(selectedProvider.id, { notes: event.target.value })}
              rows={3}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-cyan-500 dark:border-white/10 dark:bg-white/5"
            />
          </label>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-gray-400">
            <button
              onClick={() => onSetPreferredProvider(selectedProvider.id)}
              className="rounded-lg border border-slate-200 px-3 py-2 hover:border-cyan-500/40 hover:text-cyan-600 dark:border-white/10 dark:hover:text-cyan-300"
            >
              设为默认分析模型
            </button>
            <button
              onClick={() => onDeleteProvider(selectedProvider.id)}
              className="rounded-lg border border-rose-500/30 px-3 py-2 text-rose-500 hover:bg-rose-500/10"
            >
              删除当前线路
            </button>
            <span>最近保存：{new Date(settingsUpdatedAt).toLocaleString()}</span>
          </div>

          {selectedProviderTestResult && (
            <div
              className={`rounded-xl border p-4 text-sm ${
                selectedProviderTestResult.kind === 'success'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  : selectedProviderTestResult.kind === 'warning'
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                    : 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
              }`}
            >
              <div className="flex items-center gap-2 font-medium">
                <PlugZap size={15} />
                {selectedProviderTestResult.statusLabel}
              </div>
              <p className="mt-2 leading-6">{selectedProviderTestResult.detail}</p>
              <p className="mt-2 text-xs opacity-80">
                最后检测：{new Date(selectedProviderTestResult.checkedAt).toLocaleString()}
              </p>
            </div>
          )}

          {selectedProvider.protocol === 'openai' && selectedProvider.mode === 'cloud' && (
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-sm leading-6 text-slate-700 dark:text-cyan-100">
              <div className="font-medium text-slate-900 dark:text-white">OpenAI 兼容填写参考</div>
              <p className="mt-2">
                如果你用的是硅基流动，Base URL 通常填 `https://api.siliconflow.cn/v1`。
                模型名请以你自己账户里实际可用的名称为准，例如你当前在用的 `Pro/deepseek-ai/DeepSeek-V3.2`。
              </p>
              <p className="mt-2">
                `连通性测试` 只检查接口是否可达；`快速测试` 会真的向当前模型发一个最小 `ping` 请求，更接近实际生成。
              </p>
            </div>
          )}
        </div>
      )}
    </GlassCard>
  );
}
