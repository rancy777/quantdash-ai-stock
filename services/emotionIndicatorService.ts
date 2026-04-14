import { BullBearSignalSnapshot, EmotionIndicatorEntry, IndexFuturesLongShortSeries } from '../types';
import { fetchJsonWithFallback, DataSource } from './eastmoneyService';
import { loadLocalJsonFile } from './localDataService';
import { getMarketVolumeTrendHistory } from './sentimentCycleService';

let EMOTION_INDICATOR_SOURCE: DataSource = 'unknown';
const MAX_REASONABLE_ASHARE_PE = 100;
const MAX_REASONABLE_ASHARE_PE_CHANGE_RATIO = 2;
const INDEX_FUTURES_CONFIG = {
  IF: { label: '沪深300', innerCode: '1000208870' },
  IC: { label: '中证500', innerCode: '1000295095' },
  IH: { label: '上证50', innerCode: '1000295097' },
  IM: { label: '中证1000', innerCode: '1003154509' },
} as const;
type IndexFuturesCode = keyof typeof INDEX_FUTURES_CONFIG;

export const getEmotionIndicatorDataSource = () => EMOTION_INDICATOR_SOURCE;

const fetchEmotionIndexSeries = async (secid: string): Promise<Map<string, number>> => {
  const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secid}&ut=fa5fd1943c7b386f172d6893dbfba10b&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58&klt=101&fqt=0&end=20500101&lmt=12&_=${Date.now()}`;
  const res = await fetchJsonWithFallback(url);
  const klines = res?.data?.klines;
  if (!Array.isArray(klines)) {
    throw new Error(`No kline data for ${secid}`);
  }

  return new Map(
    klines
      .map((item: string) => {
        const [date, , close] = item.split(',');
        return [date, Number(close)] as const;
      })
      .filter(([, close]) => Number.isFinite(close) && close > 0),
  );
};

const fetchAshareAveragePe = async (): Promise<number | null> => {
  const url = `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=6000&po=1&np=1&ut=bd1d9ddb04089700cf9c27f6f7426281&fltt=2&invt=2&fid=f3&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23&fields=f9&_=${Date.now()}`;
  const res = await fetchJsonWithFallback(url);
  const rows = res?.data?.diff;
  if (!Array.isArray(rows)) {
    return null;
  }

  const pes = rows
    .map((item: any) => Number(item.f9))
    .filter((value: number) => Number.isFinite(value) && value > 0 && value < 5000);

  if (pes.length === 0) {
    return null;
  }

  const average = pes.reduce((sum: number, value: number) => sum + value, 0) / pes.length;
  return Number(average.toFixed(2));
};

const normalizeAshareAveragePe = (value: number | null, previousValue: number | null): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return previousValue;
  }
  if (value > MAX_REASONABLE_ASHARE_PE) {
    return previousValue;
  }
  if (typeof previousValue === 'number' && Number.isFinite(previousValue) && previousValue > 0) {
    const ratio = value / previousValue;
    if (ratio > MAX_REASONABLE_ASHARE_PE_CHANGE_RATIO || ratio < (1 / MAX_REASONABLE_ASHARE_PE_CHANGE_RATIO)) {
      return previousValue;
    }
  }
  return Number(value.toFixed(2));
};

const fetchIndexFuturesMainContract = async (code: IndexFuturesCode): Promise<string | null> => {
  const filter = encodeURIComponent(`(TRADE_CODE="${code}")(IS_MAINCODE="1")`);
  const url =
    `https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_FUTU_POSITIONCODE` +
    `&columns=TRADE_CODE,SECURITY_CODE,IS_MAINCODE&filter=${filter}` +
    `&pageNumber=1&pageSize=10&sortColumns=SECURITY_CODE&sortTypes=-1&source=WEB&client=WEB&_=${Date.now()}`;
  const res = await fetchJsonWithFallback(url);
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

  const filter = encodeURIComponent(`(SECURITY_CODE="${mainContract}")(TYSECURITY_INNER_CODE="${innerCode}")`);
  const url =
    `https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_FUTU_NET_POSITION` +
    `&columns=TRADE_DATE,TOTAL_LONG_POSITION,TOTAL_SHORT_POSITION&filter=${filter}` +
    `&pageNumber=1&pageSize=21&sortColumns=TRADE_DATE&sortTypes=-1&source=WEB&client=WEB&_=${Date.now()}`;
  const res = await fetchJsonWithFallback(url);
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

const fetchIndexFuturesLongShortRatioSeries = async (): Promise<Map<string, number>> => {
  const series = await fetchSingleIndexFuturesLongShortSeries('IF');
  return new Map(
    series.history.map((item) => [item.date, Number((item.longPosition / item.shortPosition).toFixed(4))] as const),
  );
};

export const getIndexFuturesLongShortHistory = async (): Promise<IndexFuturesLongShortSeries[]> => {
  const localData = await loadLocalJsonFile<IndexFuturesLongShortSeries[]>('index_futures_long_short.json');
  if (localData && localData.length > 0) {
    EMOTION_INDICATOR_SOURCE = 'local';
    return localData;
  }

  try {
    const data = await Promise.all(
      (Object.keys(INDEX_FUTURES_CONFIG) as IndexFuturesCode[]).map((code) => fetchSingleIndexFuturesLongShortSeries(code)),
    );
    if (data.length > 0) {
      EMOTION_INDICATOR_SOURCE = 'api';
      return data;
    }
  } catch (error) {
    console.warn('Failed to fetch index futures long-short data from EastMoney', error);
  }

  return [];
};

const isStStockName = (name: string) => /(^|\b)\*?ST\b/i.test(name.replace(/\s+/g, ''));

const fetchFullMarketRows = async (): Promise<any[]> => {
  const pageSize = 100;
  const rows: any[] = [];

  for (let pageNumber = 1; pageNumber <= 80; pageNumber += 1) {
    const url =
      `https://push2.eastmoney.com/api/qt/clist/get?pn=${pageNumber}&pz=${pageSize}&po=1&np=1` +
      `&ut=bd1d9ddb04089700cf9c27f6f7426281&fltt=2&invt=2&fid=f12` +
      `&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23,m:0+t:81+s:2048` +
      `&fields=f3,f6,f12,f14&_=${Date.now()}`;
    const res = await fetchJsonWithFallback(url);
    const pageRows = res?.data?.diff;
    if (!Array.isArray(pageRows) || pageRows.length === 0) {
      break;
    }
    rows.push(...pageRows);
    if (pageRows.length < pageSize) {
      break;
    }
  }

  return rows;
};

