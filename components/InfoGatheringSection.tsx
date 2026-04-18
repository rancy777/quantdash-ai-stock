import React, { useRef, useState } from 'react';
import InfoGatheringTabs from './infoGathering/InfoGatheringTabs';
import InfoGatheringDetailPane from './infoGathering/InfoGatheringDetailPane';
import InfoGatheringNewsBoard from './infoGathering/InfoGatheringNewsBoard';
import InfoGatheringSidebarPane from './infoGathering/InfoGatheringSidebarPane';
import useBigVReviews from './infoGathering/hooks/useBigVReviews';
import useExpertSnapshots from './infoGathering/hooks/useExpertSnapshots';
import useNewsWorkflow from './infoGathering/hooks/useNewsWorkflow';
import useReportWorkflow from './infoGathering/hooks/useReportWorkflow';
import type { InfoGatheringTabId } from './infoGathering/types';

const InfoGatheringSection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<InfoGatheringTabId>('all');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const newsWorkflow = useNewsWorkflow();
  const bigVReviewsWorkflow = useBigVReviews();
  const expertSnapshotsWorkflow = useExpertSnapshots();
  const reportWorkflow = useReportWorkflow();

  const filteredNews = activeTab === 'all'
    ? newsWorkflow.newsItems
    : newsWorkflow.newsItems.filter((item) => item.type === activeTab);
  const groupedFilteredNews = newsWorkflow.newsGroups.map((group) => ({
    ...group,
    items: activeTab === 'all'
      ? group.items
      : group.items.filter((item) => item.type === activeTab),
  }));

  const isReportTab = activeTab === 'report';
  const isExpertTab = activeTab === 'expert';
  const isBigVReviewTab = activeTab === 'review';
  const isNewsBoardMode = !isReportTab && !isExpertTab && !isBigVReviewTab;

  return (
    <div className="flex flex-col h-full gap-6">
      <InfoGatheringTabs activeTab={activeTab} onChange={setActiveTab} />

      {isNewsBoardMode ? (
        <InfoGatheringNewsBoard
          filteredNewsCount={filteredNews.length}
          groupedFilteredNews={groupedFilteredNews}
          loadingNews={newsWorkflow.loadingNews}
          onDateChange={newsWorkflow.setSelectedDate}
          onSelectNews={newsWorkflow.setSelectedNews}
          selectedDate={newsWorkflow.selectedDate}
          selectedNewsId={newsWorkflow.selectedNews.id}
        />
      ) : (
        <div key={`info-gathering-tab-${activeTab}`} className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
          <InfoGatheringSidebarPane
            activeTab={activeTab}
            bigVReview={{
              bigVReviews: bigVReviewsWorkflow.bigVReviews,
              fileInputRef,
              onCreateReview: bigVReviewsWorkflow.handleCreateBigVReview,
              onImportFiles: bigVReviewsWorkflow.handleImportBigVFiles,
              onResetReviews: bigVReviewsWorkflow.handleResetBigVReviews,
              onSelectReview: bigVReviewsWorkflow.selectBigVReview,
              selectedBigVReviewId: bigVReviewsWorkflow.selectedBigVReviewId,
            }}
            expert={{
              expertSnapshots: expertSnapshotsWorkflow.expertSnapshots,
              expertSyncMessage: expertSnapshotsWorkflow.expertSyncMessage,
              loadingExperts: expertSnapshotsWorkflow.loadingExperts,
              onSelectSnapshot: expertSnapshotsWorkflow.setSelectedExpertSnapshot,
              onSyncExperts: expertSnapshotsWorkflow.handleSyncExperts,
              selectedExpertSnapshotId: expertSnapshotsWorkflow.selectedExpertSnapshot?.id,
              syncingExperts: expertSnapshotsWorkflow.syncingExperts,
            }}
            news={{
              filteredNewsCount: filteredNews.length,
              groupedFilteredNews,
              loadingNews: newsWorkflow.loadingNews,
              onDateChange: newsWorkflow.setSelectedDate,
              onSelectNews: newsWorkflow.setSelectedNews,
              selectedDate: newsWorkflow.selectedDate,
              selectedNewsId: newsWorkflow.selectedNews.id,
            }}
            report={{
              filteredReports: reportWorkflow.filteredReports,
              loadingReports: reportWorkflow.loadingReports,
              onClearReportMemory: reportWorkflow.handleClearReportMemory,
              onRefreshReports: () => reportWorkflow.refreshReports(reportWorkflow.selectedReport?.id),
              onReportDateRangeChange: reportWorkflow.setReportDateRange,
              onReportFormatChange: reportWorkflow.setReportFormat,
              onReportOrgQueryChange: reportWorkflow.setReportOrgQuery,
              onReportQueryChange: reportWorkflow.setReportQuery,
              onReportRatingQueryChange: reportWorkflow.setReportRatingQuery,
              onReportSortChange: reportWorkflow.setReportSort,
              onReportSourceKeyChange: reportWorkflow.setReportSourceKey,
              onReportStockCodeQueryChange: reportWorkflow.setReportStockCodeQuery,
              onSelectReport: reportWorkflow.setSelectedReport,
              onToggleReportFilters: () => reportWorkflow.setShowReportFilters((prev) => !prev),
              onUploadReports: reportWorkflow.handleUploadReports,
              reportDateRange: reportWorkflow.reportDateRange,
              reportFormat: reportWorkflow.reportFormat,
              reportOrgQuery: reportWorkflow.reportOrgQuery,
              reportQuery: reportWorkflow.reportQuery,
              reportRatingQuery: reportWorkflow.reportRatingQuery,
              reportsCount: reportWorkflow.reports.length,
              reportSort: reportWorkflow.reportSort,
              reportSourceKey: reportWorkflow.reportSourceKey,
              reportSourceOptions: reportWorkflow.reportSourceOptions,
              reportStockCodeQuery: reportWorkflow.reportStockCodeQuery,
              reportUploadInputRef: reportWorkflow.reportUploadInputRef,
              selectedReportId: reportWorkflow.selectedReport?.id,
              showReportFilters: reportWorkflow.showReportFilters,
              uploadingReports: reportWorkflow.uploadingReports,
            }}
          />
          <InfoGatheringDetailPane
            activeTab={activeTab}
            bigVReview={{
              bigVTagInput: bigVReviewsWorkflow.bigVTagInput,
              fileInputRef,
              formatAttachmentSize: bigVReviewsWorkflow.formatAttachmentSize,
              onAddTag: bigVReviewsWorkflow.handleAddBigVTag,
              onDeleteReview: bigVReviewsWorkflow.handleDeleteBigVReview,
              onTagInputChange: bigVReviewsWorkflow.setBigVTagInput,
              selectedBigVReview: bigVReviewsWorkflow.selectedBigVReview,
              updateSelectedBigVReview: bigVReviewsWorkflow.updateSelectedBigVReview,
            }}
            expert={{ selectedExpertSnapshot: expertSnapshotsWorkflow.selectedExpertSnapshot }}
            news={{ selectedNews: newsWorkflow.selectedNews }}
            report={{
              generatingReportSummary: reportWorkflow.generatingReportSummary,
              loadingReportPreview: reportWorkflow.loadingReportPreview,
              onDeleteUploadedReport: reportWorkflow.handleDeleteUploadedReport,
              onGenerateReportAISummary: reportWorkflow.handleGenerateReportAISummary,
              onSelectedSummaryProviderIdChange: reportWorkflow.setSelectedSummaryProviderId,
              onToggleReportAISummary: () => reportWorkflow.setShowReportAISummary((prev) => !prev),
              reportAISummary: reportWorkflow.reportAISummary,
              reportAISummaryError: reportWorkflow.reportAISummaryError,
              selectedReport: reportWorkflow.selectedReport,
              selectedReportText: reportWorkflow.selectedReportText,
              selectedSummaryProviderId: reportWorkflow.selectedSummaryProviderId,
              showReportAISummary: reportWorkflow.showReportAISummary,
              summaryProviders: reportWorkflow.summaryProviders,
            }}
          />
        </div>
      )}
    </div>
  );
};

export default InfoGatheringSection;
