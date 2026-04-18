import type {
  BullBearSignalSnapshot,
  CycleOverviewData,
  LadderData,
  LeaderStateEntry,
  ResearchReportFile,
  SectorPersistenceData,
  Stock,
} from '../../types';
import { getCachedReportAISummary } from '../aiReportSummaryService';
import { extractObservedSymbols } from '../focusListService';
import { renderPromptTemplate } from '../modelIntegrationService';
import { getFullMarketStockList, getSingleDayPerformance, getStockKline } from '../quotesService';

import { formatAnalysisDate } from './utils';

type MarketBreadth = { rise: number; fall: number; flat: number };
type NewsSummaryItem = {
  content?: string | null;
  createdAt?: string | null;
  source: string;
  title: string;
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

const includesKeyword = (value: string | undefined | null, keyword: string): boolean =>
  Boolean(value && keyword && value.toLowerCase().includes(keyword.toLowerCase()));

export const buildLeaderSummary = (leaders: LeaderStateEntry[], ladder: LadderData | null): string =>
  leaders
    .slice(-3)
    .map((item) => {
      const leaderStock = findLeaderStockFromLadder(ladder, item);
      return `${formatAnalysisDate(item.date)} 龙头 ${item.leaderName}(${item.leaderSymbol})，${formatLeaderTags(leaderStock)}，最高板 ${item.leaderBoardCount}，同高度 ${item.leaderCount}，三板以上 ${item.threePlusCount}，次日开盘 ${item.nextOpenPct ?? '—'}%，次日收盘 ${item.nextClosePct ?? '—'}%，状态 ${item.statusLabel}`;
    })
    .join('\n');

export const buildSectorSummary = (title: string, data: SectorPersistenceData | null): string => {
  if (!data) return `${title}: 暂无数据`;
  const latest = data.entries[data.entries.length - 1];
  return `${title}: 当前领涨 ${data.currentLeaderName}(${data.currentLeaderCode})，连涨 ${data.currentStreakDays} 天，近5日 Top3 出现 ${data.currentTopThreeAppearances} 次，最近一日涨幅 ${latest?.leaderPctChange ?? '—'}%`;
};

export const buildNewsSummary = (analysisDate: string, newsItems: NewsSummaryItem[]): string => {
  const sameDay = newsItems.filter((item) => (item.createdAt ?? '').slice(0, 10) === analysisDate).slice(0, 6);
  const fallback = sameDay.length > 0 ? sameDay : newsItems.slice(0, 6);
  return fallback.map((item) => `- [${item.source}] ${item.title}`).join('\n');
};

export const buildReportSummary = (analysisDate: string, reports: ResearchReportFile[]): string => {
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

export const buildBullBearSummary = (snapshot: BullBearSignalSnapshot | null): string => {
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

export const buildMarketReviewPrompt = ({
  analysisDate,
  breadth,
  bullBearSignal,
  conceptSector,
  cycleOverview,
  industrySector,
  ladder,
  leaders,
  newsItems,
  reports,
  template,
}: {
  analysisDate: string;
  breadth: MarketBreadth;
  bullBearSignal: BullBearSignalSnapshot | null;
  conceptSector: SectorPersistenceData | null;
  cycleOverview: CycleOverviewData;
  industrySector: SectorPersistenceData | null;
  ladder: LadderData | null;
  leaders: LeaderStateEntry[];
  newsItems: NewsSummaryItem[];
  reports: ResearchReportFile[];
  template: string;
}): string =>
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
    bullBearSummary: buildBullBearSummary(bullBearSignal),
    leaderSummary: buildLeaderSummary(leaders, ladder) || '暂无龙头状态',
    conceptSectorSummary: buildSectorSummary('概念板块', conceptSector),
    industrySectorSummary: buildSectorSummary('行业板块', industrySector),
    newsSummary: buildNewsSummary(analysisDate, newsItems) || '- 暂无新闻',
    reportSummary: buildReportSummary(analysisDate, reports) || '- 暂无研报',
  });

export const buildPremarketPrompt = (
  sourceAnalysisDate: string,
  targetTradingDate: string,
  dailyReviewContent: string,
  template: string,
): string =>
  renderPromptTemplate(template, {
    sourceAnalysisDate,
    targetTradingDate,
    dailyReviewContent,
  });

export const buildPlanValidationPrompt = ({
  breadth,
  bullBearSignal,
  conceptSector,
  cycleOverview,
  industrySector,
  ladder,
  leaders,
  newsItems,
  observedStocksSummary,
  premarketPlanContent,
  targetTradingDate,
  template,
  validationDate,
}: {
  breadth: MarketBreadth;
  bullBearSignal: BullBearSignalSnapshot | null;
  conceptSector: SectorPersistenceData | null;
  cycleOverview: CycleOverviewData;
  industrySector: SectorPersistenceData | null;
  ladder: LadderData | null;
  leaders: LeaderStateEntry[];
  newsItems: NewsSummaryItem[];
  observedStocksSummary: string;
  premarketPlanContent: string;
  targetTradingDate: string;
  template: string;
  validationDate: string;
}): string =>
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
    bullBearSummary: buildBullBearSummary(bullBearSignal),
    leaderSummary: buildLeaderSummary(leaders, ladder) || '暂无龙头状态',
    conceptSectorSummary: buildSectorSummary('概念板块', conceptSector),
    industrySectorSummary: buildSectorSummary('行业板块', industrySector),
    newsSummary: buildNewsSummary(validationDate, newsItems) || '- 暂无新闻',
    observedStocksSummary: observedStocksSummary || '- 未从盘前计划中识别到股票代码',
  });

export const buildStockObservationPrompt = (
  template: string,
  variables: Record<string, string | number | null | undefined>,
): string => renderPromptTemplate(template, variables);

export const appendSkillInstructions = (prompt: string, instructions: string): string =>
  instructions
    ? `${prompt}\n\n八、启用的 Skills\n${instructions}\n\n请在输出时执行以上 Skills 的约束，并且所有结论仍然必须以本次输入数据为依据。`
    : prompt;

export const buildObservedStocksSummary = async (
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

export const buildRelatedNewsSummary = (
  symbol: string,
  name: string,
  industry: string,
  concepts: string[],
  newsItems: NewsSummaryItem[],
): string => {
  const keywords = [symbol, name, industry, ...concepts].filter(Boolean);
  const matched = newsItems.filter((item) =>
    keywords.some((keyword) =>
      includesKeyword(item.title, keyword) || includesKeyword(item.content, keyword),
    ),
  );
  const fallback = matched.length > 0 ? matched.slice(0, 4) : newsItems.slice(0, 3);
  return fallback.length > 0
    ? fallback.map((item) => `- [${item.source}] ${item.title}`).join('\n')
    : '暂无明显相关资讯';
};

export const buildRelatedReportContext = (
  stock: { symbol: string; name: string; industry: string; concepts?: string[] },
  reports: ResearchReportFile[],
  providerId: string,
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
      (report.tags ?? []).some((tag) => includesKeyword(tag, keyword)),
    ),
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

export const buildRecentKlineSummary = (rows: Awaited<ReturnType<typeof getStockKline>>): string => {
  const recent = rows.slice(-5);
  if (!recent.length) return '暂无近 5 日 K 线';
  return recent
    .map((item) => `${item.date} 开${item.open.toFixed(2)} 收${item.close.toFixed(2)} 高${item.high.toFixed(2)} 低${item.low.toFixed(2)} 量${Math.round(item.volume)}`)
    .join('\n');
};
