import { Stock } from '../../types';

export interface LadderStockGroup {
  label: string;
  count: number;
  stocks: Stock[];
}

export interface LadderTodayBoardEntry {
  stock: Stock;
  boardLabel: string;
}

export interface LadderComparisonRow {
  symbol: string;
  prev?: Stock;
  curr?: Stock;
  today?: LadderTodayBoardEntry;
}

export interface LadderComparisonPair {
  prevBoardLabel: string;
  prevBoardCount: number;
  currBoardLabel: string;
  currBoardCount: number;
  key: string;
  rows: LadderComparisonRow[];
}
