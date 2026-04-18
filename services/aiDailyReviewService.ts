import {
  getEnabledSkillsForScope,
  loadAIIntegrationSettings,
  renderSkillInstructions,
} from './modelIntegrationService';
import { extractObservedSymbols } from './focusListService';
import {
  getLatestCachedDailyReviewByProvider,
  getLatestCachedPremarketPlanByProvider,
  loadStoredDailyReviews,
  loadStoredPlanValidations,
  loadStoredPremarketPlans,
  loadStoredStockObservations,
  loadStoredUltraShortAnalyses,
  saveStoredDailyReviews,
  saveStoredPlanValidations,
  saveStoredPremarketPlans,
  saveStoredStockObservations,
  saveStoredUltraShortAnalyses,
} from './aiDailyReview/storage';
import {
  loadStockObservationContext,
  loadPlanValidationMarketContext,
  loadSharedMarketReviewContext,
} from './aiDailyReview/context';
import {
  appendSkillInstructions,
  buildLeaderSummary,
  buildMarketReviewPrompt,
  buildObservedStocksSummary,
  buildPlanValidationPrompt,
  buildPremarketPrompt,
  buildRecentKlineSummary,
  buildRelatedNewsSummary,
  buildRelatedReportContext,
  buildSectorSummary,
  buildStockObservationPrompt,
} from './aiDailyReview/promptBuilders';
import { invokeAIReviewProvider, resolveAIReviewProvider } from './aiDailyReview/provider';
import {
  deriveValidationVerdict,
  getNextTradingDate,
  splitSummaryLines,
} from './aiDailyReview/utils';
import type {
  AIDailyReviewEntry,
  AIPlanValidationEntry,
  AIPremarketPlanEntry,
  AIStockObservationEntry,
  AIUltraShortAnalysisEntry,
} from './aiDailyReview/types';

export type {
  AIDailyReviewEntry,
  AIPlanValidationEntry,
  AIPremarketPlanEntry,
  AIStockObservationEntry,
  AIUltraShortAnalysisEntry,
} from './aiDailyReview/types';
export {
  getCachedDailyReview,
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
} from './aiDailyReview/storage';

type DailyReviewPayload = {
  providerId?: string | null;
};

export const generateAIDailyReview = async ({ providerId }: DailyReviewPayload = {}): Promise<AIDailyReviewEntry> => {
  const settings = loadAIIntegrationSettings();
  const provider = resolveAIReviewProvider(settings.providers, settings.preferredProviderId, providerId);
  const context = await loadSharedMarketReviewContext();
  const prompt = appendSkillInstructions(
    buildMarketReviewPrompt({ ...context, template: settings.promptTemplates.dailyReview }),
    renderSkillInstructions(getEnabledSkillsForScope(settings, 'dailyReview'))
  );

  const content = (await invokeAIReviewProvider(
    provider,
    prompt,
    '你是资深 A 股短线盘后复盘助理，擅长结合情绪周期、板块、龙头、新闻和研报生成高密度复盘。'
  )).trim();
  if (!content) {
    throw new Error(`模型 ${provider.displayName} 没有返回可用复盘内容。`);
  }

  const entry: AIDailyReviewEntry = {
    id: `${context.analysisDate}:${provider.id}`,
    analysisDate: context.analysisDate,
    providerId: provider.id,
    providerName: provider.displayName,
    content,
    generatedAt: new Date().toISOString(),
  };

  saveStoredDailyReviews([
    entry,
    ...loadStoredDailyReviews().filter(
      (item) => !(item.analysisDate === entry.analysisDate && item.providerId === entry.providerId)
    ),
  ]);

  return entry;
};

export const generateAIUltraShortAnalysis = async ({ providerId }: DailyReviewPayload = {}): Promise<AIUltraShortAnalysisEntry> => {
  const settings = loadAIIntegrationSettings();
  const provider = resolveAIReviewProvider(settings.providers, settings.preferredProviderId, providerId);
  const context = await loadSharedMarketReviewContext();
  const prompt = appendSkillInstructions(
    buildMarketReviewPrompt({ ...context, template: settings.promptTemplates.ultraShortAnalysis }),
    renderSkillInstructions(getEnabledSkillsForScope(settings, 'ultraShortAnalysis'))
  );

  const content = (await invokeAIReviewProvider(
    provider,
    prompt,
    '你是 QuantDash 的 AI 超短线深度分析助手，专注 1 到 3 个交易日节奏下的情绪、龙头、接力和风险断点。'
  )).trim();
  if (!content) {
    throw new Error(`模型 ${provider.displayName} 没有返回可用超短线深度分析内容。`);
  }

  const entry: AIUltraShortAnalysisEntry = {
    id: `${context.analysisDate}:${provider.id}`,
    analysisDate: context.analysisDate,
    providerId: provider.id,
    providerName: provider.displayName,
    content,
    generatedAt: new Date().toISOString(),
  };

  saveStoredUltraShortAnalyses([
    entry,
    ...loadStoredUltraShortAnalyses().filter(
      (item) => !(item.analysisDate === entry.analysisDate && item.providerId === entry.providerId)
    ),
  ]);

  return entry;
};

