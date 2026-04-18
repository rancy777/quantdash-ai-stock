import { Stock } from '../types';
import { resolveScreenerApiBase } from './apiConfig';

export class WatchlistUnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WatchlistUnauthorizedError';
  }
}

const ensureSuccess = async (res: Response) => {
  if (!res.ok) {
    const detail = await res.text();
    if (res.status === 401) {
      throw new WatchlistUnauthorizedError(detail || '登录已过期，请重新登录');
    }
    throw new Error(detail || `Watchlist API error ${res.status}`);
  }
};

export const fetchRemoteWatchlist = async (token: string): Promise<Stock[]> => {
  const apiBase = resolveScreenerApiBase();
  const res = await fetch(`${apiBase}/watchlist?includeSignals=true`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  await ensureSuccess(res);
  const data = await res.json();
  return Array.isArray(data) ? (data as Stock[]) : [];
};

export const saveRemoteWatchlist = async (watchlist: Stock[], token: string): Promise<void> => {
  const apiBase = resolveScreenerApiBase();
  const res = await fetch(`${apiBase}/watchlist`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(watchlist),
  });
  await ensureSuccess(res);
};
