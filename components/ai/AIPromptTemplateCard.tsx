import React from 'react';

import { Copy, Loader2, Save, Sparkles } from 'lucide-react';

import { AIPromptTemplateKey, ModelProviderConfig } from '../../types';
import {
  promptTemplateTabs,
  promptTemplateVariableHints,
  SELECT_CLASS_NAME,
} from './config';
import GlassCard from '../ui/GlassCard';

type AIPromptTemplateCardProps = {
  selectedPromptTemplateKey: AIPromptTemplateKey;
  selectedPromptTemplate: string;
  selectedProvider: ModelProviderConfig | null;
  generatingStockObservation: boolean;
  stockObservationSymbol: string;
  onPromptTemplateSelect: (key: AIPromptTemplateKey) => void;
  onCopyTemplate: () => void;
  onResetTemplate: () => void;
  onSaveTemplate: () => void;
  onPromptTemplateChange: (key: AIPromptTemplateKey, value: string) => void;
  onStockObservationSymbolChange: (value: string) => void;
  onGenerateStockObservation: () => void;
};

export default function AIPromptTemplateCard({
  selectedPromptTemplateKey,
  selectedPromptTemplate,
  selectedProvider,
  generatingStockObservation,
  stockObservationSymbol,
  onPromptTemplateSelect,
  onCopyTemplate,
  onResetTemplate,
  onSaveTemplate,
  onPromptTemplateChange,
  onStockObservationSymbolChange,
  onGenerateStockObservation,
}: AIPromptTemplateCardProps) {
  const selectedPromptMeta = promptTemplateTabs.find((item) => item.key === selectedPromptTemplateKey);

  return (
    <GlassCard
      title="提示词模板"
      action={
        <div className="flex items-center gap-2">
          <button
            onClick={onCopyTemplate}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:border-cyan-500/40 dark:border-white/10"
          >
            <Copy size={14} />
            复制模板
          </button>
          <button
            onClick={onResetTemplate}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:border-cyan-500/40 dark:border-white/10"
          >
            恢复默认
          </button>
          <button
            onClick={onSaveTemplate}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-500"
          >
            <Save size={14} />
            保存模板
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {promptTemplateTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => onPromptTemplateSelect(tab.key)}
              className={`rounded-full px-3 py-1.5 text-sm transition ${
                selectedPromptTemplateKey === tab.key
                  ? 'bg-cyan-600 text-white'
                  : 'border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="rounded-xl border border-slate-200/70 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
          <p className="text-sm font-medium text-slate-800 dark:text-gray-100">
            {selectedPromptMeta?.label}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-gray-400">
            {selectedPromptMeta?.hint}
          </p>
          <p className="mt-2 text-xs text-slate-400 dark:text-gray-500">
            这里改完后，研报摘要、AI 当日复盘、盘前计划都会直接使用你的模板。
          </p>
          <div className="mt-3 rounded-xl border border-cyan-200/70 bg-cyan-50/80 px-3 py-2 text-xs leading-6 text-cyan-800 dark:border-cyan-500/20 dark:bg-cyan-500/10 dark:text-cyan-100">
            <div>提示：<code>{'{{...}}'}</code> 变量会在调用模型时自动替换成当前数据，不需要手动改成真实日期或正文。</div>
            <div className="mt-1 break-all text-cyan-700 dark:text-cyan-200">
              可用变量：{promptTemplateVariableHints[selectedPromptTemplateKey]}
            </div>
          </div>
        </div>
        {selectedPromptTemplateKey === 'stockObservation' && (
          <div className="rounded-xl border border-sky-200/70 bg-sky-50/80 p-4 dark:border-sky-500/20 dark:bg-sky-500/10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-800 dark:text-gray-100">个股观察快捷生成</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-gray-400">
                  在这里直接输入股票代码，就能用当前模板生成个股观察。
                </div>
              </div>
              <button
                onClick={onGenerateStockObservation}
                disabled={!selectedProvider || generatingStockObservation || !stockObservationSymbol.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {generatingStockObservation ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                生成个股观察
              </button>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[180px_minmax(0,1fr)]">
              <input
                value={stockObservationSymbol}
                onChange={(event) => onStockObservationSymbolChange(event.target.value.trim())}
                placeholder="例如 600519"
                className={SELECT_CLASS_NAME}
              />
              <div className="rounded-xl border border-sky-200/70 bg-white/70 px-4 py-3 text-sm text-slate-500 dark:border-sky-500/20 dark:bg-white/5 dark:text-gray-400">
                支持主板 / 创业板 / 科创板代码。生成结果仍会显示在下方“个股观察”卡片里。
              </div>
            </div>
          </div>
        )}
        <textarea
          value={selectedPromptTemplate}
          onChange={(event) => onPromptTemplateChange(selectedPromptTemplateKey, event.target.value)}
          rows={16}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm leading-7 text-slate-800 outline-none transition focus:border-cyan-500 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100"
        />
      </div>
    </GlassCard>
  );
}
