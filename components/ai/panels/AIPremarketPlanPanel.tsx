import React from 'react';

import { Copy, Download, Loader2, Pencil, Plus, Save, Sparkles, Telescope, X } from 'lucide-react';

import { AIPremarketPlanEntry } from '../../../services/aiDailyReviewService';
import { renderStructuredDocument, SELECT_CLASS_NAME } from '../config';
import Badge from '../../ui/Badge';
import GlassCard from '../../ui/GlassCard';

type AIPremarketPlanPanelProps = {
  canGenerate: boolean;
  generating: boolean;
  error: string;
  history: AIPremarketPlanEntry[];
  selectedHistoryId: string;
  plan: AIPremarketPlanEntry | null;
  editing: boolean;
  draft: string;
  editError: string;
  observedSymbols: string[];
  documentActionMessage?: string;
  onGenerate: () => void;
  onHistorySelect: (id: string) => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDraftChange: (value: string) => void;
  onCopy: () => void;
  onExport: () => void;
  onAddObservedSymbols: () => void;
  onOpenStockObservation: (symbol: string) => void;
};

export default function AIPremarketPlanPanel({
  canGenerate,
  generating,
  error,
  history,
  selectedHistoryId,
  plan,
  editing,
  draft,
  editError,
  observedSymbols,
  documentActionMessage,
  onGenerate,
  onHistorySelect,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDraftChange,
  onCopy,
  onExport,
  onAddObservedSymbols,
  onOpenStockObservation,
}: AIPremarketPlanPanelProps) {
  return (
    <GlassCard
      title="盘前计划"
      action={
        <button
          onClick={onGenerate}
          disabled={!canGenerate || generating}
          className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-white hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          生成次日观察清单
        </button>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200/70 bg-white/70 p-4 text-sm leading-6 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
          盘前计划基于最近交易日复盘自动生成，输出的是下一交易日的观察清单和交易预案，不是重复写一遍盘后总结。
        </div>

        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm leading-6 text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}

        {history.length > 0 && (
          <select
            value={selectedHistoryId}
            onChange={(event) => onHistorySelect(event.target.value)}
            className={SELECT_CLASS_NAME}
          >
            {history.map((item) => (
              <option key={item.id} value={item.id}>
                {item.targetTradingDate} · 来源 {item.sourceAnalysisDate} · {new Date(item.generatedAt).toLocaleString()}
              </option>
            ))}
          </select>
        )}

        {plan && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="purple">{plan.providerName}</Badge>
                <Badge variant="outline">来源复盘 {plan.sourceAnalysisDate}</Badge>
                <Badge variant="outline">目标交易日 {plan.targetTradingDate}</Badge>
                <span className="text-xs text-slate-500 dark:text-gray-400">
                  生成于 {new Date(plan.generatedAt).toLocaleString()}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {!editing ? (
                  <button
                    onClick={onStartEdit}
                    className="inline-flex items-center gap-2 rounded-lg border border-amber-300/70 px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-100/80 dark:border-amber-500/30 dark:text-amber-200 dark:hover:bg-amber-500/10"
                  >
                    <Pencil size={14} />
                    编辑 MD
                  </button>
                ) : (
                  <>
                    <button
                      onClick={onSaveEdit}
                      className="inline-flex items-center gap-2 rounded-lg border border-emerald-300/60 px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-100/80 dark:border-emerald-500/30 dark:text-emerald-200 dark:hover:bg-emerald-500/10"
                    >
                      <Save size={14} />
                      保存修改
                    </button>
                    <button
                      onClick={onCancelEdit}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300/60 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100/80 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
                    >
                      <X size={14} />
                      取消
                    </button>
                  </>
                )}
                <button
                  onClick={onCopy}
                  className="inline-flex items-center gap-2 rounded-lg border border-amber-300/70 px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-100/80 dark:border-amber-500/30 dark:text-amber-200 dark:hover:bg-amber-500/10"
                >
                  <Copy size={14} />
                  一键复制
                </button>
                <button
                  onClick={onExport}
                  className="inline-flex items-center gap-2 rounded-lg border border-amber-300/70 px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-100/80 dark:border-amber-500/30 dark:text-amber-200 dark:hover:bg-amber-500/10"
                >
                  <Download size={14} />
                  下载 MD
                </button>
              </div>
            </div>
            {documentActionMessage && (
              <div className="mt-3 text-xs font-medium text-amber-700 dark:text-amber-200">
                {documentActionMessage}
              </div>
            )}
            {editError && (
              <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-medium text-rose-700 dark:text-rose-300">
                {editError}
              </div>
            )}
            {observedSymbols.length > 0 && (
              <div className="mt-4 rounded-xl border border-amber-300/50 bg-white/60 p-4 dark:border-amber-500/20 dark:bg-white/5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-gray-100">
                    <Telescope size={16} />
                    观察标的
                  </div>
                  <button
                    onClick={onAddObservedSymbols}
                    className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-3 py-2 text-xs font-medium text-white hover:bg-amber-400"
                  >
                    <Plus size={14} />
                    一键加入自选 / 重点关注
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {observedSymbols.map((symbol) => (
                    <button
                      key={symbol}
                      onClick={() => onOpenStockObservation(symbol)}
                      className="inline-flex items-center gap-2 rounded-full border border-amber-300/60 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100/80 dark:border-amber-500/30 dark:text-amber-200 dark:hover:bg-amber-500/10"
                    >
                      <Sparkles size={12} />
                      {symbol}
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-xs leading-6 text-slate-500 dark:text-gray-400">
                  如果检测到登录 token，会写入后端自选；否则会落到本地重点关注列表。
                </p>
              </div>
            )}
            {editing ? (
              <div className="mt-4 rounded-xl border border-amber-400/20 bg-white/40 p-4 dark:bg-white/[0.03]">
                <textarea
                  value={draft}
                  onChange={(event) => onDraftChange(event.target.value)}
                  className="min-h-[420px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-mono text-sm leading-7 text-slate-800 outline-none transition focus:border-amber-500 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100"
                  spellCheck={false}
                />
              </div>
            ) : (
              renderStructuredDocument(plan.content, 'amber')
            )}
          </div>
        )}

        {!plan && !error && (
          <div className="rounded-xl border border-dashed border-slate-200/70 p-6 text-sm text-slate-500 dark:border-white/10 dark:text-gray-400">
            点击右上角按钮后，会基于最近交易日复盘生成下一交易日的重点观察清单、交易预案和风险提醒。
          </div>
        )}
      </div>
    </GlassCard>
  );
}
