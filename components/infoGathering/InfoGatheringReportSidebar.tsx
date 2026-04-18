import React from 'react';
import { FileSearch, Loader2, Search, SlidersHorizontal, Upload } from 'lucide-react';

import type { ResearchReportFile } from '../../types';
import { getReportFormatMeta } from './meta';
import type { ReportDateRange, ReportFormat, ReportSort, ReportSourceOption } from './types';

type InfoGatheringReportSidebarProps = {
  filteredReports: ResearchReportFile[];
  loadingReports: boolean;
  onClearReportMemory: () => void;
  onRefreshReports: () => void;
  onReportDateRangeChange: (value: ReportDateRange) => void;
  onReportFormatChange: (value: ReportFormat) => void;
  onReportOrgQueryChange: (value: string) => void;
  onReportQueryChange: (value: string) => void;
  onReportRatingQueryChange: (value: string) => void;
  onReportSortChange: (value: ReportSort) => void;
  onReportSourceKeyChange: (value: string) => void;
  onReportStockCodeQueryChange: (value: string) => void;
  onSelectReport: (report: ResearchReportFile) => void;
  onToggleReportFilters: () => void;
  onUploadReports: (event: React.ChangeEvent<HTMLInputElement>) => void;
  reportDateRange: ReportDateRange;
  reportFormat: ReportFormat;
  reportOrgQuery: string;
  reportQuery: string;
  reportRatingQuery: string;
  reportsCount: number;
  reportSort: ReportSort;
  reportSourceKey: string;
  reportSourceOptions: ReportSourceOption[];
  reportStockCodeQuery: string;
  reportUploadInputRef: React.RefObject<HTMLInputElement | null>;
  selectClassName: string;
  selectedReportId?: string | null;
  showReportFilters: boolean;
  uploadingReports: boolean;
};

