import { BarChart2 } from 'lucide-react';

import type { NewsItem } from '../../types';
import Badge from '../ui/Badge';

type InfoGatheringNewsDetailProps = {
  selectedNews: NewsItem;
};

const InfoGatheringNewsDetail = ({ selectedNews }: InfoGatheringNewsDetailProps) => {
  return (
    <div className="h-full flex flex-col">
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 leading-snug">{selectedNews.title}</h2>

      <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-gray-400 mb-8 pb-4 border-b border-slate-200 dark:border-white/10">
        <span className="text-cyan-600 dark:text-cyan-400 font-semibold">{selectedNews.source}</span>
        <span>{selectedNews.time}</span>
        <Badge variant="outline">{selectedNews.type.toUpperCase()}</Badge>
      </div>

      <div className="text-slate-700 dark:text-gray-300 leading-8 text-lg font-light tracking-wide space-y-4">
        <p>{selectedNews.content}</p>
        {selectedNews.url && (
          <p className="text-sm leading-6">
            <a
              href={selectedNews.url}
              target="_blank"
              rel="noreferrer"
              className="text-cyan-600 dark:text-cyan-400 hover:underline"
            >
              查看原文
            </a>
          </p>
        )}
        {selectedNews.sentiment && (
          <div className="p-4 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-lg mt-6">
            <h5 className="text-blue-600 dark:text-blue-400 text-sm font-bold mb-2 flex items-center gap-2">
              <BarChart2 size={16} /> 智能分析
            </h5>
            <p className="text-sm text-blue-700/80 dark:text-blue-200/80">
              该消息当前仅在有明确判断时才显示情绪标签；如显示为
              {selectedNews.sentiment === 'bullish' ? '利多' : selectedNews.sentiment === 'bearish' ? '利空' : '中性'}
              ，仍建议结合板块强弱和资金流向继续确认。
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default InfoGatheringNewsDetail;
