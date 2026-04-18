import React from 'react';

import { Cpu, PlugZap, Sparkles } from 'lucide-react';

type IntegrationTab = 'models' | 'ai' | 'feishu';

type AIWorkspaceHeaderProps = {
  activeTab: IntegrationTab;
  configuredProvidersCount: number;
  selectedProviderLabel?: string | null;
  feishuStatusLabel?: string | null;
  onTabChange: (tab: IntegrationTab) => void;
};

export default function AIWorkspaceHeader({
  activeTab,
  configuredProvidersCount,
  selectedProviderLabel,
  feishuStatusLabel,
  onTabChange,
}: AIWorkspaceHeaderProps) {
  const activeTabMeta = {
    models: {
      title: '模型对接',
      description: '管理云端和本地模型线路、默认模型、接口连通性与本地接入策略。',
      badge: `${configuredProvidersCount} 条可用配置`,
      icon: <Cpu size={16} />,
    },
    ai: {
      title: '提示词模板 / AI复盘',
      description: '维护提示词模板，并直接生成复盘、盘前计划、个股观察和次日校验。',
      badge: selectedProviderLabel ?? '未选择模型',
      icon: <Sparkles size={16} />,
    },
    feishu: {
      title: '飞书对接',
      description: '配置飞书机器人参数、AI 调用线路，并在写入环境前完成联通性测试。',
      badge: feishuStatusLabel ?? '待测试',
      icon: <PlugZap size={16} />,
    },
  }[activeTab];

  return (
    <div className="mb-6 rounded-[28px] border border-slate-200/80 bg-gradient-to-br from-white via-cyan-50/60 to-slate-100/80 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(8,47,73,0.78),rgba(15,23,42,0.92))] dark:shadow-none">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/70 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:border-cyan-500/20 dark:bg-cyan-500/10 dark:text-cyan-200">
            {activeTabMeta.icon}
            当前工作区
          </div>
          <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
            {activeTabMeta.title}
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600 dark:text-gray-300">
            {activeTabMeta.description}
          </p>
        </div>
        <div className="shrink-0 rounded-2xl border border-slate-200/70 bg-white/75 px-4 py-3 text-right dark:border-white/10 dark:bg-white/[0.05]">
          <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-gray-500">状态</div>
          <div className="mt-1 text-sm font-semibold text-slate-800 dark:text-gray-100">{activeTabMeta.badge}</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-3">
        {[
          { key: 'models' as const, label: '模型对接', hint: '模型线路、默认模型、连通性' },
          { key: 'ai' as const, label: '提示词模板 / AI复盘', hint: '模板编辑、复盘与计划输出' },
          { key: 'feishu' as const, label: '飞书对接', hint: '机器人参数、环境保存、测试' },
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`rounded-2xl border px-4 py-3 text-left transition ${
                isActive
                  ? 'border-cyan-300 bg-cyan-600 text-white shadow-[0_14px_28px_rgba(8,145,178,0.25)] dark:border-cyan-400/30 dark:bg-cyan-500/20 dark:shadow-none'
                  : 'border-slate-200/80 bg-white/70 text-slate-700 hover:border-cyan-200 hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-300 dark:hover:border-cyan-500/30 dark:hover:bg-white/[0.06]'
              }`}
            >
              <div className="text-sm font-semibold">{tab.label}</div>
              <div className={`mt-1 text-xs ${isActive ? 'text-cyan-50/90 dark:text-cyan-100/80' : 'text-slate-500 dark:text-gray-400'}`}>
                {tab.hint}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
