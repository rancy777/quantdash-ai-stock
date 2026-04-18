import type { BoardHeightEntry, LadderData } from '../../types';
import {
  getBoardHeightDataSource,
  loadLocalSnapshot,
  setBoardHeightDataSource,
} from './shared';

const BOARD_HEIGHT_CACHE: { data: BoardHeightEntry[]; timestamp: number } = { data: [], timestamp: 0 };

const isChinextSymbol = (symbol: string) => /^(300|301)/.test(symbol);
const isMainBoardSymbol = (symbol: string) => /^(600|601|603|605|000|001|002|003)/.test(symbol);

const buildBoardHeightHistoryFromLadder = (ladder: LadderData | null): BoardHeightEntry[] => {
  if (!ladder?.boardCounts?.length || !ladder.dates?.length) return [];

  const sortedRows = [...ladder.boardCounts].sort((a, b) => b.count - a.count);
  const fullDates = (ladder as LadderData & { fullDates?: string[] }).fullDates ?? [];

  return ladder.dates.map((date, index) => {
    let mainHighestCount = 0;
    let mainHighestStocks: typeof sortedRows[number]['data'][string] = [];
    let mainSecondCount = 0;
    let mainSecondStocks: typeof sortedRows[number]['data'][string] = [];
    let chinextHighestCount = 0;
    let chinextHighestStocks: typeof sortedRows[number]['data'][string] = [];

    for (const row of sortedRows) {
      const dayStocks = row.data?.[date] ?? [];
      if (!dayStocks.length) continue;

      const mainStocks = dayStocks.filter((stock) => isMainBoardSymbol(stock.symbol));
      const chinextStocks = dayStocks.filter((stock) => isChinextSymbol(stock.symbol));

      if (mainStocks.length > 0) {
        if (mainHighestCount === 0) {
          mainHighestCount = row.count;
          mainHighestStocks = mainStocks;
        } else if (row.count < mainHighestCount && mainSecondCount === 0) {
          mainSecondCount = row.count;
          mainSecondStocks = mainStocks;
        }
      }

      if (chinextStocks.length > 0 && chinextHighestCount === 0) {
        chinextHighestCount = row.count;
        chinextHighestStocks = chinextStocks;
      }

      if (mainHighestCount && mainSecondCount && chinextHighestCount) {
        break;
      }
    }

    return {
      date,
      fullDate: fullDates[index],
      mainBoardHighest: mainHighestCount,
      mainBoardHighestNames: mainHighestStocks.map((stock) => stock.name),
      mainBoardHighestSymbols: mainHighestStocks.map((stock) => stock.symbol),
      mainBoardSecondHighest: mainSecondCount,
      mainBoardSecondHighestNames: mainSecondStocks.map((stock) => stock.name),
      mainBoardSecondHighestSymbols: mainSecondStocks.map((stock) => stock.symbol),
      chinextHighest: chinextHighestCount,
      chinextHighestNames: chinextHighestStocks.map((stock) => stock.name),
      chinextHighestSymbols: chinextHighestStocks.map((stock) => stock.symbol),
    };
  }).filter((entry) => entry.mainBoardHighest > 0 || entry.mainBoardSecondHighest > 0 || entry.chinextHighest > 0);
};

const sortBoardHeightEntries = (items: BoardHeightEntry[]): BoardHeightEntry[] =>
  [...items].sort((a, b) => {
    const left = a.fullDate ?? a.date;
    const right = b.fullDate ?? b.date;
    return left.localeCompare(right);
  });

export const getBoardHeightHistory = async (forceRefresh = false): Promise<BoardHeightEntry[]> => {
  if (!forceRefresh) {
    const localSnapshot = await loadLocalSnapshot<BoardHeightEntry[]>('board_height_history.json');
    if (localSnapshot && localSnapshot.length > 0) {
      const sorted = sortBoardHeightEntries(localSnapshot);
      BOARD_HEIGHT_CACHE.data = sorted;
      BOARD_HEIGHT_CACHE.timestamp = Date.now();
      setBoardHeightDataSource('local');
      return sorted;
    }

    const localLadder = await loadLocalSnapshot<LadderData & { fullDates?: string[] }>('ladder.json');
    const derived = sortBoardHeightEntries(buildBoardHeightHistoryFromLadder(localLadder));
    if (derived.length > 0) {
      BOARD_HEIGHT_CACHE.data = derived;
      BOARD_HEIGHT_CACHE.timestamp = Date.now();
      setBoardHeightDataSource('local');
      return derived;
    }
  }

  if (!forceRefresh && BOARD_HEIGHT_CACHE.data.length > 0 && Date.now() - BOARD_HEIGHT_CACHE.timestamp < 30 * 60 * 1000) {
    if (getBoardHeightDataSource() === 'unknown') {
      setBoardHeightDataSource('local');
    }
    return BOARD_HEIGHT_CACHE.data;
  }

  const localLadder = await loadLocalSnapshot<LadderData & { fullDates?: string[] }>('ladder.json');
  const derived = sortBoardHeightEntries(buildBoardHeightHistoryFromLadder(localLadder));
  BOARD_HEIGHT_CACHE.data = derived;
  BOARD_HEIGHT_CACHE.timestamp = Date.now();
  setBoardHeightDataSource(derived.length > 0 ? 'local' : 'unknown');
  return derived;
};
