import { SentimentEntry } from '../types';

// Tushare API响应接口
interface TushareMarketBreadthResponse {
  code: string;
  message: string;
  data?: {
    fields: string[];
    items: any[];
  };
}

// 获取Tushare API配置
const getTushareConfig = () => {
  // 在浏览器环境中，我们从环境变量或全局配置中获取API密钥
  // 注意：实际使用时，建议通过服务端代理来调用Tushare API，避免在前端暴露API密钥
  const apiKey =
    import.meta.env.TUSHARE_API_KEY ||
    import.meta.env.VITE_TUSHARE_API_KEY ||
    'YOUR_TUSHARE_API_KEY_HERE';
  const baseUrl =
    import.meta.env.TUSHARE_API_BASE_URL ||
    import.meta.env.VITE_TUSHARE_API_BASE_URL ||
    'https://api.tushare.pro';
  
  return { apiKey, baseUrl };
};

const hasUsableTushareApiKey = (apiKey: string): boolean => {
  const normalizedKey = apiKey.trim();
  return normalizedKey.length > 0 && normalizedKey !== 'YOUR_TUSHARE_API_KEY_HERE';
};

/**
 * 调用Tushare API获取市场宽度数据（上涨下跌家数）
 * @param tradeDate 交易日期，格式为'YYYYMMDD'
 * @returns Promise<{rise: number, fall: number, flat: number} | null>
 */
export const fetchMarketBreadthFromTushare = async (tradeDate?: string): Promise<{rise: number, fall: number, flat: number} | null> => {
  try {
    const { apiKey, baseUrl } = getTushareConfig();
    
    // 检查是否为模拟环境或API密钥未配置
    if (!hasUsableTushareApiKey(apiKey)) {
      console.log('Tushare API密钥未配置，返回null以尝试其他数据源');
      return null; // 返回null而不是模拟数据，让调用方尝试其他数据源
    }
    
    // 如果没有提供日期，使用今天的日期（格式化为YYYYMMDD）
    const date = tradeDate || new Date().toISOString().slice(0, 10).replace(/-/g, '');
    
    // 1. 先获取交易日历，确认是否为交易日
    const calendarParams = new URLSearchParams({
      api_name: 'trade_cal',
      token: apiKey,
      params: JSON.stringify({
        start_date: date,
        end_date: date,
        fields: 'cal_date,is_open'
      })
    });
    
    const calendarResponse = await fetch(`${baseUrl}?${calendarParams}`);
    const calendarData: TushareMarketBreadthResponse = await calendarResponse.json();
    
    if (calendarData.code !== '0' || !calendarData.data?.items || calendarData.data.items[0][1] !== 1) {
      console.warn('当前日期不是交易日或无法确认交易日状态');
      return null; // 返回null而不是模拟数据，让调用方决定如何处理
    }
    
    // 2. 获取股票行情数据（使用daily API）
    const dailyParams = new URLSearchParams({
      api_name: 'daily',
      token: apiKey,
      params: JSON.stringify({
        trade_date: date,
        fields: 'ts_code,trade_date,open,close,pct_chg',
        limit: 5000 // 获取足够数量的股票
      })
    });
    
    const dailyResponse = await fetch(`${baseUrl}?${dailyParams}`);
    const dailyData: TushareMarketBreadthResponse = await dailyResponse.json();
    
    if (dailyData.code === '0' && dailyData.data?.items && dailyData.data.items.length > 0) {
      // 计算上涨、下跌和平盘家数
      let rise = 0;
      let fall = 0;
      let flat = 0;
      
      // 找到pct_chg字段的索引
      const pctChgIndex = dailyData.data.fields.indexOf('pct_chg');
      
      if (pctChgIndex !== -1) {
        for (const item of dailyData.data.items) {
          const pctChg = parseFloat(item[pctChgIndex]) || 0;
          if (pctChg > 0) {
            rise++;
          } else if (pctChg < 0) {
            fall++;
          } else {
            flat++;
          }
        }
        
        // 改进数据估算逻辑
        // 中国A股当前约有5100-5200只股票
        const estimatedTotal = 5100; // 更新为更准确的A股总数量估计
        const currentTotal = rise + fall + flat;
        
        // 只有当返回的数据量明显少于估计总量时才进行估算
        // 避免过度估算导致数据不准确
        if (currentTotal < estimatedTotal * 0.8 && currentTotal > 0) {
          const ratio = estimatedTotal / currentTotal;
          // 对上涨家数进行更精确的估算，避免整数舍入误差
          rise = Math.round(rise * ratio);
          fall = Math.round(fall * ratio);
          flat = estimatedTotal - rise - fall; // 确保总数等于estimatedTotal
          
          // 防止平盘数量出现负数
          if (flat < 0) {
            flat = 0;
            // 根据上涨下跌比例调整总数
            const adjustRatio = estimatedTotal / (rise + fall);
            rise = Math.round(rise * adjustRatio);
            fall = estimatedTotal - rise;
          }
        } else {
          // 如果返回的数据量已经足够多，不再进行估算
          flat = Math.max(0, estimatedTotal - rise - fall);
        }
        
        console.log(`成功获取市场宽度数据: 上涨${rise}, 下跌${fall}, 平盘${flat}`);
        return { rise, fall, flat };
      }
    }
    
    // 如果API调用失败或返回数据不完整，返回null
    console.log('Tushare API未返回有效数据，返回null以尝试其他数据源');
    return null;
  } catch (error) {
    console.error('获取市场宽度数据异常:', error);
    // 发生异常时返回null，让调用方尝试其他数据源
    return null;
  }
};

/**
 * 生成模拟的市场宽度数据（仅在所有数据源都失败时使用）
 * @returns {rise: number, fall: number, flat: number}
 */
