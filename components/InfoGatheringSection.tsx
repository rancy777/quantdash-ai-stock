import React, { useEffect, useRef, useState } from 'react';
import GlassCard from './ui/GlassCard';
import Badge from './ui/Badge';
import { MOCK_NEWS } from '../constants';
import { NewsItem, ResearchReportFile, ExpertHoldingSnapshot, ModelProviderConfig, ReportAISummaryEntry } from '../types';
import { getInfoGatheringNewsGroups, filterNewsByDate } from '../services/newsService';
import { getResearchReports, loadResearchReportText } from '../services/reportService';
import { getExpertHoldingSnapshots } from '../services/expertService';
import { removeUploadedResearchReport, saveUploadedResearchReportFiles } from '../services/reportUploadService';
import { generateReportAISummary, getCachedReportAISummary, getEnabledSummaryProviders } from '../services/aiReportSummaryService';
import { FileText, Bell, Newspaper, BarChart2, Calendar, Share2, Loader2, FolderOpen, FileSearch, Search, Users, PenSquare, Upload, Plus, Trash2, Link2, Tags, Sparkles, SlidersHorizontal, FileImage, FileSpreadsheet, File as FileIcon, FileCode2, Presentation, RefreshCw } from 'lucide-react';

const LAST_REPORT_STORAGE_KEY = 'quantdash:last-research-report';
const BIG_V_REVIEWS_STORAGE_KEY = 'quantdash:big-v-reviews';
const SELECT_CLASS_NAME =
  'rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100';

type BigVAttachment = {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
  previewText?: string;
};

type BigVReviewEntry = {
  id: string;
  title: string;
  author: string;
  source: string;
  tags: string[];
  content: string;
  createdAt: string;
  updatedAt: string;
  attachments: BigVAttachment[];
};

type NewsSourceGroup = {
  id: 'cls' | 'external';
  title: string;
  description: string;
  items: NewsItem[];
};

const createEmptyBigVReview = (): BigVReviewEntry => {
  const now = new Date().toISOString();
  return {
    id: `bigv-${now}`,
    title: '未命名复盘',
    author: '',
    source: '',
    tags: [],
    content: '',
    createdAt: now,
    updatedAt: now,
    attachments: [],
  };
};

const getReportFormatMeta = (report: Pick<ResearchReportFile, 'previewType' | 'extension'>) => {
  const normalizedExtension = report.extension.toLowerCase();
  if (report.previewType === 'pdf') {
    return {
      icon: FileText,
      label: 'PDF',
      iconClassName: 'text-rose-500',
      chipClassName: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300',
    };
  }
  if (report.previewType === 'image') {
    return {
      icon: FileImage,
      label: '图片',
      iconClassName: 'text-emerald-500',
      chipClassName: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
    };
  }
  if (report.previewType === 'office') {
    if (normalizedExtension === 'doc' || normalizedExtension === 'docx') {
      return {
        icon: FileCode2,
        label: 'Word',
        iconClassName: 'text-blue-600',
        chipClassName: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300',
      };
    }
    if (normalizedExtension === 'xls' || normalizedExtension === 'xlsx') {
      return {
        icon: FileSpreadsheet,
        label: 'Excel',
        iconClassName: 'text-emerald-600',
        chipClassName: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
      };
    }
    if (normalizedExtension === 'ppt' || normalizedExtension === 'pptx') {
      return {
        icon: Presentation,
        label: 'PPT',
        iconClassName: 'text-orange-500',
        chipClassName: 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-300',
      };
    }
    return {
      icon: FileSpreadsheet,
      label: 'Office',
      iconClassName: 'text-sky-500',
      chipClassName: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300',
    };
  }
  if (report.previewType === 'text') {
    return {
      icon: FileText,
      label: '文本',
      iconClassName: 'text-violet-500',
      chipClassName: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300',
    };
  }
  return {
    icon: FileIcon,
    label: (report.extension || '文件').toUpperCase(),
    iconClassName: 'text-slate-500',
    chipClassName: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-gray-300',
  };
};

const getSentimentBadgeMeta = (sentiment?: NewsItem['sentiment']) => {
  if (sentiment === 'bullish') {
    return { variant: 'red' as const, label: '利多' };
  }
  if (sentiment === 'bearish') {
    return { variant: 'green' as const, label: '利空' };
  }
  if (sentiment === 'neutral') {
    return { variant: 'default' as const, label: '中性' };
  }
  return null;
};

