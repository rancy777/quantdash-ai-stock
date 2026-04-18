import { SentimentEntry } from '../../types';

import { getTushareConfig, hasUsableTushareApiKey, type TushareMarketBreadthResponse } from './config';

const estimateSentimentValue = (breadthData: { rise: number; fall: number; flat: number }): number => {
  const total = breadthData.rise + breadthData.fall + breadthData.flat;
  if (total === 0) return 5;
  return Math.max(0, Math.min(10, (breadthData.rise / total) * 10));
};

const getDateDaysAgo = (days: number, format: string = 'YYYY-MM-DD'): string => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return format === 'YYYYMMDD' ? `${year}${month}${day}` : `${year}-${month}-${day}`;
};

export const fetchMarketBreadthFromTushare = async (
  tradeDate?: string,
): Promise<{ rise: number; fall: number; flat: number } | null> => {
  try {
    const { apiKey, baseUrl } = getTushareConfig();
    if (!hasUsableTushareApiKey(apiKey)) {
      return null;
    }

    const date = tradeDate || new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const calendarParams = new URLSearchParams({
      api_name: 'trade_cal',
      token: apiKey,
      params: JSON.stringify({
        start_date: date,
        end_date: date,
        fields: 'cal_date,is_open',
      }),
    });
    const calendarResponse = await fetch(`${baseUrl}?${calendarParams}`);
    const calendarData: TushareMarketBreadthResponse = await calendarResponse.json();
    if (calendarData.code !== '0' || !calendarData.data?.items || calendarData.data.items[0][1] !== 1) {
      return null;
    }

    const dailyParams = new URLSearchParams({
      api_name: 'daily',
      token: apiKey,
      params: JSON.stringify({
        trade_date: date,
        fields: 'ts_code,trade_date,open,close,pct_chg',
        limit: 5000,
      }),
    });
    const dailyResponse = await fetch(`${baseUrl}?${dailyParams}`);
    const dailyData: TushareMarketBreadthResponse = await dailyResponse.json();

    if (dailyData.code === '0' && dailyData.data?.items?.length) {
      let rise = 0;
      let fall = 0;
      let flat = 0;
      const pctChgIndex = dailyData.data.fields.indexOf('pct_chg');
      if (pctChgIndex !== -1) {
        for (const item of dailyData.data.items) {
          const pctChg = parseFloat(item[pctChgIndex]) || 0;
          if (pctChg > 0) rise += 1;
          else if (pctChg < 0) fall += 1;
          else flat += 1;
        }
      }
      const estimatedTotal = 5100;
      const currentTotal = rise + fall + flat;
      if (currentTotal < estimatedTotal * 0.8 && currentTotal > 0) {
        const ratio = estimatedTotal / currentTotal;
        rise = Math.round(rise * ratio);
        fall = Math.round(fall * ratio);
        flat = Math.max(0, estimatedTotal - rise - fall);
      } else {
        flat = Math.max(0, estimatedTotal - rise - fall);
      }
      return { rise, fall, flat };
    }
    return null;
  } catch (error) {
    console.error('获取市场宽度数据异常:', error);
    return null;
  }
};

export const fetchSentimentHistoryFromTushare = async (days: number = 15): Promise<SentimentEntry[]> => {
  try {
    const { apiKey, baseUrl } = getTushareConfig();
    if (!hasUsableTushareApiKey(apiKey)) {
      return [];
    }

    const calendarParams = new URLSearchParams({
      api_name: 'trade_cal',
      token: apiKey,
      params: JSON.stringify({
        start_date: getDateDaysAgo(days * 2, 'YYYYMMDD'),
        end_date: new Date().toISOString().slice(0, 10).replace(/-/g, ''),
        fields: 'cal_date,is_open',
        is_open: 1,
      }),
    });
    const calendarResponse = await fetch(`${baseUrl}?${calendarParams}`);
    const calendarData: TushareMarketBreadthResponse = await calendarResponse.json();
    if (calendarData.code !== '0' || !calendarData.data?.items) {
      return [];
    }

    const tradeDates = calendarData.data.items
      .filter((item) => item[1] === 1)
      .slice(-days)
      .map((item) => item[0]);

    const sentimentEntries: SentimentEntry[] = [];
    for (const date of tradeDates) {
      const breadthData = await fetchMarketBreadthFromTushare(date);
      if (!breadthData) continue;
      const formattedDate = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
      sentimentEntries.push({
        date: formattedDate,
        value: estimateSentimentValue(breadthData),
        height: 0,
        limitUpCount: 0,
        limitDownCount: 0,
        riseCount: breadthData.rise,
      });
    }

    return sentimentEntries;
  } catch (error) {
    console.error('获取历史情绪数据失败:', error);
    return [];
  }
};

export const checkTushareConnection = async (): Promise<boolean> => {
  try {
    const { apiKey, baseUrl } = getTushareConfig();
    if (!hasUsableTushareApiKey(apiKey)) {
      return false;
    }
    const params = new URLSearchParams({
      api_name: 'stock_basic',
      token: apiKey,
      params: JSON.stringify({
        exchange: '',
        list_status: 'L',
        fields: 'ts_code,symbol,name,area,industry,list_date',
        limit: 1,
      }),
    });
    const response = await fetch(`${baseUrl}?${params}`);
    const data: TushareMarketBreadthResponse = await response.json();
    return data.code === '0';
  } catch (error) {
    console.error('Tushare API连接测试失败:', error);
    return false;
  }
};