export const generateAIPremarketPlan = async ({ providerId }: DailyReviewPayload = {}): Promise<AIPremarketPlanEntry> => {
  const settings = loadAIIntegrationSettings();
  const provider = resolveAIReviewProvider(settings.providers, settings.preferredProviderId, providerId);

  const cachedReview = getLatestCachedDailyReviewByProvider(provider.id);
  const review = cachedReview ?? (await generateAIDailyReview({ providerId: provider.id }));
  const targetTradingDate = getNextTradingDate(review.analysisDate);
  const content = (
    await invokeAIReviewProvider(
      provider,
      appendSkillInstructions(
        buildPremarketPrompt(
          review.analysisDate,
          targetTradingDate,
          review.content,
          settings.promptTemplates.premarketPlan
        ),
        renderSkillInstructions(getEnabledSkillsForScope(settings, 'premarketPlan'))
      ),
      '你是 QuantDash 的盘前计划助手，任务是把上一交易日复盘转成下一交易日可执行的观察清单与应对预案。'
    )
  ).trim();

  if (!content) {
    throw new Error(`模型 ${provider.displayName} 没有返回可用盘前计划。`);
  }

  const entry: AIPremarketPlanEntry = {
    id: `${targetTradingDate}:${provider.id}`,
    sourceAnalysisDate: review.analysisDate,
    targetTradingDate,
    providerId: provider.id,
    providerName: provider.displayName,
    content,
    generatedAt: new Date().toISOString(),
  };

  saveStoredPremarketPlans([
    entry,
    ...loadStoredPremarketPlans().filter(
      (item) => !(item.targetTradingDate === entry.targetTradingDate && item.providerId === entry.providerId)
    ),
  ]);

  return entry;
};

export const generateAIPlanValidation = async ({ providerId }: DailyReviewPayload = {}): Promise<AIPlanValidationEntry> => {
  const settings = loadAIIntegrationSettings();
  const provider = resolveAIReviewProvider(settings.providers, settings.preferredProviderId, providerId);

  const plan = getLatestCachedPremarketPlanByProvider(provider.id) ?? (await generateAIPremarketPlan({ providerId: provider.id }));
  const context = await loadPlanValidationMarketContext();
  const observedStocks = await buildObservedStocksSummary(plan.content, context.validationDate);

  const content = (
    await invokeAIReviewProvider(
      provider,
      appendSkillInstructions(
        buildPlanValidationPrompt({
          ...context,
          observedStocksSummary: observedStocks.summaryText,
          premarketPlanContent: plan.content,
          targetTradingDate: plan.targetTradingDate,
          template: settings.promptTemplates.planValidation,
        }),
        renderSkillInstructions(getEnabledSkillsForScope(settings, 'planValidation'))
      ),
      '你是 QuantDash 的盘前计划次日校验助手，任务是评估上一份盘前计划与最新市场实际表现之间的偏差。',
    )
  ).trim();

  if (!content) {
    throw new Error(`模型 ${provider.displayName} 没有返回可用校验内容。`);
  }

  const verdict = deriveValidationVerdict(content);
  const entry: AIPlanValidationEntry = {
    id: `${plan.targetTradingDate}:${context.validationDate}:${provider.id}`,
    targetTradingDate: plan.targetTradingDate,
    validationDate: context.validationDate,
    providerId: provider.id,
    providerName: provider.displayName,
    content,
    generatedAt: new Date().toISOString(),
    summary: {
      ...verdict,
      observedCount: observedStocks.observedSymbols.length,
      strongCount: observedStocks.strongCount,
      neutralCount: observedStocks.neutralCount,
      weakCount: observedStocks.weakCount,
      observedSymbols: observedStocks.observedSymbols,
    },
  };

  saveStoredPlanValidations([
    entry,
    ...loadStoredPlanValidations().filter(
      (item) => !(item.targetTradingDate === entry.targetTradingDate && item.validationDate === entry.validationDate && item.providerId === entry.providerId)
    ),
  ]);

  return entry;
};

