import { fetchMarketData } from './fetchMarketData.js';
import { syncEmotionIndicators } from './syncEmotionIndicators.js';
import {
  getOrCreateSyncContext,
  printStageSummary,
  readJsonFile,
  runStagesSequentially,
} from './syncUtils.js';

export const syncAllData = async () => {
  const continueOnError = process.env.SYNC_CONTINUE_ON_ERROR !== '0';
  const summary = await runStagesSequentially([
    { key: 'market-pipeline', name: 'Market Data Pipeline', run: fetchMarketData, retries: 1 },
    {
      key: 'emotion',
      name: 'Emotion Indicators',
      run: syncEmotionIndicators,
      shouldRun: async (context) => {
        const emotion = await readJsonFile('emotion_indicators.json');
        const latestEmotion = Array.isArray(emotion) ? emotion.at(-1)?.date : null;
        return latestEmotion === context.emotionTargetDate
          ? `already up-to-date (${context.emotionTargetDate})`
          : true;
      },
    },
  ], {
    resolveContext: getOrCreateSyncContext,
    continueOnError,
    printSummary: true,
    printSummaryOnError: true,
    summaryLabel: 'sync:all',
    writeStatus: true,
  });

  const failed = summary.filter((item) => item.status === 'failed');
  if (failed.length) {
    printStageSummary(summary, 'sync:all');
    throw new Error(`sync:all completed with ${failed.length} failed stage(s)`);
  }
};

syncAllData().catch((error) => {
  console.error('[sync-all] Failed to sync all data:', error);
  process.exitCode = 1;
});
