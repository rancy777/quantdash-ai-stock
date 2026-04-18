import type { MarketVolumeTrendEntry } from '../../types';
import { requestEastmoneyAction } from '../eastmoneyService';
import { loadLocalSnapshot } from './shared';

const fetchMarketIndexAmountSeries = async (secid: string): Promise<Map<string, number>> => {
  try {
    const res = await requestEastmoneyAction<any>(
      'index_amount_series',
      { limit: 12, secid },
      { metaKey: `market-volume-series:${secid}`, preferSnapshot: true, timeout: 5000 },
    );
    const klines = res?.data?.klines;
    if (!Array.isArray(klines)) return new Map<string, number>();
    return new Map<string, number>(
      klines
        .map((line: string) => {
          const parts = String(line).split(',');
          const date = parts[0];
          const amount = Number(parts[6] ?? 0);
          if (!date || Number.isNaN(amount)) return null;
          return [date, amount];
        })
        .filter((item): item is [string, number] => Boolean(item)),
    );
  } catch (error) {
    console.warn('Failed to fetch market amount series', secid, error);
    return new Map<string, number>();
  }
};

export const getMarketVolumeTrendHistory = async (): Promise<MarketVolumeTrendEntry[]> => {
  const localSnapshot = await loadLocalSnapshot<MarketVolumeTrendEntry[]>('market_volume_trend.json');
  if (localSnapshot && localSnapshot.length > 0) {
    return localSnapshot;
  }

  const [shSeries, szSeries] = await Promise.all([
    fetchMarketIndexAmountSeries('1.000001'),
    fetchMarketIndexAmountSeries('0.399001'),
  ]);

  const allDates = [...new Set([...shSeries.keys(), ...szSeries.keys()])].sort((a, b) => a.localeCompare(b)).slice(-8);
  const entries: MarketVolumeTrendEntry[] = allDates.map((date, index) => {
    const amount = (shSeries.get(date) ?? 0) + (szSeries.get(date) ?? 0);
    const prevAmount = index > 0 ? (shSeries.get(allDates[index - 1]) ?? 0) + (szSeries.get(allDates[index - 1]) ?? 0) : 0;
    const changeRate = index > 0 && prevAmount > 0 ? Number((((amount - prevAmount) / prevAmount) * 100).toFixed(2)) : null;
    return {
      date: date.slice(5),
      amount: Number((amount / 100000000).toFixed(0)),
      changeRate,
    };
  });

  return entries.filter((item) => item.amount > 0);
};
