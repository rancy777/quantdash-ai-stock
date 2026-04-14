import { CycleOverviewData, LadderData, LeaderStateEntry, ModelProviderConfig, ResearchReportFile, SectorPersistenceData, Stock } from '../types';
import { getInfoGatheringNews } from './newsService';
import { getResearchReports } from './reportService';
import { getCycleOverview, getLeaderStateHistory, getRealTimeMarketSentiment } from './sentimentCycleService';
import { getSectorPersistenceData } from './sectorService';
import {
  getEnabledSkillsForScope,
  loadAIIntegrationSettings,
  renderPromptTemplate,
  renderSkillInstructions,
} from './modelIntegrationService';
import { extractObservedSymbols, loadFocusList } from './focusListService';
import { getFullMarketStockList, getSingleDayPerformance, getStockKline } from './quotesService';
import { getCachedReportAISummary } from './aiReportSummaryService';
import { getBullBearSignalSnapshot } from './emotionIndicatorService';
import { resolveScreenerApiBase } from './apiConfig';
import { loadLocalJsonFile } from './localDataService';

const DAILY_REVIEW_STORAGE_KEY = 'quantdash:ai-daily-review';
const ULTRA_SHORT_ANALYSIS_STORAGE_KEY = 'quantdash:ai-ultra-short-analysis';
const PREMARKET_PLAN_STORAGE_KEY = 'quantdash:ai-premarket-plan';
const PLAN_VALIDATION_STORAGE_KEY = 'quantdash:ai-plan-validation';
const STOCK_OBSERVATION_STORAGE_KEY = 'quantdash:ai-stock-observation';
const MODEL_INVOKE_ENDPOINT = `${resolveScreenerApiBase()}/integrations/model/invoke`;

export interface AIDailyReviewEntry {
  id: string;
  analysisDate: string;
  providerId: string;
  providerName: string;
  content: string;
  generatedAt: string;
}

export interface AIPremarketPlanEntry {
  id: string;
  sourceAnalysisDate: string;
  targetTradingDate: string;
  providerId: string;
  providerName: string;
  content: string;
  generatedAt: string;
}

export interface AIUltraShortAnalysisEntry {
  id: string;
  analysisDate: string;
  providerId: string;
  providerName: string;
  content: string;
  generatedAt: string;
}

export interface AIPlanValidationEntry {
  id: string;
  targetTradingDate: string;
  validationDate: string;
  providerId: string;
  providerName: string;
  content: string;
  generatedAt: string;
  summary: {
    verdict: 'matched' | 'partial' | 'missed';
    verdictLabel: string;
    observedCount: number;
    strongCount: number;
    neutralCount: number;
    weakCount: number;
    observedSymbols: string[];
  };
}

export interface AIStockObservationEntry {
  id: string;
  symbol: string;
  name: string;
  analysisDate: string;
  providerId: string;
  providerName: string;
  content: string;
  generatedAt: string;
  context: {
    focusListStatus: string;
    planTrackingStatus: string;
    relatedNews: string[];
    relatedReports: string[];
    cachedReportSummaries: string[];
  };
}

