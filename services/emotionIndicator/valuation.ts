import { requestEastmoneyAction } from '../eastmoneyService';

const MAX_REASONABLE_ASHARE_PE = 100;
const MAX_REASONABLE_ASHARE_PE_CHANGE_RATIO = 2;

export const fetchEmotionIndexSeries = async (secid: string): Promise<Map<string, number>> => {
  const res = await requestEastmoneyAction<any>(
    'emotion_index_series',
    { limit: 12, secid },
    { metaKey: `emotion-index-series:${secid}`, preferSnapshot: true },
  );
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

export const fetchAshareAveragePe = async (): Promise<number | null> => {
  const res = await requestEastmoneyAction<any>(
    'ashare_average_pe',
    {},
    { metaKey: 'ashare-average-pe', preferSnapshot: true },
  );
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

export const normalizeAshareAveragePe = (value: number | null, previousValue: number | null): number | null => {
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
