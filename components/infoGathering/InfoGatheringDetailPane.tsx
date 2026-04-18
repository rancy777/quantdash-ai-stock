import type { ComponentProps } from 'react';
import { Share2 } from 'lucide-react';

import GlassCard from '../ui/GlassCard';
import InfoGatheringBigVDetail from './InfoGatheringBigVDetail';
import InfoGatheringExpertDetail from './InfoGatheringExpertDetail';
import InfoGatheringNewsDetail from './InfoGatheringNewsDetail';
import InfoGatheringReportDetail from './InfoGatheringReportDetail';
import InfoGatheringReportPreview from './InfoGatheringReportPreview';
import type { InfoGatheringTabId } from './types';

type ReportDetailPaneProps =
  ComponentProps<typeof InfoGatheringReportDetail> &
  ComponentProps<typeof InfoGatheringReportPreview>;

type InfoGatheringDetailPaneProps = {
  activeTab: InfoGatheringTabId;
  bigVReview: ComponentProps<typeof InfoGatheringBigVDetail>;
  expert: ComponentProps<typeof InfoGatheringExpertDetail>;
  news: ComponentProps<typeof InfoGatheringNewsDetail>;
  report: ReportDetailPaneProps;
};

const InfoGatheringDetailPane = ({
  activeTab,
  bigVReview,
  expert,
  news,
  report,
}: InfoGatheringDetailPaneProps) => {
  const { loadingReportPreview, selectedReportText, ...reportDetail } = report;
  const title =
    activeTab === 'report'
      ? '研报内容'
      : activeTab === 'expert'
        ? '高手详情'
        : activeTab === 'review'
          ? '复盘内容'
          : '详情摘要';

  return (
    <GlassCard
      className="flex-1"
      title={title}
      action={
        <button className="text-slate-400 dark:text-gray-400 hover:text-slate-600 dark:hover:text-white">
          <Share2 size={16} />
        </button>
      }
    >
      {activeTab === 'review' ? (
        <InfoGatheringBigVDetail {...bigVReview} />
      ) : activeTab === 'expert' ? (
        <InfoGatheringExpertDetail {...expert} />
      ) : activeTab === 'report' ? (
        <InfoGatheringReportDetail
          {...reportDetail}
          preview={
            <InfoGatheringReportPreview
              loadingReportPreview={loadingReportPreview}
              selectedReport={report.selectedReport}
              selectedReportText={selectedReportText}
            />
          }
        />
      ) : (
        <InfoGatheringNewsDetail {...news} />
      )}
    </GlassCard>
  );
};

export default InfoGatheringDetailPane;
