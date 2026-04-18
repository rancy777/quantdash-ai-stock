import React from 'react';

import { Copy, Download, Loader2, Pencil, Plus, Save, Sparkles, Telescope, X } from 'lucide-react';

import { AIStockObservationEntry } from '../../../services/aiDailyReviewService';
import { Stock } from '../../../types';
import { renderStructuredDocument, SELECT_CLASS_NAME } from '../config';
import Badge from '../../ui/Badge';
import GlassCard from '../../ui/GlassCard';

type AIStockObservationPanelProps = {
  containerRef?: React.RefObject<HTMLDivElement | null>;
  canGenerate: boolean;
  generating: boolean;
  symbol: string;
  error: string;
  history: AIStockObservationEntry[];
  selectedHistoryId: string;
  observation: AIStockObservationEntry | null;
  editing: boolean;
  draft: string;
  editError: string;
  documentActionMessage?: string;
  focusListItems: Stock[];
  focusListMode: 'remote' | 'local';
  focusListLoading: boolean;
  onGenerate: () => void;
  onSymbolChange: (value: string) => void;
  onHistorySelect: (id: string) => void;
  onRefreshFocusList: () => void;
  onOpenSavedStockObservation: (symbol: string, sourceLabel: string) => void;
  onAddToFocusList: () => void;
  onOpenStockDetail: (symbol: string) => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDraftChange: (value: string) => void;
  onCopy: () => void;
  onExport: () => void;
};