export const generateAIStockObservation = async ({
  providerId,
  symbol,
}: DailyReviewPayload & { symbol: string }): Promise<AIStockObservationEntry> => {
  const normalizedSymbol = symbol.trim();
  if (!/^(?:00|30|60|68)\d{4}$/.test(normalizedSymbol)) {
    throw new Error('请输入有效的 A 股代码，例如 600519、300750、002594。');
  }

  const settings = loadAIIntegrationSettings();
  const provider = resolveAIReviewProvider(settings.providers, settings.preferredProviderId, providerId);
  const context = await loadStockObservationContext(normalizedSymbol);
  const focusListStatus = context.focusList.items.some((item) => item.symbol === normalizedSymbol)
    ? (context.focusList.mode === 'remote' ? '是，当前在自选列表中' : '是，当前在本地重点关注列表中')
    : '否，当前不在已保存关注列表中';
  const latestPlan = getLatestCachedPremarketPlanByProvider(provider.id);
  const planSymbols = latestPlan ? extractObservedSymbols(latestPlan.content) : [];
  const planTrackingStatus = latestPlan
    ? (planSymbols.includes(normalizedSymbol)
      ? `是，出现在目标交易日 ${latestPlan.targetTradingDate} 的盘前计划观察清单里`
      : `否，最近一份盘前计划(${latestPlan.targetTradingDate})未提及该股`)
    : '暂无可用盘前计划';
  const relatedNewsSummary = buildRelatedNewsSummary(
    context.stock.symbol,
    context.stock.name,
    context.stock.industry || '',
    context.stock.concepts ?? [],
    context.newsItems,
  );
  const relatedReportContext = buildRelatedReportContext(context.stock, context.reports, provider.id);
  const prompt = appendSkillInstructions(
    buildStockObservationPrompt(settings.promptTemplates.stockObservation, {
      symbol: context.stock.symbol,
      name: context.stock.name,
      industry: context.stock.industry || '待补充',
      concepts: context.stock.concepts?.join('、') || '暂无概念标签',
      analysisDate: context.analysisDate,
      latestPrice: context.stock.price.toFixed(2),
      latestPctChange: context.stock.pctChange.toFixed(2),
      openPct: context.perf?.openPct?.toFixed(2) ?? '—',
      closePct: context.perf?.closePct?.toFixed(2) ?? '—',
      isOneWord: context.perf ? (context.perf.isOneWord ? '是' : '否') : '未知',
      klineSummary: buildRecentKlineSummary(context.klines),
      stage: context.cycleOverview.stage,
      riskLevel: context.cycleOverview.riskLevel,
      volumeState: context.cycleOverview.volumeState,
      leaderSummary: buildLeaderSummary(context.leaders, null) || '暂无龙头状态',
      conceptSectorSummary: buildSectorSummary('概念板块', context.conceptSector),
      industrySectorSummary: buildSectorSummary('行业板块', context.industrySector),
      focusListStatus,
      planTrackingStatus,
      relatedNewsSummary,
      relatedReportSummary: relatedReportContext.reportSummary,
      cachedReportSummary: relatedReportContext.cachedSummary,
    }),
    renderSkillInstructions(getEnabledSkillsForScope(settings, 'stockObservation'))
  );

  const content = (await invokeAIReviewProvider(
    provider,
    prompt,
    '你是 QuantDash 的个股观察助手，任务是判断一只股票在当前市场环境中的位置、作用和观察重点。'
  )).trim();
  if (!content) {
    throw new Error(`模型 ${provider.displayName} 没有返回可用个股观察内容。`);
  }

  const entry: AIStockObservationEntry = {
    id: `${context.stock.symbol}:${context.analysisDate}:${provider.id}`,
    symbol: context.stock.symbol,
    name: context.stock.name,
    analysisDate: context.analysisDate,
    providerId: provider.id,
    providerName: provider.displayName,
    content,
    generatedAt: new Date().toISOString(),
    context: {
      focusListStatus,
      planTrackingStatus,
      relatedNews: splitSummaryLines(relatedNewsSummary),
      relatedReports: splitSummaryLines(relatedReportContext.reportSummary),
      cachedReportSummaries: splitSummaryLines(relatedReportContext.cachedSummary),
    },
  };

  saveStoredStockObservations([
    entry,
    ...loadStoredStockObservations().filter(
      (item) => !(item.symbol === entry.symbol && item.analysisDate === entry.analysisDate && item.providerId === entry.providerId),
    ),
  ]);

  return entry;
};
