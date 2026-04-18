import type { IndexFuturesLongShortSeries } from '../../types';
import { requestEastmoneyAction } from '../eastmoneyService';
import { loadLocalJsonFile } from '../localDataService';
import { setEmotionIndicatorDataSource } from './shared';

const INDEX_FUTURES_CONFIG = {
  IF: { label: '沪深300', innerCode: '1000208870' },
  IC: { label: '中证500', innerCode: '1000295095' },
  IH: { label: '上证50', innerCode: '1000295097' },
  IM: { label: '中证1000', innerCode: '1003154509' },
} as const;

type IndexFuturesCode = keyof typeof INDEX_FUTURES_CONFIG;

const fetchIndexFuturesMainContract = async (code: IndexFuturesCode): Promise<string | null> => {
  const res = await requestEastmoneyAction<any>(
    'futures_main_contract',
    { code },
    { metaKey: `futures-main-contract:${code}`, preferSnapshot: true },
  );
  const rows = res?.result?.data;
  if (!Array.isArray(rows)) {
    return null;
  }

  const mainContract = rows.find((item: any) => item?.IS_MAINCODE === '1' && typeof item?.SECURITY_CODE === 'string');
  return mainContract?.SECURITY_CODE ?? null;
};

const fetchSingleIndexFuturesLongShortSeries = async (code: IndexFuturesCode): Promise<IndexFuturesLongShortSeries> => {
  const { label, innerCode } = INDEX_FUTURES_CONFIG[code];
  const mainContract = await fetchIndexFuturesMainContract(code);
  if (!mainContract) {
    throw new Error(`No main ${code} contract found`);
  }

  const res = await requestEastmoneyAction<any>(
    'futures_net_position',
    { innerCode, securityCode: mainContract },
    { metaKey: `futures-net-position:${code}`, preferSnapshot: true },
  );
  const rows = res?.result?.data;
  if (!Array.isArray(rows)) {
    throw new Error(`No ${code} net position data`);
  }

  const history = rows
    .map((item: any) => {
      const date = typeof item?.TRADE_DATE === 'string' ? item.TRADE_DATE.slice(0, 10) : '';
      const longPosition = Number(item?.TOTAL_LONG_POSITION);
      const shortPosition = Number(item?.TOTAL_SHORT_POSITION);
      if (!date || !Number.isFinite(longPosition) || !Number.isFinite(shortPosition) || shortPosition <= 0) {
        return null;
      }
      return {
        date,
        longPosition,
        shortPosition,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-12);

  if (history.length === 0) {
    throw new Error(`No valid ${code} long-short history`);
  }

  return {
    code,
    label,
    mainContract,
    history,
  };
};

export const getIndexFuturesLongShortRatioSeries = async (): Promise<Map<string, number>> => {
  const series = await fetchSingleIndexFuturesLongShortSeries('IF');
  return new Map(
    series.history.map((item) => [item.date, Number((item.longPosition / item.shortPosition).toFixed(4))] as const),
  );
};

export const getIndexFuturesLongShortHistory = async (): Promise<IndexFuturesLongShortSeries[]> => {
  const localData = await loadLocalJsonFile<IndexFuturesLongShortSeries[]>('index_futures_long_short.json');
  if (localData && localData.length > 0) {
    setEmotionIndicatorDataSource('local');
    return localData;
  }

  try {
    const data = await Promise.all(
      (Object.keys(INDEX_FUTURES_CONFIG) as IndexFuturesCode[]).map((code) => fetchSingleIndexFuturesLongShortSeries(code)),
    );
    if (data.length > 0) {
      setEmotionIndicatorDataSource('api');
      return data;
    }
  } catch (error) {
    console.warn('Failed to fetch index futures long-short data from EastMoney', error);
  }

  return [];
};
