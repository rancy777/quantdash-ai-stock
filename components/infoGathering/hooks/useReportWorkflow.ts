import type { ChangeEvent } from 'react';
import { useEffect, useRef, useState } from 'react';

import { getCachedReportAISummary, generateReportAISummary, getEnabledSummaryProviders } from '../../../services/aiReportSummaryService';
import { removeUploadedResearchReport, saveUploadedResearchReportFiles } from '../../../services/reportUploadService';
import { getResearchReports, loadResearchReportText } from '../../../services/reportService';
import type { ModelProviderConfig, ReportAISummaryEntry, ResearchReportFile } from '../../../types';
import type { ReportDateRange, ReportFormat, ReportSort, ReportSourceOption } from '../types';

const LAST_REPORT_STORAGE_KEY = 'quantdash:last-research-report';

export default function useReportWorkflow() {
  const [reports, setReports] = useState<ResearchReportFile[]>([]);
  const [selectedReport, setSelectedReport] = useState<ResearchReportFile | null>(null);
  const [selectedReportText, setSelectedReportText] = useState<string | null>(null);
  const [loadingReports, setLoadingReports] = useState(true);
  const [loadingReportPreview, setLoadingReportPreview] = useState(false);
  const [uploadingReports, setUploadingReports] = useState(false);
  const [summaryProviders, setSummaryProviders] = useState<ModelProviderConfig[]>([]);
  const [selectedSummaryProviderId, setSelectedSummaryProviderId] = useState<string>('');
  const [reportAISummary, setReportAISummary] = useState<ReportAISummaryEntry | null>(null);
  const [generatingReportSummary, setGeneratingReportSummary] = useState(false);
  const [reportAISummaryError, setReportAISummaryError] = useState('');
  const [reportQuery, setReportQuery] = useState('');
  const [reportStockCodeQuery, setReportStockCodeQuery] = useState('');
  const [reportOrgQuery, setReportOrgQuery] = useState('');
  const [reportRatingQuery, setReportRatingQuery] = useState('');
  const [reportFormat, setReportFormat] = useState<ReportFormat>('all');
  const [reportSourceKey, setReportSourceKey] = useState('all');
  const [reportSort, setReportSort] = useState<ReportSort>('updated_desc');
  const [reportDateRange, setReportDateRange] = useState<ReportDateRange>('all');
  const [showReportFilters, setShowReportFilters] = useState(false);
  const [showReportAISummary, setShowReportAISummary] = useState(false);
  const reportUploadInputRef = useRef<HTMLInputElement | null>(null);

  const refreshReports = async (preferredReportId?: string) => {
    setLoadingReports(true);
    const items = await getResearchReports();
    setReports(items);
    setSelectedReport((prev) => {
      if (preferredReportId) {
        const preferred = items.find((item) => item.id === preferredReportId);
        if (preferred) return preferred;
      }
      if (prev) {
        const matched = items.find((item) => item.id === prev.id);
        if (matched) return matched;
      }
      const savedId = window.localStorage.getItem(LAST_REPORT_STORAGE_KEY);
      if (savedId) {
        const matched = items.find((item) => item.id === savedId);
        if (matched) return matched;
      }
      return items[0] ?? null;
    });
    setLoadingReports(false);
  };

  useEffect(() => {
    let mounted = true;

    const loadReportsAndProviders = async () => {
      const [items] = await Promise.all([getResearchReports()]);
      if (!mounted) return;
      setReports(items);
      setSelectedReport((prev) => {
        if (prev) {
          const matched = items.find((item) => item.id === prev.id);
          if (matched) return matched;
        }
        const savedId = window.localStorage.getItem(LAST_REPORT_STORAGE_KEY);
        if (savedId) {
          const matched = items.find((item) => item.id === savedId);
          if (matched) return matched;
        }
        return items[0] ?? null;
      });
      setLoadingReports(false);
    };

    void loadReportsAndProviders();
    const providers = getEnabledSummaryProviders();
    if (mounted) {
      setSummaryProviders(providers);
      setSelectedSummaryProviderId((prev) => prev || providers[0]?.id || '');
    }
    const timer = window.setInterval(() => {
      void refreshReports();
    }, 30000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadPreview = async () => {
      if (!selectedReport || selectedReport.previewType !== 'text') {
        setSelectedReportText(null);
        return;
      }
      setLoadingReportPreview(true);
      const content = await loadResearchReportText(selectedReport);
      if (!mounted) return;
      setSelectedReportText(content);
      setLoadingReportPreview(false);
    };
    void loadPreview();
    return () => {
      mounted = false;
    };
  }, [selectedReport]);

  useEffect(() => {
    if (!selectedReport) {
      setReportAISummary(null);
      setReportAISummaryError('');
      setShowReportAISummary(false);
      return;
    }

    const providerId = selectedSummaryProviderId || summaryProviders[0]?.id;
    if (!providerId) {
      setReportAISummary(null);
      setReportAISummaryError('');
      return;
    }

    setReportAISummary(getCachedReportAISummary(selectedReport.id, providerId));
    setReportAISummaryError('');
    setShowReportAISummary(false);
  }, [selectedReport, selectedSummaryProviderId, summaryProviders]);

  useEffect(() => {
    if (selectedReport?.id) {
      window.localStorage.setItem(LAST_REPORT_STORAGE_KEY, selectedReport.id);
    }
  }, [selectedReport]);

  const normalizedReportQuery = reportQuery.trim().toLowerCase();
  const normalizedReportStockCodeQuery = reportStockCodeQuery.trim().toLowerCase();
  const normalizedReportOrgQuery = reportOrgQuery.trim().toLowerCase();
  const normalizedReportRatingQuery = reportRatingQuery.trim().toLowerCase();
  const now = Date.now();
  const reportDateThreshold =
    reportDateRange === '7d'
      ? now - 7 * 24 * 60 * 60 * 1000
      : reportDateRange === '30d'
        ? now - 30 * 24 * 60 * 60 * 1000
        : reportDateRange === '90d'
          ? now - 90 * 24 * 60 * 60 * 1000
          : null;

  const filteredReports = reports
    .filter((item) => reportSourceKey === 'all' || item.sourceKey === reportSourceKey)
    .filter((item) => reportFormat === 'all' || item.previewType === reportFormat)
    .filter((item) => {
      if (reportDateThreshold === null) return true;
      const updatedAt = Date.parse(item.updatedAt);
      return !Number.isNaN(updatedAt) && updatedAt >= reportDateThreshold;
    })
    .filter((item) => {
      if (!normalizedReportStockCodeQuery) return true;
      return (
        (item.stockCode ?? '').toLowerCase().includes(normalizedReportStockCodeQuery) ||
        (item.stockName ?? '').toLowerCase().includes(normalizedReportStockCodeQuery)
      );
    })
    .filter((item) => {
      if (!normalizedReportOrgQuery) return true;
      return (
        (item.orgName ?? '').toLowerCase().includes(normalizedReportOrgQuery) ||
        (item.sourceLabel ?? '').toLowerCase().includes(normalizedReportOrgQuery) ||
        (item.researcher ?? '').toLowerCase().includes(normalizedReportOrgQuery)
      );
    })
    .filter((item) => {
      if (!normalizedReportRatingQuery) return true;
      return (
        (item.rating ?? '').toLowerCase().includes(normalizedReportRatingQuery) ||
        (item.tags ?? []).some((tag) => tag.toLowerCase().includes(normalizedReportRatingQuery))
      );
    })
    .filter((item) => {
      if (!normalizedReportQuery) return true;
      return (
        item.name.toLowerCase().includes(normalizedReportQuery) ||
        (item.title ?? '').toLowerCase().includes(normalizedReportQuery) ||
        item.extension.toLowerCase().includes(normalizedReportQuery) ||
        item.relativePath.toLowerCase().includes(normalizedReportQuery) ||
        (item.sourceLabel ?? '').toLowerCase().includes(normalizedReportQuery) ||
        (item.summary ?? '').toLowerCase().includes(normalizedReportQuery) ||
        (item.orgName ?? '').toLowerCase().includes(normalizedReportQuery) ||
        (item.rating ?? '').toLowerCase().includes(normalizedReportQuery) ||
        (item.stockCode ?? '').toLowerCase().includes(normalizedReportQuery) ||
        (item.stockName ?? '').toLowerCase().includes(normalizedReportQuery) ||
        (item.tags ?? []).some((tag) => tag.toLowerCase().includes(normalizedReportQuery))
      );
    })
    .sort((a, b) => {
      if (reportSort === 'updated_asc') {
        return a.updatedAt.localeCompare(b.updatedAt);
      }
      if (reportSort === 'name_asc') {
        return a.name.localeCompare(b.name, 'zh-CN');
      }
      return b.updatedAt.localeCompare(a.updatedAt);
    });

  const reportSourceOptions: ReportSourceOption[] = [
    { id: 'all', label: '全部来源', count: reports.length },
    ...Array.from(
      reports.reduce<Map<string, { label: string; count: number }>>((acc, item) => {
        const key = item.sourceKey ?? item.sourceLabel ?? item.relativePath;
        const label = item.sourceLabel ?? key;
        const current = acc.get(key);
        acc.set(key, { label, count: (current?.count ?? 0) + 1 });
        return acc;
      }, new Map()).entries(),
    )
      .map(([id, meta]) => ({ id, label: meta.label, count: meta.count }))
      .sort((a, b) => b.count - a.count),
  ];

  const handleClearReportMemory = () => {
    window.localStorage.removeItem(LAST_REPORT_STORAGE_KEY);
    setSelectedReport(reports[0] ?? null);
    setReportQuery('');
    setReportStockCodeQuery('');
    setReportOrgQuery('');
    setReportRatingQuery('');
    setReportFormat('all');
    setReportSourceKey('all');
    setReportSort('updated_desc');
    setReportDateRange('all');
  };

  const handleUploadReports = async (event: ChangeEvent<HTMLInputElement>) => {
    const files: File[] = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    setUploadingReports(true);
    try {
      const uploaded = await saveUploadedResearchReportFiles(files);
      await refreshReports(uploaded[0]?.id);
    } finally {
      setUploadingReports(false);
      event.target.value = '';
    }
  };

  const handleDeleteUploadedReport = async () => {
    if (!selectedReport || selectedReport.sourceType !== 'upload') return;
    await removeUploadedResearchReport(selectedReport.id);
    await refreshReports();
  };

  const handleGenerateReportAISummary = async () => {
    if (!selectedReport) return;
    setGeneratingReportSummary(true);
    setReportAISummaryError('');
    setShowReportAISummary(true);
    try {
      const summaryEntry = await generateReportAISummary({
        report: selectedReport,
        reportText: selectedReportText,
        providerId: selectedSummaryProviderId || undefined,
      });
      setReportAISummary(summaryEntry);
    } catch (error) {
      setReportAISummaryError(error instanceof Error ? error.message : 'AI 摘要生成失败');
    } finally {
      setGeneratingReportSummary(false);
    }
  };

  return {
    filteredReports,
    generatingReportSummary,
    handleClearReportMemory,
    handleDeleteUploadedReport,
    handleGenerateReportAISummary,
    handleUploadReports,
    loadingReportPreview,
    loadingReports,
    refreshReports,
    reportAISummary,
    reportAISummaryError,
    reportDateRange,
    reportFormat,
    reportOrgQuery,
    reportQuery,
    reportRatingQuery,
    reportSort,
    reportSourceKey,
    reportSourceOptions,
    reportStockCodeQuery,
    reportUploadInputRef,
    reports,
    selectedReport,
    selectedReportText,
    selectedSummaryProviderId,
    setReportDateRange,
    setReportFormat,
    setReportOrgQuery,
    setReportQuery,
    setReportRatingQuery,
    setReportSort,
    setReportSourceKey,
    setReportStockCodeQuery,
    setSelectedReport,
    setSelectedSummaryProviderId,
    setShowReportAISummary,
    setShowReportFilters,
    showReportAISummary,
    showReportFilters,
    summaryProviders,
    uploadingReports,
  };
}
