import { syncEmotionIndicators } from './syncEmotionIndicators.js';
import { syncMarketCorePy } from './syncMarketCorePy.js';
import { syncStockSnapshotsPy } from './syncStockSnapshotsPy.js';
import { syncSectorSnapshotsPy } from './syncSectorSnapshotsPy.js';
import { syncSentimentCycleSnapshotsPy } from './syncSentimentCycleSnapshotsPy.js';
import { syncKlineLibraryPy } from './syncKlineLibraryPy.js';
import {
  getFileDateStamp,
  getOrCreateSyncContext,
  readJsonFile,
  runStagesSequentially,
} from './syncUtils.js';

export const syncPythonOfflineData = async () => {
  await runStagesSequentially([
    {
      key: 'kline',
      name: 'Kline Library',
      run: syncKlineLibraryPy,
      retries: 1,
      shouldRun: async (context) => {
        const manifest = await readJsonFile('kline-manifest.json');
        const stamp = await getFileDateStamp('kline-manifest.json');
        if (Array.isArray(manifest) && manifest.length > 0 && stamp === context.onlineTradingDate) {
          return `already updated on ${context.onlineTradingDate}`;
        }
        return true;
      },
    },
    {
      key: 'market-core',
      name: 'Market Core Snapshot',
      run: syncMarketCorePy,
      shouldRun: async (context) => {
        const sentiment = await readJsonFile('sentiment.json');
        const performance = await readJsonFile('performance.json');
        const latestSentiment = Array.isArray(sentiment) ? sentiment.at(-1)?.date : null;
        const latestPerformance = Array.isArray(performance) ? performance.at(-1)?.date : null;
        if (
          latestSentiment === context.onlineTradingDate &&
          latestPerformance === context.onlineMonthDay
        ) {
          return `already up-to-date (${context.onlineTradingDate})`;
        }
        return true;
      },
    },
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
    {
      key: 'stocks',
      name: 'Stock Snapshots',
      run: syncStockSnapshotsPy,
      shouldRun: async (context) => {
        const stamp = await getFileDateStamp('stock_list_full.json');
        return stamp === context.onlineTradingDate
          ? `already updated on ${context.onlineTradingDate}`
          : true;
      },
    },
    {
      key: 'sectors',
      name: 'Sector Snapshots',
      run: syncSectorSnapshotsPy,
      shouldRun: async (context) => {
        const stamp = await getFileDateStamp('sector_rotation_concept.json');
        return stamp === context.onlineTradingDate
          ? `already updated on ${context.onlineTradingDate}`
          : true;
      },
    },
    {
      key: 'cycle',
      name: 'Sentiment Cycle Snapshots',
      run: syncSentimentCycleSnapshotsPy,
      shouldRun: async (context) => {
        const leaderState = await readJsonFile('leader_state.json');
        const latestCycle = Array.isArray(leaderState) ? leaderState.at(-1)?.date : null;
        return latestCycle === context.onlineMonthDay
          ? `already up-to-date (${context.onlineMonthDay})`
          : true;
      },
    },
  ], {
    resolveContext: getOrCreateSyncContext,
    printSummary: true,
    printSummaryOnError: true,
    summaryLabel: 'sync:offline:py',
    writeStatus: true,
  });
};

if (process.argv[1]?.endsWith('syncPythonOfflineData.js')) {
  syncPythonOfflineData().catch((error) => {
    console.error('[python-offline-sync] failed:', error);
    process.exitCode = 1;
  });
}