type DailyReviewPayload = {
  providerId?: string | null;
};

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const formatAnalysisDate = (mmdd: string): string => {
  const [month, day] = mmdd.split('-').map((item) => Number(item));
  const year = new Date().getFullYear();
  if (!month || !day) {
    return `${year}-${mmdd}`;
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const loadStoredDailyReviews = (): AIDailyReviewEntry[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(DAILY_REVIEW_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AIDailyReviewEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveStoredDailyReviews = (entries: AIDailyReviewEntry[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DAILY_REVIEW_STORAGE_KEY, JSON.stringify(entries));
};

const loadStoredUltraShortAnalyses = (): AIUltraShortAnalysisEntry[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(ULTRA_SHORT_ANALYSIS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AIUltraShortAnalysisEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveStoredUltraShortAnalyses = (entries: AIUltraShortAnalysisEntry[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ULTRA_SHORT_ANALYSIS_STORAGE_KEY, JSON.stringify(entries));
};

const loadStoredPremarketPlans = (): AIPremarketPlanEntry[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(PREMARKET_PLAN_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AIPremarketPlanEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveStoredPremarketPlans = (entries: AIPremarketPlanEntry[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PREMARKET_PLAN_STORAGE_KEY, JSON.stringify(entries));
};

const loadStoredPlanValidations = (): AIPlanValidationEntry[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(PLAN_VALIDATION_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AIPlanValidationEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveStoredPlanValidations = (entries: AIPlanValidationEntry[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PLAN_VALIDATION_STORAGE_KEY, JSON.stringify(entries));
};

const loadStoredStockObservations = (): AIStockObservationEntry[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STOCK_OBSERVATION_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AIStockObservationEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveStoredStockObservations = (entries: AIStockObservationEntry[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STOCK_OBSERVATION_STORAGE_KEY, JSON.stringify(entries));
};

const invokeProvider = async (
  provider: ModelProviderConfig,
  prompt: string,
  systemPrompt: string
): Promise<string> => {
  const response = await fetch(MODEL_INVOKE_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      providerKey: provider.providerKey,
      protocol: provider.protocol,
      baseUrl: trimTrailingSlash(provider.baseUrl),
      apiKey: provider.apiKey,
      model: provider.model,
      systemPrompt,
      userPrompt: prompt,
      temperature: 0.25,
      maxTokens: 1600,
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `模型请求失败: ${response.status}`);
  }
  const payload = await response.json() as { content?: string };
  return payload.content?.trim() ?? '';
};

const findLeaderStockFromLadder = (
  ladder: LadderData | null,
  leader: LeaderStateEntry,
): Stock | null => {
  if (!ladder?.boardCounts?.length) return null;

  for (const row of ladder.boardCounts) {
    const stocks = row?.data?.[leader.date];
    if (!Array.isArray(stocks)) continue;
    const matched = stocks.find((item) => item.symbol === leader.leaderSymbol);
    if (matched) return matched;
  }

  return null;
};

const formatLeaderTags = (stock: Stock | null): string => {
  if (!stock) return '所属待补充';
  const industry = stock.industry?.trim() || '待补充';
  const concepts = Array.isArray(stock.concepts)
    ? stock.concepts.map((item) => item?.trim()).filter(Boolean)
    : [];
  const conceptSummary = concepts.length > 0 ? concepts.slice(0, 3).join('、') : industry;
  return `所属 ${industry}，概念 ${conceptSummary}`;
};

const buildLeaderSummary = (leaders: LeaderStateEntry[], ladder: LadderData | null): string =>
  leaders
    .slice(-3)
    .map(
      (item) => {
        const leaderStock = findLeaderStockFromLadder(ladder, item);
        return `${formatAnalysisDate(item.date)} 龙头 ${item.leaderName}(${item.leaderSymbol})，${formatLeaderTags(leaderStock)}，最高板 ${item.leaderBoardCount}，同高度 ${item.leaderCount}，三板以上 ${item.threePlusCount}，次日开盘 ${item.nextOpenPct ?? '—'}%，次日收盘 ${item.nextClosePct ?? '—'}%，状态 ${item.statusLabel}`;
      }
    )
    .join('\n');

const buildSectorSummary = (title: string, data: SectorPersistenceData | null): string => {
  if (!data) return `${title}: 暂无数据`;
  const latest = data.entries[data.entries.length - 1];
  return `${title}: 当前领涨 ${data.currentLeaderName}(${data.currentLeaderCode})，连涨 ${data.currentStreakDays} 天，近5日 Top3 出现 ${data.currentTopThreeAppearances} 次，最近一日涨幅 ${latest?.leaderPctChange ?? '—'}%`;
};

const buildNewsSummary = (analysisDate: string, newsItems: Awaited<ReturnType<typeof getInfoGatheringNews>>): string => {
  const target = analysisDate;
  const sameDay = newsItems.filter((item) => (item.createdAt ?? '').slice(0, 10) === target).slice(0, 6);
  const fallback = sameDay.length > 0 ? sameDay : newsItems.slice(0, 6);
  return fallback
    .map((item) => `- [${item.source}] ${item.title}`)
    .join('\n');
};

const buildReportSummary = (analysisDate: string, reports: ResearchReportFile[]): string => {
  const sameDay = reports
    .filter((item) => (item.publishedAt ?? item.updatedAt ?? '').slice(0, 10) === analysisDate)
    .slice(0, 6);
  const fallback = sameDay.length > 0 ? sameDay : reports.slice(0, 6);
  return fallback
    .map((item) => {
      const parts = [
        item.orgName ? `[${item.orgName}]` : '',
        item.title ?? item.name,
        item.rating ? `评级 ${item.rating}` : '',
        item.stockCode ? `标的 ${item.stockCode}` : '',
      ].filter(Boolean);
      return `- ${parts.join(' ')}`;
    })
    .join('\n');
};

const includesKeyword = (value: string | undefined | null, keyword: string): boolean =>
  Boolean(value && keyword && value.toLowerCase().includes(keyword.toLowerCase()));

const buildRelatedNewsSummary = (
  symbol: string,
  name: string,
  industry: string,
  concepts: string[],
  newsItems: Awaited<ReturnType<typeof getInfoGatheringNews>>
): string => {
  const keywords = [symbol, name, industry, ...concepts].filter(Boolean);
  const matched = newsItems.filter((item) =>
    keywords.some((keyword) =>
      includesKeyword(item.title, keyword) || includesKeyword(item.content, keyword)
    )
  );
  const fallback = matched.length > 0 ? matched.slice(0, 4) : newsItems.slice(0, 3);
  return fallback.length > 0
    ? fallback.map((item) => `- [${item.source}] ${item.title}`).join('\n')
    : '暂无明显相关资讯';
};

const splitSummaryLines = (value: string): string[] =>
  value
    .split('\n')
    .map((item) => item.replace(/^\s*-\s*/, '').trim())
    .filter(Boolean);

const buildRelatedReportContext = (
  stock: { symbol: string; name: string; industry: string; concepts?: string[] },
  reports: ResearchReportFile[],
  providerId: string
): { reportSummary: string; cachedSummary: string } => {
  const keywords = [stock.symbol, stock.name, stock.industry, ...(stock.concepts ?? [])].filter(Boolean);
  const matchedReports = reports.filter((report) =>
    keywords.some((keyword) =>
      report.stockCode === keyword ||
      report.stockName === keyword ||
      includesKeyword(report.title, keyword) ||
      includesKeyword(report.summary, keyword) ||
      includesKeyword(report.orgName, keyword) ||
      includesKeyword(report.industryName, keyword) ||
      (report.tags ?? []).some((tag) => includesKeyword(tag, keyword))
    )
  );

  const pickedReports = matchedReports.slice(0, 3);
  const reportSummary = pickedReports.length > 0
    ? pickedReports
        .map((report) => {
          const title = report.title ?? report.name;
          const org = report.orgName ? `，机构 ${report.orgName}` : '';
          const rating = report.rating ? `，评级 ${report.rating}` : '';
          return `- ${title}${org}${rating}`;
        })
        .join('\n')
    : '暂无明显相关研报';

  const cachedSummaries = pickedReports
    .map((report) => {
      const cached = getCachedReportAISummary(report.id, providerId);
      if (!cached?.summary) return null;
      return `- ${report.title ?? report.name}: ${cached.summary.slice(0, 160)}`;
    })
    .filter((item): item is string => Boolean(item));

  return {
    reportSummary,
    cachedSummary: cachedSummaries.length > 0 ? cachedSummaries.join('\n') : '暂无已有 AI 研报摘要',
  };
};

const buildPrompt = (
  analysisDate: string,
  cycleOverview: CycleOverviewData,
  breadth: { rise: number; fall: number; flat: number },
  bullBearSummary: string,
  leaders: LeaderStateEntry[],
  conceptSector: SectorPersistenceData | null,
  industrySector: SectorPersistenceData | null,
  newsSummary: string,
  reportSummary: string,
  ladder: LadderData | null,
  template: string
): string =>
  renderPromptTemplate(template, {
    analysisDate,
    stage: cycleOverview.stage,
    confidence: cycleOverview.confidence,
    riskLevel: cycleOverview.riskLevel,
    volumeState: cycleOverview.volumeState,
    latestVolumeAmount: cycleOverview.latestVolumeAmount ?? '—',
    volumeChangeRate: cycleOverview.volumeChangeRate ?? '—',
    reasons: cycleOverview.reasons.join('；') || '—',
    rise: breadth.rise,
    fall: breadth.fall,
    flat: breadth.flat,
    bullBearSummary,
    leaderSummary: buildLeaderSummary(leaders, ladder) || '暂无龙头状态',
    conceptSectorSummary: buildSectorSummary('概念板块', conceptSector),
    industrySectorSummary: buildSectorSummary('行业板块', industrySector),
    newsSummary: newsSummary || '- 暂无新闻',
    reportSummary: reportSummary || '- 暂无研报',
  });

const getNextTradingDate = (analysisDate: string): string => {
  const cursor = new Date(`${analysisDate}T00:00:00`);
  do {
    cursor.setDate(cursor.getDate() + 1);
  } while (cursor.getDay() === 0 || cursor.getDay() === 6);
  return cursor.toISOString().slice(0, 10);
};

const buildBullBearSummary = (snapshot: Awaited<ReturnType<typeof getBullBearSignalSnapshot>>): string => {
  if (!snapshot) return '暂无牛熊风向标数据';
  const bucketSummary = (snapshot.rangeBuckets ?? [])
    .map((item) => `${item.label}${item.count}家`)
    .join('，');
  return [
    `日期 ${snapshot.date}`,
    `上涨 ${snapshot.riseCount} 家 / 下跌 ${snapshot.fallCount} 家 / 平盘 ${snapshot.flatCount} 家`,
    `涨停 ${snapshot.limitUpCount} 家 / 自然涨停 ${snapshot.naturalLimitUpCount} 家 / 跌停 ${snapshot.limitDownCount} 家 / 自然跌停 ${snapshot.naturalLimitDownCount} 家`,
    `三市成交额 ${snapshot.totalAmount} 亿元，较前一日 ${snapshot.amountChangeRate ?? '—'}%`,
    `区间分布：${bucketSummary || '暂无'}`,
  ].join('；');
};

const buildPremarketPrompt = (
  sourceAnalysisDate: string,
  targetTradingDate: string,
  dailyReviewContent: string,
  template: string
): string =>
  renderPromptTemplate(template, {
    sourceAnalysisDate,
    targetTradingDate,
    dailyReviewContent,
  });

const buildPlanValidationPrompt = (
  targetTradingDate: string,
  validationDate: string,
  premarketPlanContent: string,
  cycleOverview: CycleOverviewData,
  breadth: { rise: number; fall: number; flat: number },
  bullBearSummary: string,
  leaders: LeaderStateEntry[],
  conceptSector: SectorPersistenceData | null,
  industrySector: SectorPersistenceData | null,
  newsSummary: string,
  observedStocksSummary: string,
  ladder: LadderData | null,
  template: string,
): string =>
  renderPromptTemplate(template, {
    targetTradingDate,
    validationDate,
    premarketPlanContent,
    stage: cycleOverview.stage,
    riskLevel: cycleOverview.riskLevel,
    volumeState: cycleOverview.volumeState,
    latestVolumeAmount: cycleOverview.latestVolumeAmount ?? '—',
    volumeChangeRate: cycleOverview.volumeChangeRate ?? '—',
    rise: breadth.rise,
    fall: breadth.fall,
    flat: breadth.flat,
    bullBearSummary,
    leaderSummary: buildLeaderSummary(leaders, ladder) || '暂无龙头状态',
    conceptSectorSummary: buildSectorSummary('概念板块', conceptSector),
    industrySectorSummary: buildSectorSummary('行业板块', industrySector),
    newsSummary: newsSummary || '- 暂无新闻',
    observedStocksSummary: observedStocksSummary || '- 未从盘前计划中识别到股票代码',
  });

const buildStockObservationPrompt = (
  template: string,
  variables: Record<string, string | number | null | undefined>,
): string => renderPromptTemplate(template, variables);

const appendSkillInstructions = (prompt: string, instructions: string): string =>
  instructions
    ? `${prompt}\n\n八、启用的 Skills\n${instructions}\n\n请在输出时执行以上 Skills 的约束，并且所有结论仍然必须以本次输入数据为依据。`
    : prompt;

const buildObservedStocksSummary = async (
  planContent: string,
  validationDate: string,
): Promise<{
  summaryText: string;
  observedSymbols: string[];
  strongCount: number;
  neutralCount: number;
  weakCount: number;
}> => {
  const symbols = extractObservedSymbols(planContent).slice(0, 12);
  if (!symbols.length) {
    return {
      summaryText: '- 未从盘前计划中识别到股票代码',
      observedSymbols: [],
      strongCount: 0,
      neutralCount: 0,
      weakCount: 0,
    };
  }

  const stockList = await getFullMarketStockList();
  const stockMap = new Map(stockList.map((item) => [item.symbol, item]));
  let strongCount = 0;
  let neutralCount = 0;
  let weakCount = 0;

  const rows = await Promise.all(
    symbols.map(async (symbol) => {
      const stock = stockMap.get(symbol);
      const perf = await getSingleDayPerformance(symbol, validationDate);
      const displayName = stock?.name ?? symbol;
      const industry = stock?.industry ?? '待补充';
      if (!perf) {
        neutralCount += 1;
        return `- ${displayName}(${symbol})：未拿到 ${validationDate} 的单日表现，所属 ${industry}`;
      }
      if (perf.closePct >= 3) {
        strongCount += 1;
      } else if (perf.closePct <= -2) {
        weakCount += 1;
      } else {
        neutralCount += 1;
      }
      return `- ${displayName}(${symbol})：所属 ${industry}，${validationDate} 开盘 ${perf.openPct.toFixed(2)}%，收盘 ${perf.closePct.toFixed(2)}%，${perf.isOneWord ? '一字板/近似一字' : '非一字表现'}`;
    }),
  );

  return {
    summaryText: rows.join('\n'),
    observedSymbols: symbols,
    strongCount,
    neutralCount,
    weakCount,
  };
};

const deriveValidationVerdict = (content: string): { verdict: 'matched' | 'partial' | 'missed'; verdictLabel: string } => {
  if (/明显偏差|基本失效|多数失效|整体失效/.test(content)) {
    return { verdict: 'missed', verdictLabel: '偏差较大' };
  }
  if (/部分成立|部分正确|有对有错|部分验证/.test(content)) {
    return { verdict: 'partial', verdictLabel: '部分成立' };
  }
  if (/整体正确|偏正确|总体成立|验证成立|大体符合/.test(content)) {
    return { verdict: 'matched', verdictLabel: '整体成立' };
  }
  return { verdict: 'partial', verdictLabel: '待人工判断' };
};

const buildRecentKlineSummary = (rows: Awaited<ReturnType<typeof getStockKline>>): string => {
  const recent = rows.slice(-5);
  if (!recent.length) return '暂无近 5 日 K 线';
  return recent
    .map((item) => `${item.date} 开${item.open.toFixed(2)} 收${item.close.toFixed(2)} 高${item.high.toFixed(2)} 低${item.low.toFixed(2)} 量${Math.round(item.volume)}`)
    .join('\n');
};

export const getCachedDailyReview = (analysisDate: string, providerId: string): AIDailyReviewEntry | null =>
  loadStoredDailyReviews().find((item) => item.analysisDate === analysisDate && item.providerId === providerId) ?? null;

export const getLatestCachedDailyReviewByProvider = (providerId: string): AIDailyReviewEntry | null =>
  loadStoredDailyReviews()
    .filter((item) => item.providerId === providerId)
    .sort((a, b) => Date.parse(b.generatedAt) - Date.parse(a.generatedAt))[0] ?? null;

export const getLatestCachedUltraShortAnalysisByProvider = (providerId: string): AIUltraShortAnalysisEntry | null =>
  loadStoredUltraShortAnalyses()
    .filter((item) => item.providerId === providerId)
    .sort((a, b) => Date.parse(b.generatedAt) - Date.parse(a.generatedAt))[0] ?? null;

export const getLatestCachedPremarketPlanByProvider = (providerId: string): AIPremarketPlanEntry | null =>
  loadStoredPremarketPlans()
    .filter((item) => item.providerId === providerId)
    .sort((a, b) => Date.parse(b.generatedAt) - Date.parse(a.generatedAt))[0] ?? null;

export const getLatestCachedPlanValidationByProvider = (providerId: string): AIPlanValidationEntry | null =>
  loadStoredPlanValidations()
    .filter((item) => item.providerId === providerId)
    .sort((a, b) => Date.parse(b.generatedAt) - Date.parse(a.generatedAt))[0] ?? null;

export const getLatestCachedStockObservationByProvider = (providerId: string): AIStockObservationEntry | null =>
  loadStoredStockObservations()
    .filter((item) => item.providerId === providerId)
    .sort((a, b) => Date.parse(b.generatedAt) - Date.parse(a.generatedAt))[0] ?? null;

export const getDailyReviewHistoryByProvider = (providerId: string): AIDailyReviewEntry[] =>
  loadStoredDailyReviews()
    .filter((item) => item.providerId === providerId)
    .sort((a, b) => {
      if (a.analysisDate !== b.analysisDate) {
        return b.analysisDate.localeCompare(a.analysisDate);
      }
      return Date.parse(b.generatedAt) - Date.parse(a.generatedAt);
    });

export const updateStoredDailyReviewContent = (
  entryId: string,
  content: string,
): AIDailyReviewEntry | null => {
  const normalizedContent = content.trim();
  if (!normalizedContent) return null;

  const entries = loadStoredDailyReviews();
  const targetIndex = entries.findIndex((item) => item.id === entryId);
  if (targetIndex < 0) return null;

  const updatedEntry: AIDailyReviewEntry = {
    ...entries[targetIndex],
    content: normalizedContent,
  };

  const nextEntries = [...entries];
  nextEntries[targetIndex] = updatedEntry;
  saveStoredDailyReviews(nextEntries);
  return updatedEntry;
};

export const updateStoredUltraShortAnalysisContent = (
  entryId: string,
  content: string,
): AIUltraShortAnalysisEntry | null => {
  const normalizedContent = content.trim();
  if (!normalizedContent) return null;

  const entries = loadStoredUltraShortAnalyses();
  const targetIndex = entries.findIndex((item) => item.id === entryId);
  if (targetIndex < 0) return null;

  const updatedEntry: AIUltraShortAnalysisEntry = {
    ...entries[targetIndex],
    content: normalizedContent,
  };

  const nextEntries = [...entries];
  nextEntries[targetIndex] = updatedEntry;
  saveStoredUltraShortAnalyses(nextEntries);
  return updatedEntry;
};

export const getUltraShortAnalysisHistoryByProvider = (providerId: string): AIUltraShortAnalysisEntry[] =>
  loadStoredUltraShortAnalyses()
    .filter((item) => item.providerId === providerId)
    .sort((a, b) => {
      if (a.analysisDate !== b.analysisDate) {
        return b.analysisDate.localeCompare(a.analysisDate);
      }
      return Date.parse(b.generatedAt) - Date.parse(a.generatedAt);
    });

export const getPremarketPlanHistoryByProvider = (providerId: string): AIPremarketPlanEntry[] =>
  loadStoredPremarketPlans()
    .filter((item) => item.providerId === providerId)
    .sort((a, b) => {
      if (a.targetTradingDate !== b.targetTradingDate) {
        return b.targetTradingDate.localeCompare(a.targetTradingDate);
      }
      return Date.parse(b.generatedAt) - Date.parse(a.generatedAt);
    });

export const updateStoredPremarketPlanContent = (
  entryId: string,
  content: string,
): AIPremarketPlanEntry | null => {
  const normalizedContent = content.trim();
  if (!normalizedContent) return null;

  const entries = loadStoredPremarketPlans();
  const targetIndex = entries.findIndex((item) => item.id === entryId);
  if (targetIndex < 0) return null;

  const updatedEntry: AIPremarketPlanEntry = {
    ...entries[targetIndex],
    content: normalizedContent,
  };

  const nextEntries = [...entries];
  nextEntries[targetIndex] = updatedEntry;
  saveStoredPremarketPlans(nextEntries);
  return updatedEntry;
};

export const getPlanValidationHistoryByProvider = (providerId: string): AIPlanValidationEntry[] =>
  loadStoredPlanValidations()
    .filter((item) => item.providerId === providerId)
    .sort((a, b) => {
      if (a.validationDate !== b.validationDate) {
        return b.validationDate.localeCompare(a.validationDate);
      }
      if (a.targetTradingDate !== b.targetTradingDate) {
        return b.targetTradingDate.localeCompare(a.targetTradingDate);
      }
      return Date.parse(b.generatedAt) - Date.parse(a.generatedAt);
    });

export const updateStoredPlanValidationContent = (
  entryId: string,
  content: string,
): AIPlanValidationEntry | null => {
  const normalizedContent = content.trim();
  if (!normalizedContent) return null;

  const entries = loadStoredPlanValidations();
  const targetIndex = entries.findIndex((item) => item.id === entryId);
  if (targetIndex < 0) return null;

  const verdict = deriveValidationVerdict(normalizedContent);
  const updatedEntry: AIPlanValidationEntry = {
    ...entries[targetIndex],
    content: normalizedContent,
    summary: {
      ...entries[targetIndex].summary,
      ...verdict,
    },
  };

  const nextEntries = [...entries];
  nextEntries[targetIndex] = updatedEntry;
  saveStoredPlanValidations(nextEntries);
  return updatedEntry;
};

export const getStockObservationHistoryByProvider = (providerId: string): AIStockObservationEntry[] =>
  loadStoredStockObservations()
    .filter((item) => item.providerId === providerId)
    .sort((a, b) => {
      if (a.analysisDate !== b.analysisDate) {
        return b.analysisDate.localeCompare(a.analysisDate);
      }
      return Date.parse(b.generatedAt) - Date.parse(a.generatedAt);
    });

export const updateStoredStockObservationContent = (
  entryId: string,
  content: string,
): AIStockObservationEntry | null => {
  const normalizedContent = content.trim();
  if (!normalizedContent) return null;

  const entries = loadStoredStockObservations();
  const targetIndex = entries.findIndex((item) => item.id === entryId);
  if (targetIndex < 0) return null;

  const updatedEntry: AIStockObservationEntry = {
    ...entries[targetIndex],
    content: normalizedContent,
  };

  const nextEntries = [...entries];
  nextEntries[targetIndex] = updatedEntry;
  saveStoredStockObservations(nextEntries);
  return updatedEntry;
};

export const generateAIDailyReview = async ({ providerId }: DailyReviewPayload = {}): Promise<AIDailyReviewEntry> => {
  const settings = loadAIIntegrationSettings();
  const provider =
    settings.providers.find((item) => item.id === providerId) ??
    settings.providers.find((item) => item.id === settings.preferredProviderId) ??
    settings.providers.find((item) => item.enabled);

  if (!provider) {
    throw new Error('没有可用的 AI 模型线路，请先在 AI对接 页面启用至少一条模型。');
  }
  if (!provider.baseUrl || !provider.model) {
    throw new Error(`模型线路 ${provider.displayName} 缺少 baseUrl 或 model 配置。`);
  }

  const [cycleOverview, breadth, bullBearSignal, leaders, conceptSector, industrySector, newsItems, reports, ladder] = await Promise.all([
    getCycleOverview(),
    getRealTimeMarketSentiment(),
    getBullBearSignalSnapshot(),
    getLeaderStateHistory(),
    getSectorPersistenceData('concept'),
    getSectorPersistenceData('industry'),
    getInfoGatheringNews(),
    getResearchReports(),
    loadLocalJsonFile<LadderData>('ladder.json'),
  ]);

  const latestLeader = leaders[leaders.length - 1];
  const analysisDate = latestLeader ? formatAnalysisDate(latestLeader.date) : new Date().toISOString().slice(0, 10);
  const prompt = appendSkillInstructions(
    buildPrompt(
      analysisDate,
      cycleOverview,
      breadth,
      buildBullBearSummary(bullBearSignal),
      leaders,
      conceptSector,
      industrySector,
      buildNewsSummary(analysisDate, newsItems),
      buildReportSummary(analysisDate, reports),
      ladder,
      settings.promptTemplates.dailyReview
    ),
    renderSkillInstructions(getEnabledSkillsForScope(settings, 'dailyReview'))
  );

  const content = (await invokeProvider(
    provider,
    prompt,
    '你是资深 A 股短线盘后复盘助理，擅长结合情绪周期、板块、龙头、新闻和研报生成高密度复盘。'
  )).trim();
  if (!content) {
    throw new Error(`模型 ${provider.displayName} 没有返回可用复盘内容。`);
  }

  const entry: AIDailyReviewEntry = {
    id: `${analysisDate}:${provider.id}`,
    analysisDate,
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
  const provider =
    settings.providers.find((item) => item.id === providerId) ??
    settings.providers.find((item) => item.id === settings.preferredProviderId) ??
    settings.providers.find((item) => item.enabled);

  if (!provider) {
    throw new Error('没有可用的 AI 模型线路，请先在 AI对接 页面启用至少一条模型。');
  }
  if (!provider.baseUrl || !provider.model) {
    throw new Error(`模型线路 ${provider.displayName} 缺少 baseUrl 或 model 配置。`);
  }

  const [cycleOverview, breadth, bullBearSignal, leaders, conceptSector, industrySector, newsItems, reports, ladder] = await Promise.all([
    getCycleOverview(),
    getRealTimeMarketSentiment(),
    getBullBearSignalSnapshot(),
    getLeaderStateHistory(),
    getSectorPersistenceData('concept'),
    getSectorPersistenceData('industry'),
    getInfoGatheringNews(),
    getResearchReports(),
    loadLocalJsonFile<LadderData>('ladder.json'),
  ]);

  const latestLeader = leaders[leaders.length - 1];
  const analysisDate = latestLeader ? formatAnalysisDate(latestLeader.date) : new Date().toISOString().slice(0, 10);
  const prompt = appendSkillInstructions(
    buildPrompt(
      analysisDate,
      cycleOverview,
      breadth,
      buildBullBearSummary(bullBearSignal),
      leaders,
      conceptSector,
      industrySector,
      buildNewsSummary(analysisDate, newsItems),
      buildReportSummary(analysisDate, reports),
      ladder,
      settings.promptTemplates.ultraShortAnalysis
    ),
    renderSkillInstructions(getEnabledSkillsForScope(settings, 'ultraShortAnalysis'))
  );

  const content = (await invokeProvider(
    provider,
    prompt,
    '你是 QuantDash 的 AI 超短线深度分析助手，专注 1 到 3 个交易日节奏下的情绪、龙头、接力和风险断点。'
  )).trim();
  if (!content) {
    throw new Error(`模型 ${provider.displayName} 没有返回可用超短线深度分析内容。`);
  }

  const entry: AIUltraShortAnalysisEntry = {
    id: `${analysisDate}:${provider.id}`,
    analysisDate,
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
  const provider =
    settings.providers.find((item) => item.id === providerId) ??
    settings.providers.find((item) => item.id === settings.preferredProviderId) ??
    settings.providers.find((item) => item.enabled);

  if (!provider) {
    throw new Error('没有可用的 AI 模型线路，请先在 AI对接 页面启用至少一条模型。');
  }

  const cachedReview = getLatestCachedDailyReviewByProvider(provider.id);
  const review = cachedReview ?? (await generateAIDailyReview({ providerId: provider.id }));
  const targetTradingDate = getNextTradingDate(review.analysisDate);
  const content = (
    await invokeProvider(
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
  const provider =
    settings.providers.find((item) => item.id === providerId) ??
    settings.providers.find((item) => item.id === settings.preferredProviderId) ??
    settings.providers.find((item) => item.enabled);

  if (!provider) {
    throw new Error('没有可用的 AI 模型线路，请先在 AI对接 页面启用至少一条模型。');
  }

  const plan = getLatestCachedPremarketPlanByProvider(provider.id) ?? (await generateAIPremarketPlan({ providerId: provider.id }));

  const [cycleOverview, breadth, bullBearSignal, leaders, conceptSector, industrySector, newsItems, ladder] = await Promise.all([
    getCycleOverview(),
    getRealTimeMarketSentiment(),
    getBullBearSignalSnapshot(),
    getLeaderStateHistory(),
    getSectorPersistenceData('concept'),
    getSectorPersistenceData('industry'),
    getInfoGatheringNews(),
    loadLocalJsonFile<LadderData>('ladder.json'),
  ]);

  const latestLeader = leaders[leaders.length - 1];
  const validationDate = latestLeader ? formatAnalysisDate(latestLeader.date) : new Date().toISOString().slice(0, 10);
  const observedStocks = await buildObservedStocksSummary(plan.content, validationDate);

  const content = (
    await invokeProvider(
      provider,
      appendSkillInstructions(
        buildPlanValidationPrompt(
          plan.targetTradingDate,
          validationDate,
          plan.content,
          cycleOverview,
          breadth,
          buildBullBearSummary(bullBearSignal),
          leaders,
          conceptSector,
          industrySector,
          buildNewsSummary(validationDate, newsItems),
          observedStocks.summaryText,
          ladder,
          settings.promptTemplates.planValidation,
        ),
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
    id: `${plan.targetTradingDate}:${validationDate}:${provider.id}`,
    targetTradingDate: plan.targetTradingDate,
    validationDate,
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
  const provider =
    settings.providers.find((item) => item.id === providerId) ??
    settings.providers.find((item) => item.id === settings.preferredProviderId) ??
    settings.providers.find((item) => item.enabled);

  if (!provider) {
    throw new Error('没有可用的 AI 模型线路，请先在 AI对接 页面启用至少一条模型。');
  }

  const [stockList, cycleOverview, leaders, conceptSector, industrySector, klines, newsItems, reports, focusList] = await Promise.all([
    getFullMarketStockList(),
    getCycleOverview(),
    getLeaderStateHistory(),
    getSectorPersistenceData('concept'),
    getSectorPersistenceData('industry'),
    getStockKline(normalizedSymbol, 101),
    getInfoGatheringNews(),
    getResearchReports(),
    loadFocusList(),
  ]);

  const stock = stockList.find((item) => item.symbol === normalizedSymbol);
  if (!stock) {
    throw new Error(`未在本地股票列表中找到 ${normalizedSymbol}，请先同步股票快照。`);
  }

  const latestLeader = leaders[leaders.length - 1];
  const analysisDate = latestLeader ? formatAnalysisDate(latestLeader.date) : new Date().toISOString().slice(0, 10);
  const perf = await getSingleDayPerformance(normalizedSymbol, analysisDate);
  const focusListStatus = focusList.items.some((item) => item.symbol === normalizedSymbol)
    ? (focusList.mode === 'remote' ? '是，当前在自选列表中' : '是，当前在本地重点关注列表中')
    : '否，当前不在已保存关注列表中';
  const latestPlan = getLatestCachedPremarketPlanByProvider(provider.id);
  const planSymbols = latestPlan ? extractObservedSymbols(latestPlan.content) : [];
  const planTrackingStatus = latestPlan
    ? (planSymbols.includes(normalizedSymbol)
      ? `是，出现在目标交易日 ${latestPlan.targetTradingDate} 的盘前计划观察清单里`
      : `否，最近一份盘前计划(${latestPlan.targetTradingDate})未提及该股`)
    : '暂无可用盘前计划';
  const relatedNewsSummary = buildRelatedNewsSummary(stock.symbol, stock.name, stock.industry || '', stock.concepts ?? [], newsItems);
  const relatedReportContext = buildRelatedReportContext(stock, reports, provider.id);
  const prompt = appendSkillInstructions(
    buildStockObservationPrompt(settings.promptTemplates.stockObservation, {
      symbol: stock.symbol,
      name: stock.name,
      industry: stock.industry || '待补充',
      concepts: stock.concepts?.join('、') || '暂无概念标签',
      analysisDate,
      latestPrice: stock.price.toFixed(2),
      latestPctChange: stock.pctChange.toFixed(2),
      openPct: perf?.openPct?.toFixed(2) ?? '—',
      closePct: perf?.closePct?.toFixed(2) ?? '—',
      isOneWord: perf ? (perf.isOneWord ? '是' : '否') : '未知',
      klineSummary: buildRecentKlineSummary(klines),
      stage: cycleOverview.stage,
      riskLevel: cycleOverview.riskLevel,
      volumeState: cycleOverview.volumeState,
      leaderSummary: buildLeaderSummary(leaders, null) || '暂无龙头状态',
      conceptSectorSummary: buildSectorSummary('概念板块', conceptSector),
      industrySectorSummary: buildSectorSummary('行业板块', industrySector),
      focusListStatus,
      planTrackingStatus,
      relatedNewsSummary,
      relatedReportSummary: relatedReportContext.reportSummary,
      cachedReportSummary: relatedReportContext.cachedSummary,
    }),
    renderSkillInstructions(getEnabledSkillsForScope(settings, 'stockObservation'))
  );

  const content = (await invokeProvider(
    provider,
    prompt,
    '你是 QuantDash 的个股观察助手，任务是判断一只股票在当前市场环境中的位置、作用和观察重点。'
  )).trim();
  if (!content) {
    throw new Error(`模型 ${provider.displayName} 没有返回可用个股观察内容。`);
  }

  const entry: AIStockObservationEntry = {
    id: `${stock.symbol}:${analysisDate}:${provider.id}`,
    symbol: stock.symbol,
    name: stock.name,
    analysisDate,
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
