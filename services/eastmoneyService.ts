import type { DataFreshnessMeta } from '../types';
import { resolveScreenerApiBase } from './apiConfig';

type FetchFallbackOptions = {
  allowProxy?: boolean;
  cacheTtlMs?: number;
  failureCooldownMs?: number;
  timeout?: number;
};

type EastmoneyActionOptions = {
  cacheTtlMs?: number;
  failureCooldownMs?: number;
  timeout?: number;
  preferSnapshot?: boolean;
  forceRefresh?: boolean;
  metaKey?: string;
};

type EastmoneyActionResponse<T> = {
  data: T;
  meta?: {
    datasetKey?: string;
    requestKey?: string;
    source?: 'live' | 'cache' | 'snapshot' | 'secondary';
    provider?: DataFreshnessMeta['provider'];
    updatedAt?: string | null;
    isSnapshotFallback?: boolean;
    isCached?: boolean;
  };
};

export type DataSource = 'local' | 'api' | 'unknown';

export type EastmoneyActionName =
  | 'major_indexes'
  | 'stock_list_page'
  | 'chinext_list'
  | 'stock_kline'
  | 'index_kline'
  | 'sector_board_list'
  | 'sector_board_history'
  | 'limit_up_pool'
  | 'broken_pool'
  | 'limit_down_pool'
  | 'market_breadth_overview'
  | 'full_market_rows'
  | 'full_market_pct_snapshot'
  | 'emotion_index_series'
  | 'ashare_average_pe'
  | 'index_amount_series'
  | 'futures_main_contract'
  | 'futures_net_position';

const responseCache = new Map<string, { data: unknown; expiresAt: number }>();
const inFlightRequests = new Map<string, Promise<unknown>>();
const failureCooldowns = new Map<string, number>();
const dataFreshnessStore = new Map<string, DataFreshnessMeta>();

const normalizeRequestKey = (url: string) =>
  url
    .replace(/([?&])_=\d+/g, '$1_=:ts')
    .replace(/([?&])cb=[^&]+/g, '$1cb=:dynamic');

const buildActionCacheKey = (action: EastmoneyActionName, params: Record<string, unknown>) =>
  `${action}:${JSON.stringify(Object.keys(params).sort().reduce<Record<string, unknown>>((acc, key) => {
    acc[key] = params[key];
    return acc;
  }, {}))}`;

const sourceLabelMap: Record<DataFreshnessMeta['source'], string> = {
  cache: '代理缓存',
  live: '实时采集',
  local: '本地文件',
  mock: '模拟回退',
  secondary: '第二数据源',
  snapshot: '最近快照',
  unknown: '未知',
};

const formatProviderLabel = (provider: DataFreshnessMeta['provider']) => {
  if (provider === 'eastmoney') return 'EastMoney';
  if (provider === 'mootdx') return 'Mootdx';
  if (provider === 'local') return '本地';
  if (provider === 'mock') return '模拟';
  return '未知';
};

const convertMeta = (meta?: EastmoneyActionResponse<unknown>['meta']): DataFreshnessMeta => {
  const source = meta?.source ?? 'unknown';
  const provider = meta?.provider ?? (source === 'secondary' ? 'mootdx' : source === 'unknown' ? 'unknown' : 'eastmoney');
  const baseLabel = sourceLabelMap[source];
  return {
    datasetKey: meta?.datasetKey,
    detail: `${baseLabel} · ${formatProviderLabel(provider)}`,
    isCached: meta?.isCached,
    isSnapshotFallback: meta?.isSnapshotFallback,
    provider,
    source,
    updatedAt: meta?.updatedAt ?? null,
  };
};

export const setDataFreshnessMeta = (metaKey: string, meta: DataFreshnessMeta) => {
  dataFreshnessStore.set(metaKey, meta);
};

export const getDataFreshnessMeta = (metaKey: string): DataFreshnessMeta | null =>
  dataFreshnessStore.get(metaKey) ?? null;