const normalizeSnapshotDate = (date: string): string => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  if (/^\d{2}-\d{2}$/.test(date)) {
    const currentYear = new Date().getFullYear();
    return `${currentYear}-${date}`;
  }
  return date;
};

const fetchLimitPoolMeta = async (date: string, poolType: 'zt' | 'dt'): Promise<Array<{ symbol: string; name: string }>> => {
  const apiDate = date.replace(/-/g, '');
  const url = poolType === 'zt'
    ? `https://push2ex.eastmoney.com/getTopicZTPool?ut=7eea3edcaed734bea9cbfc24409ed989&dpt=wz.ztzt&Pageindex=0&pagesize=1000&sort=fbt%3Aasc&date=${apiDate}&_=${Date.now()}`
    : `https://push2ex.eastmoney.com/getTopicDTPool?ut=7eea3edcaed734bea9cbfc24409ed989&Pageindex=0&pagesize=1000&sort=fbt%3Aasc&date=${apiDate}&_=${Date.now()}`;

  try {
    const res = await fetchJsonWithFallback(url, { timeout: 4000 });
    const pool = res?.data?.pool;
    if (!Array.isArray(pool)) return [];
    return pool.map((item: any) => ({
      symbol: String(item?.c ?? ''),
      name: String(item?.n ?? ''),
    }));
  } catch {
    return [];
  }
};