const InfoGatheringSection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'all' | 'notice' | 'news' | 'report' | 'expert' | 'review'>('all');
  const [selectedNews, setSelectedNews] = useState<NewsItem>(MOCK_NEWS[0]);
  const [newsItems, setNewsItems] = useState<NewsItem[]>(MOCK_NEWS);
  const [rawNewsGroups, setRawNewsGroups] = useState<{ cls: NewsItem[], external: NewsItem[], merged: NewsItem[] }>({ cls: [], external: [], merged: [] });
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [newsGroups, setNewsGroups] = useState<NewsSourceGroup[]>([
    { id: 'cls', title: '财联社新闻', description: '盘中电报与快讯', items: [] },
    { id: 'external', title: '外网新闻', description: '外媒与新闻聚合', items: [] },
  ]);
  const [reports, setReports] = useState<ResearchReportFile[]>([]);
  const [selectedReport, setSelectedReport] = useState<ResearchReportFile | null>(null);
  const [selectedReportText, setSelectedReportText] = useState<string | null>(null);
  const [expertSnapshots, setExpertSnapshots] = useState<ExpertHoldingSnapshot[]>([]);
  const [selectedExpertSnapshot, setSelectedExpertSnapshot] = useState<ExpertHoldingSnapshot | null>(null);
  const [loadingNews, setLoadingNews] = useState(true);
  const [loadingReports, setLoadingReports] = useState(true);
  const [loadingReportPreview, setLoadingReportPreview] = useState(false);
  const [loadingExperts, setLoadingExperts] = useState(true);
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
  const [reportFormat, setReportFormat] = useState<'all' | 'pdf' | 'image' | 'text' | 'office' | 'other'>('all');
  const [reportSourceKey, setReportSourceKey] = useState('all');
  const [reportSort, setReportSort] = useState<'updated_desc' | 'updated_asc' | 'name_asc'>('updated_desc');
  const [reportDateRange, setReportDateRange] = useState<'all' | '7d' | '30d' | '90d'>('all');
  const [showReportFilters, setShowReportFilters] = useState(false);
  const [showReportAISummary, setShowReportAISummary] = useState(false);
  const [bigVReviews, setBigVReviews] = useState<BigVReviewEntry[]>([]);
  const [selectedBigVReviewId, setSelectedBigVReviewId] = useState<string | null>(null);
  const [bigVTagInput, setBigVTagInput] = useState('');
  const [syncingExperts, setSyncingExperts] = useState(false);
  const [expertSyncMessage, setExpertSyncMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const reportUploadInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let mounted = true;
    const loadNews = async () => {
      setLoadingNews(true);
      const grouped = await getInfoGatheringNewsGroups();
      if (!mounted) return;
      setRawNewsGroups(grouped);
      setLoadingNews(false);
    };

    const loadReports = async () => {
      setLoadingReports(true);
      const items = await getResearchReports();
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

    const loadExperts = async () => {
      setLoadingExperts(true);
      const items = await getExpertHoldingSnapshots();
      if (!mounted) return;
      setExpertSnapshots(items);
      setSelectedExpertSnapshot((prev) => {
        if (prev) {
          const matched = items.find((item) => item.id === prev.id);
          if (matched) return matched;
        }
        return items[0] ?? null;
      });
      setLoadingExperts(false);
    };

    loadNews();
    loadReports();
    loadExperts();
    const providers = getEnabledSummaryProviders();
    if (mounted) {
      setSummaryProviders(providers);
      setSelectedSummaryProviderId((prev) => prev || providers[0]?.id || '');
    }
    const timer = window.setInterval(() => {
      loadNews();
      loadReports();
      loadExperts();
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
    loadPreview();
    return () => {
      mounted = false;
    };
  }, [selectedReport]);

  useEffect(() => {
    const filteredCls = filterNewsByDate(rawNewsGroups.cls, selectedDate);
    const filteredExternal = filterNewsByDate(rawNewsGroups.external, selectedDate);
    const filteredMerged = filterNewsByDate(rawNewsGroups.merged, selectedDate);
    
    setNewsItems(filteredMerged);
    setNewsGroups([
      { id: 'cls', title: '财联社新闻', description: '盘中电报与快讯', items: filteredCls },
      { id: 'external', title: '外网新闻', description: '外媒与新闻聚合', items: filteredExternal },
    ]);
    setSelectedNews((prev) => filteredMerged.find((item) => item.id === prev.id) ?? filteredMerged[0] ?? MOCK_NEWS[0]);
  }, [rawNewsGroups, selectedDate]);

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

  useEffect(() => {
    const raw = window.localStorage.getItem(BIG_V_REVIEWS_STORAGE_KEY);
    if (!raw) {
      const initial = createEmptyBigVReview();
      setBigVReviews([initial]);
      setSelectedBigVReviewId(initial.id);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as BigVReviewEntry[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        setBigVReviews(parsed);
        setSelectedBigVReviewId(parsed[0].id);
        return;
      }
    } catch (error) {
      console.warn('Failed to parse big-v reviews from localStorage', error);
    }

    const fallback = createEmptyBigVReview();
    setBigVReviews([fallback]);
    setSelectedBigVReviewId(fallback.id);
  }, []);

  useEffect(() => {
    if (bigVReviews.length === 0) return;
    window.localStorage.setItem(BIG_V_REVIEWS_STORAGE_KEY, JSON.stringify(bigVReviews));
  }, [bigVReviews]);

  const tabs = [
    { id: 'all', label: '全部', icon: <LayersIcon /> },
    { id: 'notice', label: '公告', icon: <Bell size={14} /> },
    { id: 'news', label: '新闻', icon: <Newspaper size={14} /> },
    { id: 'report', label: '研报', icon: <FileText size={14} /> },
    { id: 'expert', label: '高手', icon: <Users size={14} /> },
    { id: 'review', label: '大V复盘', icon: <PenSquare size={14} /> },
  ];

  const filteredNews = activeTab === 'all' 
    ? newsItems
    : newsItems.filter(n => n.type === activeTab);
  const groupedFilteredNews = newsGroups.map((group) => ({
    ...group,
    items: activeTab === 'all'
      ? group.items
      : group.items.filter((item) => item.type === activeTab),
  }));

  const isReportTab = activeTab === 'report';
  const isExpertTab = activeTab === 'expert';
  const isBigVReviewTab = activeTab === 'review';
  const isNewsBoardMode = !isReportTab && !isExpertTab && !isBigVReviewTab;
  const normalizedReportQuery = reportQuery.trim().toLowerCase();
  const normalizedReportStockCodeQuery = reportStockCodeQuery.trim().toLowerCase();
  const normalizedReportOrgQuery = reportOrgQuery.trim().toLowerCase();
  const normalizedReportRatingQuery = reportRatingQuery.trim().toLowerCase();
  const selectedBigVReview = bigVReviews.find((item) => item.id === selectedBigVReviewId) ?? null;
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
  const reportSourceOptions = [
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

  const renderNewsGroupPanel = (group: NewsSourceGroup & { items: NewsItem[] }) => (
    <GlassCard
      key={group.id}
      className="overflow-hidden flex flex-col min-h-0"
      noPadding
      title={group.title}
      action={<Badge variant="outline">{group.items.length} 条</Badge>}
    >
      {loadingNews ? (
        <div className="h-full flex items-center justify-center text-slate-500 dark:text-gray-400 gap-2">
          <Loader2 className="animate-spin" /> 正在加载新闻...
        </div>
      ) : group.items.length === 0 ? (
        <div className="h-full flex items-center justify-center text-slate-400 p-6 text-sm">
          当前分类下暂无 {group.title}
        </div>
      ) : (
        <div className="overflow-y-auto p-4 space-y-3 h-full custom-scrollbar">
          {group.items.map((item) => (
            <article
              key={item.id}
              className={`rounded-2xl border p-4 transition-all ${
                selectedNews.id === item.id
                  ? 'border-cyan-400/50 bg-cyan-50 dark:border-cyan-500/40 dark:bg-cyan-500/10'
                  : 'border-slate-200 bg-white/70 hover:border-slate-300 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/20'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1 text-[12px] font-semibold text-white dark:bg-white dark:text-slate-900">
                    <Calendar size={12} />
                    <span className="font-mono tracking-wide">{item.time}</span>
                  </div>
                  <div className="mt-3 text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-gray-500">
                    {item.source}
                  </div>
                </div>
                {getSentimentBadgeMeta(item.sentiment) && (
                  <Badge variant={getSentimentBadgeMeta(item.sentiment)!.variant}>
                    {getSentimentBadgeMeta(item.sentiment)!.label}
                  </Badge>
                )}
              </div>
              <h4 className="mt-3 text-[15px] font-semibold leading-6 text-slate-900 dark:text-white">
                {item.title}
              </h4>
              <p className="mt-2 line-clamp-4 text-sm leading-6 text-slate-600 dark:text-gray-300">
                {item.content}
              </p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] uppercase text-slate-500 dark:bg-white/5 dark:text-gray-400">
                  {item.type}
                </span>
                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setSelectedNews(item)}
                    className="text-xs font-medium text-cyan-600 hover:underline dark:text-cyan-400"
                  >
                    查看原文
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </GlassCard>
  );

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

  const applyQuickReportFilter = (kind: 'stock' | 'org' | 'rating', value: string) => {
    if (kind === 'stock') {
      setReportStockCodeQuery(value);
      return;
    }
    if (kind === 'org') {
      setReportOrgQuery(value);
      return;
    }
    setReportRatingQuery(value);
  };

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
      return items[0] ?? null;
    });
    setLoadingReports(false);
  };

  const handleUploadReports = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
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

  const updateSelectedBigVReview = (updater: (entry: BigVReviewEntry) => BigVReviewEntry) => {
    if (!selectedBigVReviewId) return;
    setBigVReviews((prev) =>
      prev.map((entry) =>
        entry.id === selectedBigVReviewId
          ? updater({
              ...entry,
              updatedAt: new Date().toISOString(),
            })
          : entry,
      ),
    );
  };

  const handleCreateBigVReview = () => {
    const next = createEmptyBigVReview();
    setBigVReviews((prev) => [next, ...prev]);
    setSelectedBigVReviewId(next.id);
    setBigVTagInput('');
  };

  const handleDeleteBigVReview = () => {
    if (!selectedBigVReviewId) return;
    const remaining = bigVReviews.filter((item) => item.id !== selectedBigVReviewId);
    if (remaining.length === 0) {
      const fallback = createEmptyBigVReview();
      setBigVReviews([fallback]);
      setSelectedBigVReviewId(fallback.id);
      setBigVTagInput('');
      return;
    }
    setBigVReviews(remaining);
    setSelectedBigVReviewId(remaining[0].id);
    setBigVTagInput('');
  };

  const handleImportBigVFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0 || !selectedBigVReviewId) return;

    const nextAttachments = await Promise.all(
      files.map(async (file) => {
        const isTextLike =
          file.type.startsWith('text/') ||
          /\.(txt|md|markdown|json|csv|log)$/i.test(file.name);

        let previewText: string | undefined;
        if (isTextLike) {
          try {
            previewText = (await file.text()).slice(0, 2000);
          } catch (error) {
            console.warn('Failed to read uploaded file', file.name, error);
          }
        }

        return {
          id: `${file.name}-${file.lastModified}-${file.size}`,
          name: file.name,
          type: file.type || 'unknown',
          size: file.size,
          uploadedAt: new Date().toISOString(),
          previewText,
        } satisfies BigVAttachment;
      }),
    );

    updateSelectedBigVReview((entry) => {
      const mergedContent = nextAttachments
        .filter((item) => item.previewText)
        .map((item) => `\n\n[导入文件] ${item.name}\n${item.previewText}`)
        .join('');

      return {
        ...entry,
        content: `${entry.content}${mergedContent}`.trim(),
        attachments: [...nextAttachments, ...entry.attachments],
      };
    });

    event.target.value = '';
  };

  const handleResetBigVReviews = () => {
    const fallback = createEmptyBigVReview();
    setBigVReviews([fallback]);
    setSelectedBigVReviewId(fallback.id);
    setBigVTagInput('');
    window.localStorage.setItem(BIG_V_REVIEWS_STORAGE_KEY, JSON.stringify([fallback]));
  };

  const handleSyncExperts = async () => {
    setSyncingExperts(true);
    setExpertSyncMessage('');
    try {
      const items = await getExpertHoldingSnapshots();
      setExpertSnapshots(items);
      setSelectedExpertSnapshot((prev) => {
        if (prev) {
          const matched = items.find((item) => item.id === prev.id);
          if (matched) return matched;
        }
        return items[0] ?? null;
      });
      setExpertSyncMessage(
        items.length > 0
          ? '已刷新本地缓存。如需抓取最新高手 CSV，请先在终端运行 npm run sync:experts。'
          : '当前未发现本地高手数据。请先在终端运行 npm run sync:experts，再回到页面刷新。',
      );
    } catch (error) {
      console.error('同步高手数据失败:', error);
      setExpertSyncMessage('读取本地高手数据失败，请检查本地 data 文件或先运行 npm run sync:experts。');
    } finally {
      setSyncingExperts(false);
    }
  };

  const handleAddBigVTag = () => {
    const nextTag = bigVTagInput.trim();
    if (!nextTag || !selectedBigVReview) return;
    if (selectedBigVReview.tags.includes(nextTag)) {
      setBigVTagInput('');
      return;
    }
    updateSelectedBigVReview((entry) => ({
      ...entry,
      tags: [...entry.tags, nextTag],
    }));
    setBigVTagInput('');
  };

  const formatAttachmentSize = (size: number) => {
    if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(2)} MB`;
    if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${size} B`;
  };

  const renderReportPreview = () => {
    if (!selectedReport) {
      return (
        <div className="h-full flex items-center justify-center text-slate-400">
          暂无研报文件
        </div>
      );
    }

    if (selectedReport.pdfLocalUrl) {
      return <iframe src={selectedReport.pdfLocalUrl} title={selectedReport.name} className="w-full h-full rounded-xl bg-white" />;
    }

    if (selectedReport.previewType === 'pdf') {
      return <iframe src={selectedReport.url} title={selectedReport.name} className="w-full h-full rounded-xl bg-white" />;
    }

    if (selectedReport.previewType === 'image') {
      return (
        <div className="h-full overflow-auto custom-scrollbar">
          <img src={selectedReport.url} alt={selectedReport.name} className="max-w-full rounded-xl mx-auto" />
        </div>
      );
    }

    if (selectedReport.previewType === 'text') {
      if (loadingReportPreview) {
        return (
          <div className="h-full flex items-center justify-center text-slate-500 gap-2">
            <Loader2 className="animate-spin" /> 正在加载研报内容...
          </div>
        );
      }
      return (
        <pre className="h-full overflow-auto custom-scrollbar whitespace-pre-wrap break-words rounded-xl bg-slate-50 dark:bg-white/5 p-4 text-sm leading-7 text-slate-700 dark:text-gray-300">
          {selectedReportText ?? '文件为空或无法读取文本内容'}
        </pre>
      );
    }

    return (
      <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 dark:text-gray-400 gap-4">
        <FolderOpen size={40} className="opacity-40" />
        <div>
          <div className="font-semibold text-slate-700 dark:text-gray-200">该格式暂不支持内嵌预览</div>
          <div className="text-sm mt-1">当前文件类型: .{selectedReport.extension}</div>
        </div>
        <a
          href={selectedReport.url}
          target="_blank"
          rel="noreferrer"
          className="px-4 py-2 rounded-lg bg-cyan-600 text-white text-sm hover:bg-cyan-500 transition-colors"
        >
          打开文件
        </a>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Tabs */}
      <div className="flex gap-2 p-1 rounded-xl w-fit bg-slate-200/50 dark:bg-white/5">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === tab.id 
                ? 'bg-cyan-600 text-white shadow-lg' 
                : 'text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/5'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {isNewsBoardMode ? (
        <div className="flex flex-col gap-4 flex-1 min-h-0">
          {/* 日期导航 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const yesterday = new Date(selectedDate);
                  yesterday.setDate(yesterday.getDate() - 1);
                  setSelectedDate(yesterday);
                }}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 transition-colors flex items-center gap-2"
              >
                ← 昨天
              </button>
              <span className="px-4 py-2 rounded-xl bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 font-medium text-sm">
                {selectedDate.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}
              </span>
              <button
                onClick={() => {
                  const tomorrow = new Date(selectedDate);
                  tomorrow.setDate(tomorrow.getDate() + 1);
                  const today = new Date();
                  if (tomorrow <= today) {
                    setSelectedDate(tomorrow);
                  }
                }}
                disabled={selectedDate.toDateString() === new Date().toDateString()}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                明天 →
              </button>
            </div>
            <button
              onClick={() => setSelectedDate(new Date())}
              className="px-3 py-2 rounded-xl bg-cyan-600 text-white text-sm hover:bg-cyan-500 transition-colors"
            >
              回到今天
            </button>
          </div>
          
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 flex-1 min-h-0">
            {groupedFilteredNews.map((group) => renderNewsGroupPanel(group))}
            {filteredNews.length === 0 && !loadingNews && (
              <div className="xl:col-span-2">
                <GlassCard className="h-full flex items-center justify-center text-slate-400">
                  暂无该分类新闻
                </GlassCard>
              </div>
            )}
          </div>
        </div>
      ) : (
      <div key={`info-gathering-tab-${activeTab}`} className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
        {/* Left: News List */}
        <GlassCard className={`${isReportTab ? 'lg:w-[31rem]' : 'lg:w-5/12'} overflow-hidden flex flex-col`} noPadding>
          {isBigVReviewTab ? (
            <div className="h-full flex flex-col min-h-0">
              <div className="p-4 border-b border-slate-200 dark:border-white/10 space-y-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCreateBigVReview}
                    className="flex-1 px-3 py-2 rounded-xl bg-cyan-600 text-white text-sm font-medium hover:bg-cyan-500 transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus size={14} /> 新建复盘
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-sm text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors flex items-center gap-2"
                  >
                    <Upload size={14} /> 导入
                  </button>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>支持粘贴内容，文本文件会自动导入正文</span>
                  <button
                    onClick={handleResetBigVReviews}
                    className="hover:text-rose-500 transition-colors"
                  >
                    重置本地
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleImportBigVFiles}
                  className="hidden"
                />
              </div>
              <div className="overflow-y-auto p-4 space-y-3 h-full custom-scrollbar">
                {bigVReviews.map((entry) => (
                  <div
                    key={entry.id}
                    onClick={() => {
                      setSelectedBigVReviewId(entry.id);
                      setBigVTagInput('');
                    }}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      selectedBigVReviewId === entry.id
                        ? 'bg-cyan-50/50 dark:bg-white/10 border-cyan-500/30 shadow-md'
                        : 'bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-white/5'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-3 mb-2">
                      <span className="text-xs text-slate-400 dark:text-gray-500 font-mono flex items-center gap-1">
                        <Calendar size={10} /> {new Date(entry.updatedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <Badge variant="outline">{entry.attachments.length} 附件</Badge>
                    </div>
                    <h4 className={`text-sm font-medium leading-relaxed ${selectedBigVReviewId === entry.id ? 'text-cyan-700 dark:text-cyan-100' : 'text-slate-700 dark:text-gray-300'}`}>
                      {entry.title || '未命名复盘'}
                    </h4>
                    <div className="mt-2 text-xs text-slate-400 dark:text-gray-500 flex items-center justify-between gap-2">
                      <span>{entry.author || '未填写作者'}</span>
                      <span>{entry.tags.length > 0 ? entry.tags.join(' / ') : '无标签'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : isExpertTab ? (
            loadingExperts ? (
              <div className="h-full flex items-center justify-center text-slate-500 dark:text-gray-400 gap-2">
                <Loader2 className="animate-spin" /> 正在加载高手数据...
              </div>
            ) : (
              <div className="h-full flex flex-col min-h-0">
                <div className="p-4 border-b border-slate-200 dark:border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500 dark:text-gray-400">数据来源：本地缓存</span>
                    <button
                      onClick={handleSyncExperts}
                      disabled={syncingExperts}
                      className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center hover:bg-slate-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      title="刷新本地高手缓存"
                    >
                      {syncingExperts ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                    </button>
                  </div>
                  <div className="text-xs leading-5 text-slate-500 dark:text-gray-400">
                    公开仓库中此按钮只刷新本地缓存。抓取最新高手 CSV 请在终端运行 <span className="font-mono">npm run sync:experts</span>。
                  </div>
                  {expertSyncMessage && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
                      {expertSyncMessage}
                    </div>
                  )}
                </div>
                <div className="overflow-y-auto p-4 space-y-3 flex-1 custom-scrollbar">
                {expertSnapshots.map((snapshot) => (
                  <div
                    key={snapshot.id}
                    onClick={() => setSelectedExpertSnapshot(snapshot)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      selectedExpertSnapshot?.id === snapshot.id
                        ? 'bg-cyan-50/50 dark:bg-white/10 border-cyan-500/30 shadow-md'
                        : 'bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-white/5'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2 gap-3">
                      <span className="text-xs text-slate-400 dark:text-gray-500 font-mono flex items-center gap-1">
                        <Calendar size={10}/> {snapshot.date}
                      </span>
                      <Badge variant="outline">{snapshot.recordCount} 条</Badge>
                    </div>
                    <h4 className={`text-sm font-medium leading-relaxed ${selectedExpertSnapshot?.id === snapshot.id ? 'text-cyan-700 dark:text-cyan-100' : 'text-slate-700 dark:text-gray-300'}`}>
                      {snapshot.fileName}
                    </h4>
                    <div className="mt-2 text-xs text-slate-400 dark:text-gray-500 flex items-center justify-between gap-2">
                      <span>{snapshot.groups.join(' / ')}</span>
                      <span className="bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded uppercase">CSV</span>
                    </div>
                  </div>
                ))}
                {expertSnapshots.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 py-10 gap-2">
                    <Users className="opacity-40" />
                    <span>暂无高手持仓数据</span>
                    <span className="text-xs">点击上方按钮同步最新 CSV 数据</span>
                  </div>
                )}
                </div>
              </div>
            )
          ) : isReportTab ? (
            loadingReports ? (
              <div className="h-full flex items-center justify-center text-slate-500 dark:text-gray-400 gap-2">
                <Loader2 className="animate-spin" /> 正在加载研报...
              </div>
            ) : (
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
                      onClick={() => refreshReports(selectedReport?.id)}
                      className="px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-sm text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                    >
                      刷新
                    </button>
                  </div>
                  <input
                    ref={reportUploadInputRef}
                    type="file"
                    multiple
                    onChange={handleUploadReports}
                    className="hidden"
                  />
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={reportQuery}
                      onChange={(e) => setReportQuery(e.target.value)}
                      placeholder="搜索标题、机构、代码或文件名"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
                    />
                    </div>
                    <button
                      onClick={() => setShowReportFilters((prev) => !prev)}
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
                      onClick={handleClearReportMemory}
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
                            onChange={(e) => setReportStockCodeQuery(e.target.value)}
                            placeholder="股票代码 / 名称"
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
                          />
                          <input
                            value={reportOrgQuery}
                            onChange={(e) => setReportOrgQuery(e.target.value)}
                            placeholder="机构 / 作者"
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
                          />
                          <input
                            value={reportRatingQuery}
                            onChange={(e) => setReportRatingQuery(e.target.value)}
                            placeholder="评级"
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
                          />
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          <select
                            value={reportSourceKey}
                            onChange={(e) => setReportSourceKey(e.target.value)}
                            className={SELECT_CLASS_NAME}
                          >
                            {reportSourceOptions.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.label}{option.id === 'all' ? '' : ` (${option.count})`}
                              </option>
                            ))}
                          </select>
                          <select
                            value={reportFormat}
                            onChange={(e) => setReportFormat(e.target.value as typeof reportFormat)}
                            className={SELECT_CLASS_NAME}
                          >
                            <option value="all">全部格式</option>
                            <option value="pdf">PDF</option>
                            <option value="image">图片</option>
                            <option value="text">文本</option>
                            <option value="office">Office</option>
                            <option value="other">其他</option>
                          </select>
                          <select
                            value={reportDateRange}
                            onChange={(e) => setReportDateRange(e.target.value as typeof reportDateRange)}
                            className={SELECT_CLASS_NAME}
                          >
                            <option value="all">全部日期</option>
                            <option value="7d">近 7 天</option>
                            <option value="30d">近 30 天</option>
                            <option value="90d">近 90 天</option>
                          </select>
                          <select
                            value={reportSort}
                            onChange={(e) => setReportSort(e.target.value as typeof reportSort)}
                            className={SELECT_CLASS_NAME}
                          >
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
                    ]
                      .filter(Boolean)
                      .join(' · ');
                    return (
                      <button
                        key={item.id}
                        onClick={() => setSelectedReport(item)}
                        className={`group relative w-full rounded-2xl px-3 py-3 text-left transition-all ${
                          selectedReport?.id === item.id
                            ? 'bg-white shadow-sm ring-1 ring-cyan-500/20 dark:bg-white/[0.08] dark:ring-cyan-400/20'
                            : 'hover:bg-white/70 dark:hover:bg-white/[0.04]'
                        }`}
                      >
                        {selectedReport?.id === item.id && (
                          <span className="absolute left-0 top-3 bottom-3 w-1 rounded-full bg-cyan-500" />
                        )}
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
                              selectedReport?.id === item.id
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
                    <span>{reports.length === 0 ? '暂无研报文件' : '没有符合条件的研报'}</span>
                    <span className="text-xs">
                      {reports.length === 0
                        ? '把文件放进 data/research_reports 后执行 `pnpm run sync:reports`'
                        : '可以尝试更换关键词、格式或排序'}
                    </span>
                  </div>
                )}
                </div>
              </div>
            )
          ) : loadingNews ? (
            <div className="h-full flex items-center justify-center text-slate-500 dark:text-gray-400 gap-2">
              <Loader2 className="animate-spin" /> 正在加载新闻...
            </div>
          ) : (
          <div className="flex flex-col h-full min-h-0">
            {/* 日期导航 */}
            <div className="p-4 border-b border-slate-200 dark:border-white/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const yesterday = new Date(selectedDate);
                      yesterday.setDate(yesterday.getDate() - 1);
                      setSelectedDate(yesterday);
                    }}
                    className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 transition-colors flex items-center gap-2"
                  >
                    ← 昨天
                  </button>
                  <span className="px-4 py-2 rounded-xl bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 font-medium text-sm">
                    {selectedDate.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}
                  </span>
                  <button
                    onClick={() => {
                      const tomorrow = new Date(selectedDate);
                      tomorrow.setDate(tomorrow.getDate() + 1);
                      const today = new Date();
                      if (tomorrow <= today) {
                        setSelectedDate(tomorrow);
                      }
                    }}
                    disabled={selectedDate.toDateString() === new Date().toDateString()}
                    className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    明天 →
                  </button>
                </div>
                <button
                  onClick={() => setSelectedDate(new Date())}
                  className="px-3 py-2 rounded-xl bg-cyan-600 text-white text-sm hover:bg-cyan-500 transition-colors"
                >
                  回到今天
                </button>
              </div>
            </div>
            <div className="overflow-y-auto p-4 space-y-5 flex-1 custom-scrollbar">
            {groupedFilteredNews.map((group) => (
              <div key={group.id} className="space-y-3">
                <div className="px-1">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-white">{group.title}</h3>
                    <Badge variant="outline">{group.items.length} 条</Badge>
                  </div>
                  <div className="mt-1 text-xs text-slate-400 dark:text-gray-500">{group.description}</div>
                </div>
                {group.items.length > 0 ? (
                  group.items.map((item) => (
                    <div 
                      key={item.id}
                      onClick={() => setSelectedNews(item)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer ${
                        selectedNews.id === item.id 
                          ? 'bg-cyan-50/50 dark:bg-white/10 border-cyan-500/30 shadow-md' 
                          : 'bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-white/5'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs text-slate-400 dark:text-gray-500 font-mono flex items-center gap-1">
                          <Calendar size={10}/> {item.time}
                        </span>
                        {getSentimentBadgeMeta(item.sentiment) && (
                          <Badge variant={getSentimentBadgeMeta(item.sentiment)!.variant}>
                            {getSentimentBadgeMeta(item.sentiment)!.label}
                          </Badge>
                        )}
                      </div>
                      <h4 className={`text-sm font-medium leading-relaxed ${selectedNews.id === item.id ? 'text-cyan-700 dark:text-cyan-100' : 'text-slate-700 dark:text-gray-300'}`}>
                        {item.title}
                      </h4>
                      <div className="mt-2 text-xs text-slate-400 dark:text-gray-500 flex items-center justify-between">
                        <span>{item.source}</span>
                        <span className="bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded uppercase">{item.type}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 dark:border-white/10 p-4 text-sm text-slate-400">
                    当前分类下暂无 {group.title}
                  </div>
                )}
              </div>
            ))}
            {filteredNews.length === 0 && (
              <div className="h-full flex items-center justify-center text-slate-400 py-10">
                暂无该分类新闻
              </div>
            )}
            </div>
          </div>
          )}
        </GlassCard>

        {/* Right: Detail View */}
        <GlassCard
          className="flex-1"
          title={isReportTab ? '研报内容' : isExpertTab ? '高手详情' : isBigVReviewTab ? '复盘内容' : '详情摘要'}
          action={<button className="text-slate-400 dark:text-gray-400 hover:text-slate-600 dark:hover:text-white"><Share2 size={16}/></button>}
        >
          {isBigVReviewTab ? (
            selectedBigVReview ? (
              <div className="h-full flex flex-col min-h-0">
                <div className="flex items-start justify-between gap-4 mb-4 pb-4 border-b border-slate-200 dark:border-white/10">
                  <div className="min-w-0 flex-1">
                    <input
                      value={selectedBigVReview.title}
                      onChange={(e) => updateSelectedBigVReview((entry) => ({ ...entry, title: e.target.value }))}
                      placeholder="输入复盘标题，例如：某大V 3月27日午后复盘"
                      className="w-full bg-transparent text-2xl font-bold text-slate-900 dark:text-white outline-none placeholder:text-slate-300"
                    />
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-gray-400">
                      <span>创建于 {new Date(selectedBigVReview.createdAt).toLocaleString('zh-CN')}</span>
                      <span>更新于 {new Date(selectedBigVReview.updatedAt).toLocaleString('zh-CN')}</span>
                      <Badge variant="outline">{selectedBigVReview.attachments.length} 个附件</Badge>
                    </div>
                  </div>
                  <button
                    onClick={handleDeleteBigVReview}
                    className="px-3 py-2 rounded-lg border border-rose-200 text-rose-500 hover:bg-rose-50 dark:border-rose-500/20 dark:hover:bg-rose-500/10 transition-colors flex items-center gap-2"
                  >
                    <Trash2 size={14} /> 删除
                  </button>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-4 flex-1 min-h-0">
                  <div className="flex flex-col gap-4 min-h-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <label className="rounded-xl bg-slate-50 dark:bg-white/5 p-4">
                        <div className="text-xs text-slate-400 mb-2 flex items-center gap-2">
                          <Users size={12} /> 作者 / 大V
                        </div>
                        <input
                          value={selectedBigVReview.author}
                          onChange={(e) => updateSelectedBigVReview((entry) => ({ ...entry, author: e.target.value }))}
                          placeholder="例如：某财经博主、游资复盘号"
                          className="w-full bg-transparent text-sm text-slate-700 dark:text-gray-200 outline-none"
                        />
                      </label>
                      <label className="rounded-xl bg-slate-50 dark:bg-white/5 p-4">
                        <div className="text-xs text-slate-400 mb-2 flex items-center gap-2">
                          <Link2 size={12} /> 来源 / 链接备注
                        </div>
                        <input
                          value={selectedBigVReview.source}
                          onChange={(e) => updateSelectedBigVReview((entry) => ({ ...entry, source: e.target.value }))}
                          placeholder="例如：微博、公众号、群消息、语音转文字"
                          className="w-full bg-transparent text-sm text-slate-700 dark:text-gray-200 outline-none"
                        />
                      </label>
                    </div>

                    <div className="rounded-xl bg-slate-50 dark:bg-white/5 p-4">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div className="text-xs text-slate-400 flex items-center gap-2">
                          <Tags size={12} /> 标签
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            value={bigVTagInput}
                            onChange={(e) => setBigVTagInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddBigVTag();
                              }
                            }}
                            placeholder="输入标签后回车"
                            className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-1.5 text-sm outline-none"
                          />
                          <button
                            onClick={handleAddBigVTag}
                            className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-sm dark:bg-white dark:text-slate-900"
                          >
                            添加
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedBigVReview.tags.length > 0 ? (
                          selectedBigVReview.tags.map((tag) => (
                            <button
                              key={tag}
                              onClick={() =>
                                updateSelectedBigVReview((entry) => ({
                                  ...entry,
                                  tags: entry.tags.filter((item) => item !== tag),
                                }))
                              }
                              className="px-3 py-1 rounded-full bg-cyan-100 text-cyan-700 text-xs dark:bg-cyan-500/10 dark:text-cyan-300"
                            >
                              {tag} ×
                            </button>
                          ))
                        ) : (
                          <span className="text-sm text-slate-400">还没有标签，可按题材、情绪、风格分类。</span>
                        )}
                      </div>
                    </div>

                    <div className="flex-1 min-h-0 rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-200 dark:border-white/10 text-sm text-slate-500 dark:text-gray-400">
                        正文内容
                      </div>
                      <textarea
                        value={selectedBigVReview.content}
                        onChange={(e) => updateSelectedBigVReview((entry) => ({ ...entry, content: e.target.value }))}
                        placeholder="直接粘贴大V复盘文字，或者先点击左侧“导入”把 txt / md / csv 等文本文件灌进来。"
                        className="w-full h-full min-h-[320px] resize-none bg-transparent px-4 py-4 text-sm leading-7 text-slate-700 dark:text-gray-200 outline-none"
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 dark:border-white/10 p-4 overflow-auto custom-scrollbar">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <h3 className="text-sm font-semibold text-slate-800 dark:text-white">导入附件</h3>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-lg bg-cyan-600 text-white text-xs hover:bg-cyan-500 transition-colors"
                      >
                        继续导入
                      </button>
                    </div>
                    <div className="space-y-3">
                      {selectedBigVReview.attachments.length > 0 ? (
                        selectedBigVReview.attachments.map((attachment) => (
                          <div key={attachment.id} className="rounded-xl bg-slate-50 dark:bg-white/5 p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-slate-700 dark:text-gray-200 break-all">{attachment.name}</div>
                                <div className="mt-1 text-xs text-slate-400">
                                  {attachment.type || 'unknown'} · {formatAttachmentSize(attachment.size)}
                                </div>
                              </div>
                              <button
                                onClick={() =>
                                  updateSelectedBigVReview((entry) => ({
                                    ...entry,
                                    attachments: entry.attachments.filter((item) => item.id !== attachment.id),
                                  }))
                                }
                                className="text-slate-400 hover:text-rose-500 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                            {attachment.previewText && (
                              <pre className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-white dark:bg-slate-900 p-3 text-xs leading-6 text-slate-600 dark:text-gray-300 max-h-40 overflow-auto custom-scrollbar">
                                {attachment.previewText}
                              </pre>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="rounded-xl border border-dashed border-slate-200 dark:border-white/10 p-6 text-sm text-slate-400 text-center">
                          还没有导入附件。
                          <div className="mt-2 text-xs">文本文件会自动写入正文，图片/PDF 先记录文件信息，后续可以再接正式上传。</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400">暂无大V复盘条目</div>
            )
          ) : isExpertTab ? (
            <div className="h-full flex flex-col min-h-0">
              <div className="flex items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-200 dark:border-white/10">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white leading-snug">
                    {selectedExpertSnapshot ? `高手持仓快照 ${selectedExpertSnapshot.date}` : '暂无高手持仓数据'}
                  </h2>
                  <div className="mt-2 flex items-center gap-3 text-sm text-slate-500 dark:text-gray-400">
                    <span>{selectedExpertSnapshot?.recordCount ?? 0} 条记录</span>
                    <Badge variant="outline">CSV</Badge>
                  </div>
                </div>
              </div>
              {selectedExpertSnapshot ? (
                <div className="flex-1 min-h-0 flex flex-col gap-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="rounded-xl bg-slate-50 dark:bg-white/5 p-4">
                      <div className="text-xs text-slate-400">组别数量</div>
                      <div className="mt-2 text-2xl font-mono font-bold text-cyan-500">{selectedExpertSnapshot.groups.length}</div>
                    </div>
                    <div className="rounded-xl bg-slate-50 dark:bg-white/5 p-4">
                      <div className="text-xs text-slate-400">当日收益为正人数</div>
                      <div className="mt-2 text-2xl font-mono font-bold text-emerald-500">
                        {selectedExpertSnapshot.records.filter((item) => (item.dailyReturnPct ?? -999) > 0).length}
                      </div>
                    </div>
                    <div className="rounded-xl bg-slate-50 dark:bg-white/5 p-4">
                      <div className="text-xs text-slate-400">空仓/无持仓描述</div>
                      <div className="mt-2 text-2xl font-mono font-bold text-amber-500">
                        {selectedExpertSnapshot.records.filter((item) => /空仓|无/.test(item.holdings)).length}
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 min-h-0 overflow-auto custom-scrollbar rounded-xl border border-slate-200 dark:border-white/10">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900 z-10">
                        <tr className="text-left text-slate-500 dark:text-gray-400">
                          <th className="px-4 py-3">组别</th>
                          <th className="px-4 py-3">昵称</th>
                          <th className="px-4 py-3">资产(万)</th>
                          <th className="px-4 py-3">当日%</th>
                          <th className="px-4 py-3">本周%</th>
                          <th className="px-4 py-3">核心持仓</th>
                          <th className="px-4 py-3">操作要点</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedExpertSnapshot.records.map((item, index) => (
                          <tr key={`${item.nickname}-${index}`} className="border-t border-slate-200 dark:border-white/10 align-top">
                            <td className="px-4 py-3 whitespace-nowrap">{item.group}</td>
                            <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-800 dark:text-white">{item.nickname}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{item.assetScaleWan ?? '—'}</td>
                            <td className={`px-4 py-3 whitespace-nowrap ${(item.dailyReturnPct ?? 0) > 0 ? 'text-red-500' : (item.dailyReturnPct ?? 0) < 0 ? 'text-green-500' : 'text-slate-500'}`}>{item.dailyReturnPct ?? '—'}</td>
                            <td className={`px-4 py-3 whitespace-nowrap ${(item.weeklyReturnPct ?? 0) > 0 ? 'text-red-500' : (item.weeklyReturnPct ?? 0) < 0 ? 'text-green-500' : 'text-slate-500'}`}>{item.weeklyReturnPct ?? '—'}</td>
                            <td className="px-4 py-3 min-w-[180px]">{item.holdings || '—'}</td>
                            <td className="px-4 py-3 min-w-[320px] text-slate-600 dark:text-gray-300">{item.notes || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400">暂无高手持仓数据</div>
              )}
            </div>
          ) : isReportTab ? (
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
                        onClick={reportAISummary ? () => setShowReportAISummary((prev) => !prev) : handleGenerateReportAISummary}
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
                        onClick={handleDeleteUploadedReport}
                        className="px-3 py-2 rounded-full border border-rose-200 text-rose-500 text-sm hover:bg-rose-50 transition-colors whitespace-nowrap"
                      >
                        删除
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className={`flex-1 min-h-0 grid gap-4 ${showReportAISummary || reportAISummaryError || generatingReportSummary ? 'xl:grid-cols-[minmax(0,1fr)_340px]' : 'grid-cols-1'}`}>
                <div className="min-h-0">
                  {renderReportPreview()}
                </div>
                {(showReportAISummary || reportAISummaryError || generatingReportSummary) && (
                  <div className="min-h-0 rounded-2xl border border-violet-200/30 bg-violet-50/40 p-4 dark:border-violet-500/20 dark:bg-violet-500/10 overflow-auto custom-scrollbar">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="inline-flex items-center gap-2 text-sm font-medium text-violet-700 dark:text-violet-300">
                        <Sparkles size={14} />
                        AI 研报摘要
                      </div>
                      {summaryProviders.length > 0 && (
                        <select
                          value={selectedSummaryProviderId}
                          onChange={(event) => setSelectedSummaryProviderId(event.target.value)}
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
          ) : (
          <div className="h-full flex flex-col">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 leading-snug">{selectedNews.title}</h2>
            
            <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-gray-400 mb-8 pb-4 border-b border-slate-200 dark:border-white/10">
              <span className="text-cyan-600 dark:text-cyan-400 font-semibold">{selectedNews.source}</span>
              <span>{selectedNews.time}</span>
              <Badge variant="outline">{selectedNews.type.toUpperCase()}</Badge>
            </div>
            
            <div className="text-slate-700 dark:text-gray-300 leading-8 text-lg font-light tracking-wide space-y-4">
               <p>{selectedNews.content}</p>
               {selectedNews.url && (
                 <p className="text-sm leading-6">
                   <a
                     href={selectedNews.url}
                     target="_blank"
                     rel="noreferrer"
                     className="text-cyan-600 dark:text-cyan-400 hover:underline"
                   >
                     查看原文
                   </a>
                 </p>
               )}
               {selectedNews.sentiment && (
                 <div className="p-4 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-lg mt-6">
                   <h5 className="text-blue-600 dark:text-blue-400 text-sm font-bold mb-2 flex items-center gap-2">
                     <BarChart2 size={16}/> 智能分析
                   </h5>
                   <p className="text-sm text-blue-700/80 dark:text-blue-200/80">
                     该消息当前仅在有明确判断时才显示情绪标签；如显示为
                     {selectedNews.sentiment === 'bullish' ? '利多' : selectedNews.sentiment === 'bearish' ? '利空' : '中性'}
                     ，仍建议结合板块强弱和资金流向继续确认。
                   </p>
                 </div>
               )}
            </div>
          </div>
          )}
        </GlassCard>
      </div>
      )}
    </div>
  );
};

function LayersIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
  );
}

export default InfoGatheringSection;
