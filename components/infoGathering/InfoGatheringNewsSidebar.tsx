import type { ReactNode } from 'react';
import { Calendar, Loader2 } from 'lucide-react';

import type { NewsItem } from '../../types';
import Badge from '../ui/Badge';
import { getSentimentBadgeMeta } from './meta';
import type { NewsSourceGroup } from './types';

type InfoGatheringNewsSidebarProps = {
  dateNavigator: ReactNode;
  filteredNewsCount: number;
  groupedFilteredNews: Array<NewsSourceGroup & { items: NewsItem[] }>;
  loadingNews: boolean;
  onSelectNews: (item: NewsItem) => void;
  selectedNewsId: string;
};

const InfoGatheringNewsSidebar = ({
  dateNavigator,
  filteredNewsCount,
  groupedFilteredNews,
  loadingNews,
  onSelectNews,
  selectedNewsId,
}: InfoGatheringNewsSidebarProps) => {
  if (loadingNews) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500 dark:text-gray-400 gap-2">
        <Loader2 className="animate-spin" /> 正在加载新闻...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-4 border-b border-slate-200 dark:border-white/10">
        {dateNavigator}
      </div>
      <div className="overflow-y-auto p-4 space-y-5 flex-1 custom-scrollbar">
        {groupedFilteredNews.map((group) => (
          <div key={group.id} className="space-y-3">
            <div className="px-1">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-white">{group.title}</h3>
                <Badge variant="outline">{group.items.length} 条</Badge>
              </div>
              <div className="mt-1 text-xs text-slate-400 dark:text-gray-500">{group.description}</div>
            </div>
            {group.items.length > 0 ? (
              group.items.map((item) => (
                <div
                  key={item.id}
                  onClick={() => onSelectNews(item)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    selectedNewsId === item.id
                      ? 'bg-cyan-50/50 dark:bg-white/10 border-cyan-500/30 shadow-md'
                      : 'bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs text-slate-400 dark:text-gray-500 font-mono flex items-center gap-1">
                      <Calendar size={10} /> {item.time}
                    </span>
                    {getSentimentBadgeMeta(item.sentiment) && (
                      <Badge variant={getSentimentBadgeMeta(item.sentiment)!.variant}>
                        {getSentimentBadgeMeta(item.sentiment)!.label}
                      </Badge>
                    )}
                  </div>
                  <h4 className={`text-sm font-medium leading-relaxed ${selectedNewsId === item.id ? 'text-cyan-700 dark:text-cyan-100' : 'text-slate-700 dark:text-gray-300'}`}>
                    {item.title}
                  </h4>
                  <div className="mt-2 text-xs text-slate-400 dark:text-gray-500 flex items-center justify-between">
                    <span>{item.source}</span>
                    <span className="bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded uppercase">{item.type}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 dark:border-white/10 p-4 text-sm text-slate-400">
                当前分类下暂无 {group.title}
              </div>
            )}
          </div>
        ))}
        {filteredNewsCount === 0 && (
          <div className="h-full flex items-center justify-center text-slate-400 py-10">
            暂无该分类新闻
          </div>
        )}
      </div>
    </div>
  );
};

export default InfoGatheringNewsSidebar;
