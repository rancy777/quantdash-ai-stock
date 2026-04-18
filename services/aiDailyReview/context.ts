import type {
  BullBearSignalSnapshot,
  CycleOverviewData,
  LadderData,
  LeaderStateEntry,
  ResearchReportFile,
  SectorPersistenceData,
  Stock,
} from '../../types';
import { getBullBearSignalSnapshot } from '../emotionIndicatorService';
import { loadFocusList } from '../focusListService';
import { loadLocalJsonFile } from '../localDataService';
import { getInfoGatheringNews } from '../newsService';
import { getFullMarketStockList, getSingleDayPerformance, getStockKline } from '../quotesService';
import { getResearchReports } from '../reportService';
import { getCycleOverview, getLeaderStateHistory, getRealTimeMarketSentiment } from '../sentimentCycleService';
import { getSectorPersistenceData } from '../sectorService';

import { formatAnalysisDate } from './utils';

type MarketBreadth = { rise: number; fall: number; flat: number };
type NewsSummaryItem = Awaited<ReturnType<typeof getInfoGatheringNews>>[number];

const getLatestLeaderDate = (leaders: LeaderStateEntry[]): string =>
  leaders.length > 0 ? formatAnalysisDate(leaders[leaders.length - 1].date) : new Date().toISOString().slice(0, 10);

export type SharedMarketReviewContext = {
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
};

export type PlanValidationMarketContext = {
  breadth: MarketBreadth;
  bullBearSignal: BullBearSignalSnapshot | null;
  conceptSector: SectorPersistenceData | null;
  cycleOverview: CycleOverviewData;
  industrySector: SectorPersistenceData | null;
  ladder: LadderData | null;
  leaders: LeaderStateEntry[];
  newsItems: NewsSummaryItem[];
  validationDate: string;
};

export type StockObservationContext = {
  analysisDate: string;
  conceptSector: SectorPersistenceData | null;
  cycleOverview: CycleOverviewData;
  focusList: Awaited<ReturnType<typeof loadFocusList>>;
  industrySector: SectorPersistenceData | null;
  klines: Awaited<ReturnType<typeof getStockKline>>;
  leaders: LeaderStateEntry[];
  newsItems: NewsSummaryItem[];
  perf: Awaited<ReturnType<typeof getSingleDayPerformance>>;
  reports: ResearchReportFile[];
  stock: Stock;
};

export const loadSharedMarketReviewContext = async (): Promise<SharedMarketReviewContext> => {
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

  return {
    analysisDate: getLatestLeaderDate(leaders),
    breadth,
    bullBearSignal,
    conceptSector,
    cycleOverview,
    industrySector,
    ladder,
    leaders,
    newsItems,
    reports,
  };
};

export const loadPlanValidationMarketContext = async (): Promise<PlanValidationMarketContext> => {
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

  return {
    breadth,
    bullBearSignal,
    conceptSector,
    cycleOverview,
    industrySector,
    ladder,
    leaders,
    newsItems,
    validationDate: getLatestLeaderDate(leaders),
  };
};

export const loadStockObservationContext = async (symbol: string): Promise<StockObservationContext> => {
  const [stockList, cycleOverview, leaders, conceptSector, industrySector, klines, newsItems, reports, focusList] = await Promise.all([
    getFullMarketStockList(),
    getCycleOverview(),
    getLeaderStateHistory(),
    getSectorPersistenceData('concept'),
    getSectorPersistenceData('industry'),
    getStockKline(symbol, 101),
    getInfoGatheringNews(),
    getResearchReports(),
    loadFocusList(),
  ]);

  const stock = stockList.find((item) => item.symbol === symbol);
  if (!stock) {
    throw new Error(`未在本地股票列表中找到 ${symbol}，请先同步股票快照。`);
  }

  const analysisDate = getLatestLeaderDate(leaders);
  const perf = await getSingleDayPerformance(symbol, analysisDate);

  return {
    analysisDate,
    conceptSector,
    cycleOverview,
    focusList,
    industrySector,
    klines,
    leaders,
    newsItems,
    perf,
    reports,
    stock,
  };
};
