import React from 'react';

import { Copy, Download, Loader2, Pencil, Save, Sparkles, X } from 'lucide-react';

import { AIUltraShortAnalysisEntry } from '../../../services/aiDailyReviewService';
import { renderStructuredDocument, SELECT_CLASS_NAME } from '../config';
import Badge from '../../ui/Badge';
import GlassCard from '../../ui/GlassCard';

type AIUltraShortAnalysisPanelProps = {
  canGenerate: boolean;
  generating: boolean;
  error: string;
  history: AIUltraShortAnalysisEntry[];
  selectedHistoryId: string;
  analysis: AIUltraShortAnalysisEntry | null;
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

export default function AIUltraShortAnalysisPanel({
  canGenerate,
  generating,
  error,
  history,
  selectedHistoryId,
  analysis,
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
}: AIUltraShortAnalysisPanelProps) {
  return (
    <GlassCard
      title="AI 超短线深度分析"
      action={
        <button
          onClick={onGenerate}
          disabled={!canGenerate || generating}
          className="inline-flex items-center gap-2 rounded-lg bg-fuchsia-600 px-3 py-2 text-sm font-medium text-white hover:bg-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          生成超短分析
        </button>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200/70 bg-white/70 p-4 text-sm leading-6 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
          这份分析更偏 1 到 3 个交易日节奏，重点看情绪强弱、接力环境、龙头溢价、主线持续性和高风险动作。
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

        {analysis && (
          <div className="rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="purple">{analysis.providerName}</Badge>
                <Badge variant="outline">最近交易日 {analysis.analysisDate}</Badge>
                <span className="text-xs text-slate-500 dark:text-gray-400">
                  生成于 {new Date(analysis.generatedAt).toLocaleString()}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {!editing ? (
                  <button
                    onClick={onStartEdit}
                    className="inline-flex items-center gap-2 rounded-lg border border-fuchsia-300/60 px-3 py-2 text-xs font-medium text-fuchsia-700 hover:bg-fuchsia-100/80 dark:border-fuchsia-500/30 dark:text-fuchsia-200 dark:hover:bg-fuchsia-500/10"
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
                  className="inline-flex items-center gap-2 rounded-lg border border-fuchsia-300/60 px-3 py-2 text-xs font-medium text-fuchsia-700 hover:bg-fuchsia-100/80 dark:border-fuchsia-500/30 dark:text-fuchsia-200 dark:hover:bg-fuchsia-500/10"
                >
                  <Copy size={14} />
                  一键复制
                </button>
                <button
                  onClick={onExport}
                  className="inline-flex items-center gap-2 rounded-lg border border-fuchsia-300/60 px-3 py-2 text-xs font-medium text-fuchsia-700 hover:bg-fuchsia-100/80 dark:border-fuchsia-500/30 dark:text-fuchsia-200 dark:hover:bg-fuchsia-500/10"
                >
                  <Download size={14} />
                  下载 MD
                </button>
              </div>
            </div>
            {documentActionMessage && (
              <div className="mt-3 text-xs font-medium text-fuchsia-700 dark:text-fuchsia-200">
                {documentActionMessage}
              </div>
            )}
            {editError && (
              <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-medium text-rose-700 dark:text-rose-300">
                {editError}
              </div>
            )}
            {editing ? (
              <div className="mt-4 rounded-xl border border-fuchsia-400/20 bg-white/40 p-4 dark:bg-white/[0.03]">
                <textarea
                  value={draft}
                  onChange={(event) => onDraftChange(event.target.value)}
                  className="min-h-[420px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-mono text-sm leading-7 text-slate-800 outline-none transition focus:border-fuchsia-500 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100"
                  spellCheck={false}
                />
              </div>
            ) : (
              renderStructuredDocument(analysis.content, 'violet')
            )}
          </div>
        )}

        {!analysis && !error && (
          <div className="rounded-xl border border-dashed border-slate-200/70 p-6 text-sm text-slate-500 dark:border-white/10 dark:text-gray-400">
            点击右上角按钮后，会基于最近交易日的情绪、板块、龙头、新闻和研报生成一份偏超短交易节奏的深度分析。
          </div>
        )}
      </div>
    </GlassCard>
  );
}
