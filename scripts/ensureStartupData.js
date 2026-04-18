import { syncEmotionIndicators } from './syncEmotionIndicators.js';
import { syncMarketCorePy } from './syncMarketCorePy.js';
import { syncSectorSnapshotsPy } from './syncSectorSnapshotsPy.js';
import { syncSentimentCycleSnapshotsPy } from './syncSentimentCycleSnapshotsPy.js';
import {
  getFileDateStamp,
  getOrCreateSyncContext,
  readJsonFile,
  runStagesSequentially,
} from './syncUtils.js';
import { fetchMarketData } from './fetchMarketData.js';
import { syncPythonOfflineData } from './syncPythonOfflineData.js';

const AUTO_SYNC_ENABLED = process.env.STARTUP_AUTO_SYNC !== '0';
const SYNC_MODE = String(process.env.STARTUP_SYNC_MODE ?? 'startup').toLowerCase();

const log = (...args) => console.log('[startup-sync]', ...args);

const runLightweightStartupSync = async () => runStagesSequentially([
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
  summaryLabel: 'startup-sync',
  writeStatus: true,
  statusExtra: { mode: 'startup' },
});

export const ensureStartupData = async () => {
  if (!AUTO_SYNC_ENABLED) {
    log('Skipped because STARTUP_AUTO_SYNC=0');
    return;
  }

  if (SYNC_MODE === 'offline') {
    log('Running full offline snapshot sync before startup...');
    await syncPythonOfflineData();
    return;
  }

  if (SYNC_MODE === 'market') {
    log('Running full market pipeline sync before startup...');
    await fetchMarketData();
    return;
  }

  log('Running lightweight startup sync (market core + emotion + sectors + cycle)...');
  await runLightweightStartupSync();
};

if (process.argv[1]?.endsWith('ensureStartupData.js')) {
  ensureStartupData().catch((error) => {
    console.error('[startup-sync] failed:', error);
    process.exitCode = 1;
  });
}
