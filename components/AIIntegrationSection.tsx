import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  CheckCircle2,
  Copy,
  Cpu,
  Download,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  Save,
  Sparkles,
  PlugZap,
  Telescope,
  X,
} from 'lucide-react';
import GlassCard from './ui/GlassCard';
import Badge from './ui/Badge';
import { AIIntegrationSettings, AIPromptTemplateKey, FeishuBotConfig, FeishuBotConfigTestResult, ModelProviderConfig, ModelProviderMode, ModelProviderProtocol, Stock } from '../types';
import {
  createCustomProvider,
  getDefaultPromptTemplates,
  loadAIIntegrationSettings,
  maskApiKey,
  saveAIIntegrationSettings,
  testModelProviderConnection,
  testModelProviderPrompt,
  type ProviderConnectionTestResult,
} from '../services/modelIntegrationService';
import { loadFeishuBotConfig, saveFeishuBotConfig, testFeishuBotConfig } from '../services/feishuIntegrationService';
import {
  AIDailyReviewEntry,
  AIPlanValidationEntry,
  AIPremarketPlanEntry,
  AIStockObservationEntry,
  AIUltraShortAnalysisEntry,
  generateAIDailyReview,
  generateAIPlanValidation,
  generateAIPremarketPlan,
  generateAIStockObservation,
  generateAIUltraShortAnalysis,
  getDailyReviewHistoryByProvider,
  getLatestCachedDailyReviewByProvider,
  getLatestCachedPlanValidationByProvider,
  getLatestCachedPremarketPlanByProvider,
  getLatestCachedStockObservationByProvider,
  getLatestCachedUltraShortAnalysisByProvider,
  getPlanValidationHistoryByProvider,
  getPremarketPlanHistoryByProvider,
  getStockObservationHistoryByProvider,
  getUltraShortAnalysisHistoryByProvider,
  updateStoredDailyReviewContent,
  updateStoredPlanValidationContent,
  updateStoredPremarketPlanContent,
  updateStoredStockObservationContent,
  updateStoredUltraShortAnalysisContent,
} from '../services/aiDailyReviewService';
import { copyPlainText, exportTextAsMarkdown } from '../services/aiOutputService';
import { addSymbolsToFocusList, extractObservedSymbols, loadFocusList } from '../services/focusListService';
import { AIStockObservationRequest } from '../services/aiNavigationService';
import { emitStockDetailRequest } from '../services/stockNavigationService';

const protocolOptions: { value: ModelProviderProtocol; label: string }[] = [
  { value: 'openai', label: 'OpenAI 兼容' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'custom', label: '自定义' },
];

const providerTypeLabel: Record<ModelProviderMode, string> = {
  cloud: '云端模型',
  local: '本地模型',
};

const SELECT_CLASS_NAME =
  'w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-cyan-500 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100';
const PROVIDER_SELECT_CARD_CLASS_NAME =
  'w-full rounded-2xl border border-slate-200/80 bg-white px-4 py-3.5 text-left text-sm text-slate-900 shadow-[0_8px_24px_rgba(15,23,42,0.06)] outline-none transition hover:border-cyan-300 hover:shadow-[0_12px_30px_rgba(34,211,238,0.08)] focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100 dark:shadow-none dark:hover:border-cyan-500/30';

const promptTemplateTabs: { key: AIPromptTemplateKey; label: string; hint: string }[] = [
  { key: 'reportSummary', label: '研报摘要模板', hint: '单篇研报摘要的默认提示词。' },
  { key: 'dailyReview', label: 'AI 当日复盘模板', hint: '最近交易日复盘的默认提示词。' },
  { key: 'ultraShortAnalysis', label: 'AI 超短线深度分析模板', hint: '偏 1 到 3 日节奏的超短博弈分析模板。' },
  { key: 'premarketPlan', label: '盘前计划模板', hint: '次日观察清单与交易预案的默认提示词。' },
  { key: 'stockObservation', label: '个股观察模板', hint: '预留给后续个股观察功能使用。' },
  { key: 'planValidation', label: '次日校验模板', hint: '用于评估盘前计划与次日实际盘面的偏差。' },
];

const promptTemplateVariableHints: Record<AIPromptTemplateKey, string> = {
  reportSummary: '{{reportTitle}} {{sourceLabel}} {{orgLine}} {{researcherLine}} {{ratingLine}} {{contentBlock}}',
  dailyReview: '{{analysisDate}} {{stage}} {{confidence}} {{riskLevel}} {{volumeState}} {{latestVolumeAmount}} {{volumeChangeRate}} {{reasons}} {{rise}} {{fall}} {{flat}} {{bullBearSummary}} {{leaderSummary}} {{conceptSectorSummary}} {{industrySectorSummary}} {{newsSummary}} {{reportSummary}}',
  ultraShortAnalysis: '{{analysisDate}} {{stage}} {{confidence}} {{riskLevel}} {{volumeState}} {{latestVolumeAmount}} {{volumeChangeRate}} {{reasons}} {{rise}} {{fall}} {{flat}} {{bullBearSummary}} {{leaderSummary}} {{conceptSectorSummary}} {{industrySectorSummary}} {{newsSummary}} {{reportSummary}}',
  premarketPlan: '{{sourceAnalysisDate}} {{targetTradingDate}} {{dailyReviewContent}}',
  stockObservation: '{{symbol}} {{name}} {{industry}} {{concepts}} {{analysisDate}} {{latestPrice}} {{latestPctChange}} {{openPct}} {{closePct}} {{isOneWord}} {{klineSummary}} {{stage}} {{riskLevel}} {{volumeState}} {{leaderSummary}} {{conceptSectorSummary}} {{industrySectorSummary}} {{focusListStatus}} {{planTrackingStatus}} {{relatedNewsSummary}} {{relatedReportSummary}} {{cachedReportSummary}}',
  planValidation: '{{targetTradingDate}} {{validationDate}} {{premarketPlanContent}} {{stage}} {{riskLevel}} {{volumeState}} {{latestVolumeAmount}} {{volumeChangeRate}} {{rise}} {{fall}} {{flat}} {{bullBearSummary}} {{leaderSummary}} {{conceptSectorSummary}} {{industrySectorSummary}} {{newsSummary}} {{observedStocksSummary}}',
};

const renderStructuredDocument = (content: string, tone: 'violet' | 'amber' | 'cyan') => {
  const className = tone === 'violet'
    ? 'border-violet-400/20 bg-white/40 dark:bg-white/[0.03]'
    : tone === 'amber'
      ? 'border-amber-400/20 bg-white/40 dark:bg-white/[0.03]'
      : 'border-cyan-400/20 bg-white/40 dark:bg-white/[0.03]';

  return (
    <div className={`mt-4 rounded-xl border p-4 ${className}`}>
      <div className="whitespace-pre-wrap text-sm leading-7 text-slate-700 dark:text-gray-200">
        {content}
      </div>
    </div>
  );
};

type DocumentActionFeedback = {
  scope: 'AI 当日复盘' | 'AI 超短线深度分析' | '盘前计划' | '个股观察' | '次日校验';
  message: string;
};

interface AIIntegrationSectionProps {
  stockObservationRequest?: AIStockObservationRequest | null;
  onStockObservationRequestHandled?: (request: AIStockObservationRequest) => void;
}