export const getBullBearSignalSnapshot = async (): Promise<BullBearSignalSnapshot | null> => {
  const localHistory = await loadLocalJsonFile<BullBearSignalSnapshot[]>('bull_bear_signal.json');
  if (Array.isArray(localHistory) && localHistory.length > 0) {
    EMOTION_INDICATOR_SOURCE = 'local';
    return localHistory[localHistory.length - 1] ?? null;
  }

  try {
    const [rows, breadth, volumeHistory] = await Promise.all([
      fetchFullMarketRows(),
      fetchJsonWithFallback(
        `https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&invt=2&fields=f104,f105,f106&secids=1.000001,0.399001&ut=bd1d9ddb04089700cf9c27f6f7426281&_=${Date.now()}`,
      ),
      getMarketVolumeTrendHistory(),
    ]);

    if (rows.length === 0) return null;

    const latestDate = normalizeSnapshotDate(volumeHistory.at(-1)?.date ?? new Date().toISOString().slice(0, 10));
    const [limitUpPool, limitDownPool] = await Promise.all([
      fetchLimitPoolMeta(latestDate, 'zt'),
      fetchLimitPoolMeta(latestDate, 'dt'),
    ]);

    const limitUpSymbols = new Set(limitUpPool.map((item) => item.symbol));
    const limitDownSymbols = new Set(limitDownPool.map((item) => item.symbol));

    let riseCount = 0;
    let fallCount = 0;
    let flatCount = 0;
    let totalAmount = 0;
    let up5Count = 0;
    let up1Count = 0;
    let flatBandCount = 0;
    let down1Count = 0;
    let down5Count = 0;

    for (const row of rows) {
      const symbol = String(row?.f12 ?? '');
      const pct = Number(row?.f3);
      const amount = Number(row?.f6);
      if (Number.isFinite(amount) && amount > 0) {
        totalAmount += amount;
      }
      if (!Number.isFinite(pct)) continue;

      if (pct > 0) riseCount++;
      else if (pct < 0) fallCount++;
      else flatCount++;

      if (limitUpSymbols.has(symbol) || limitDownSymbols.has(symbol)) {
        continue;
      }

      if (pct >= 5) up5Count++;
      else if (pct >= 1) up1Count++;
      else if (pct > -1) flatBandCount++;
      else if (pct > -5) down1Count++;
      else down5Count++;
    }

    const breadthRows = Array.isArray(breadth?.data?.diff) ? breadth.data.diff : [];
    if (breadthRows.length > 0) {
      const totals = breadthRows.reduce(
        (acc: { rise: number; fall: number; flat: number }, item: any) => {
          acc.rise += Number(item?.f104) || 0;
          acc.fall += Number(item?.f105) || 0;
          acc.flat += Number(item?.f106) || 0;
          return acc;
        },
        { rise: 0, fall: 0, flat: 0 },
      );
      if (totals.rise + totals.fall + totals.flat > 0) {
        riseCount = totals.rise;
        fallCount = totals.fall;
        flatCount = totals.flat;
      }
    }

    const latestVolume = volumeHistory.at(-1) ?? null;
    const previousVolume = volumeHistory.length > 1 ? volumeHistory.at(-2) ?? null : null;
    const amountYi = latestVolume?.amount ?? Number((totalAmount / 100000000).toFixed(0));
    const amountChangeRate = latestVolume?.changeRate ?? (
      previousVolume && previousVolume.amount > 0
        ? Number((((amountYi - previousVolume.amount) / previousVolume.amount) * 100).toFixed(2))
        : null
    );

    const limitDownCount = limitDownPool.length > 0
      ? limitDownPool.length
      : rows.filter((row) => Number(row?.f3) <= -9.5).length;

    return {
      date: latestDate,
      riseCount,
      fallCount,
      flatCount,
      limitUpCount: limitUpPool.length,
      limitDownCount,
      naturalLimitUpCount: limitUpPool.filter((item) => !isStStockName(item.name)).length,
      naturalLimitDownCount: limitDownPool.length > 0
        ? limitDownPool.filter((item) => !isStStockName(item.name)).length
        : rows.filter((row) => Number(row?.f3) <= -9.5 && !isStStockName(String(row?.f14 ?? ''))).length,
      totalAmount: amountYi,
      amountChangeRate,
      rangeBuckets: [
        { label: '涨停', count: limitUpPool.length, tone: 'up' },
        { label: '涨停~5%', count: up5Count, tone: 'up' },
        { label: '5~1%', count: up1Count, tone: 'up' },
        { label: '平盘', count: flatBandCount, tone: 'flat' },
        { label: '0~-1%', count: down1Count, tone: 'down' },
        { label: '-1~-5%', count: down5Count, tone: 'down' },
        { label: '跌停', count: limitDownCount, tone: 'down' },
      ],
    };
  } catch (error) {
    console.warn('Failed to fetch bull bear signal snapshot from EastMoney', error);
    return null;
  }
};

