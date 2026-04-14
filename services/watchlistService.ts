import { Stock } from '../types';
import { resolveScreenerApiBase } from './apiConfig';

const ensureSuccess = async (res: Response) => {
  if (!res.ok) {
    const detail = await res.text();
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
