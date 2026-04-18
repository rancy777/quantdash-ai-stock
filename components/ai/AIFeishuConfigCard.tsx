import React from 'react';

import { Loader2, PlugZap, Save } from 'lucide-react';

import { FeishuBotConfig, FeishuBotConfigTestResult } from '../../types';
import GlassCard from '../ui/GlassCard';

type AIFeishuConfigCardProps = {
  feishuLoading: boolean;
  feishuSaving: boolean;
  feishuTesting: boolean;
  feishuFeedback: string;
  feishuError: string;
  feishuConfig: FeishuBotConfig;
  feishuTestResult: FeishuBotConfigTestResult | null;
  onUpdateFeishuConfig: (key: keyof FeishuBotConfig, value: string) => void;
  onSaveFeishuConfig: () => void;
  onTestFeishuConfig: () => void;
};

export default function AIFeishuConfigCard({
  feishuLoading,
  feishuSaving,
  feishuTesting,
  feishuFeedback,
  feishuError,
  feishuConfig,
  feishuTestResult,
  onUpdateFeishuConfig,
  onSaveFeishuConfig,
  onTestFeishuConfig,
}: AIFeishuConfigCardProps) {
  return (
    <GlassCard
      title="飞书机器人"
      action={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            onClick={onTestFeishuConfig}
            disabled={feishuLoading || feishuTesting}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 px-3 py-2 text-sm font-medium text-emerald-600 hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60 dark:text-emerald-300"
          >
            {feishuTesting ? <Loader2 size={16} className="animate-spin" /> : <PlugZap size={16} />}
            测试参数
          </button>
          <button
            onClick={onSaveFeishuConfig}
            disabled={feishuLoading || feishuSaving}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {feishuSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            保存到环境
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200/70 bg-white/70 p-4 text-sm leading-6 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
          这里配置的是飞书问答机器人使用的本地环境参数，保存后会写入项目根目录 `.env.local`。当前只做参数管理和联通性测试，启动命令仍是 `npm run feishu:bot`。
        </div>

        {feishuFeedback && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">
            {feishuFeedback}
          </div>
        )}

        {feishuError && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300">
            {feishuError}
          </div>
        )}

        {feishuTestResult && (
          <div
            className={`rounded-xl border p-4 text-sm ${
              feishuTestResult.kind === 'success'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : feishuTestResult.kind === 'warning'
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                  : 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
            }`}
          >
            <div className="font-medium">{feishuTestResult.statusLabel}</div>
            <div className="mt-1 leading-6">{feishuTestResult.detail}</div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700 dark:text-gray-300">FEISHU_APP_ID</span>
            <input
              value={feishuConfig.appId}
              onChange={(event) => onUpdateFeishuConfig('appId', event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-cyan-500 dark:border-white/10 dark:bg-white/5"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700 dark:text-gray-300">FEISHU_APP_SECRET</span>
            <input
              type="password"
              value={feishuConfig.appSecret}
              onChange={(event) => onUpdateFeishuConfig('appSecret', event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-cyan-500 dark:border-white/10 dark:bg-white/5"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700 dark:text-gray-300">FEISHU_BOT_VERIFICATION_TOKEN</span>
            <input
              value={feishuConfig.verificationToken}
              onChange={(event) => onUpdateFeishuConfig('verificationToken', event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-cyan-500 dark:border-white/10 dark:bg-white/5"
            />
          </label>
          <div className="rounded-xl border border-slate-200/70 bg-white/70 px-4 py-3 text-sm leading-6 text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-400">
            当前飞书脚本默认跑长连接模式，这个 token 主要用于兼容事件配置和后续回调场景。
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700 dark:text-gray-300">FEISHU_BOT_AI_BASE_URL</span>
            <input
              value={feishuConfig.aiBaseUrl}
              onChange={(event) => onUpdateFeishuConfig('aiBaseUrl', event.target.value)}
              placeholder="例如 https://api.openai.com/v1"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-cyan-500 dark:border-white/10 dark:bg-white/5"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700 dark:text-gray-300">FEISHU_BOT_AI_API_KEY</span>
            <input
              type="password"
              value={feishuConfig.aiApiKey}
              onChange={(event) => onUpdateFeishuConfig('aiApiKey', event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-cyan-500 dark:border-white/10 dark:bg-white/5"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700 dark:text-gray-300">FEISHU_BOT_AI_MODEL</span>
            <input
              value={feishuConfig.aiModel}
              onChange={(event) => onUpdateFeishuConfig('aiModel', event.target.value)}
              placeholder="例如 gpt-5.4"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-cyan-500 dark:border-white/10 dark:bg-white/5"
            />
          </label>
        </div>
      </div>
    </GlassCard>
  );
}