const AIIntegrationSection: React.FC<AIIntegrationSectionProps> = ({
  stockObservationRequest = null,
  onStockObservationRequestHandled,
}) => {
  const [activeIntegrationTab, setActiveIntegrationTab] = useState<'models' | 'ai' | 'feishu'>('models');
  const [settings, setSettings] = useState<AIIntegrationSettings>(() => loadAIIntegrationSettings());
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(settings.preferredProviderId);
  const [selectedPromptTemplateKey, setSelectedPromptTemplateKey] = useState<AIPromptTemplateKey>('dailyReview');
  const [isProviderDropdownOpen, setIsProviderDropdownOpen] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState('');
  const [saveFeedback, setSaveFeedback] = useState('');
  const [testingProviderId, setTestingProviderId] = useState<string | null>(null);
  const [pingTestingProviderId, setPingTestingProviderId] = useState<string | null>(null);
  const [connectionResults, setConnectionResults] = useState<Record<string, ProviderConnectionTestResult>>({});
  const [dailyReview, setDailyReview] = useState<AIDailyReviewEntry | null>(null);
  const [selectedDailyReviewId, setSelectedDailyReviewId] = useState('');
  const [dailyReviewError, setDailyReviewError] = useState('');
  const [generatingDailyReview, setGeneratingDailyReview] = useState(false);
  const [editingDailyReview, setEditingDailyReview] = useState(false);
  const [dailyReviewDraft, setDailyReviewDraft] = useState('');
  const [dailyReviewEditError, setDailyReviewEditError] = useState('');
  const [dailyReviewHistoryVersion, setDailyReviewHistoryVersion] = useState(0);
  const [ultraShortAnalysis, setUltraShortAnalysis] = useState<AIUltraShortAnalysisEntry | null>(null);
  const [selectedUltraShortAnalysisId, setSelectedUltraShortAnalysisId] = useState('');
  const [ultraShortAnalysisError, setUltraShortAnalysisError] = useState('');
  const [generatingUltraShortAnalysis, setGeneratingUltraShortAnalysis] = useState(false);
  const [editingUltraShortAnalysis, setEditingUltraShortAnalysis] = useState(false);
  const [ultraShortAnalysisDraft, setUltraShortAnalysisDraft] = useState('');
  const [ultraShortAnalysisEditError, setUltraShortAnalysisEditError] = useState('');
  const [ultraShortAnalysisHistoryVersion, setUltraShortAnalysisHistoryVersion] = useState(0);
  const [premarketPlan, setPremarketPlan] = useState<AIPremarketPlanEntry | null>(null);
  const [selectedPremarketPlanId, setSelectedPremarketPlanId] = useState('');
  const [premarketPlanError, setPremarketPlanError] = useState('');
  const [generatingPremarketPlan, setGeneratingPremarketPlan] = useState(false);
  const [editingPremarketPlan, setEditingPremarketPlan] = useState(false);
  const [premarketPlanDraft, setPremarketPlanDraft] = useState('');
  const [premarketPlanEditError, setPremarketPlanEditError] = useState('');
  const [premarketPlanHistoryVersion, setPremarketPlanHistoryVersion] = useState(0);
  const [stockObservation, setStockObservation] = useState<AIStockObservationEntry | null>(null);
  const [selectedStockObservationId, setSelectedStockObservationId] = useState('');
  const [stockObservationError, setStockObservationError] = useState('');
  const [generatingStockObservation, setGeneratingStockObservation] = useState(false);
  const [stockObservationSymbol, setStockObservationSymbol] = useState('');
  const [editingStockObservation, setEditingStockObservation] = useState(false);
  const [stockObservationDraft, setStockObservationDraft] = useState('');
  const [stockObservationEditError, setStockObservationEditError] = useState('');
  const [stockObservationHistoryVersion, setStockObservationHistoryVersion] = useState(0);
  const [planValidation, setPlanValidation] = useState<AIPlanValidationEntry | null>(null);
  const [selectedPlanValidationId, setSelectedPlanValidationId] = useState('');
  const [planValidationError, setPlanValidationError] = useState('');
  const [generatingPlanValidation, setGeneratingPlanValidation] = useState(false);
  const [editingPlanValidation, setEditingPlanValidation] = useState(false);
  const [planValidationDraft, setPlanValidationDraft] = useState('');
  const [planValidationEditError, setPlanValidationEditError] = useState('');
  const [planValidationHistoryVersion, setPlanValidationHistoryVersion] = useState(0);
  const [planActionFeedback, setPlanActionFeedback] = useState('');
  const [documentActionFeedback, setDocumentActionFeedback] = useState<DocumentActionFeedback | null>(null);
  const [focusListItems, setFocusListItems] = useState<Stock[]>([]);
  const [focusListMode, setFocusListMode] = useState<'remote' | 'local'>('local');
  const [focusListLoading, setFocusListLoading] = useState(false);
  const [feishuConfig, setFeishuConfig] = useState<FeishuBotConfig>({
    appId: '',
    appSecret: '',
    verificationToken: '',
    aiBaseUrl: '',
    aiApiKey: '',
    aiModel: '',
  });
  const [feishuLoading, setFeishuLoading] = useState(false);
  const [feishuSaving, setFeishuSaving] = useState(false);
  const [feishuTesting, setFeishuTesting] = useState(false);
  const [feishuFeedback, setFeishuFeedback] = useState('');
  const [feishuError, setFeishuError] = useState('');
  const [feishuTestResult, setFeishuTestResult] = useState<FeishuBotConfigTestResult | null>(null);
  const providerDropdownRef = useRef<HTMLDivElement | null>(null);
  const stockObservationSectionRef = useRef<HTMLDivElement | null>(null);

  const selectedProvider = useMemo(
    () => settings.providers.find((item) => item.id === selectedProviderId) ?? settings.providers[0] ?? null,
    [selectedProviderId, settings.providers]
  );
  const cloudProviders = settings.providers.filter((item) => item.mode === 'cloud');
  const localProviders = settings.providers.filter((item) => item.mode === 'local');
  const configuredCloudProviders = settings.providers.filter(
    (item) => item.mode === 'cloud' && item.apiKey.trim()
  );
  const configuredProviders = settings.providers.filter(
    (item) => (item.mode === 'cloud' && item.apiKey.trim()) || (item.mode === 'local' && item.enabled)
  );
  const selectedProviderTestResult = selectedProvider ? connectionResults[selectedProvider.id] : undefined;
  const observedSymbols = premarketPlan ? extractObservedSymbols(premarketPlan.content) : [];
  const selectedPromptTemplate = settings.promptTemplates[selectedPromptTemplateKey];
  const showDailyReviewPanel = selectedPromptTemplateKey === 'dailyReview';
  const showUltraShortAnalysisPanel = selectedPromptTemplateKey === 'ultraShortAnalysis';
  const showPremarketPlanPanel = selectedPromptTemplateKey === 'premarketPlan';
  const showStockObservationPanel = selectedPromptTemplateKey === 'stockObservation';
  const showPlanValidationPanel = selectedPromptTemplateKey === 'planValidation';
  const dailyReviewHistory = useMemo(
    () => (selectedProvider ? getDailyReviewHistoryByProvider(selectedProvider.id) : []),
    [selectedProvider, dailyReviewHistoryVersion]
  );
  const ultraShortAnalysisHistory = useMemo(
    () => (selectedProvider ? getUltraShortAnalysisHistoryByProvider(selectedProvider.id) : []),
    [selectedProvider, ultraShortAnalysisHistoryVersion]
  );
  const premarketPlanHistory = useMemo(
    () => (selectedProvider ? getPremarketPlanHistoryByProvider(selectedProvider.id) : []),
    [selectedProvider, premarketPlanHistoryVersion]
  );
  const stockObservationHistory = useMemo(
    () => (selectedProvider ? getStockObservationHistoryByProvider(selectedProvider.id) : []),
    [selectedProvider, stockObservationHistoryVersion]
  );
  const planValidationHistory = useMemo(
    () => (selectedProvider ? getPlanValidationHistoryByProvider(selectedProvider.id) : []),
    [selectedProvider, planValidationHistoryVersion]
  );

  useEffect(() => {
    if (!selectedProviderId && settings.providers[0]) {
      setSelectedProviderId(settings.providers[0].id);
    }
  }, [selectedProviderId, settings.providers]);

  useEffect(() => {
    if (!copyFeedback) return;
    const timer = window.setTimeout(() => setCopyFeedback(''), 1800);
    return () => window.clearTimeout(timer);
  }, [copyFeedback]);

  useEffect(() => {
    if (!saveFeedback) return;
    const timer = window.setTimeout(() => setSaveFeedback(''), 1800);
    return () => window.clearTimeout(timer);
  }, [saveFeedback]);

  useEffect(() => {
    if (!planActionFeedback) return;
    const timer = window.setTimeout(() => setPlanActionFeedback(''), 2200);
    return () => window.clearTimeout(timer);
  }, [planActionFeedback]);

  useEffect(() => {
    setEditingDailyReview(false);
    setDailyReviewEditError('');
    setDailyReviewDraft(dailyReview?.content ?? '');
  }, [dailyReview]);

  useEffect(() => {
    setEditingUltraShortAnalysis(false);
    setUltraShortAnalysisEditError('');
    setUltraShortAnalysisDraft(ultraShortAnalysis?.content ?? '');
  }, [ultraShortAnalysis]);

  useEffect(() => {
    setEditingPremarketPlan(false);
    setPremarketPlanEditError('');
    setPremarketPlanDraft(premarketPlan?.content ?? '');
  }, [premarketPlan]);

  useEffect(() => {
    setEditingStockObservation(false);
    setStockObservationEditError('');
    setStockObservationDraft(stockObservation?.content ?? '');
  }, [stockObservation]);

  useEffect(() => {
    setEditingPlanValidation(false);
    setPlanValidationEditError('');
    setPlanValidationDraft(planValidation?.content ?? '');
  }, [planValidation]);

  useEffect(() => {
    if (!documentActionFeedback) return;
    const timer = window.setTimeout(() => setDocumentActionFeedback(null), 2200);
    return () => window.clearTimeout(timer);
  }, [documentActionFeedback]);

  useEffect(() => {
    if (!feishuFeedback) return;
    const timer = window.setTimeout(() => setFeishuFeedback(''), 2200);
    return () => window.clearTimeout(timer);
  }, [feishuFeedback]);

  const refreshFocusList = async () => {
    setFocusListLoading(true);
    try {
      const result = await loadFocusList();
      setFocusListItems(result.items);
      setFocusListMode(result.mode);
    } catch (error) {
      console.warn('Failed to load focus list', error);
      setFocusListItems([]);
      setFocusListMode('local');
    } finally {
      setFocusListLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedProvider) {
      setDailyReview(null);
      setSelectedDailyReviewId('');
      setUltraShortAnalysis(null);
      setSelectedUltraShortAnalysisId('');
      setPremarketPlan(null);
      setSelectedPremarketPlanId('');
      setStockObservation(null);
      setSelectedStockObservationId('');
      setPlanValidation(null);
      setSelectedPlanValidationId('');
      setDailyReviewError('');
      setUltraShortAnalysisError('');
      return;
    }
    const nextDailyReview = getLatestCachedDailyReviewByProvider(selectedProvider.id);
    const nextUltraShortAnalysis = getLatestCachedUltraShortAnalysisByProvider(selectedProvider.id);
    const nextPremarketPlan = getLatestCachedPremarketPlanByProvider(selectedProvider.id);
    const nextStockObservation = getLatestCachedStockObservationByProvider(selectedProvider.id);
    const nextPlanValidation = getLatestCachedPlanValidationByProvider(selectedProvider.id);
    setDailyReview(nextDailyReview);
    setSelectedDailyReviewId(nextDailyReview?.id ?? '');
    setUltraShortAnalysis(nextUltraShortAnalysis);
    setSelectedUltraShortAnalysisId(nextUltraShortAnalysis?.id ?? '');
    setPremarketPlan(nextPremarketPlan);
    setSelectedPremarketPlanId(nextPremarketPlan?.id ?? '');
    setStockObservation(nextStockObservation);
    setSelectedStockObservationId(nextStockObservation?.id ?? '');
    setStockObservationSymbol(nextStockObservation?.symbol ?? '');
    setPlanValidation(nextPlanValidation);
    setSelectedPlanValidationId(nextPlanValidation?.id ?? '');
    setDailyReviewError('');
    setUltraShortAnalysisError('');
    setPremarketPlanError('');
    setStockObservationError('');
    setPlanValidationError('');
  }, [selectedProvider]);

  useEffect(() => {
    if (!dailyReviewHistory.length) return;
    const next = dailyReviewHistory.find((item) => item.id === selectedDailyReviewId) ?? dailyReviewHistory[0];
    setDailyReview(next);
    if (selectedDailyReviewId !== next.id) {
      setSelectedDailyReviewId(next.id);
    }
  }, [dailyReviewHistory, selectedDailyReviewId]);

  useEffect(() => {
    if (!ultraShortAnalysisHistory.length) return;
    const next = ultraShortAnalysisHistory.find((item) => item.id === selectedUltraShortAnalysisId) ?? ultraShortAnalysisHistory[0];
    setUltraShortAnalysis(next);
    if (selectedUltraShortAnalysisId !== next.id) {
      setSelectedUltraShortAnalysisId(next.id);
    }
  }, [ultraShortAnalysisHistory, selectedUltraShortAnalysisId]);

  useEffect(() => {
    if (!premarketPlanHistory.length) return;
    const next = premarketPlanHistory.find((item) => item.id === selectedPremarketPlanId) ?? premarketPlanHistory[0];
    setPremarketPlan(next);
    if (selectedPremarketPlanId !== next.id) {
      setSelectedPremarketPlanId(next.id);
    }
  }, [premarketPlanHistory, selectedPremarketPlanId]);

  useEffect(() => {
    if (!stockObservationHistory.length) return;
    const next = stockObservationHistory.find((item) => item.id === selectedStockObservationId) ?? stockObservationHistory[0];
    setStockObservation(next);
    setStockObservationSymbol(next.symbol);
    if (selectedStockObservationId !== next.id) {
      setSelectedStockObservationId(next.id);
    }
  }, [stockObservationHistory, selectedStockObservationId]);

  useEffect(() => {
    if (!planValidationHistory.length) return;
    const next = planValidationHistory.find((item) => item.id === selectedPlanValidationId) ?? planValidationHistory[0];
    setPlanValidation(next);
    if (selectedPlanValidationId !== next.id) {
      setSelectedPlanValidationId(next.id);
    }
  }, [planValidationHistory, selectedPlanValidationId]);

  useEffect(() => {
    void refreshFocusList();
  }, []);

  useEffect(() => {
    const loadConfig = async () => {
      setFeishuLoading(true);
      setFeishuError('');
      try {
        const config = await loadFeishuBotConfig();
        setFeishuConfig(config);
      } catch (error) {
        setFeishuError(error instanceof Error ? error.message : '读取飞书配置失败');
      } finally {
        setFeishuLoading(false);
      }
    };
    void loadConfig();
  }, []);

  useEffect(() => {
    if (!isProviderDropdownOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!providerDropdownRef.current?.contains(event.target as Node)) {
        setIsProviderDropdownOpen(false);
      }
    };
    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, [isProviderDropdownOpen]);

  const handleSaveSettings = () => {
    const next = saveAIIntegrationSettings({
      ...settings,
      preferredProviderId: selectedProvider?.id ?? settings.preferredProviderId,
    });
    setSettings(next);
    setSaveFeedback('已保存到本地浏览器');
  };

  const handleAddProvider = (mode: ModelProviderMode) => {
    const nextProvider = createCustomProvider(mode);
    setSettings((current) => ({
      ...current,
      providers: [nextProvider, ...current.providers],
      preferredProviderId: current.preferredProviderId ?? nextProvider.id,
    }));
    setSelectedProviderId(nextProvider.id);
  };

  const handleDeleteProvider = (providerId: string) => {
    setSettings((current) => {
      const nextProviders = current.providers.filter((item) => item.id !== providerId);
      const nextSelected = nextProviders[0]?.id ?? null;
      setSelectedProviderId((prev) => (prev === providerId ? nextSelected : prev));
      return {
        ...current,
        providers: nextProviders,
        preferredProviderId:
          current.preferredProviderId === providerId ? nextSelected : current.preferredProviderId,
      };
    });
  };

  const updateProvider = (providerId: string, updater: (provider: ModelProviderConfig) => ModelProviderConfig) => {
    setSettings((current) => ({
      ...current,
      providers: current.providers.map((item) =>
        item.id === providerId ? { ...updater(item), updatedAt: new Date().toISOString() } : item
      ),
    }));
  };

  const handlePromptTemplateChange = (key: AIPromptTemplateKey, value: string) => {
    setSettings((current) => ({
      ...current,
      promptTemplates: {
        ...current.promptTemplates,
        [key]: value,
      },
    }));
  };

  const handleResetPromptTemplate = (key: AIPromptTemplateKey) => {
    const defaults = getDefaultPromptTemplates();
    handlePromptTemplateChange(key, defaults[key]);
    setSaveFeedback('模板已恢复默认');
  };

  const copyToClipboard = async (label: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopyFeedback(`${label} 已复制`);
    } catch (error) {
      console.warn(`Failed to copy ${label}`, error);
      setCopyFeedback(`复制 ${label} 失败`);
    }
  };

  const handleConnectionTest = async () => {
    if (!selectedProvider) return;
    setTestingProviderId(selectedProvider.id);
    const result = await testModelProviderConnection(selectedProvider);
    setConnectionResults((current) => ({
      ...current,
      [selectedProvider.id]: result,
    }));
    setTestingProviderId(null);
  };

  const handlePromptPingTest = async () => {
    if (!selectedProvider) return;
    setPingTestingProviderId(selectedProvider.id);
    const result = await testModelProviderPrompt(selectedProvider);
    setConnectionResults((current) => ({
      ...current,
      [selectedProvider.id]: result,
    }));
    setPingTestingProviderId(null);
  };

  const handleGenerateDailyReview = async () => {
    if (!selectedProvider) return;
    setGeneratingDailyReview(true);
    setDailyReviewError('');
    try {
      const entry = await generateAIDailyReview({ providerId: selectedProvider.id });
      setDailyReview(entry);
      setSelectedDailyReviewId(entry.id);
      setDailyReviewHistoryVersion((current) => current + 1);
    } catch (error) {
      setDailyReviewError(error instanceof Error ? error.message : '生成当日复盘失败');
    } finally {
      setGeneratingDailyReview(false);
    }
  };

  const handleStartEditDailyReview = () => {
    if (!dailyReview) return;
    setEditingDailyReview(true);
    setDailyReviewEditError('');
    setDailyReviewDraft(dailyReview.content);
  };

  const handleCancelEditDailyReview = () => {
    setEditingDailyReview(false);
    setDailyReviewEditError('');
    setDailyReviewDraft(dailyReview?.content ?? '');
  };

  const handleSaveDailyReviewEdit = () => {
    if (!dailyReview) return;
    const updated = updateStoredDailyReviewContent(dailyReview.id, dailyReviewDraft);
    if (!updated) {
      setDailyReviewEditError('保存失败：复盘内容不能为空。');
      return;
    }

    setDailyReview(updated);
    setEditingDailyReview(false);
    setDailyReviewEditError('');
    setDailyReviewHistoryVersion((current) => current + 1);
    setDocumentActionFeedback({
      scope: 'AI 当日复盘',
      message: '已保存当前 MD 内容',
    });
  };

  const handleStartEditUltraShortAnalysis = () => {
    if (!ultraShortAnalysis) return;
    setEditingUltraShortAnalysis(true);
    setUltraShortAnalysisEditError('');
    setUltraShortAnalysisDraft(ultraShortAnalysis.content);
  };

  const handleCancelEditUltraShortAnalysis = () => {
    setEditingUltraShortAnalysis(false);
    setUltraShortAnalysisEditError('');
    setUltraShortAnalysisDraft(ultraShortAnalysis?.content ?? '');
  };

  const handleSaveUltraShortAnalysisEdit = () => {
    if (!ultraShortAnalysis) return;
    const updated = updateStoredUltraShortAnalysisContent(ultraShortAnalysis.id, ultraShortAnalysisDraft);
    if (!updated) {
      setUltraShortAnalysisEditError('保存失败：分析内容不能为空。');
      return;
    }
    setUltraShortAnalysis(updated);
    setEditingUltraShortAnalysis(false);
    setUltraShortAnalysisEditError('');
    setUltraShortAnalysisHistoryVersion((current) => current + 1);
    setDocumentActionFeedback({
      scope: 'AI 超短线深度分析',
      message: '已保存当前 MD 内容',
    });
  };

  const handleStartEditPremarketPlan = () => {
    if (!premarketPlan) return;
    setEditingPremarketPlan(true);
    setPremarketPlanEditError('');
    setPremarketPlanDraft(premarketPlan.content);
  };

  const handleCancelEditPremarketPlan = () => {
    setEditingPremarketPlan(false);
    setPremarketPlanEditError('');
    setPremarketPlanDraft(premarketPlan?.content ?? '');
  };

  const handleSavePremarketPlanEdit = () => {
    if (!premarketPlan) return;
    const updated = updateStoredPremarketPlanContent(premarketPlan.id, premarketPlanDraft);
    if (!updated) {
      setPremarketPlanEditError('保存失败：盘前计划内容不能为空。');
      return;
    }
    setPremarketPlan(updated);
    setEditingPremarketPlan(false);
    setPremarketPlanEditError('');
    setPremarketPlanHistoryVersion((current) => current + 1);
    setDocumentActionFeedback({
      scope: '盘前计划',
      message: '已保存当前 MD 内容',
    });
  };

  const handleStartEditStockObservation = () => {
    if (!stockObservation) return;
    setEditingStockObservation(true);
    setStockObservationEditError('');
    setStockObservationDraft(stockObservation.content);
  };

  const handleCancelEditStockObservation = () => {
    setEditingStockObservation(false);
    setStockObservationEditError('');
    setStockObservationDraft(stockObservation?.content ?? '');
  };

  const handleSaveStockObservationEdit = () => {
    if (!stockObservation) return;
    const updated = updateStoredStockObservationContent(stockObservation.id, stockObservationDraft);
    if (!updated) {
      setStockObservationEditError('保存失败：个股观察内容不能为空。');
      return;
    }
    setStockObservation(updated);
    setEditingStockObservation(false);
    setStockObservationEditError('');
    setStockObservationHistoryVersion((current) => current + 1);
    setDocumentActionFeedback({
      scope: '个股观察',
      message: '已保存当前 MD 内容',
    });
  };

  const handleStartEditPlanValidation = () => {
    if (!planValidation) return;
    setEditingPlanValidation(true);
    setPlanValidationEditError('');
    setPlanValidationDraft(planValidation.content);
  };

  const handleCancelEditPlanValidation = () => {
    setEditingPlanValidation(false);
    setPlanValidationEditError('');
    setPlanValidationDraft(planValidation?.content ?? '');
  };

  const handleSavePlanValidationEdit = () => {
    if (!planValidation) return;
    const updated = updateStoredPlanValidationContent(planValidation.id, planValidationDraft);
    if (!updated) {
      setPlanValidationEditError('保存失败：次日校验内容不能为空。');
      return;
    }
    setPlanValidation(updated);
    setEditingPlanValidation(false);
    setPlanValidationEditError('');
    setPlanValidationHistoryVersion((current) => current + 1);
    setDocumentActionFeedback({
      scope: '次日校验',
      message: '已保存当前 MD 内容',
    });
  };

  const handleGenerateUltraShortAnalysis = async () => {
    if (!selectedProvider) return;
    setGeneratingUltraShortAnalysis(true);
    setUltraShortAnalysisError('');
    try {
      const entry = await generateAIUltraShortAnalysis({ providerId: selectedProvider.id });
      setUltraShortAnalysis(entry);
      setSelectedUltraShortAnalysisId(entry.id);
      setUltraShortAnalysisHistoryVersion((current) => current + 1);
    } catch (error) {
      setUltraShortAnalysisError(error instanceof Error ? error.message : '生成 AI 超短线深度分析失败');
    } finally {
      setGeneratingUltraShortAnalysis(false);
    }
  };

  const handleGeneratePremarketPlan = async () => {
    if (!selectedProvider) return;
    setGeneratingPremarketPlan(true);
    setPremarketPlanError('');
    try {
      const entry = await generateAIPremarketPlan({ providerId: selectedProvider.id });
      setPremarketPlan(entry);
      setSelectedPremarketPlanId(entry.id);
      setPremarketPlanHistoryVersion((current) => current + 1);
    } catch (error) {
      setPremarketPlanError(error instanceof Error ? error.message : '生成盘前计划失败');
    } finally {
      setGeneratingPremarketPlan(false);
    }
  };

  const handleCopyDocument = async (title: string, content: string) => {
    try {
      await copyPlainText(content);
      setDocumentActionFeedback({
        scope: title as DocumentActionFeedback['scope'],
        message: `${title} 复制成功`,
      });
    } catch (error) {
      console.warn(`Failed to copy ${title}`, error);
      setDocumentActionFeedback({
        scope: title as DocumentActionFeedback['scope'],
        message: `${title} 复制失败`,
      });
    }
  };

  const handleExportMarkdown = (title: string, content: string, subtitle: string) => {
    try {
      exportTextAsMarkdown(title, content, subtitle);
      setDocumentActionFeedback({
        scope: title as DocumentActionFeedback['scope'],
        message: 'Markdown 文件已下载',
      });
    } catch (error) {
      console.warn(`Failed to export ${title} as markdown`, error);
      setDocumentActionFeedback({
        scope: title as DocumentActionFeedback['scope'],
        message: 'Markdown 下载失败',
      });
    }
  };

  const handleAddObservedSymbols = async () => {
    if (observedSymbols.length === 0) {
      setPlanActionFeedback('盘前计划里没有识别到股票代码');
      return;
    }
    try {
      const result = await addSymbolsToFocusList(observedSymbols);
      const modeLabel = result.mode === 'remote' ? '自选' : '本地重点关注';
      await refreshFocusList();
      if (result.addedSymbols.length === 0) {
        setPlanActionFeedback(`观察标的已存在于${modeLabel}`);
        return;
      }
      setPlanActionFeedback(`已加入${modeLabel}: ${result.addedSymbols.join('、')}`);
    } catch (error) {
      console.warn('Failed to add observed symbols', error);
      setPlanActionFeedback(error instanceof Error ? error.message : '加入自选失败');
    }
  };

  const handleGeneratePlanValidation = async () => {
    if (!selectedProvider) return;
    setGeneratingPlanValidation(true);
    setPlanValidationError('');
    try {
      const entry = await generateAIPlanValidation({ providerId: selectedProvider.id });
      setPlanValidation(entry);
      setSelectedPlanValidationId(entry.id);
      setPlanValidationHistoryVersion((current) => current + 1);
    } catch (error) {
      setPlanValidationError(error instanceof Error ? error.message : '生成次日校验失败');
    } finally {
      setGeneratingPlanValidation(false);
    }
  };

  const updateFeishuConfig = (key: keyof FeishuBotConfig, value: string) => {
    setFeishuConfig((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleSaveFeishuConfig = async () => {
    setFeishuSaving(true);
    setFeishuError('');
    try {
      const saved = await saveFeishuBotConfig(feishuConfig);
      setFeishuConfig(saved);
      setFeishuFeedback('飞书配置已写入 .env.local');
    } catch (error) {
      setFeishuError(error instanceof Error ? error.message : '保存飞书配置失败');
    } finally {
      setFeishuSaving(false);
    }
  };

  const handleTestFeishuConfig = async () => {
    setFeishuTesting(true);
    setFeishuError('');
    try {
      const result = await testFeishuBotConfig(feishuConfig);
      setFeishuTestResult(result);
    } catch (error) {
      setFeishuError(error instanceof Error ? error.message : '测试飞书配置失败');
    } finally {
      setFeishuTesting(false);
    }
  };

  const generateStockObservationForSymbol = async (symbol: string) => {
    if (!selectedProvider) return;
    const normalizedSymbol = symbol.trim();
    if (!normalizedSymbol) return;
    setGeneratingStockObservation(true);
    setStockObservationError('');
    try {
      const entry = await generateAIStockObservation({
        providerId: selectedProvider.id,
        symbol: normalizedSymbol,
      });
      setStockObservation(entry);
      setSelectedStockObservationId(entry.id);
      setStockObservationSymbol(entry.symbol);
      setStockObservationHistoryVersion((current) => current + 1);
    } catch (error) {
      setStockObservationError(error instanceof Error ? error.message : '生成个股观察失败');
    } finally {
      setGeneratingStockObservation(false);
    }
  };

  const handleGenerateStockObservation = async () => {
    await generateStockObservationForSymbol(stockObservationSymbol);
  };

  const openStockObservation = async (symbol: string, sourceLabel: string) => {
    const normalizedSymbol = symbol.trim();
    if (!normalizedSymbol) return;
    setStockObservationSymbol(normalizedSymbol);
    setSelectedPromptTemplateKey('stockObservation');
    setPlanActionFeedback(`已从${sourceLabel}切到个股观察：${normalizedSymbol}`);
    stockObservationSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    await generateStockObservationForSymbol(normalizedSymbol);
  };

  const handleAddCurrentObservationToFocusList = async () => {
    if (!stockObservation) return;
    try {
      const result = await addSymbolsToFocusList([stockObservation.symbol]);
      await refreshFocusList();
      const modeLabel = result.mode === 'remote' ? '自选' : '本地重点关注';
      if (result.addedSymbols.length === 0) {
        setPlanActionFeedback(`${stockObservation.symbol} 已存在于${modeLabel}`);
        return;
      }
      setPlanActionFeedback(`已加入${modeLabel}: ${stockObservation.symbol}`);
    } catch (error) {
      console.warn('Failed to add current stock observation to focus list', error);
      setPlanActionFeedback(error instanceof Error ? error.message : '加入自选失败');
    }
  };

  useEffect(() => {
    if (!stockObservationRequest || !selectedProvider) return;
    const normalizedSymbol = stockObservationRequest.symbol.trim();
    if (!normalizedSymbol) {
      onStockObservationRequestHandled?.(stockObservationRequest);
      return;
    }
    setActiveIntegrationTab('ai');
    setStockObservationSymbol(normalizedSymbol);
    setSelectedPromptTemplateKey('stockObservation');
    setPlanActionFeedback(`已切换到个股观察：${normalizedSymbol}`);
    stockObservationSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    void generateStockObservationForSymbol(normalizedSymbol).finally(() => {
      onStockObservationRequestHandled?.(stockObservationRequest);
    });
  }, [stockObservationRequest, selectedProvider, onStockObservationRequestHandled]);

  const activeTabMeta = {
    models: {
      title: '模型对接',
      description: '管理云端和本地模型线路、默认模型、接口连通性与本地接入策略。',
      badge: `${configuredProviders.length} 条可用配置`,
      icon: <Cpu size={16} />,
    },
    ai: {
      title: '提示词模板 / AI复盘',
      description: '维护提示词模板，并直接生成复盘、盘前计划、个股观察和次日校验。',
      badge: selectedProvider?.displayName ?? '未选择模型',
      icon: <Sparkles size={16} />,
    },
    feishu: {
      title: '飞书对接',
      description: '配置飞书机器人参数、AI 调用线路，并在写入环境前完成联通性测试。',
      badge: feishuTestResult?.statusLabel ?? '待测试',
      icon: <PlugZap size={16} />,
    },
  }[activeIntegrationTab];

  return (
    <div className="h-full overflow-auto pr-1">
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
            { key: 'models', label: '模型对接', hint: '模型线路、默认模型、连通性' },
            { key: 'ai', label: '提示词模板 / AI复盘', hint: '模板编辑、复盘与计划输出' },
            { key: 'feishu', label: '飞书对接', hint: '机器人参数、环境保存、测试' },
          ].map((tab) => {
            const isActive = activeIntegrationTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveIntegrationTab(tab.key as 'models' | 'ai' | 'feishu')}
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

      <div className={`grid grid-cols-1 gap-6 ${activeIntegrationTab === 'models' ? 'xl:grid-cols-[360px_minmax(0,1fr)]' : ''}`}>
        <div className="space-y-6">
          {activeIntegrationTab === 'models' && (
            <GlassCard title="模型线路">
              <div className="grid grid-cols-1 gap-3">
                <div className="rounded-xl border border-slate-200/70 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-cyan-500/15 p-2 text-cyan-500">
                      <Cpu size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-gray-100">{settings.providers.length} 条模型线路</p>
                      <p className="text-xs text-slate-500 dark:text-gray-400">云端 token 和本地模型统一管理</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200/70 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-emerald-500/15 p-2 text-emerald-500">
                      <CheckCircle2 size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-gray-100">{configuredProviders.length} 条可用配置</p>
                      <p className="text-xs text-slate-500 dark:text-gray-400">
                        云端按已填写 API Key 统计，本地按已手动启用统计
                      </p>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200/70 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-violet-500/15 p-2 text-violet-500">
                      <KeyRound size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-gray-100">{configuredCloudProviders.length} 条云端已填 Key</p>
                      <p className="text-xs text-slate-500 dark:text-gray-400">{localProviders.length} 条本地线路可单独启用</p>
                    </div>
                  </div>
                </div>
              </div>
            </GlassCard>
          )}

          {activeIntegrationTab === 'feishu' && (
            <GlassCard
              title="飞书机器人"
              action={
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleTestFeishuConfig}
                    disabled={feishuLoading || feishuTesting}
                    className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 px-3 py-2 text-sm font-medium text-emerald-600 hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60 dark:text-emerald-300"
                  >
                    {feishuTesting ? <Loader2 size={16} className="animate-spin" /> : <PlugZap size={16} />}
                    测试参数
                  </button>
                  <button
                    onClick={handleSaveFeishuConfig}
                    disabled={feishuLoading || feishuSaving}
                    className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {feishuSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    保存到环境
                  </button>
                </div>
              }
            >
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200/70 bg-white/70 p-4 text-sm leading-6 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
                  这里配置的是飞书问答机器人使用的本地环境参数，保存后会写入项目根目录 `.env.local`。当前只做参数管理和联通性测试，启动命令仍是 `npm run feishu:bot`。
                </div>

                {feishuFeedback && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">
                    {feishuFeedback}
                  </div>
                )}

                {feishuError && (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300">
                    {feishuError}
                  </div>
                )}

                {feishuTestResult && (
                  <div className={`rounded-xl border p-4 text-sm ${
                    feishuTestResult.kind === 'success'
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                      : feishuTestResult.kind === 'warning'
                        ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                        : 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
                  }`}>
                    <div className="font-medium">{feishuTestResult.statusLabel}</div>
                    <div className="mt-1 leading-6">{feishuTestResult.detail}</div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700 dark:text-gray-300">FEISHU_APP_ID</span>
                    <input
                      value={feishuConfig.appId}
                      onChange={(event) => updateFeishuConfig('appId', event.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-cyan-500 dark:border-white/10 dark:bg-white/5"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700 dark:text-gray-300">FEISHU_APP_SECRET</span>
                    <input
                      type="password"
                      value={feishuConfig.appSecret}
                      onChange={(event) => updateFeishuConfig('appSecret', event.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-cyan-500 dark:border-white/10 dark:bg-white/5"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700 dark:text-gray-300">FEISHU_BOT_VERIFICATION_TOKEN</span>
                    <input
                      value={feishuConfig.verificationToken}
                      onChange={(event) => updateFeishuConfig('verificationToken', event.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-cyan-500 dark:border-white/10 dark:bg-white/5"
                    />
                  </label>
                  <div className="rounded-xl border border-slate-200/70 bg-white/70 px-4 py-3 text-sm leading-6 text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-400">
                    当前飞书脚本默认跑长连接模式，这个 token 主要用于兼容事件配置和后续回调场景。
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700 dark:text-gray-300">FEISHU_BOT_AI_BASE_URL</span>
                    <input
                      value={feishuConfig.aiBaseUrl}
                      onChange={(event) => updateFeishuConfig('aiBaseUrl', event.target.value)}
                      placeholder="例如 https://api.openai.com/v1"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-cyan-500 dark:border-white/10 dark:bg-white/5"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700 dark:text-gray-300">FEISHU_BOT_AI_API_KEY</span>
                    <input
                      type="password"
                      value={feishuConfig.aiApiKey}
                      onChange={(event) => updateFeishuConfig('aiApiKey', event.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-cyan-500 dark:border-white/10 dark:bg-white/5"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700 dark:text-gray-300">FEISHU_BOT_AI_MODEL</span>
                    <input
                      value={feishuConfig.aiModel}
                      onChange={(event) => updateFeishuConfig('aiModel', event.target.value)}
                      placeholder="例如 gpt-5.4"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-cyan-500 dark:border-white/10 dark:bg-white/5"
                    />
                  </label>
                </div>
              </div>
            </GlassCard>
          )}

          {activeIntegrationTab === 'models' && (
          <GlassCard title="模型列表">
            <div className="space-y-4">
              <label className="space-y-2 block">
                <span className="text-sm font-medium text-slate-700 dark:text-gray-300">选择模型线路</span>
                <div ref={providerDropdownRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setIsProviderDropdownOpen((prev) => !prev)}
                    className={`${PROVIDER_SELECT_CARD_CLASS_NAME} flex items-center justify-between gap-3`}
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">
                        {selectedProvider?.displayName ?? '请选择模型'}
                      </div>
                      <div className="mt-1 truncate text-xs text-slate-500 dark:text-gray-400">
                        {selectedProvider
                          ? `${providerTypeLabel[selectedProvider.mode]} · ${selectedProvider.model || '未设置模型'}`
                          : '云端模型 / 本地模型'}
                      </div>
                    </div>
                    <ChevronDown
                      size={16}
                      className={`shrink-0 text-slate-400 transition-transform dark:text-gray-500 ${
                        isProviderDropdownOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {isProviderDropdownOpen && (
                    <div className="absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_20px_40px_rgba(15,23,42,0.12)] dark:border-white/10 dark:bg-slate-950">
                      <div className="max-h-80 overflow-auto p-2 custom-scrollbar">
                        {cloudProviders.length > 0 && (
                          <div className="mb-2">
                            <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-gray-500">
                              云端模型
                            </div>
                            <div className="space-y-1">
                              {cloudProviders.map((item) => (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedProviderId(item.id);
                                    setIsProviderDropdownOpen(false);
                                  }}
                                  className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                                    selectedProviderId === item.id
                                      ? 'border-cyan-200 bg-cyan-50 text-cyan-700 shadow-[0_10px_24px_rgba(34,211,238,0.12)] dark:border-cyan-500/20 dark:bg-cyan-500/10 dark:text-cyan-300'
                                      : 'border-transparent bg-slate-50/70 hover:border-slate-200 hover:bg-white dark:bg-white/[0.03] dark:hover:border-white/10 dark:hover:bg-white/[0.05]'
                                  }`}
                                >
                                  <div className="flex items-start gap-3">
                                    <span
                                      className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                                        item.enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-gray-600'
                                      }`}
                                    />
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="truncate text-sm font-medium">{item.displayName}</span>
                                        {item.enabled && <Badge variant="green">已启用</Badge>}
                                      </div>
                                      <div className="mt-1 truncate text-xs text-slate-500 dark:text-gray-400">
                                        {item.model || '未设置模型'}
                                      </div>
                                      <div className="mt-1 truncate text-[11px] text-slate-400 dark:text-gray-500">
                                        {maskApiKey(item.apiKey)}
                                      </div>
                                    </div>
                                    <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-500 dark:border-white/10 dark:bg-slate-900 dark:text-gray-400">
                                      {item.protocol}
                                    </span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        {localProviders.length > 0 && (
                          <div>
                            <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-gray-500">
                              本地模型
                            </div>
                            <div className="space-y-1">
                              {localProviders.map((item) => (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedProviderId(item.id);
                                    setIsProviderDropdownOpen(false);
                                  }}
                                  className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                                    selectedProviderId === item.id
                                      ? 'border-cyan-200 bg-cyan-50 text-cyan-700 shadow-[0_10px_24px_rgba(34,211,238,0.12)] dark:border-cyan-500/20 dark:bg-cyan-500/10 dark:text-cyan-300'
                                      : 'border-transparent bg-slate-50/70 hover:border-slate-200 hover:bg-white dark:bg-white/[0.03] dark:hover:border-white/10 dark:hover:bg-white/[0.05]'
                                  }`}
                                >
                                  <div className="flex items-start gap-3">
                                    <span
                                      className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                                        item.enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-gray-600'
                                      }`}
                                    />
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="truncate text-sm font-medium">{item.displayName}</span>
                                        {item.enabled && <Badge variant="green">已启用</Badge>}
                                      </div>
                                      <div className="mt-1 truncate text-xs text-slate-500 dark:text-gray-400">
                                        {item.model || '未设置模型'}
                                      </div>
                                      <div className="mt-1 truncate text-[11px] text-slate-400 dark:text-gray-500">
                                        {maskApiKey(item.apiKey)}
                                      </div>
                                    </div>
                                    <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-500 dark:border-white/10 dark:bg-slate-900 dark:text-gray-400">
                                      {item.protocol}
                                    </span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </label>

              {selectedProvider && (
                <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-[0_14px_32px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-slate-950 dark:shadow-none">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-300">
                      <Cpu size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-800 dark:text-gray-100">{selectedProvider.displayName}</span>
                        <Badge variant={selectedProvider.mode === 'cloud' ? 'blue' : 'purple'}>{providerTypeLabel[selectedProvider.mode]}</Badge>
                        {selectedProvider.enabled ? <Badge variant="green">已启用</Badge> : <Badge variant="outline">未启用</Badge>}
                        {selectedProviderTestResult?.kind === 'success' && <Badge variant="blue">连通成功</Badge>}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-gray-400">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            selectedProvider.enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-gray-600'
                          }`}
                        />
                        <span>{selectedProvider.enabled ? '当前已加入 AI 生成功能，可再单独做连通性测试' : '当前不会参与 AI 生成功能'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl bg-slate-50 px-3 py-3 dark:bg-white/[0.04]">
                      <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400 dark:text-gray-500">模型</div>
                      <div className="mt-1 truncate text-sm text-slate-700 dark:text-gray-200">{selectedProvider.model || '未设置'}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-3 py-3 dark:bg-white/[0.04]">
                      <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400 dark:text-gray-500">协议</div>
                      <div className="mt-1 truncate text-sm text-slate-700 dark:text-gray-200">{selectedProvider.protocol}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-3 py-3 dark:bg-white/[0.04]">
                      <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400 dark:text-gray-500">Token</div>
                      <div className="mt-1 truncate text-sm text-slate-700 dark:text-gray-200">{maskApiKey(selectedProvider.apiKey)}</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  onClick={() => handleAddProvider('cloud')}
                  className="inline-flex items-center justify-center gap-1 rounded-lg border border-cyan-500/30 px-3 py-2 text-sm font-medium text-cyan-600 dark:text-cyan-300 hover:bg-cyan-500/10"
                >
                  <Plus size={14} />
                  新增云端模型
                </button>
                <button
                  onClick={() => handleAddProvider('local')}
                  className="inline-flex items-center justify-center gap-1 rounded-lg border border-cyan-500/30 px-3 py-2 text-sm font-medium text-cyan-600 dark:text-cyan-300 hover:bg-cyan-500/10"
                >
                  <Plus size={14} />
                  新增本地模型
                </button>
              </div>
            </div>
          </GlassCard>
          )}
        </div>

        <div className="space-y-6">
          {activeIntegrationTab === 'ai' && (
            <GlassCard
              title="提示词模板"
              action={
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyToClipboard('提示词模板', selectedPromptTemplate)}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:border-cyan-500/40 dark:border-white/10"
                  >
                    <Copy size={14} />
                    复制模板
                  </button>
                  <button
                    onClick={() => handleResetPromptTemplate(selectedPromptTemplateKey)}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:border-cyan-500/40 dark:border-white/10"
                  >
                    恢复默认
                  </button>
                  <button
                    onClick={handleSaveSettings}
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
                      onClick={() => setSelectedPromptTemplateKey(tab.key)}
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
                    {promptTemplateTabs.find((item) => item.key === selectedPromptTemplateKey)?.label}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-gray-400">
                    {promptTemplateTabs.find((item) => item.key === selectedPromptTemplateKey)?.hint}
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
                        onClick={handleGenerateStockObservation}
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
                        onChange={(event) => setStockObservationSymbol(event.target.value.trim())}
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
                  onChange={(event) => handlePromptTemplateChange(selectedPromptTemplateKey, event.target.value)}
                  rows={16}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm leading-7 text-slate-800 outline-none transition focus:border-cyan-500 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
            </GlassCard>
          )}

          {activeIntegrationTab === 'models' && (
          <div className="space-y-6">

          <GlassCard
            title="模型配置"
            action={
              <div className="flex items-center gap-2">
                <button
                  onClick={selectedProvider ? handlePromptPingTest : undefined}
                  disabled={!selectedProvider || pingTestingProviderId === selectedProvider.id}
                  className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/30 px-3 py-2 text-sm font-medium text-cyan-600 hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-60 dark:text-cyan-300"
                >
                  {pingTestingProviderId === selectedProvider?.id ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                  快速测试
                </button>
                <button
                  onClick={selectedProvider ? handleConnectionTest : undefined}
                  disabled={!selectedProvider || testingProviderId === selectedProvider.id}
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 px-3 py-2 text-sm font-medium text-emerald-600 hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60 dark:text-emerald-300"
                >
                  {testingProviderId === selectedProvider?.id ? <Loader2 size={16} className="animate-spin" /> : <PlugZap size={16} />}
                  连通性测试
                </button>
                <button
                  onClick={handleSaveSettings}
                  className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-500"
                >
                  <Save size={16} />
                  保存配置
                </button>
              </div>
            }
          >
            {!selectedProvider ? (
              <div className="flex min-h-[220px] items-center justify-center text-sm text-slate-500 dark:text-gray-400">
                先新增一条模型线路。
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700 dark:text-gray-300">显示名称</span>
                    <input
                      value={selectedProvider.displayName}
                      onChange={(event) =>
                        updateProvider(selectedProvider.id, (provider) => ({
                          ...provider,
                          displayName: event.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-cyan-500 dark:border-white/10 dark:bg-white/5"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700 dark:text-gray-300">模型名</span>
                    <input
                      value={selectedProvider.model}
                      onChange={(event) =>
                        updateProvider(selectedProvider.id, (provider) => ({
                          ...provider,
                          model: event.target.value,
                        }))
                      }
                      placeholder="例如 gpt-5.4 / deepseek-reasoner / qwen2.5:14b-instruct"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-cyan-500 dark:border-white/10 dark:bg-white/5"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700 dark:text-gray-300">线路类型</span>
                    <select
                      value={selectedProvider.mode}
                      onChange={(event) =>
                        updateProvider(selectedProvider.id, (provider) => ({
                          ...provider,
                          mode: event.target.value as ModelProviderMode,
                        }))
                      }
                      className={SELECT_CLASS_NAME}
                    >
                      <option value="cloud">云端模型</option>
                      <option value="local">本地模型</option>
                    </select>
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700 dark:text-gray-300">协议</span>
                    <select
                      value={selectedProvider.protocol}
                      onChange={(event) =>
                        updateProvider(selectedProvider.id, (provider) => ({
                          ...provider,
                          protocol: event.target.value as ModelProviderProtocol,
                        }))
                      }
                      className={SELECT_CLASS_NAME}
                    >
                      {protocolOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700 dark:text-gray-300">启用状态</span>
                    <select
                      value={selectedProvider.enabled ? 'enabled' : 'disabled'}
                      onChange={(event) =>
                        updateProvider(selectedProvider.id, (provider) => ({
                          ...provider,
                          enabled: event.target.value === 'enabled',
                        }))
                      }
                      className={SELECT_CLASS_NAME}
                    >
                      <option value="enabled">启用</option>
                      <option value="disabled">停用</option>
                    </select>
                  </label>
                </div>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700 dark:text-gray-300">Base URL</span>
                  <input
                    value={selectedProvider.baseUrl}
                    onChange={(event) =>
                      updateProvider(selectedProvider.id, (provider) => ({
                        ...provider,
                        baseUrl: event.target.value,
                      }))
                    }
                    placeholder="例如 https://api.openai.com/v1 或 http://127.0.0.1:11434/v1"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-cyan-500 dark:border-white/10 dark:bg-white/5"
                  />
                </label>

                <label className="space-y-2">
                  <span className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-gray-300">
                    <KeyRound size={14} />
                    Token / API Key
                  </span>
                  <input
                    type="password"
                    value={selectedProvider.apiKey}
                    onChange={(event) =>
                      updateProvider(selectedProvider.id, (provider) => ({
                        ...provider,
                        apiKey: event.target.value,
                      }))
                    }
                    placeholder={selectedProvider.mode === 'local' ? '本地模型通常可留空' : '填写你的 API Token'}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-cyan-500 dark:border-white/10 dark:bg-white/5"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700 dark:text-gray-300">备注</span>
                  <textarea
                    value={selectedProvider.notes ?? ''}
                    onChange={(event) =>
                      updateProvider(selectedProvider.id, (provider) => ({
                        ...provider,
                        notes: event.target.value,
                      }))
                    }
                    rows={3}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-cyan-500 dark:border-white/10 dark:bg-white/5"
                  />
                </label>

                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-gray-400">
                  <button
                    onClick={() =>
                      setSettings((current) => ({
                        ...current,
                        preferredProviderId: selectedProvider.id,
                      }))
                    }
                    className="rounded-lg border border-slate-200 px-3 py-2 hover:border-cyan-500/40 hover:text-cyan-600 dark:border-white/10 dark:hover:text-cyan-300"
                  >
                    设为默认分析模型
                  </button>
                  <button
                    onClick={() => handleDeleteProvider(selectedProvider.id)}
                    className="rounded-lg border border-rose-500/30 px-3 py-2 text-rose-500 hover:bg-rose-500/10"
                  >
                    删除当前线路
                  </button>
                  <span>最近保存：{new Date(settings.updatedAt).toLocaleString()}</span>
                </div>

                {selectedProviderTestResult && (
                  <div
                    className={`rounded-xl border p-4 text-sm ${
                      selectedProviderTestResult.kind === 'success'
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                        : selectedProviderTestResult.kind === 'warning'
                          ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                          : 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-medium">
                      <PlugZap size={15} />
                      {selectedProviderTestResult.statusLabel}
                    </div>
                    <p className="mt-2 leading-6">{selectedProviderTestResult.detail}</p>
                    <p className="mt-2 text-xs opacity-80">
                      最后检测：{new Date(selectedProviderTestResult.checkedAt).toLocaleString()}
                    </p>
                  </div>
                )}

                {selectedProvider.protocol === 'openai' && selectedProvider.mode === 'cloud' && (
                  <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-sm leading-6 text-slate-700 dark:text-cyan-100">
                    <div className="font-medium text-slate-900 dark:text-white">OpenAI 兼容填写参考</div>
                    <p className="mt-2">
                      如果你用的是硅基流动，Base URL 通常填 `https://api.siliconflow.cn/v1`。
                      模型名请以你自己账户里实际可用的名称为准，例如你当前在用的 `Pro/deepseek-ai/DeepSeek-V3.2`。
                    </p>
                    <p className="mt-2">
                      `连通性测试` 只检查接口是否可达；`快速测试` 会真的向当前模型发一个最小 `ping` 请求，更接近实际生成。
                    </p>
                  </div>
                )}
              </div>
            )}
          </GlassCard>

          <GlassCard title="本地模型">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="rounded-xl border border-slate-200/70 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                <div className="text-sm font-semibold text-slate-800 dark:text-gray-100">Ollama</div>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-gray-300">
                  地址通常填 `http://127.0.0.1:11434/v1`，模型填本地已拉取的名称。
                </p>
              </div>
              <div className="rounded-xl border border-slate-200/70 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                <div className="text-sm font-semibold text-slate-800 dark:text-gray-100">LM Studio</div>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-gray-300">
                  先开启 OpenAI Compatible Server，再填 `http://127.0.0.1:1234/v1`。
                </p>
              </div>
              <div className="rounded-xl border border-slate-200/70 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                <div className="text-sm font-semibold text-slate-800 dark:text-gray-100">自建服务</div>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-gray-300">
                  只要你的网关或推理服务兼容 OpenAI 接口，就能直接接入这一页。
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200/70 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
              <div className="text-sm font-semibold text-slate-800 dark:text-gray-100">当前策略</div>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-gray-300">
                当前真正使用的 AI 功能只保留两项：`AI 当日复盘` 和 `盘前计划`。模型配置、提示词模板、本地模型接入都围绕这两项服务。
              </p>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-gray-400">
              {settings.preferredProviderId && (
                <Badge variant="green">
                  默认模型：
                  {settings.providers.find((item) => item.id === settings.preferredProviderId)?.displayName ?? '未设置'}
                </Badge>
              )}
              {copyFeedback && <Badge variant="blue">{copyFeedback}</Badge>}
              {saveFeedback && <Badge variant="purple">{saveFeedback}</Badge>}
              {planActionFeedback && <Badge variant="blue">{planActionFeedback}</Badge>}
            </div>
          </GlassCard>
          </div>
          )}

          {activeIntegrationTab === 'ai' && (
          <>
          {selectedPromptTemplateKey === 'reportSummary' && (
            <GlassCard title="研报摘要">
              <div className="rounded-xl border border-slate-200/70 bg-white/70 p-6 text-sm leading-7 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
                当前切换的是 <code>研报摘要模板</code>。研报摘要的实际使用入口在 <code>信息采集 / 研报 / AI 摘要</code>，这里不再重复展示其它 AI 分析模块。
              </div>
            </GlassCard>
          )}

          {showUltraShortAnalysisPanel && (
            <GlassCard title="AI 超短线深度分析">
              <div className="space-y-4">
                <div className="flex justify-end">
                  <button
                    onClick={handleGenerateUltraShortAnalysis}
                    disabled={!selectedProvider || generatingUltraShortAnalysis}
                    className="inline-flex items-center gap-2 rounded-lg bg-fuchsia-600 px-3 py-2 text-sm font-medium text-white hover:bg-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {generatingUltraShortAnalysis ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    生成超短分析
                  </button>
                </div>

                <div className="rounded-xl border border-slate-200/70 bg-white/70 p-4 text-sm leading-6 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
                  这份分析更偏 1 到 3 个交易日节奏，重点看情绪强弱、接力环境、龙头溢价、主线持续性和高风险动作。
                </div>

                {ultraShortAnalysisError && (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm leading-6 text-rose-700 dark:text-rose-300">
                    {ultraShortAnalysisError}
                  </div>
                )}

                {ultraShortAnalysisHistory.length > 0 && (
                  <select
                    value={selectedUltraShortAnalysisId}
                    onChange={(event) => setSelectedUltraShortAnalysisId(event.target.value)}
                    className={SELECT_CLASS_NAME}
                  >
                    {ultraShortAnalysisHistory.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.analysisDate} · {new Date(item.generatedAt).toLocaleString()}
                      </option>
                    ))}
                  </select>
                )}

                {ultraShortAnalysis && (
                  <div className="rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/10 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <Badge variant="purple">{ultraShortAnalysis.providerName}</Badge>
                        <Badge variant="outline">最近交易日 {ultraShortAnalysis.analysisDate}</Badge>
                        <span className="text-xs text-slate-500 dark:text-gray-400">
                          生成于 {new Date(ultraShortAnalysis.generatedAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {!editingUltraShortAnalysis ? (
                          <button
                            onClick={handleStartEditUltraShortAnalysis}
                            className="inline-flex items-center gap-2 rounded-lg border border-fuchsia-300/60 px-3 py-2 text-xs font-medium text-fuchsia-700 hover:bg-fuchsia-100/80 dark:border-fuchsia-500/30 dark:text-fuchsia-200 dark:hover:bg-fuchsia-500/10"
                          >
                            <Pencil size={14} />
                            编辑 MD
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={handleSaveUltraShortAnalysisEdit}
                              className="inline-flex items-center gap-2 rounded-lg border border-emerald-300/60 px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-100/80 dark:border-emerald-500/30 dark:text-emerald-200 dark:hover:bg-emerald-500/10"
                            >
                              <Save size={14} />
                              保存修改
                            </button>
                            <button
                              onClick={handleCancelEditUltraShortAnalysis}
                              className="inline-flex items-center gap-2 rounded-lg border border-slate-300/60 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100/80 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
                            >
                              <X size={14} />
                              取消
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleCopyDocument('AI 超短线深度分析', ultraShortAnalysis.content)}
                          className="inline-flex items-center gap-2 rounded-lg border border-fuchsia-300/60 px-3 py-2 text-xs font-medium text-fuchsia-700 hover:bg-fuchsia-100/80 dark:border-fuchsia-500/30 dark:text-fuchsia-200 dark:hover:bg-fuchsia-500/10"
                        >
                          <Copy size={14} />
                          一键复制
                        </button>
                        <button
                          onClick={() =>
                            handleExportMarkdown(
                              'AI 超短线深度分析',
                              ultraShortAnalysis.content,
                              `最近交易日 ${ultraShortAnalysis.analysisDate} · ${ultraShortAnalysis.providerName}`
                            )
                          }
                          className="inline-flex items-center gap-2 rounded-lg border border-fuchsia-300/60 px-3 py-2 text-xs font-medium text-fuchsia-700 hover:bg-fuchsia-100/80 dark:border-fuchsia-500/30 dark:text-fuchsia-200 dark:hover:bg-fuchsia-500/10"
                        >
                          <Download size={14} />
                          下载 MD
                        </button>
                      </div>
                    </div>
                    {documentActionFeedback?.scope === 'AI 超短线深度分析' && (
                      <div className="mt-3 text-xs font-medium text-fuchsia-700 dark:text-fuchsia-200">
                        {documentActionFeedback.message}
                      </div>
                    )}
                    {ultraShortAnalysisEditError && (
                      <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-medium text-rose-700 dark:text-rose-300">
                        {ultraShortAnalysisEditError}
                      </div>
                    )}
                    {editingUltraShortAnalysis ? (
                      <div className="mt-4 rounded-xl border border-fuchsia-400/20 bg-white/40 p-4 dark:bg-white/[0.03]">
                        <textarea
                          value={ultraShortAnalysisDraft}
                          onChange={(event) => setUltraShortAnalysisDraft(event.target.value)}
                          className="min-h-[420px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-mono text-sm leading-7 text-slate-800 outline-none transition focus:border-fuchsia-500 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100"
                          spellCheck={false}
                        />
                      </div>
                    ) : (
                      renderStructuredDocument(ultraShortAnalysis.content, 'violet')
                    )}
                  </div>
                )}

                {!ultraShortAnalysis && !ultraShortAnalysisError && (
                  <div className="rounded-xl border border-dashed border-slate-200/70 p-6 text-sm text-slate-500 dark:border-white/10 dark:text-gray-400">
                    点击右上角按钮后，会基于最近交易日的情绪、板块、龙头、新闻和研报生成一份偏超短交易节奏的深度分析。
                  </div>
                )}
              </div>
            </GlassCard>
          )}

          {showDailyReviewPanel && (
          <GlassCard
            title="AI 当日复盘"
            action={
              <button
                onClick={handleGenerateDailyReview}
                disabled={!selectedProvider || generatingDailyReview}
                className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {generatingDailyReview ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                生成最近交易日复盘
              </button>
            }
          >
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200/70 bg-white/70 p-4 text-sm leading-6 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
                这不是单篇研报摘要，而是基于最近交易日的情绪周期、龙头、板块、新闻和研报做一份综合复盘。当前调用模型：
                <span className="ml-2 font-semibold text-slate-800 dark:text-gray-100">
                  {selectedProvider?.displayName ?? '未选择'}
                </span>
              </div>

              {dailyReviewError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm leading-6 text-rose-700 dark:text-rose-300">
                  {dailyReviewError}
                </div>
              )}

              {dailyReviewHistory.length > 0 && (
                <select
                  value={selectedDailyReviewId}
                  onChange={(event) => setSelectedDailyReviewId(event.target.value)}
                  className={SELECT_CLASS_NAME}
                >
                  {dailyReviewHistory.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.analysisDate} · {new Date(item.generatedAt).toLocaleString()}
                    </option>
                  ))}
                </select>
              )}

              {dailyReview && (
                <div className="rounded-xl border border-violet-500/20 bg-violet-500/10 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge variant="purple">{dailyReview.providerName}</Badge>
                      <Badge variant="outline">最近交易日 {dailyReview.analysisDate}</Badge>
                      <span className="text-xs text-slate-500 dark:text-gray-400">
                        生成于 {new Date(dailyReview.generatedAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {!editingDailyReview ? (
                        <button
                          onClick={handleStartEditDailyReview}
                          className="inline-flex items-center gap-2 rounded-lg border border-violet-300/60 px-3 py-2 text-xs font-medium text-violet-700 hover:bg-violet-100/80 dark:border-violet-500/30 dark:text-violet-200 dark:hover:bg-violet-500/10"
                        >
                          <Pencil size={14} />
                          编辑 MD
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={handleSaveDailyReviewEdit}
                            className="inline-flex items-center gap-2 rounded-lg border border-emerald-300/60 px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-100/80 dark:border-emerald-500/30 dark:text-emerald-200 dark:hover:bg-emerald-500/10"
                          >
                            <Save size={14} />
                            保存修改
                          </button>
                          <button
                            onClick={handleCancelEditDailyReview}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-300/60 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100/80 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
                          >
                            <X size={14} />
                            取消
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleCopyDocument('AI 当日复盘', dailyReview.content)}
                        className="inline-flex items-center gap-2 rounded-lg border border-violet-300/60 px-3 py-2 text-xs font-medium text-violet-700 hover:bg-violet-100/80 dark:border-violet-500/30 dark:text-violet-200 dark:hover:bg-violet-500/10"
                      >
                        <Copy size={14} />
                        一键复制
                      </button>
                      <button
                        onClick={() =>
                          handleExportMarkdown(
                            'AI 当日复盘',
                            dailyReview.content,
                            `最近交易日 ${dailyReview.analysisDate} · ${dailyReview.providerName}`
                          )
                        }
                        className="inline-flex items-center gap-2 rounded-lg border border-violet-300/60 px-3 py-2 text-xs font-medium text-violet-700 hover:bg-violet-100/80 dark:border-violet-500/30 dark:text-violet-200 dark:hover:bg-violet-500/10"
                      >
                        <Download size={14} />
                        下载 MD
                      </button>
                    </div>
                  </div>
                  {documentActionFeedback?.scope === 'AI 当日复盘' && (
                    <div className="mt-3 text-xs font-medium text-violet-700 dark:text-violet-200">
                      {documentActionFeedback.message}
                    </div>
                  )}
                  {dailyReviewEditError && (
                    <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-medium text-rose-700 dark:text-rose-300">
                      {dailyReviewEditError}
                    </div>
                  )}
                  {editingDailyReview ? (
                    <div className="mt-4 rounded-xl border border-violet-400/20 bg-white/40 p-4 dark:bg-white/[0.03]">
                      <textarea
                        value={dailyReviewDraft}
                        onChange={(event) => setDailyReviewDraft(event.target.value)}
                        className="min-h-[420px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-mono text-sm leading-7 text-slate-800 outline-none transition focus:border-violet-500 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100"
                        spellCheck={false}
                      />
                    </div>
                  ) : (
                    renderStructuredDocument(dailyReview.content, 'violet')
                  )}
                </div>
              )}

              {!dailyReview && !dailyReviewError && (
                <div className="rounded-xl border border-dashed border-slate-200/70 p-6 text-sm text-slate-500 dark:border-white/10 dark:text-gray-400">
                  点击右上角按钮后，会按最近交易日生成一份盘后复盘，不会误把周末写成当天盘面。
                </div>
              )}
            </div>
          </GlassCard>
          )}

          {showPremarketPlanPanel && (
          <GlassCard
            title="盘前计划"
            action={
              <button
                onClick={handleGeneratePremarketPlan}
                disabled={!selectedProvider || generatingPremarketPlan}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-white hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {generatingPremarketPlan ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                生成次日观察清单
              </button>
            }
          >
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200/70 bg-white/70 p-4 text-sm leading-6 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
                盘前计划基于最近交易日复盘自动生成，输出的是下一交易日的观察清单和交易预案，不是重复写一遍盘后总结。
              </div>

              {premarketPlanError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm leading-6 text-rose-700 dark:text-rose-300">
                  {premarketPlanError}
                </div>
              )}

              {premarketPlanHistory.length > 0 && (
                <select
                  value={selectedPremarketPlanId}
                  onChange={(event) => setSelectedPremarketPlanId(event.target.value)}
                  className={SELECT_CLASS_NAME}
                >
                  {premarketPlanHistory.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.targetTradingDate} · 来源 {item.sourceAnalysisDate} · {new Date(item.generatedAt).toLocaleString()}
                    </option>
                  ))}
                </select>
              )}

              {premarketPlan && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge variant="purple">{premarketPlan.providerName}</Badge>
                      <Badge variant="outline">来源复盘 {premarketPlan.sourceAnalysisDate}</Badge>
                      <Badge variant="outline">目标交易日 {premarketPlan.targetTradingDate}</Badge>
                      <span className="text-xs text-slate-500 dark:text-gray-400">
                        生成于 {new Date(premarketPlan.generatedAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {!editingPremarketPlan ? (
                        <button
                          onClick={handleStartEditPremarketPlan}
                          className="inline-flex items-center gap-2 rounded-lg border border-amber-300/70 px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-100/80 dark:border-amber-500/30 dark:text-amber-200 dark:hover:bg-amber-500/10"
                        >
                          <Pencil size={14} />
                          编辑 MD
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={handleSavePremarketPlanEdit}
                            className="inline-flex items-center gap-2 rounded-lg border border-emerald-300/60 px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-100/80 dark:border-emerald-500/30 dark:text-emerald-200 dark:hover:bg-emerald-500/10"
                          >
                            <Save size={14} />
                            保存修改
                          </button>
                          <button
                            onClick={handleCancelEditPremarketPlan}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-300/60 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100/80 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
                          >
                            <X size={14} />
                            取消
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleCopyDocument('盘前计划', premarketPlan.content)}
                        className="inline-flex items-center gap-2 rounded-lg border border-amber-300/70 px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-100/80 dark:border-amber-500/30 dark:text-amber-200 dark:hover:bg-amber-500/10"
                      >
                        <Copy size={14} />
                        一键复制
                      </button>
                      <button
                        onClick={() =>
                          handleExportMarkdown(
                            '盘前计划',
                            premarketPlan.content,
                            `目标交易日 ${premarketPlan.targetTradingDate} · ${premarketPlan.providerName}`
                          )
                        }
                        className="inline-flex items-center gap-2 rounded-lg border border-amber-300/70 px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-100/80 dark:border-amber-500/30 dark:text-amber-200 dark:hover:bg-amber-500/10"
                      >
                        <Download size={14} />
                        下载 MD
                      </button>
                    </div>
                  </div>
                  {documentActionFeedback?.scope === '盘前计划' && (
                    <div className="mt-3 text-xs font-medium text-amber-700 dark:text-amber-200">
                      {documentActionFeedback.message}
                    </div>
                  )}
                  {premarketPlanEditError && (
                    <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-medium text-rose-700 dark:text-rose-300">
                      {premarketPlanEditError}
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
                          onClick={handleAddObservedSymbols}
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
                            onClick={() => void openStockObservation(symbol, '盘前计划观察标的')}
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
                  {editingPremarketPlan ? (
                    <div className="mt-4 rounded-xl border border-amber-400/20 bg-white/40 p-4 dark:bg-white/[0.03]">
                      <textarea
                        value={premarketPlanDraft}
                        onChange={(event) => setPremarketPlanDraft(event.target.value)}
                        className="min-h-[420px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-mono text-sm leading-7 text-slate-800 outline-none transition focus:border-amber-500 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100"
                        spellCheck={false}
                      />
                    </div>
                  ) : (
                    renderStructuredDocument(premarketPlan.content, 'amber')
                  )}
                </div>
              )}

              {!premarketPlan && !premarketPlanError && (
                <div className="rounded-xl border border-dashed border-slate-200/70 p-6 text-sm text-slate-500 dark:border-white/10 dark:text-gray-400">
                  点击右上角按钮后，会基于最近交易日复盘生成下一交易日的重点观察清单、交易预案和风险提醒。
                </div>
              )}
            </div>
          </GlassCard>
          )}

          {showStockObservationPanel && (
          <div ref={stockObservationSectionRef}>
          <GlassCard
            title="个股观察"
            action={
              <button
                onClick={handleGenerateStockObservation}
                disabled={!selectedProvider || generatingStockObservation || !stockObservationSymbol.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {generatingStockObservation ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
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
                    onClick={() => void refreshFocusList()}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs hover:border-sky-500/40 dark:border-white/10"
                  >
                    刷新列表
                  </button>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {focusListItems.map((item) => (
                    <button
                      key={item.symbol}
                      onClick={() => void openStockObservation(item.symbol, focusListMode === 'remote' ? '自选列表' : '重点关注列表')}
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
                  value={stockObservationSymbol}
                  onChange={(event) => setStockObservationSymbol(event.target.value.trim())}
                  placeholder="例如 600519"
                  className={SELECT_CLASS_NAME}
                />
                <div className="rounded-xl border border-slate-200/70 bg-white/70 px-4 py-3 text-sm text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-400">
                  支持主板 / 创业板 / 科创板代码。建议优先输入你盘前计划或自选池里正在跟踪的票。
                </div>
              </div>

              {stockObservationError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm leading-6 text-rose-700 dark:text-rose-300">
                  {stockObservationError}
                </div>
              )}

              {stockObservationHistory.length > 0 && (
                <select
                  value={selectedStockObservationId}
                  onChange={(event) => setSelectedStockObservationId(event.target.value)}
                  className={SELECT_CLASS_NAME}
                >
                  {stockObservationHistory.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.analysisDate} · {item.name}({item.symbol}) · {new Date(item.generatedAt).toLocaleString()}
                    </option>
                  ))}
                </select>
              )}

              {stockObservation && (
                <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge variant="purple">{stockObservation.providerName}</Badge>
                      <Badge variant="outline">{stockObservation.name} {stockObservation.symbol}</Badge>
                      <Badge variant="outline">最近交易日 {stockObservation.analysisDate}</Badge>
                      <span className="text-xs text-slate-500 dark:text-gray-400">
                        生成于 {new Date(stockObservation.generatedAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => void handleAddCurrentObservationToFocusList()}
                        className="inline-flex items-center gap-2 rounded-lg border border-emerald-300/70 px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-100/80 dark:border-emerald-500/30 dark:text-emerald-200 dark:hover:bg-emerald-500/10"
                      >
                        <Plus size={14} />
                        加入自选 / 重点关注
                      </button>
                      <button
                        onClick={() => emitStockDetailRequest(stockObservation.symbol, 'ai-stock-observation')}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-300/70 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100/80 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5"
                      >
                        <Telescope size={14} />
                        去股票信息页
                      </button>
                      {!editingStockObservation ? (
                        <button
                          onClick={handleStartEditStockObservation}
                          className="inline-flex items-center gap-2 rounded-lg border border-sky-300/70 px-3 py-2 text-xs font-medium text-sky-700 hover:bg-sky-100/80 dark:border-sky-500/30 dark:text-sky-200 dark:hover:bg-sky-500/10"
                        >
                          <Pencil size={14} />
                          编辑 MD
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={handleSaveStockObservationEdit}
                            className="inline-flex items-center gap-2 rounded-lg border border-emerald-300/60 px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-100/80 dark:border-emerald-500/30 dark:text-emerald-200 dark:hover:bg-emerald-500/10"
                          >
                            <Save size={14} />
                            保存修改
                          </button>
                          <button
                            onClick={handleCancelEditStockObservation}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-300/60 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100/80 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
                          >
                            <X size={14} />
                            取消
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleCopyDocument('个股观察', stockObservation.content)}
                        className="inline-flex items-center gap-2 rounded-lg border border-sky-300/70 px-3 py-2 text-xs font-medium text-sky-700 hover:bg-sky-100/80 dark:border-sky-500/30 dark:text-sky-200 dark:hover:bg-sky-500/10"
                      >
                        <Copy size={14} />
                        一键复制
                      </button>
                      <button
                        onClick={() =>
                          handleExportMarkdown(
                            '个股观察',
                            stockObservation.content,
                            `${stockObservation.name} ${stockObservation.symbol} · ${stockObservation.providerName}`
                          )
                        }
                        className="inline-flex items-center gap-2 rounded-lg border border-sky-300/70 px-3 py-2 text-xs font-medium text-sky-700 hover:bg-sky-100/80 dark:border-sky-500/30 dark:text-sky-200 dark:hover:bg-sky-500/10"
                      >
                        <Download size={14} />
                        下载 MD
                      </button>
                    </div>
                  </div>
                  {documentActionFeedback?.scope === '个股观察' && (
                    <div className="mt-3 text-xs font-medium text-sky-700 dark:text-sky-200">
                      {documentActionFeedback.message}
                    </div>
                  )}
                  {stockObservationEditError && (
                    <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-medium text-rose-700 dark:text-rose-300">
                      {stockObservationEditError}
                    </div>
                  )}
                  <div className="mt-4 rounded-xl border border-sky-300/40 bg-white/60 p-4 dark:border-sky-500/20 dark:bg-white/5">
                    <div className="text-sm font-semibold text-slate-800 dark:text-gray-100">个股观察依据</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="outline">{stockObservation.context.focusListStatus}</Badge>
                      <Badge variant="outline">{stockObservation.context.planTrackingStatus}</Badge>
                    </div>
                    <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
                      <div className="rounded-xl border border-slate-200/70 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-gray-400">相关资讯</div>
                        <div className="mt-2 space-y-2 text-xs leading-6 text-slate-600 dark:text-gray-300">
                          {stockObservation.context.relatedNews.map((item, index) => (
                            <div key={`${item}-${index}`}>{item}</div>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-200/70 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-gray-400">相关研报</div>
                        <div className="mt-2 space-y-2 text-xs leading-6 text-slate-600 dark:text-gray-300">
                          {stockObservation.context.relatedReports.map((item, index) => (
                            <div key={`${item}-${index}`}>{item}</div>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-200/70 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-gray-400">已有 AI 研报观点</div>
                        <div className="mt-2 space-y-2 text-xs leading-6 text-slate-600 dark:text-gray-300">
                          {stockObservation.context.cachedReportSummaries.map((item, index) => (
                            <div key={`${item}-${index}`}>{item}</div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  {editingStockObservation ? (
                    <div className="mt-4 rounded-xl border border-sky-400/20 bg-white/40 p-4 dark:bg-white/[0.03]">
                      <textarea
                        value={stockObservationDraft}
                        onChange={(event) => setStockObservationDraft(event.target.value)}
                        className="min-h-[420px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-mono text-sm leading-7 text-slate-800 outline-none transition focus:border-sky-500 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100"
                        spellCheck={false}
                      />
                    </div>
                  ) : (
                    renderStructuredDocument(stockObservation.content, 'cyan')
                  )}
                </div>
              )}

              {!stockObservation && !stockObservationError && (
                <div className="rounded-xl border border-dashed border-slate-200/70 p-6 text-sm text-slate-500 dark:border-white/10 dark:text-gray-400">
                  输入股票代码后生成个股观察，适合辅助你判断一只票当前处于启动、加速、分歧、修复还是退潮阶段。
                </div>
              )}
            </div>
          </GlassCard>
          </div>
          )}

          {showPlanValidationPanel && (
          <GlassCard
            title="次日校验"
            action={
              <button
                onClick={handleGeneratePlanValidation}
                disabled={!selectedProvider || generatingPlanValidation}
                className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {generatingPlanValidation ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                生成计划校验
              </button>
            }
          >
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200/70 bg-white/70 p-4 text-sm leading-6 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
                次日校验会把最近一份盘前计划和最新市场实际数据进行对照，输出哪些判断成立、哪些偏差、以及下次应如何修正。
              </div>

              {planValidationError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm leading-6 text-rose-700 dark:text-rose-300">
                  {planValidationError}
                </div>
              )}

              {planValidationHistory.length > 0 && (
                <select
                  value={selectedPlanValidationId}
                  onChange={(event) => setSelectedPlanValidationId(event.target.value)}
                  className={SELECT_CLASS_NAME}
                >
                  {planValidationHistory.map((item) => (
                    <option key={item.id} value={item.id}>
                      校验 {item.validationDate} · 计划 {item.targetTradingDate} · {new Date(item.generatedAt).toLocaleString()}
                    </option>
                  ))}
                </select>
              )}

              {planValidation && (
                <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-4">
                  <div className="mb-4 rounded-xl border border-cyan-300/40 bg-white/60 p-4 dark:border-cyan-500/20 dark:bg-white/5">
                    <div className="text-sm font-semibold text-slate-800 dark:text-gray-100">计划命中率摘要</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="blue">结论：{planValidation.summary.verdictLabel}</Badge>
                      <Badge variant="outline">观察标的 {planValidation.summary.observedCount} 只</Badge>
                      <Badge variant="green">强于预期 {planValidation.summary.strongCount}</Badge>
                      <Badge variant="outline">中性 {planValidation.summary.neutralCount}</Badge>
                      <Badge variant="red">弱于预期 {planValidation.summary.weakCount}</Badge>
                    </div>
                    {planValidation.summary.observedSymbols.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {planValidation.summary.observedSymbols.map((symbol) => (
                          <Badge key={symbol} variant="outline">{symbol}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge variant="purple">{planValidation.providerName}</Badge>
                      <Badge variant="outline">计划交易日 {planValidation.targetTradingDate}</Badge>
                      <Badge variant="outline">校验交易日 {planValidation.validationDate}</Badge>
                      <span className="text-xs text-slate-500 dark:text-gray-400">
                        生成于 {new Date(planValidation.generatedAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {!editingPlanValidation ? (
                        <button
                          onClick={handleStartEditPlanValidation}
                          className="inline-flex items-center gap-2 rounded-lg border border-cyan-300/70 px-3 py-2 text-xs font-medium text-cyan-700 hover:bg-cyan-100/80 dark:border-cyan-500/30 dark:text-cyan-200 dark:hover:bg-cyan-500/10"
                        >
                          <Pencil size={14} />
                          编辑 MD
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={handleSavePlanValidationEdit}
                            className="inline-flex items-center gap-2 rounded-lg border border-emerald-300/60 px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-100/80 dark:border-emerald-500/30 dark:text-emerald-200 dark:hover:bg-emerald-500/10"
                          >
                            <Save size={14} />
                            保存修改
                          </button>
                          <button
                            onClick={handleCancelEditPlanValidation}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-300/60 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100/80 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
                          >
                            <X size={14} />
                            取消
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleCopyDocument('次日校验', planValidation.content)}
                        className="inline-flex items-center gap-2 rounded-lg border border-cyan-300/70 px-3 py-2 text-xs font-medium text-cyan-700 hover:bg-cyan-100/80 dark:border-cyan-500/30 dark:text-cyan-200 dark:hover:bg-cyan-500/10"
                      >
                        <Copy size={14} />
                        一键复制
                      </button>
                      <button
                        onClick={() =>
                          handleExportMarkdown(
                            '次日校验',
                            planValidation.content,
                            `计划 ${planValidation.targetTradingDate} · 校验 ${planValidation.validationDate} · ${planValidation.providerName}`
                          )
                        }
                        className="inline-flex items-center gap-2 rounded-lg border border-cyan-300/70 px-3 py-2 text-xs font-medium text-cyan-700 hover:bg-cyan-100/80 dark:border-cyan-500/30 dark:text-cyan-200 dark:hover:bg-cyan-500/10"
                      >
                        <Download size={14} />
                        下载 MD
                      </button>
                    </div>
                  </div>
                  {documentActionFeedback?.scope === '次日校验' && (
                    <div className="mt-3 text-xs font-medium text-cyan-700 dark:text-cyan-200">
                      {documentActionFeedback.message}
                    </div>
                  )}
                  {planValidationEditError && (
                    <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-medium text-rose-700 dark:text-rose-300">
                      {planValidationEditError}
                    </div>
                  )}
                  {editingPlanValidation ? (
                    <div className="mt-4 rounded-xl border border-cyan-400/20 bg-white/40 p-4 dark:bg-white/[0.03]">
                      <textarea
                        value={planValidationDraft}
                        onChange={(event) => setPlanValidationDraft(event.target.value)}
                        className="min-h-[420px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-mono text-sm leading-7 text-slate-800 outline-none transition focus:border-cyan-500 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100"
                        spellCheck={false}
                      />
                    </div>
                  ) : (
                    renderStructuredDocument(planValidation.content, 'cyan')
                  )}
                </div>
              )}

              {!planValidation && !planValidationError && (
                <div className="rounded-xl border border-dashed border-slate-200/70 p-6 text-sm text-slate-500 dark:border-white/10 dark:text-gray-400">
                  点击右上角按钮后，会基于最近一份盘前计划和最新交易日实际盘面生成校验结果，帮助你判断计划是否有效、偏差来自哪里。
                </div>
              )}
            </div>
          </GlassCard>
          )}
          </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIIntegrationSection;