export default function AIStockObservationPanel({
  containerRef,
  canGenerate,
  generating,
  symbol,
  error,
  history,
  selectedHistoryId,
  observation,
  editing,
  draft,
  editError,
  documentActionMessage,
  focusListItems,
  focusListMode,
  focusListLoading,
  onGenerate,
  onSymbolChange,
  onHistorySelect,
  onRefreshFocusList,
  onOpenSavedStockObservation,
  onAddToFocusList,
  onOpenStockDetail,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDraftChange,
  onCopy,
  onExport,
}: AIStockObservationPanelProps) {
  return (
    <div ref={containerRef}>
      <GlassCard
        title="个股观察"
        action={
          <button
            onClick={onGenerate}
            disabled={!canGenerate || generating || !symbol.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            生成个股观察
          </button>
        }
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200/70 bg-white/70 p-4 text-sm leading-6 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
            输入股票代码后，AI 会结合个股、板块、龙头、情绪和近 5 日 K 线，给出位置判断、观察重点和失效条件。
          </div>

          <div className="rounded-xl border border-slate-200/70 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-800 dark:text-gray-100">
                  {focusListMode === 'remote' ? '自选列表快捷观察' : '本地重点关注快捷观察'}
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-gray-400">
                  已保存的跟踪票可以直接触发 AI 个股观察，不需要重复输入代码。
                </div>
              </div>
              <button
                onClick={onRefreshFocusList}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs hover:border-sky-500/40 dark:border-white/10"
              >
                刷新列表
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {focusListItems.map((item) => (
                <button
                  key={item.symbol}
                  onClick={() => onOpenSavedStockObservation(item.symbol, focusListMode === 'remote' ? '自选列表' : '重点关注列表')}
                  className="inline-flex items-center gap-2 rounded-full border border-sky-300/60 px-3 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-100/80 dark:border-sky-500/30 dark:text-sky-200 dark:hover:bg-sky-500/10"
                >
                  <Sparkles size={12} />
                  <span>{item.name}</span>
                  <span className="font-mono opacity-80">{item.symbol}</span>
                </button>
              ))}
            </div>
            {!focusListLoading && focusListItems.length === 0 && (
              <div className="mt-4 rounded-xl border border-dashed border-slate-200/70 p-4 text-xs text-slate-500 dark:border-white/10 dark:text-gray-400">
                这里还没有已保存的自选 / 重点关注。你可以先从盘前计划里一键加入，或者在悬浮卡里手动加票。
              </div>
            )}
            {focusListLoading && (
              <div className="mt-4 text-xs text-slate-500 dark:text-gray-400">
                正在读取自选 / 重点关注列表...
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-[180px_minmax(0,1fr)]">
            <input
              value={symbol}
              onChange={(event) => onSymbolChange(event.target.value.trim())}
              placeholder="例如 600519"
              className={SELECT_CLASS_NAME}
            />
            <div className="rounded-xl border border-slate-200/70 bg-white/70 px-4 py-3 text-sm text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-400">
              支持主板 / 创业板 / 科创板代码。建议优先输入你盘前计划或自选池里正在跟踪的票。
            </div>
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
                  {item.analysisDate} · {item.name}({item.symbol}) · {new Date(item.generatedAt).toLocaleString()}
                </option>
              ))}
            </select>
          )}

          {observation && (
            <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="purple">{observation.providerName}</Badge>
                  <Badge variant="outline">{observation.name} {observation.symbol}</Badge>
                  <Badge variant="outline">最近交易日 {observation.analysisDate}</Badge>
                  <span className="text-xs text-slate-500 dark:text-gray-400">
                    生成于 {new Date(observation.generatedAt).toLocaleString()}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={onAddToFocusList}
                    className="inline-flex items-center gap-2 rounded-lg border border-emerald-300/70 px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-100/80 dark:border-emerald-500/30 dark:text-emerald-200 dark:hover:bg-emerald-500/10"
                  >
                    <Plus size={14} />
                    加入自选 / 重点关注
                  </button>
                  <button
                    onClick={() => onOpenStockDetail(observation.symbol)}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300/70 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100/80 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5"
                  >
                    <Telescope size={14} />
                    去股票信息页
                  </button>
                  {!editing ? (
                    <button
                      onClick={onStartEdit}
                      className="inline-flex items-center gap-2 rounded-lg border border-sky-300/70 px-3 py-2 text-xs font-medium text-sky-700 hover:bg-sky-100/80 dark:border-sky-500/30 dark:text-sky-200 dark:hover:bg-sky-500/10"
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
                    className="inline-flex items-center gap-2 rounded-lg border border-sky-300/70 px-3 py-2 text-xs font-medium text-sky-700 hover:bg-sky-100/80 dark:border-sky-500/30 dark:text-sky-200 dark:hover:bg-sky-500/10"
                  >
                    <Copy size={14} />
                    一键复制
                  </button>
                  <button
                    onClick={onExport}
                    className="inline-flex items-center gap-2 rounded-lg border border-sky-300/70 px-3 py-2 text-xs font-medium text-sky-700 hover:bg-sky-100/80 dark:border-sky-500/30 dark:text-sky-200 dark:hover:bg-sky-500/10"
                  >
                    <Download size={14} />
                    下载 MD
                  </button>
                </div>
              </div>
              {documentActionMessage && (
                <div className="mt-3 text-xs font-medium text-sky-700 dark:text-sky-200">
                  {documentActionMessage}
                </div>
              )}
              {editError && (
                <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-medium text-rose-700 dark:text-rose-300">
                  {editError}
                </div>
              )}
              <div className="mt-4 rounded-xl border border-sky-300/40 bg-white/60 p-4 dark:border-sky-500/20 dark:bg-white/5">
                <div className="text-sm font-semibold text-slate-800 dark:text-gray-100">个股观察依据</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="outline">{observation.context.focusListStatus}</Badge>
                  <Badge variant="outline">{observation.context.planTrackingStatus}</Badge>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
                  <div className="rounded-xl border border-slate-200/70 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-gray-400">相关资讯</div>
                    <div className="mt-2 space-y-2 text-xs leading-6 text-slate-600 dark:text-gray-300">
                      {observation.context.relatedNews.map((item, index) => (
                        <div key={`${item}-${index}`}>{item}</div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200/70 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-gray-400">相关研报</div>
                    <div className="mt-2 space-y-2 text-xs leading-6 text-slate-600 dark:text-gray-300">
                      {observation.context.relatedReports.map((item, index) => (
                        <div key={`${item}-${index}`}>{item}</div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200/70 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-gray-400">已有 AI 研报观点</div>
                    <div className="mt-2 space-y-2 text-xs leading-6 text-slate-600 dark:text-gray-300">
                      {observation.context.cachedReportSummaries.map((item, index) => (
                        <div key={`${item}-${index}`}>{item}</div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              {editing ? (
                <div className="mt-4 rounded-xl border border-sky-400/20 bg-white/40 p-4 dark:bg-white/[0.03]">
                  <textarea
                    value={draft}
                    onChange={(event) => onDraftChange(event.target.value)}
                    className="min-h-[420px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-mono text-sm leading-7 text-slate-800 outline-none transition focus:border-sky-500 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100"
                    spellCheck={false}
                  />
                </div>
              ) : (
                renderStructuredDocument(observation.content, 'cyan')
              )}
            </div>
          )}

          {!observation && !error && (
            <div className="rounded-xl border border-dashed border-slate-200/70 p-6 text-sm text-slate-500 dark:border-white/10 dark:text-gray-400">
              输入股票代码后生成个股观察，适合辅助你判断一只票当前处于启动、加速、分歧、修复还是退潮阶段。
            </div>
          )}
        </div>
      </GlassCard>
    </div>
  );
}
