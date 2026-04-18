import React from 'react';

import { Copy, Download, Loader2, Pencil, Save, Sparkles, X } from 'lucide-react';

import { AIDailyReviewEntry } from '../../../services/aiDailyReviewService';
import { renderStructuredDocument, SELECT_CLASS_NAME } from '../config';
import Badge from '../../ui/Badge';
import GlassCard from '../../ui/GlassCard';

type AIDailyReviewPanelProps = {
  canGenerate: boolean;
  generating: boolean;
  selectedProviderLabel?: string | null;
  error: string;
  history: AIDailyReviewEntry[];
  selectedHistoryId: string;
  review: AIDailyReviewEntry | null;
  editing: boolean;
  draft: string;
  editError: string;
  documentActionMessage?: string;
  onGenerate: () => void;
  onHistorySelect: (id: string) => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDraftChange: (value: string) => void;
  onCopy: () => void;
  onExport: () => void;
};

export default function AIDailyReviewPanel({
  canGenerate,
  generating,
  selectedProviderLabel,
  error,
  history,
  selectedHistoryId,
  review,
  editing,
  draft,
  editError,
  documentActionMessage,
  onGenerate,
  onHistorySelect,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDraftChange,
  onCopy,
  onExport,
}: AIDailyReviewPanelProps) {
  return (
    <GlassCard
      title="AI 当日复盘"
      action={
        <button
          onClick={onGenerate}
          disabled={!canGenerate || generating}
          className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          生成最近交易日复盘
        </button>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200/70 bg-white/70 p-4 text-sm leading-6 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
          这不是单篇研报摘要，而是基于最近交易日的情绪周期、龙头、板块、新闻和研报做一份综合复盘。当前调用模型：
          <span className="ml-2 font-semibold text-slate-800 dark:text-gray-100">
            {selectedProviderLabel ?? '未选择'}
          </span>
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
                {item.analysisDate} · {new Date(item.generatedAt).toLocaleString()}
              </option>
            ))}
          </select>
        )}

        {review && (
          <div className="rounded-xl border border-violet-500/20 bg-violet-500/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="purple">{review.providerName}</Badge>
                <Badge variant="outline">最近交易日 {review.analysisDate}</Badge>
                <span className="text-xs text-slate-500 dark:text-gray-400">
                  生成于 {new Date(review.generatedAt).toLocaleString()}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {!editing ? (
                  <button
                    onClick={onStartEdit}
                    className="inline-flex items-center gap-2 rounded-lg border border-violet-300/60 px-3 py-2 text-xs font-medium text-violet-700 hover:bg-violet-100/80 dark:border-violet-500/30 dark:text-violet-200 dark:hover:bg-violet-500/10"
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
                  className="inline-flex items-center gap-2 rounded-lg border border-violet-300/60 px-3 py-2 text-xs font-medium text-violet-700 hover:bg-violet-100/80 dark:border-violet-500/30 dark:text-violet-200 dark:hover:bg-violet-500/10"
                >
                  <Copy size={14} />
                  一键复制
                </button>
                <button
                  onClick={onExport}
                  className="inline-flex items-center gap-2 rounded-lg border border-violet-300/60 px-3 py-2 text-xs font-medium text-violet-700 hover:bg-violet-100/80 dark:border-violet-500/30 dark:text-violet-200 dark:hover:bg-violet-500/10"
                >
                  <Download size={14} />
                  下载 MD
                </button>
              </div>
            </div>
            {documentActionMessage && (
              <div className="mt-3 text-xs font-medium text-violet-700 dark:text-violet-200">
                {documentActionMessage}
              </div>
            )}
            {editError && (
              <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-medium text-rose-700 dark:text-rose-300">
                {editError}
              </div>
            )}
            {editing ? (
              <div className="mt-4 rounded-xl border border-violet-400/20 bg-white/40 p-4 dark:bg-white/[0.03]">
                <textarea
                  value={draft}
                  onChange={(event) => onDraftChange(event.target.value)}
                  className="min-h-[420px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-mono text-sm leading-7 text-slate-800 outline-none transition focus:border-violet-500 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100"
                  spellCheck={false}
                />
              </div>
            ) : (
              renderStructuredDocument(review.content, 'violet')
            )}
          </div>
        )}

        {!review && !error && (
          <div className="rounded-xl border border-dashed border-slate-200/70 p-6 text-sm text-slate-500 dark:border-white/10 dark:text-gray-400">
            点击右上角按钮后，会按最近交易日生成一份盘后复盘，不会误把周末写成当天盘面。
          </div>
        )}
      </div>
    </GlassCard>
  );
}
