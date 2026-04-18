import { BarChart2 } from 'lucide-react';

import useSentimentSectionData from './hooks/useSentimentSectionData';
import useSentimentSectionDerived from './hooks/useSentimentSectionDerived';
import { renderSentimentSourceBadge, SENTIMENT_METRICS } from './config';
import SentimentBrokenPanel from './panels/SentimentBrokenPanel';
import SentimentCurrentCyclePanel from './panels/SentimentCurrentCyclePanel';
import SentimentEmotionPanel from './panels/SentimentEmotionPanel';
import SentimentHeightPanel from './panels/SentimentHeightPanel';
import SentimentLeaderPanel from './panels/SentimentLeaderPanel';
import SentimentPremiumPanel from './panels/SentimentPremiumPanel';
import SentimentPressurePanel from './panels/SentimentPressurePanel';
import SentimentRepairPanel from './panels/SentimentRepairPanel';
import SentimentStructurePanel from './panels/SentimentStructurePanel';

type SentimentMetricContentProps = {
  data: ReturnType<typeof useSentimentSectionData>;
  derived: ReturnType<typeof useSentimentSectionDerived>;
};

const SentimentMetricContent = ({ data, derived }: SentimentMetricContentProps) => {
  if (data.activeMetric === 'currentCycle') {
    return (
      <div className="w-full flex flex-col">
        <SentimentCurrentCyclePanel
          cycleOverview={data.cycleOverview}
          currentBigFaceRepairRate={data.currentBigFaceRepairRate}
          currentBrokenRepairRate={data.currentBrokenRepairRate}
          currentLeader={data.currentLeader}
          currentLeaderNextClose={data.currentLeaderNextClose}
          highRiskData={data.highRiskData}
          overviewLoading={data.overviewLoading}
          selectedLeaderEntry={derived.selectedLeaderEntry}
          volumeTrendAxisDomain={derived.volumeTrendAxisDomain}
          volumeTrendData={data.volumeTrendData}
          formatVolumeAxisTick={derived.formatVolumeAxisTick}
        />
      </div>
    );
  }

  if (data.activeMetric === 'emotion') {
    return (
      <SentimentEmotionPanel
        bullBearBarData={derived.bullBearBarData}
        bullBearDateOptions={derived.bullBearDateOptions}
        bullBearSignal={data.bullBearSignal}
        emotionComparisonData={derived.emotionComparisonData}
        emotionIndicatorData={data.emotionIndicatorData}
        emotionIndicatorLoading={data.emotionIndicatorLoading}
        emotionIndicatorSource={data.emotionIndicatorSource}
        emotionSeriesOptions={derived.emotionSeriesOptions}
        formatAmountYi={derived.formatAmountYi}
        formatBullBearDate={derived.formatBullBearDate}
        formatEmotionValue={derived.formatEmotionValue}
        formatPositionAxisTick={derived.formatPositionAxisTick}
        formatPositionCount={derived.formatPositionCount}
        getPreviousEmotionValueAt={derived.getPreviousEmotionValueAt}
        handleRefresh={data.handleRefresh}
        indexFuturesLongShortData={data.indexFuturesLongShortData}
        latestIndexFuturesPoint={derived.latestIndexFuturesPoint}
        longPositionChangePct={derived.longPositionChangePct}
        onSelectBullBearDate={data.setSelectedBullBearDate}
        onSelectIndexFuturesCode={data.setSelectedIndexFuturesCode}
        renderSourceBadge={(source) => renderSentimentSourceBadge(source, data.emotionIndicatorUpdatedAt)}
        selectedEmotionSeries={data.selectedEmotionSeries}
        selectedEmotionSeriesCards={derived.selectedEmotionSeriesCards}
        selectedIndexFuturesCode={data.selectedIndexFuturesCode}
        selectedIndexFuturesSeries={derived.selectedIndexFuturesSeries}
        shortPositionChangePct={derived.shortPositionChangePct}
        toggleEmotionSeries={derived.toggleEmotionSeries}
      />
    );
  }

  if (data.activeMetric === 'broken') {
    return (
      <SentimentBrokenPanel
        brokenData={data.brokenData}
        brokenLoading={data.brokenLoading}
        brokenLoadingMode={data.brokenLoadingMode}
        currentBrokenCount={data.currentBrokenCount}
        currentBrokenLimitUp={data.currentBrokenLimitUp}
        currentBrokenRate={data.currentBrokenRate}
        renderSourceBadge={(source) => renderSentimentSourceBadge(source, data.performanceUpdatedAt)}
        selectedBrokenEntry={derived.selectedBrokenEntry}
        source={data.performanceSource}
      />
    );
  }

  if (data.activeMetric === 'premium') {
    return (
      <SentimentPremiumPanel
        currentFollowThrough={data.currentFollowThrough}
        currentPremium={data.currentPremium}
        currentPremiumDate={data.currentPremiumDate}
        currentSuccessRate={data.currentSuccessRate}
        premiumData={data.premiumData}
        premiumLoading={data.premiumLoading}
        premiumLoadingMode={data.premiumLoadingMode}
        selectedPremiumEntry={derived.selectedPremiumEntry}
      />
    );
  }

  if (data.activeMetric === 'structure') {
    return (
      <SentimentStructurePanel
        currentFirstBoardCount={data.currentFirstBoardCount}
        currentFirstBoardRatio={data.currentFirstBoardRatio}
        currentHighBoardCount={data.currentHighBoardCount}
        currentRelayCount={data.currentRelayCount}
        currentStructureDate={data.currentStructureDate}
        renderSourceBadge={(source) => renderSentimentSourceBadge(source, data.structureUpdatedAt)}
        selectedStructureEntry={derived.selectedStructureEntry}
        structureData={data.structureData}
        structureLoading={data.structureLoading}
        structureLoadingMode={data.structureLoadingMode}
        structureSource={data.structureSource}
      />
    );
  }

  if (data.activeMetric === 'repair') {
    return (
      <SentimentRepairPanel
        currentBigFaceCount={data.currentBigFaceCount}
        currentBigFaceRepairRate={data.currentBigFaceRepairRate}
        currentBrokenRepairRate={data.currentBrokenRepairRate}
        currentRepairBrokenCount={data.currentRepairBrokenCount}
        currentRepairDate={data.currentRepairDate}
        renderSourceBadge={(source) => renderSentimentSourceBadge(source, data.repairUpdatedAt)}
        repairData={data.repairData}
        repairLoading={data.repairLoading}
        repairLoadingMode={data.repairLoadingMode}
        repairSource={data.repairSource}
      />
    );
  }

  if (data.activeMetric === 'leader') {
    return (
      <SentimentLeaderPanel
        currentLeader={data.currentLeader}
        currentLeaderBoard={data.currentLeaderBoard}
        currentLeaderNextClose={data.currentLeaderNextClose}
        currentThreePlusCount={data.currentThreePlusCount}
        leaderData={data.leaderData}
        leaderLoading={data.leaderLoading}
        leaderLoadingMode={data.leaderLoadingMode}
        leaderSource={data.leaderSource}
        renderSourceBadge={(source) => renderSentimentSourceBadge(source, data.leaderUpdatedAt)}
        selectedLeaderEntry={derived.selectedLeaderEntry}
      />
    );
  }

  if (data.activeMetric === 'height') {
    return (
      <SentimentHeightPanel
        boardHeightAxisTicks={derived.boardHeightAxisTicks}
        boardHeightChartWidth={derived.boardHeightChartWidth}
        boardHeightData={data.boardHeightData}
        boardHeightLoading={data.boardHeightLoading}
        boardHeightScrollRef={derived.boardHeightScrollRef}
        boardHeightSource={data.boardHeightSource}
        chinextHighestDot={derived.renderBoardHeightDot('chinextHighestNames', '#06b6d4', -26, 'right')}
        formatBoardNames={derived.formatBoardNames}
        handleBoardHeightMouseDown={derived.handleBoardHeightMouseDown}
        handleBoardHeightMouseMove={derived.handleBoardHeightMouseMove}
        handleRefresh={data.handleRefresh}
        isBoardHeightDragging={derived.isBoardHeightDragging}
        latestBoardHeight={derived.latestBoardHeight}
        mainBoardHighestDot={derived.renderBoardHeightDot('mainBoardHighestNames', '#f43f5e', -12, 'left')}
        mainBoardSecondHighestDot={derived.renderBoardHeightDot('mainBoardSecondHighestNames', '#f59e0b', 18, 'center')}
        renderSourceBadge={(source) => renderSentimentSourceBadge(source, data.boardHeightUpdatedAt)}
        sortedBoardHeightData={derived.sortedBoardHeightData}
        stopBoardHeightDrag={derived.stopBoardHeightDrag}
      />
    );
  }

  if (data.activeMetric === 'pressure') {
    return (
      <SentimentPressurePanel
        coeffData={data.coeffData}
        currentHeight={data.currentHeight}
        currentLimitUpCount={data.currentLimitUpCount}
        currentRiseCount={data.currentRiseCount}
        currentScore={data.currentScore}
        handleRefresh={data.handleRefresh}
        isRefreshing={data.isRefreshing}
        lineSeriesOptions={derived.lineSeriesOptions}
        loading={data.loading}
        realTimeBreadth={data.realTimeBreadth}
        renderSourceBadge={(source) => renderSentimentSourceBadge(source, data.sentimentUpdatedAt)}
        selectedCoeffEntry={derived.selectedCoeffEntry}
        selectedSeries={data.selectedSeries}
        sentimentLoadingMode={data.sentimentLoadingMode}
        sentimentSource={data.sentimentSource}
        toggleSeries={derived.toggleSeries}
      />
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4">
      <BarChart2 size={48} className="opacity-20" />
      <p>该指标 ({SENTIMENT_METRICS.find((metric) => metric.id === data.activeMetric)?.label}) 数据接入中...</p>
    </div>
  );
};

export default SentimentMetricContent;
