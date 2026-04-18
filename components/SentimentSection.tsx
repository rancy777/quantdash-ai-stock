
import React from 'react';
import SentimentHistoricalDateBar from './sentiment/SentimentHistoricalDateBar';
import SentimentMetricContent from './sentiment/SentimentMetricContent';
import SentimentMetricToolbar from './sentiment/SentimentMetricToolbar';
import { SENTIMENT_METRICS } from './sentiment/config';
import useSentimentSectionData from './sentiment/hooks/useSentimentSectionData';
import useSentimentSectionDerived from './sentiment/hooks/useSentimentSectionDerived';
import GlassCard from './ui/GlassCard';

const SentimentSection: React.FC = () => {
  const data = useSentimentSectionData();
  const derived = useSentimentSectionDerived({
    boardHeightData: data.boardHeightData,
    brokenData: data.brokenData,
    bullBearHistory: data.bullBearHistory,
    bullBearSignal: data.bullBearSignal,
    coeffData: data.coeffData,
    emotionIndicatorData: data.emotionIndicatorData,
    indexFuturesLongShortData: data.indexFuturesLongShortData,
    leaderData: data.leaderData,
    premiumData: data.premiumData,
    repairData: data.repairData,
    selectedEmotionSeries: data.selectedEmotionSeries,
    selectedHistoricalDate: data.selectedHistoricalDate,
    selectedIndexFuturesCode: data.selectedIndexFuturesCode,
    selectedSeries: data.selectedSeries,
    setSelectedEmotionSeries: data.setSelectedEmotionSeries,
    setSelectedSeries: data.setSelectedSeries,
    structureData: data.structureData,
    volumeTrendData: data.volumeTrendData,
  });

  return (
    <div className="h-full flex flex-col gap-6">
      {/* Top Toolbar */}
      <GlassCard className="flex-shrink-0" noPadding>
        <SentimentMetricToolbar
          activeMetric={data.activeMetric}
          metrics={SENTIMENT_METRICS}
          onSelectMetric={data.setActiveMetric}
        />
      </GlassCard>

      {/* Main Content Area */}
      <GlassCard className="flex-1 min-h-0 relative" noPadding>
        <SentimentHistoricalDateBar
          dateOptions={data.historicalDateOptions}
          selectedDate={data.selectedHistoricalDate}
          onChange={data.setSelectedHistoricalDate}
        />
        <div className="h-full w-full min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar p-2">
          <SentimentMetricContent data={data} derived={derived} />
        </div>
      </GlassCard>
    </div>
  );
};

export default SentimentSection;