const getMockMarketBreadthData = (): {rise: number, fall: number, flat: number} => {
  // 根据当前时间生成相对合理的模拟数据
  const now = new Date();
  const hour = now.getHours();
  
  // 生成一个基础值，模拟市场整体情况
  // 这里使用随机值但加上一些时间特征，让数据看起来更真实
  let baseRise = 2000 + Math.random() * 1000;
  let baseFall = 2000 + Math.random() * 1000;
  
  // 模拟股票总数约5000只
  const totalStocks = 5000;
  
  // 根据时间调整模拟数据的偏向
  if (hour >= 9 && hour < 15) {
    // 交易时间，数据波动更大
    const marketTrend = Math.random(); // 随机市场趋势
    if (marketTrend > 0.6) {
      // 上涨趋势
      baseRise += 500;
      baseFall -= 300;
    } else if (marketTrend < 0.4) {
      // 下跌趋势
      baseRise -= 300;
      baseFall += 500;
    }
  }
  
  // 确保数值合理
  baseRise = Math.max(1000, Math.min(4000, Math.round(baseRise)));
  baseFall = Math.max(1000, Math.min(4000, Math.round(baseFall)));
  
  // 计算平盘数量
  const flat = Math.max(0, totalStocks - baseRise - baseFall);
  
  return { rise: baseRise, fall: baseFall, flat };
};

/**
 * 获取最近N天的市场情绪数据
 * @param days 天数
 * @returns Promise<SentimentEntry[]> 情绪数据数组
 */
export const fetchSentimentHistoryFromTushare = async (days: number = 15): Promise<SentimentEntry[]> => {
  try {
    const { apiKey, baseUrl } = getTushareConfig();

    if (!hasUsableTushareApiKey(apiKey)) {
      console.log('Tushare API密钥未配置，跳过历史情绪数据请求');
      return [];
    }
    
    // 首先获取交易日历
    const calendarParams = new URLSearchParams({
      api_name: 'trade_cal',
      token: apiKey,
      params: JSON.stringify({
        start_date: getDateDaysAgo(days * 2, 'YYYYMMDD'), // 获取足够的天数，考虑非交易日
        end_date: new Date().toISOString().slice(0, 10).replace(/-/g, ''),
        fields: 'cal_date,is_open',
        is_open: 1 // 只获取交易日
      })
    });
    
    const calendarResponse = await fetch(`${baseUrl}?${calendarParams}`);
    const calendarData: TushareMarketBreadthResponse = await calendarResponse.json();
    
    if (calendarData.code !== '0' || !calendarData.data?.items) {
      console.warn('获取交易日历失败:', calendarData.message);
      return [];
    }
    
    // 获取最近的days个交易日
    const tradeDates = calendarData.data.items
      .filter(item => item[1] === 1) // is_open = 1
      .slice(-days)
      .map(item => item[0]); // 获取cal_date
    
    const sentimentEntries: SentimentEntry[] = [];
    
    // 依次获取每个交易日的市场宽度数据
    for (const date of tradeDates) {
      const breadthData = await fetchMarketBreadthFromTushare(date);
      
      if (breadthData) {
        // 将YYYYMMDD格式转换为YYYY-MM-DD格式
        const formattedDate = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
        
        // 这里我们只有上涨下跌家数数据，其他字段需要估算或设置默认值
        sentimentEntries.push({
          date: formattedDate,
          value: estimateSentimentValue(breadthData),
          height: 0, // 连板高度需要额外数据
          limitUpCount: 0, // 涨停家数需要额外数据
          limitDownCount: 0, // 跌停家数需要额外数据
          riseCount: breadthData.rise
        });
      }
    }
    
    return sentimentEntries;
  } catch (error) {
    console.error('获取历史情绪数据失败:', error);
    return [];
  }
};

/**
 * 根据市场宽度数据估算情绪指数
 * @param breadthData 市场宽度数据
 * @returns number 估算的情绪指数值
 */
const estimateSentimentValue = (breadthData: { rise: number; fall: number; flat: number }): number => {
  // 简单的情绪指数计算逻辑
  // 可以根据实际情况调整算法
  const total = breadthData.rise + breadthData.fall + breadthData.flat;
  if (total === 0) return 5; // 中性
  
  const riseRatio = breadthData.rise / total;
  // 将上涨比例映射到0-10的情绪指数
  return Math.max(0, Math.min(10, riseRatio * 10));
};

/**
 * 获取N天前的日期
 * @param days 天数
 * @param format 格式：'YYYY-MM-DD' 或 'YYYYMMDD'
 * @returns string 格式化的日期字符串
 */
const getDateDaysAgo = (days: number, format: string = 'YYYY-MM-DD'): string => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return format === 'YYYYMMDD' 
    ? `${year}${month}${day}` 
    : `${year}-${month}-${day}`;
};

/**
 * 检查Tushare API连接是否正常
 * @returns Promise<boolean> 连接是否正常
 */
export const checkTushareConnection = async (): Promise<boolean> => {
  try {
    const { apiKey, baseUrl } = getTushareConfig();

    if (!hasUsableTushareApiKey(apiKey)) {
      return false;
    }
    
    // 调用一个简单的API来测试连接
    const params = new URLSearchParams({
      api_name: 'stock_basic',
      token: apiKey,
      params: JSON.stringify({
        exchange: '',
        list_status: 'L',
        fields: 'ts_code,symbol,name,area,industry,list_date',
        limit: 1 // 只获取一条记录
      })
    });
    
    const response = await fetch(`${baseUrl}?${params}`);
    const data: TushareMarketBreadthResponse = await response.json();
    
    return data.code === '0';
  } catch (error) {
    console.error('Tushare API连接测试失败:', error);
    return false;
  }
};
