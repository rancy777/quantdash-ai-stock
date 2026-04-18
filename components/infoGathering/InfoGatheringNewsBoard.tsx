import { Calendar, Loader2 } from 'lucide-react';

import type { NewsItem } from '../../types';
import Badge from '../ui/Badge';
import GlassCard from '../ui/GlassCard';
import InfoGatheringDateNavigator from './InfoGatheringDateNavigator';
import { getSentimentBadgeMeta } from './meta';
import type { NewsSourceGroup } from './types';

type InfoGatheringNewsBoardProps = {
  filteredNewsCount: number;
  groupedFilteredNews: Array<NewsSourceGroup & { items: NewsItem[] }>;
  loadingNews: boolean;
  onDateChange: (date: Date) => void;
  onSelectNews: (item: NewsItem) => void;
  selectedDate: Date;
  selectedNewsId: string;
};

const InfoGatheringNewsBoard = ({
  filteredNewsCount,
  groupedFilteredNews,
  loadingNews,
  onDateChange,
  onSelectNews,
  selectedDate,
  selectedNewsId,
}: InfoGatheringNewsBoardProps) => {
  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      <InfoGatheringDateNavigator selectedDate={selectedDate} onChange={onDateChange} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 flex-1 min-h-0">
        {groupedFilteredNews.map((group) => (
          <GlassCard
            key={group.id}
            className="overflow-hidden flex flex-col min-h-0"
            noPadding
            title={group.title}
            action={<Badge variant="outline">{group.items.length} 条</Badge>}
          >
            {loadingNews ? (
              <div className="h-full flex items-center justify-center text-slate-500 dark:text-gray-400 gap-2">
                <Loader2 className="animate-spin" /> 正在加载新闻...
              </div>
            ) : group.items.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 p-6 text-sm">
                当前分类下暂无 {group.title}
              </div>
            ) : (
              <div className="overflow-y-auto p-4 space-y-3 h-full custom-scrollbar">
                {group.items.map((item) => (
                  <article
                    key={item.id}
                    className={`rounded-2xl border p-4 transition-all ${
                      selectedNewsId === item.id
                        ? 'border-cyan-400/50 bg-cyan-50 dark:border-cyan-500/40 dark:bg-cyan-500/10'
                        : 'border-slate-200 bg-white/70 hover:border-slate-300 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1 text-[12px] font-semibold text-white dark:bg-white dark:text-slate-900">
                          <Calendar size={12} />
                          <span className="font-mono tracking-wide">{item.time}</span>
                        </div>
                        <div className="mt-3 text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-gray-500">
                          {item.source}
                        </div>
                      </div>
                      {getSentimentBadgeMeta(item.sentiment) && (
                        <Badge variant={getSentimentBadgeMeta(item.sentiment)!.variant}>
                          {getSentimentBadgeMeta(item.sentiment)!.label}
                        </Badge>
                      )}
                    </div>
                    <h4 className="mt-3 text-[15px] font-semibold leading-6 text-slate-900 dark:text-white">
                      {item.title}
                    </h4>
                    <p className="mt-2 line-clamp-4 text-sm leading-6 text-slate-600 dark:text-gray-300">
                      {item.content}
                    </p>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] uppercase text-slate-500 dark:bg-white/5 dark:text-gray-400">
                        {item.type}
                      </span>
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={() => onSelectNews(item)}
                          className="text-xs font-medium text-cyan-600 hover:underline dark:text-cyan-400"
                        >
                          查看原文
                        </a>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </GlassCard>
        ))}
        {filteredNewsCount === 0 && !loadingNews && (
          <div className="xl:col-span-2">
            <GlassCard className="h-full flex items-center justify-center text-slate-400">
              暂无该分类新闻
            </GlassCard>
          </div>
        )}
      </div>
    </div>
  );
};

export default InfoGatheringNewsBoard;
