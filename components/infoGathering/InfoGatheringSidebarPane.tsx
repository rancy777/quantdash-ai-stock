import type { ComponentProps } from 'react';

import GlassCard from '../ui/GlassCard';
import InfoGatheringBigVSidebar from './InfoGatheringBigVSidebar';
import InfoGatheringDateNavigator from './InfoGatheringDateNavigator';
import InfoGatheringExpertSidebar from './InfoGatheringExpertSidebar';
import InfoGatheringNewsSidebar from './InfoGatheringNewsSidebar';
import InfoGatheringReportSidebar from './InfoGatheringReportSidebar';
import type { InfoGatheringTabId, NewsSourceGroup } from './types';
import type { NewsItem } from '../../types';

const SELECT_CLASS_NAME =
  'rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100';

type NewsSidebarPaneProps = {
  filteredNewsCount: number;
  groupedFilteredNews: Array<NewsSourceGroup & { items: NewsItem[] }>;
  loadingNews: boolean;
  onDateChange: (date: Date) => void;
  onSelectNews: (item: NewsItem) => void;
  selectedDate: Date;
  selectedNewsId: string;
};

type InfoGatheringSidebarPaneProps = {
  activeTab: InfoGatheringTabId;
  bigVReview: ComponentProps<typeof InfoGatheringBigVSidebar>;
  expert: ComponentProps<typeof InfoGatheringExpertSidebar>;
  news: NewsSidebarPaneProps;
  report: ComponentProps<typeof InfoGatheringReportSidebar>;
};

const InfoGatheringSidebarPane = ({
  activeTab,
  bigVReview,
  expert,
  news,
  report,
}: InfoGatheringSidebarPaneProps) => {
  const isReportTab = activeTab === 'report';

  return (
    <GlassCard className={`${isReportTab ? 'lg:w-[31rem]' : 'lg:w-5/12'} overflow-hidden flex flex-col`} noPadding>
      {activeTab === 'review' ? (
        <InfoGatheringBigVSidebar {...bigVReview} />
      ) : activeTab === 'expert' ? (
        <InfoGatheringExpertSidebar {...expert} />
      ) : activeTab === 'report' ? (
        <InfoGatheringReportSidebar {...report} selectClassName={SELECT_CLASS_NAME} />
      ) : (
        <InfoGatheringNewsSidebar
          dateNavigator={
            <InfoGatheringDateNavigator
              selectedDate={news.selectedDate}
              onChange={news.onDateChange}
            />
          }
          filteredNewsCount={news.filteredNewsCount}
          groupedFilteredNews={news.groupedFilteredNews}
          loadingNews={news.loadingNews}
          onSelectNews={news.onSelectNews}
          selectedNewsId={news.selectedNewsId}
        />
      )}
    </GlassCard>
  );
};

export default InfoGatheringSidebarPane;