export const mergeDataFreshnessMeta = (
  metas: Array<DataFreshnessMeta | null | undefined>,
  fallback: DataFreshnessMeta = { source: 'unknown', updatedAt: null, detail: '未知' },
): DataFreshnessMeta => {
  const valid = metas.filter((item): item is DataFreshnessMeta => Boolean(item));
  if (valid.length === 0) return fallback;

  const priority: Record<DataFreshnessMeta['source'], number> = {
    live: 5,
    cache: 4,
    secondary: 4,
    snapshot: 3,
    local: 2,
    mock: 1,
    unknown: 0,
  };
  const winner = valid.reduce((best, current) =>
    priority[current.source] > priority[best.source] ? current : best,
  );
  const updatedAt = valid
    .map((item) => item.updatedAt)
    .filter((item): item is string => Boolean(item))
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? winner.updatedAt ?? null;

  return {
    ...winner,
    isCached: valid.some((item) => item.isCached),
    isSnapshotFallback: valid.some((item) => item.isSnapshotFallback),
    updatedAt,
  };
};

export const fetchJsonWithFallback = async (url: string, options: FetchFallbackOptions = {}) => {
  const cacheTtlMs = options.cacheTtlMs ?? 5000;
  const failureCooldownMs = options.failureCooldownMs ?? 15000;
  const timeout = options.timeout ?? 8000;
  const requestKey = normalizeRequestKey(url);
  const now = Date.now();

  const cached = responseCache.get(requestKey);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const cooldownUntil = failureCooldowns.get(requestKey);
  if (cooldownUntil && cooldownUntil > now) {
    throw new Error('Request is in cooldown after a recent failure');
  }

  const inFlight = inFlightRequests.get(requestKey);
  if (inFlight) {
    return inFlight;
  }

  const fetchWithTimeout = async () => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(`${resolveScreenerApiBase()}/eastmoney/fetch`, {
        body: JSON.stringify({ timeoutMs: timeout, url }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
        signal: controller.signal,
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || `Request failed with status ${response.status}`);
      }
      return response;
    } finally {
      clearTimeout(id);
    }
  };

  const request = (async () => {
    try {
      const res = await fetchWithTimeout();
      const payload = await res.json();
      const data = payload?.data ?? payload;
      responseCache.set(requestKey, { data, expiresAt: Date.now() + cacheTtlMs });
      failureCooldowns.delete(requestKey);
      return data;
    } catch {
      failureCooldowns.set(requestKey, Date.now() + failureCooldownMs);
      throw new Error('All fetch methods failed');
    }
  })();

  inFlightRequests.set(requestKey, request);
  try {
    return await request;
  } finally {
    inFlightRequests.delete(requestKey);
  }
};

export const requestEastmoneyAction = async <T>(
  action: EastmoneyActionName,
  params: Record<string, unknown> = {},
  options: EastmoneyActionOptions = {},
): Promise<T> => {
  const cacheTtlMs = options.cacheTtlMs ?? 5000;
  const failureCooldownMs = options.failureCooldownMs ?? 15000;
  const timeout = options.timeout ?? 8000;
  const requestKey = buildActionCacheKey(action, params);
  const metaKey = options.metaKey ?? requestKey;
  const now = Date.now();

  const cached = responseCache.get(requestKey);
  if (cached && cached.expiresAt > now) {
    return cached.data as T;
  }

  const cooldownUntil = failureCooldowns.get(requestKey);
  if (cooldownUntil && cooldownUntil > now) {
    throw new Error('Request is in cooldown after a recent failure');
  }

  const inFlight = inFlightRequests.get(requestKey);
  if (inFlight) {
    return inFlight as Promise<T>;
  }

  const request = (async () => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(`${resolveScreenerApiBase()}/eastmoney/action`, {
        body: JSON.stringify({
          action,
          forceRefresh: options.forceRefresh ?? false,
          params,
          preferSnapshot: options.preferSnapshot ?? false,
          timeoutMs: timeout,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
        signal: controller.signal,
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || `Request failed with status ${response.status}`);
      }
      const payload = (await response.json()) as EastmoneyActionResponse<T>;
      const data = payload.data;
      setDataFreshnessMeta(metaKey, convertMeta(payload.meta));
      responseCache.set(requestKey, { data, expiresAt: Date.now() + cacheTtlMs });
      failureCooldowns.delete(requestKey);
      return data;
    } catch {
      failureCooldowns.set(requestKey, Date.now() + failureCooldownMs);
      throw new Error('All fetch methods failed');
    } finally {
      clearTimeout(id);
    }
  })();

  inFlightRequests.set(requestKey, request);
  try {
    return await request;
  } finally {
    inFlightRequests.delete(requestKey);
  }
};
