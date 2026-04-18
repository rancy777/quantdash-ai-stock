import { Stock, LadderData } from '../types';
import { db, STORES } from './db';
import { getDataFreshnessMeta, mergeDataFreshnessMeta, setDataFreshnessMeta } from './eastmoneyService';
import { loadLocalJsonFile } from './localDataService';
import {
  ensureLadderLimitTimes,
  fetchLimitUpPool,
  getLimitUpPoolDataFreshness,
} from './limitUpPoolService';

const LADDER_META_KEY = 'limit-up-ladder';

const randomMockLimitTime = () => {
  const hour = 9 + Math.floor(Math.random() * 4);
  const minute = Math.floor(Math.random() * 60);
  const second = Math.floor(Math.random() * 60);
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:${second.toString().padStart(2, '0')}`;
};

const generateMockLadderData = (dates: string[], boardCounts: any[]): any => {
  const dataMatrix: any = {};
  boardCounts.forEach(r => dataMatrix[r.label] = {});

  dates.forEach(date => {
    boardCounts.forEach(row => {
      if (Math.random() > 0.6) {
        const count = Math.floor(Math.random() * 3) + 1;
        const stocks = [];
        for (let k = 0; k < count; k++) {
          stocks.push({
            symbol: `600${Math.floor(Math.random() * 1000)}`,
            name: `模拟股份${Math.floor(Math.random() * 100)}`,
            price: 10 + Math.random() * 20,
            pctChange: 10.0,
            volume: '-',
            turnover: '1.2亿',
            industry: '模拟板块',
            concepts: ['模拟概念'],
            pe: 20,
            limitUpTime: randomMockLimitTime(),
          });
        }
        dataMatrix[row.label][date] = stocks;
      }
    });
  });
  return dataMatrix;
};

const getTradingDates = (endDate: Date, count: number): string[] => {
  const dates: string[] = [];
  const current = new Date(endDate);
  let safetyCounter = 0;

  while (dates.length < count && safetyCounter < 100) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) {
      dates.push(current.toISOString().split('T')[0]);
    }
    current.setDate(current.getDate() - 1);
    safetyCounter++;
  }

  return dates;
};

export const getLimitUpLadderData = async (targetDateStr?: string): Promise<LadderData> => {
  const targetDate = targetDateStr ? new Date(targetDateStr) : new Date();
  const dateKey = targetDate.toISOString().split('T')[0];

  if (!targetDateStr) {
    const localLadder = await loadLocalJsonFile<LadderData>('ladder.json');
    if (localLadder && localLadder.boardCounts?.length) {
      setDataFreshnessMeta(LADDER_META_KEY, {
        detail: '本地连板天梯',
        source: 'local',
        updatedAt: null,
      });
      return ensureLadderLimitTimes(localLadder);
    }
  }

  const cached = await db.get<LadderData>(STORES.LADDER, dateKey);
  if (cached) {
    setDataFreshnessMeta(LADDER_META_KEY, {
      detail: 'IndexedDB 缓存',
      source: 'local',
      updatedAt: new Date().toISOString(),
    });
    return ensureLadderLimitTimes(cached);
  }

  const fullDates = getTradingDates(targetDate, 22);
  const dateLabels = fullDates.map(d => d.slice(5));
  const boardCounts = [
    { label: '七板以上', count: 7 },
    { label: '六连板', count: 6 },
    { label: '五连板', count: 5 },
    { label: '四连板', count: 4 },
    { label: '三连板', count: 3 },
    { label: '二连板', count: 2 },
  ];

  try {
    const dataMatrix: Record<string, Record<string, Stock[]>> = {};
    boardCounts.forEach(r => {
      dataMatrix[r.label] = {};
      dateLabels.forEach(label => {
        dataMatrix[r.label][label] = [];
      });
    });

    let hasRealData = false;
    let lastSnapshot: Record<number, Stock[]> | null = null;
    const ladderMetas = [];

    for (let i = 0; i < fullDates.length; i++) {
      const fullDate = fullDates[i];
      const dateLabel = dateLabels[i];
      const pool = await fetchLimitUpPool(fullDate);
      ladderMetas.push(getLimitUpPoolDataFreshness(fullDate));

      if (pool.length > 0) {
        hasRealData = true;
        const daySnapshot: Record<number, Stock[]> = {};

        for (const item of pool) {
          const lbc = item.boardCount;
          const symbol = item.symbol;
          const is20cm = symbol.startsWith('30') || symbol.startsWith('68');
          const is30cm = symbol.startsWith('8') || symbol.startsWith('4');
          let pct = 10.0;
          if (is30cm) pct = 30.0;
          else if (is20cm) pct = 20.0;

          const industryLabel = item.industry || '市场热点';
          const stock: Stock = {
            symbol,
            name: item.name,
            price: 0,
            pctChange: pct,
            volume: '-',
            turnover: '-',
            industry: industryLabel,
            concepts: [industryLabel],
            pe: 0,
            limitUpTime: item.limitUpTime,
          };

          const targetRow = lbc >= 7 ? boardCounts.find(r => r.count === 7) : boardCounts.find(r => r.count === lbc);
          if (targetRow) {
            dataMatrix[targetRow.label][dateLabel].push(stock);
          }
        }

        boardCounts.forEach(row => {
          daySnapshot[row.count] = dataMatrix[row.label][dateLabel].map(stock => ({ ...stock }));
        });
        lastSnapshot = daySnapshot;
      } else if (lastSnapshot) {
        boardCounts.forEach(row => {
          const source = row.count === 7 ? 7 : row.count + 1;
          const fallback = lastSnapshot?.[source] ?? [];
          dataMatrix[row.label][dateLabel] = fallback.map(stock => ({
            ...stock,
            concepts: [...stock.concepts],
            pctChange: Math.max(stock.pctChange - 5, 0),
          }));
        });
      }

      await new Promise(resolve => setTimeout(resolve, 60));
    }

    if (!hasRealData) {
      throw new Error('No ladder data fetched');
    }

    const resultData = {
      dates: dateLabels,
      boardCounts: boardCounts.map(r => ({
        ...r,
        data: dataMatrix[r.label],
      })),
      date: dateKey,
    };

    setDataFreshnessMeta(LADDER_META_KEY, mergeDataFreshnessMeta(ladderMetas));
    ensureLadderLimitTimes(resultData);
    await db.put(STORES.LADDER, resultData);

    return resultData;
  } catch {
    console.warn('Failed to fetch Real ZT Pool, falling back to mock ladder');
    setDataFreshnessMeta(LADDER_META_KEY, {
      detail: '模拟连板天梯',
      source: 'mock',
      updatedAt: null,
    });
    const mockDataMatrix = generateMockLadderData(dateLabels, boardCounts);
    const fallbackData: LadderData = {
      dates: dateLabels,
      boardCounts: boardCounts.map(r => ({
        ...r,
        data: mockDataMatrix[r.label],
      })),
      date: dateKey,
    };
    return ensureLadderLimitTimes(fallbackData);
  }
};

export const getLimitUpLadderDataFreshness = () => {
  return getDataFreshnessMeta(LADDER_META_KEY);
};