export const getBullBearSignalHistory = async (): Promise<BullBearSignalSnapshot[]> => {
  const localHistory = await loadLocalJsonFile<BullBearSignalSnapshot[]>('bull_bear_signal.json');
  if (Array.isArray(localHistory) && localHistory.length > 0) {
    EMOTION_INDICATOR_SOURCE = 'local';
    return localHistory;
  }

  const latest = await getBullBearSignalSnapshot();
  return latest ? [latest] : [];
};

export const getEmotionIndicatorHistory = async (): Promise<EmotionIndicatorEntry[]> => {
  const localIndicators = await loadLocalJsonFile<EmotionIndicatorEntry[]>('emotion_indicators.json');
  if (localIndicators && localIndicators.length > 0) {
    EMOTION_INDICATOR_SOURCE = 'local';
    return localIndicators;
  }

  try {
    const [a50Series, nasdaqSeries, dowSeries, spSeries, cnhSeries, ashareAveragePe, indexFuturesLongShortSeries] = await Promise.all([
      fetchEmotionIndexSeries('100.XIN9'),
      fetchEmotionIndexSeries('100.NDX'),
      fetchEmotionIndexSeries('100.DJIA'),
      fetchEmotionIndexSeries('100.SPX'),
      fetchEmotionIndexSeries('133.USDCNH'),
      fetchAshareAveragePe(),
      fetchIndexFuturesLongShortRatioSeries(),
    ]);

    const dates = Array.from(a50Series.keys())
      .filter((date) => (
        nasdaqSeries.has(date) &&
        dowSeries.has(date) &&
        spSeries.has(date) &&
        cnhSeries.has(date) &&
        indexFuturesLongShortSeries.has(date)
      ))
      .sort((a, b) => a.localeCompare(b))
      .slice(-10);

    if (dates.length > 0) {
      const merged = dates
        .map((date) => ({
          date,
          ftseA50: a50Series.get(date)!,
          nasdaq: nasdaqSeries.get(date)!,
          dowJones: dowSeries.get(date)!,
          sp500: spSeries.get(date)!,
          offshoreRmb: cnhSeries.get(date)!,
          ashareAvgValuation: normalizeAshareAveragePe(ashareAveragePe, null) ?? 0,
          indexFuturesLongShortRatio: indexFuturesLongShortSeries.get(date)!,
        }))
        .filter((item) => item.ashareAvgValuation > 0 && (item.indexFuturesLongShortRatio ?? 0) > 0);

      if (merged.length > 0) {
        EMOTION_INDICATOR_SOURCE = 'api';
        return merged;
      }
    }
  } catch (error) {
    console.warn('Failed to fetch emotion indicators from EastMoney', error);
  }

  EMOTION_INDICATOR_SOURCE = 'unknown';
  return [];
};
