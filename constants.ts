import { Stock, NewsItem, SentimentData, MarketSentiment } from './types';

export const MOCK_STOCKS: Stock[] = [
  { symbol: '600519', name: '贵州茅台', price: 1725.50, pctChange: 1.25, volume: '2.5万', turnover: '45亿', industry: '白酒', concepts: ['核心资产', 'MSCI'], pe: 28.5, pb: 8.2, marketCap: 21000 },
  { symbol: '300750', name: '宁德时代', price: 185.30, pctChange: -2.10, volume: '15万', turnover: '28亿', industry: '电池', concepts: ['新能源', '创业板指'], pe: 18.2, pb: 3.5, marketCap: 8500 },
  { symbol: '002594', name: '比亚迪', price: 230.15, pctChange: 3.45, volume: '12万', turnover: '31亿', industry: '汽车整车', concepts: ['新能源车', '出海'], pe: 22.1, pb: 4.8, marketCap: 7200 },
  { symbol: '601318', name: '中国平安', price: 42.80, pctChange: -0.50, volume: '45万', turnover: '19亿', industry: '保险', concepts: ['中字头', '高股息'], pe: 6.5, pb: 0.9, marketCap: 8000 },
  { symbol: '600036', name: '招商银行', price: 31.20, pctChange: 0.15, volume: '30万', turnover: '9亿', industry: '银行', concepts: ['大金融'], pe: 5.8, pb: 0.85, marketCap: 9000 },
  { symbol: '688981', name: '中芯国际', price: 48.90, pctChange: 5.20, volume: '60万', turnover: '35亿', industry: '半导体', concepts: ['国产替代', '科创板'], pe: 45.0, pb: 3.2, marketCap: 3800 },
  { symbol: '000001', name: '平安银行', price: 10.50, pctChange: -1.20, volume: '80万', turnover: '8亿', industry: '银行', concepts: ['深股通'], pe: 4.5, pb: 0.5, marketCap: 2000 },
  { symbol: '300059', name: '东方财富', price: 13.40, pctChange: 2.10, volume: '110万', turnover: '15亿', industry: '证券', concepts: ['互联网金融'], pe: 25.0, pb: 3.0, marketCap: 2500 },
];

export const MOCK_NEWS: NewsItem[] = [
  { id: '1', title: '央行：将继续实施稳健的货币政策，保持流动性合理充裕', source: '财联社', time: '10:25', content: '央行行长在今日的金融街论坛上表示，未来将继续坚持稳健的货币政策，灵活运用多种货币政策工具...', sentiment: 'bullish', type: 'news' },
  { id: '2', title: '某龙头企业发布业绩预告，三季度净利润同比增长150%', source: '证券时报', time: '09:45', content: '公司预计2024年前三季度实现归属于上市公司股东的净利润为20亿元至22亿元...', sentiment: 'bullish', type: 'notice' },
  { id: '3', title: '半导体行业需求疲软，多家大厂下调营收预期', source: '彭博社', time: '08:30', content: '受全球宏观经济影响，消费电子需求持续低迷，导致上游芯片厂商库存积压严重...', sentiment: 'bearish', type: 'report' },
  { id: '4', title: '关于召开2024年第二次临时股东大会的通知', source: '交易所', time: 'Yesterday', content: '本公司董事会决定于2024年11月15日召开临时股东大会，审议关于...', sentiment: 'neutral', type: 'notice' },
  { id: '5', title: '光伏产业链价格全线下跌，行业洗牌加速', source: '第一财经', time: 'Yesterday', content: '随着产能释放，硅料、硅片价格持续下探，部分二三线厂商面临停产风险...', sentiment: 'bearish', type: 'report' },
];

export const SENTIMENT_CHART_DATA: SentimentData[] = Array.from({ length: 30 }, (_, i) => ({
  date: `11-${i + 1}`,
  value: 40 + Math.random() * 40 + (i > 20 ? 10 : -10), // Random trend
}));

export const RECENT_SENTIMENT: MarketSentiment[] = [
  { label: '今日', score: 75, description: '贪婪', trend: 'up' },
  { label: '昨日', score: 68, description: '贪婪', trend: 'up' },
  { label: '前日', score: 45, description: '恐慌', trend: 'down' },
  { label: '上周', score: 50, description: '中性', trend: 'flat' },
];

export const INDUSTRIES = ['全部', '银行', '非银金融', '医药生物', '电子', '电力设备', '食品饮料', '计算机', '房地产', '有色金属'];
export const CONCEPTS = ['全部', '中特估', '人工智能', '新能源', '数字经济', '半导体', '高股息', '华为概念', '低空经济'];