const InfoGatheringReportSidebar = ({
  filteredReports,
  loadingReports,
  onClearReportMemory,
  onRefreshReports,
  onReportDateRangeChange,
  onReportFormatChange,
  onReportOrgQueryChange,
  onReportQueryChange,
  onReportRatingQueryChange,
  onReportSortChange,
  onReportSourceKeyChange,
  onReportStockCodeQueryChange,
  onSelectReport,
  onToggleReportFilters,
  onUploadReports,
  reportDateRange,
  reportFormat,
  reportOrgQuery,
  reportQuery,
  reportRatingQuery,
  reportsCount,
  reportSort,
  reportSourceKey,
  reportSourceOptions,
  reportStockCodeQuery,
  reportUploadInputRef,
  selectClassName,
  selectedReportId,
  showReportFilters,
  uploadingReports,
}: InfoGatheringReportSidebarProps) => {
  if (loadingReports) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500 dark:text-gray-400 gap-2">
        <Loader2 className="animate-spin" /> 正在加载研报...
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="p-4 pb-3 border-b border-slate-200 dark:border-white/10 space-y-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => reportUploadInputRef.current?.click()}
            className="flex-1 px-3 py-2 rounded-xl bg-cyan-600 text-white text-sm font-medium hover:bg-cyan-500 transition-colors flex items-center justify-center gap-2"
          >
            {uploadingReports ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            上传研报
          </button>
          <button
            onClick={onRefreshReports}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-sm text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
          >
            刷新
          </button>
        </div>
        <input ref={reportUploadInputRef} type="file" multiple onChange={onUploadReports} className="hidden" />
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={reportQuery}
              onChange={(e) => onReportQueryChange(e.target.value)}
              placeholder="搜索标题、机构、代码或文件名"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <button
            onClick={onToggleReportFilters}
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${
              showReportFilters
                ? 'border-cyan-300 bg-cyan-50 text-cyan-700 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-300'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5'
            }`}
          >
            <SlidersHorizontal size={14} />
            筛选
          </button>
        </div>
        <div className="flex items-center justify-between gap-3 text-xs text-slate-400">
          <span>{filteredReports.length} 份结果</span>
          <button
            onClick={onClearReportMemory}
            className="text-slate-500 hover:text-cyan-600 dark:text-gray-400 dark:hover:text-cyan-400"
          >
            清空筛选
          </button>
        </div>
        {showReportFilters && (
          <div className="space-y-2 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="grid grid-cols-1 gap-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <input
                  value={reportStockCodeQuery}
                  onChange={(e) => onReportStockCodeQueryChange(e.target.value)}
                  placeholder="股票代码 / 名称"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
                />
                <input
                  value={reportOrgQuery}
                  onChange={(e) => onReportOrgQueryChange(e.target.value)}
                  placeholder="机构 / 作者"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
                />
                <input
                  value={reportRatingQuery}
                  onChange={(e) => onReportRatingQueryChange(e.target.value)}
                  placeholder="评级"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <select value={reportSourceKey} onChange={(e) => onReportSourceKeyChange(e.target.value)} className={selectClassName}>
                  {reportSourceOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}{option.id === 'all' ? '' : ` (${option.count})`}
                    </option>
                  ))}
                </select>
                <select value={reportFormat} onChange={(e) => onReportFormatChange(e.target.value as ReportFormat)} className={selectClassName}>
                  <option value="all">全部格式</option>
                  <option value="pdf">PDF</option>
                  <option value="image">图片</option>
                  <option value="text">文本</option>
                  <option value="office">Office</option>
                  <option value="other">其他</option>
                </select>
                <select value={reportDateRange} onChange={(e) => onReportDateRangeChange(e.target.value as ReportDateRange)} className={selectClassName}>
                  <option value="all">全部日期</option>
                  <option value="7d">近 7 天</option>
                  <option value="30d">近 30 天</option>
                  <option value="90d">近 90 天</option>
                </select>
                <select value={reportSort} onChange={(e) => onReportSortChange(e.target.value as ReportSort)} className={selectClassName}>
                  <option value="updated_desc">最新优先</option>
                  <option value="updated_asc">最早优先</option>
                  <option value="name_asc">名称排序</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="overflow-y-auto p-2.5 space-y-1 h-full custom-scrollbar">
        {filteredReports.map((item) => {
          const formatMeta = getReportFormatMeta(item);
          const FormatIcon = formatMeta.icon;
          const metaLine = [
            item.orgName,
            item.stockCode ? `${item.stockCode}${item.stockName ? ` · ${item.stockName}` : ''}` : '',
            item.rating,
          ].filter(Boolean).join(' · ');

          return (
            <button
              key={item.id}
              onClick={() => onSelectReport(item)}
              className={`group relative w-full rounded-2xl px-3 py-3 text-left transition-all ${
                selectedReportId === item.id
                  ? 'bg-white shadow-sm ring-1 ring-cyan-500/20 dark:bg-white/[0.08] dark:ring-cyan-400/20'
                  : 'hover:bg-white/70 dark:hover:bg-white/[0.04]'
              }`}
            >
              {selectedReportId === item.id && <span className="absolute left-0 top-3 bottom-3 w-1 rounded-full bg-cyan-500" />}
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${
                  formatMeta.label === 'PDF'
                    ? 'bg-rose-50 ring-1 ring-rose-100 dark:bg-rose-500/10 dark:ring-rose-500/20'
                    : 'bg-slate-100 dark:bg-white/5'
                } ${formatMeta.iconClassName}`}>
                  <FormatIcon size={17} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3 text-[11px] text-slate-400 dark:text-gray-500">
                    <span className="font-mono">
                      {new Date(item.publishedAt ?? item.updatedAt).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}
                    </span>
                    <span className="truncate">{item.sourceLabel ?? '研报'}</span>
                  </div>
                  <h4 className={`mt-1 text-sm leading-6 break-all transition-colors ${
                    selectedReportId === item.id
                      ? 'text-slate-900 dark:text-white'
                      : 'text-slate-700 dark:text-gray-200 group-hover:text-slate-900 dark:group-hover:text-white'
                  }`}>
                    {item.title ?? item.name}
                  </h4>
                  <div className="mt-1 truncate text-xs leading-5 text-slate-500 dark:text-gray-400">
                    {metaLine || item.sizeLabel}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
        {filteredReports.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 py-10 gap-2">
            <FileSearch className="opacity-40" />
            <span>{reportsCount === 0 ? '暂无研报文件' : '没有符合条件的研报'}</span>
            <span className="text-xs">
              {reportsCount === 0
                ? '把文件放进 data/research_reports 后执行 `pnpm run sync:reports`'
                : '可以尝试更换关键词、格式或排序'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default InfoGatheringReportSidebar;
