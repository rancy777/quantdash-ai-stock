import type { DataSource } from '../eastmoneyService';
import { loadLocalJsonFile } from '../localDataService';
import { getStockKline } from '../quotesService';

let sentimentSource: DataSource = 'unknown';
let performanceSource: DataSource = 'unknown';
let structureSource: DataSource = 'unknown';
let repairSource: DataSource = 'unknown';
let leaderSource: DataSource = 'unknown';
let boardHeightSource: DataSource = 'unknown';
let sentimentUpdatedAt: string | null = null;
let performanceUpdatedAt: string | null = null;
let structureUpdatedAt: string | null = null;
let repairUpdatedAt: string | null = null;
let leaderUpdatedAt: string | null = null;
let boardHeightUpdatedAt: string | null = null;

const nextTimestamp = () => new Date().toISOString();

export const getSentimentDataSource = () => sentimentSource;
export const getSentimentUpdatedAt = () => sentimentUpdatedAt;
export const setSentimentDataSource = (source: DataSource) => {
  sentimentSource = source;
  sentimentUpdatedAt = nextTimestamp();
};

export const getPerformanceDataSource = () => performanceSource;
export const getPerformanceUpdatedAt = () => performanceUpdatedAt;
export const setPerformanceDataSource = (source: DataSource) => {
  performanceSource = source;
  performanceUpdatedAt = nextTimestamp();
};

export const getStructureDataSource = () => structureSource;
export const getStructureUpdatedAt = () => structureUpdatedAt;
export const setStructureDataSource = (source: DataSource) => {
  structureSource = source;
  structureUpdatedAt = nextTimestamp();
};

export const getRepairDataSource = () => repairSource;
export const getRepairUpdatedAt = () => repairUpdatedAt;
export const setRepairDataSource = (source: DataSource) => {
  repairSource = source;
  repairUpdatedAt = nextTimestamp();
};

export const getLeaderDataSource = () => leaderSource;
export const getLeaderUpdatedAt = () => leaderUpdatedAt;
export const setLeaderDataSource = (source: DataSource) => {
  leaderSource = source;
  leaderUpdatedAt = nextTimestamp();
};

export const getBoardHeightDataSource = () => boardHeightSource;
export const getBoardHeightUpdatedAt = () => boardHeightUpdatedAt;
export const setBoardHeightDataSource = (source: DataSource) => {
  boardHeightSource = source;
  boardHeightUpdatedAt = nextTimestamp();
};

export const loadLocalSnapshot = async <T>(fileName: string): Promise<T | null> => {
  return loadLocalJsonFile<T>(fileName);
};

export const getRecentTradingDates = async (count: number): Promise<string[]> => {
  try {
    const klines = await getStockKline('000001', 101);
    const dates = klines.map((item) => item.date).sort();
    const start = Math.max(dates.length - count - 2, 0);
    return dates.slice(start);
  } catch {
    const dates: string[] = [];
    const cursor = new Date();
    while (dates.length < count + 2) {
      const day = cursor.getDay();
      if (day !== 0 && day !== 6) {
        dates.unshift(cursor.toISOString().split('T')[0]);
      }
      cursor.setDate(cursor.getDate() - 1);
    }
    return dates;
  }
};
