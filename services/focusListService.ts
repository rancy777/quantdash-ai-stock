import { Stock } from '../types';
import { getFullMarketStockList } from './quotesService';
import { fetchRemoteWatchlist, saveRemoteWatchlist } from './watchlistService';

const FOCUS_LIST_STORAGE_KEY = 'quantdash:focus-list';
const AUTH_TOKEN_STORAGE_KEYS = [
  'quantdash:auth-token',
  'quantdash:token',
  'authToken',
  'token',
  'screenerToken',
] as const;

export type FocusListSaveResult = {
  mode: 'remote' | 'local';
  addedSymbols: string[];
  duplicateSymbols: string[];
};

export type FocusListLoadResult = {
  mode: 'remote' | 'local';
  items: Stock[];
};

const buildFallbackStock = (symbol: string): Stock => ({
  symbol,
  name: symbol,
  price: 0,
  pctChange: 0,
  volume: '0',
  turnover: '0',
  industry: '待补充',
  concepts: [],
});

const getStoredAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  for (const key of AUTH_TOKEN_STORAGE_KEYS) {
    const value = window.localStorage.getItem(key);
    if (value) return value;
  }
  return null;
};

const loadLocalFocusList = (): Stock[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(FOCUS_LIST_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Stock[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveLocalFocusList = (items: Stock[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(FOCUS_LIST_STORAGE_KEY, JSON.stringify(items));
};

export const extractObservedSymbols = (content: string): string[] => {
  const matches = content.match(/\b(?:00|30|60|68)\d{4}\b/g) ?? [];
  return Array.from(new Set(matches));
};

const mergeStocks = (existing: Stock[], additions: Stock[]): FocusListSaveResult & { items: Stock[] } => {
  const existingMap = new Map(existing.map((item) => [item.symbol, item]));
  const addedSymbols: string[] = [];
  const duplicateSymbols: string[] = [];

  additions.forEach((item) => {
    if (existingMap.has(item.symbol)) {
      duplicateSymbols.push(item.symbol);
      return;
    }
    existingMap.set(item.symbol, item);
    addedSymbols.push(item.symbol);
  });

  return {
    mode: 'local',
    addedSymbols,
    duplicateSymbols,
    items: Array.from(existingMap.values()),
  };
};

const buildStockLookup = async (): Promise<Map<string, Stock>> => {
  const stocks = await getFullMarketStockList();
  return new Map(stocks.map((item) => [item.symbol, item]));
};

export const addSymbolsToFocusList = async (symbols: string[]): Promise<FocusListSaveResult> => {
  const normalized = Array.from(new Set(symbols.filter(Boolean)));
  if (normalized.length === 0) {
    return { mode: 'local', addedSymbols: [], duplicateSymbols: [] };
  }

  const lookup = await buildStockLookup();
  const additions = normalized.map((symbol) => lookup.get(symbol) ?? buildFallbackStock(symbol));
  const token = getStoredAuthToken();

  if (token) {
    try {
      const remoteWatchlist = await fetchRemoteWatchlist(token);
      const existingMap = new Map(remoteWatchlist.map((item) => [item.symbol, item]));
      const addedSymbols: string[] = [];
      const duplicateSymbols: string[] = [];
      additions.forEach((item) => {
        if (existingMap.has(item.symbol)) {
          duplicateSymbols.push(item.symbol);
          return;
        }
        existingMap.set(item.symbol, item);
        addedSymbols.push(item.symbol);
      });
      await saveRemoteWatchlist(Array.from(existingMap.values()), token);
      return { mode: 'remote', addedSymbols, duplicateSymbols };
    } catch (error) {
      console.warn('Failed to save remote watchlist, fallback to local focus list', error);
    }
  }

  const merged = mergeStocks(loadLocalFocusList(), additions);
  saveLocalFocusList(merged.items);
  return {
    mode: 'local',
    addedSymbols: merged.addedSymbols,
    duplicateSymbols: merged.duplicateSymbols,
  };
};

export const getLocalFocusList = (): Stock[] => loadLocalFocusList();

export const loadFocusList = async (): Promise<FocusListLoadResult> => {
  const token = getStoredAuthToken();
  if (token) {
    try {
      const remoteWatchlist = await fetchRemoteWatchlist(token);
      return {
        mode: 'remote',
        items: remoteWatchlist,
      };
    } catch (error) {
      console.warn('Failed to load remote watchlist, fallback to local focus list', error);
    }
  }

  return {
    mode: 'local',
    items: loadLocalFocusList(),
  };
};
