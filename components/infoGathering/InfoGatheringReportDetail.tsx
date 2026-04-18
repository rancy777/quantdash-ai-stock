import type { ReactNode } from 'react';
import { Loader2, Sparkles } from 'lucide-react';

import type { ModelProviderConfig, ReportAISummaryEntry, ResearchReportFile } from '../../types';
import Badge from '../ui/Badge';
import { getReportFormatMeta } from './meta';

type InfoGatheringReportDetailProps = {
  generatingReportSummary: boolean;
  onDeleteUploadedReport: () => void;
  onGenerateReportAISummary: () => void;
  onSelectedSummaryProviderIdChange: (providerId: string) => void;
  onToggleReportAISummary: () => void;
  preview: ReactNode;
  reportAISummary: ReportAISummaryEntry | null;
  reportAISummaryError: string;
  selectedReport: ResearchReportFile | null;
  selectedSummaryProviderId: string;
  showReportAISummary: boolean;
  summaryProviders: ModelProviderConfig[];
};

const InfoGatheringReportDetail = ({
  generatingReportSummary,
  onDeleteUploadedReport,
  onGenerateReportAISummary,
  onSelectedSummaryProviderIdChange,
  onToggleReportAISummary,
  preview,
  reportAISummary,
  reportAISummaryError,
  selectedReport,
  selectedSummaryProviderId,
  showReportAISummary,
  summaryProviders,
}: InfoGatheringReportDetailProps) => {
  const showSummaryPanel = showReportAISummary || Boolean(reportAISummaryError) || generatingReportSummary;

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="mb-3 pb-4 border-b border-slate-200/80 dark:border-white/10">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            {selectedReport && (() => {
              const formatMeta = getReportFormatMeta(selectedReport);
              const FormatIcon = formatMeta.icon;
              return (
                <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs text-slate-600 dark:bg-white/5 dark:text-gray-300">
                  <FormatIcon size={13} className={formatMeta.iconClassName} />
                  <span>{formatMeta.label}</span>
                </div>
              );
            })()}
            <h2 className="text-[22px] font-semibold text-slate-900 dark:text-white leading-snug break-all tracking-tight">
              {selectedReport?.title ?? selectedReport?.name ?? '暂无研报'}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-gray-400">
              {selectedReport?.sourceLabel && <span>{selectedReport.sourceLabel}</span>}
              {selectedReport?.orgName && <span>{selectedReport.orgName}</span>}
              {selectedReport?.rating && <span>{selectedReport.rating}</span>}
              {selectedReport?.stockCode && <span>{selectedReport.stockCode}{selectedReport.stockName ? ` · ${selectedReport.stockName}` : ''}</span>}
              <span>{new Date(selectedReport?.publishedAt ?? selectedReport?.updatedAt ?? '').toLocaleDateString('zh-CN')}</span>
            </div>
            {selectedReport?.summary && (
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-gray-400 line-clamp-1">
                {selectedReport.summary}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            {summaryProviders.length > 0 && (
              <button
                onClick={reportAISummary ? onToggleReportAISummary : onGenerateReportAISummary}
                disabled={generatingReportSummary}
                className="px-3 py-2 rounded-full border border-violet-200 text-violet-700 text-sm hover:bg-violet-50 transition-colors whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed dark:border-violet-500/20 dark:text-violet-300 dark:hover:bg-violet-500/10"
              >
                {generatingReportSummary ? '生成中' : reportAISummary ? (showReportAISummary ? '收起摘要' : 'AI 摘要') : 'AI 摘要'}
              </button>
            )}
            {selectedReport?.originUrl && selectedReport.sourceType !== 'upload' && (
              <a
                href={selectedReport.originUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 rounded-full border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition-colors whitespace-nowrap dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
              >
                来源
              </a>
            )}
            {selectedReport?.pdfLocalUrl && (
              <a
                href={selectedReport.pdfLocalUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 rounded-full border border-cyan-200 text-cyan-600 text-sm hover:bg-cyan-50 transition-colors whitespace-nowrap dark:border-cyan-500/20 dark:text-cyan-300 dark:hover:bg-cyan-500/10"
              >
                新开 PDF
              </a>
            )}
            {selectedReport?.sourceType === 'upload' && (
              <button
                onClick={onDeleteUploadedReport}
                className="px-3 py-2 rounded-full border border-rose-200 text-rose-500 text-sm hover:bg-rose-50 transition-colors whitespace-nowrap"
              >
                删除
              </button>
            )}
          </div>
        </div>
      </div>
      <div className={`flex-1 min-h-0 grid gap-4 ${showSummaryPanel ? 'xl:grid-cols-[minmax(0,1fr)_340px]' : 'grid-cols-1'}`}>
        <div className="min-h-0">
          {preview}
        </div>
        {showSummaryPanel && (
          <div className="min-h-0 rounded-2xl border border-violet-200/30 bg-violet-50/40 p-4 dark:border-violet-500/20 dark:bg-violet-500/10 overflow-auto custom-scrollbar">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 text-sm font-medium text-violet-700 dark:text-violet-300">
                <Sparkles size={14} />
                AI 研报摘要
              </div>
              {summaryProviders.length > 0 && (
                <select
                  value={selectedSummaryProviderId}
                  onChange={(event) => onSelectedSummaryProviderIdChange(event.target.value)}
                  className="rounded-full border border-violet-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition-colors hover:border-violet-300 dark:border-violet-500/20 dark:bg-slate-900 dark:text-slate-100"
                >
                  {summaryProviders.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.displayName}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {reportAISummary && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge variant="purple">{reportAISummary.providerName}</Badge>
                <Badge variant="outline">{reportAISummary.contentMode === 'fulltext' ? '基于正文' : '基于元数据'}</Badge>
              </div>
            )}

            {generatingReportSummary && (
              <div className="mt-4 inline-flex items-center gap-2 text-sm text-violet-700 dark:text-violet-300">
                <Loader2 size={14} className="animate-spin" />
                正在生成摘要...
              </div>
            )}

            {reportAISummaryError && (
              <p className="mt-4 text-sm leading-6 text-rose-600 dark:text-rose-300">{reportAISummaryError}</p>
            )}

            {reportAISummary && showReportAISummary && (
              <div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700 dark:text-gray-200">
                {reportAISummary.summary}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default InfoGatheringReportDetail;
