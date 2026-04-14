import fs from 'fs/promises';
import { fetchMarketData } from './fetchMarketData.js';
import { syncEmotionIndicators } from './syncEmotionIndicators.js';
import { syncSentimentCycleSnapshotsPy } from './syncSentimentCycleSnapshotsPy.js';
import { getEmotionTargetDate, printStageSummary, runStagesSequentially } from './syncUtils.js';
import { A_SHARE_DIR, resolveExistingDataPath } from './dataPaths.js';

const DATA_DIR = A_SHARE_DIR;
const SENTIMENT_PATH = await resolveExistingDataPath('sentiment.json');
const PERFORMANCE_PATH = await resolveExistingDataPath('performance.json');
const EMOTION_INDICATOR_PATH = await resolveExistingDataPath('emotion_indicators.json');
const LEADER_STATE_PATH = await resolveExistingDataPath('leader_state.json');

const TARGET_HOUR = 15;
const TARGET_MINUTE = 5;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (...payload) => console.log('[auto-data]', ...payload);

const isTradingDay = (date) => {
  const day = date.getDay();
  return day !== 0 && day !== 6;
};

const pastCutoff = (date) => {
  if (date.getHours() > TARGET_HOUR) return true;
  if (date.getHours() === TARGET_HOUR && date.getMinutes() >= TARGET_MINUTE) {
    return true;
  }
  return false;
};

const getLatestSentimentSnapshotDate = async () => {
  try {
    const raw = await fs.readFile(SENTIMENT_PATH, 'utf-8');
    const payload = JSON.parse(raw);
    if (!Array.isArray(payload) || payload.length === 0) {
      return null;
    }
    const lastRecord = payload[payload.length - 1];
    return typeof lastRecord?.date === 'string' ? lastRecord.date.slice(0, 10) : null;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn('[auto-data] Failed to read sentiment cache:', error.message);
    }
    return null;
  }
};

const getLatestPerformanceSnapshotDate = async () => {
  try {
    const raw = await fs.readFile(PERFORMANCE_PATH, 'utf-8');
    const payload = JSON.parse(raw);
    if (!Array.isArray(payload) || payload.length === 0) {
      return null;
    }
    const lastRecord = payload[payload.length - 1];
    return typeof lastRecord?.date === 'string' ? lastRecord.date : null; // MM-DD format
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn('[auto-data] Failed to read performance cache:', error.message);
    }
    return null;
  }
};

const getLatestEmotionIndicatorDate = async () => {
  try {
    const raw = await fs.readFile(EMOTION_INDICATOR_PATH, 'utf-8');
    const payload = JSON.parse(raw);
    if (!Array.isArray(payload) || payload.length === 0) {
      return null;
    }
    const lastRecord = payload[payload.length - 1];
    return typeof lastRecord?.date === 'string' ? lastRecord.date.slice(0, 10) : null;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn('[auto-data] Failed to read emotion indicator cache:', error.message);
    }
    return null;
  }
};

const getLatestCycleSnapshotDate = async () => {
  try {
    const raw = await fs.readFile(LEADER_STATE_PATH, 'utf-8');
    const payload = JSON.parse(raw);
    if (!Array.isArray(payload) || payload.length === 0) {
      return null;
    }
    const lastRecord = payload[payload.length - 1];
    return typeof lastRecord?.date === 'string' ? lastRecord.date : null;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn('[auto-data] Failed to read cycle cache:', error.message);
    }
    return null;
  }
};

const fetchLatestOnlineTradingDate = async () => {
  try {
    const url =
      'https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=1.000001&fields1=f1&fields2=f51&klt=101&fqt=1&end=20500101&lmt=1&_=' +
      Date.now();
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119 Safari/537.36',
      },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    const latest = data?.data?.klines?.[0];
    if (!latest) return null;
    const [dateStr] = latest.split(',');
    return dateStr || null;
  } catch (error) {
    console.warn('[auto-data] Failed to fetch online trading date:', error.message);
    return null;
  }
};

const getNextWaitMs = (now = new Date()) => {
  if (!isTradingDay(now)) {
    return 60 * 60 * 1000; // Check every hour on non-trading days
  }
  const cutoff = new Date(now);
  cutoff.setHours(TARGET_HOUR, TARGET_MINUTE, 0, 0);
  if (now < cutoff) {
    const diff = cutoff.getTime() - now.getTime();
    return Math.min(diff, 10 * 60 * 1000); // Poll faster as we approach 15:00
  }
  return 5 * 60 * 1000;
};

const runWatcher = async () => {
  log('Watcher started. Will auto-download market data after 15:00 on trading days.');
  let isFetching = false;
  for (;;) {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (!isTradingDay(now)) {
      log('Today is not a trading day. Waiting for next check.');
      await sleep(getNextWaitMs(now));
      continue;
    }

    if (!pastCutoff(now)) {
      log('Market not closed yet. Waiting until after 15:00.');
      await sleep(getNextWaitMs(now));
      continue;
    }

    const latestSentiment = await getLatestSentimentSnapshotDate();
    const latestPerformance = await getLatestPerformanceSnapshotDate();
    const latestEmotionIndicator = await getLatestEmotionIndicatorDate();
    const latestCycleSnapshot = await getLatestCycleSnapshotDate();
    const onlineDate = await fetchLatestOnlineTradingDate();
    if (!onlineDate) {
      log('Unable to confirm latest online trading date. Retrying later.');
      await sleep(getNextWaitMs(now));
      continue;
    }

    const onlineMonthDay = onlineDate.slice(5);
    const emotionTargetDate = getEmotionTargetDate(onlineDate);
    const sentimentUpToDate = latestSentiment === onlineDate;
    const performanceUpToDate = latestPerformance === onlineMonthDay;
    const emotionUpToDate = latestEmotionIndicator === emotionTargetDate;
    const cycleUpToDate = latestCycleSnapshot === onlineMonthDay;

    if (sentimentUpToDate && performanceUpToDate && emotionUpToDate && cycleUpToDate) {
      log(`Local snapshots already up-to-date (${onlineDate}).`);
      await sleep(getNextWaitMs(now));
      continue;
    }

    if (sentimentUpToDate && performanceUpToDate && cycleUpToDate && !emotionUpToDate) {
      isFetching = true;
      log(`Emotion indicators lagging behind ${emotionTargetDate ?? onlineDate}. Triggering emotion-only sync...`);
      try {
        const summary = await runStagesSequentially([
          { key: 'emotion', name: 'Emotion Indicators', run: syncEmotionIndicators },
        ], {
          continueOnError: false,
          printSummary: true,
          printSummaryOnError: true,
          summaryLabel: 'auto-data',
          writeStatus: true,
          statusExtra: { mode: 'emotion-only' },
        });
        printStageSummary(summary, 'auto-data');
        log(`Emotion indicator sync finished for ${emotionTargetDate ?? onlineDate}.`);
      } catch (error) {
        console.error('[auto-data] Failed to sync emotion indicators:', error);
      } finally {
        isFetching = false;
      }
      await sleep(getNextWaitMs(new Date()));
      continue;
    }

    if (sentimentUpToDate && performanceUpToDate && emotionUpToDate && !cycleUpToDate) {
      isFetching = true;
      log(`Cycle snapshots lagging behind ${onlineDate}. Triggering cycle-only sync...`);
      try {
        const summary = await runStagesSequentially([
          { key: 'cycle', name: 'Sentiment Cycle Snapshots', run: syncSentimentCycleSnapshotsPy },
        ], {
          continueOnError: false,
          printSummary: true,
          printSummaryOnError: true,
          summaryLabel: 'auto-data',
          writeStatus: true,
          statusExtra: { mode: 'cycle-only' },
        });
        printStageSummary(summary, 'auto-data');
        log(`Cycle snapshot sync finished for ${onlineDate}.`);
      } catch (error) {
        console.error('[auto-data] Failed to sync cycle snapshots:', error);
      } finally {
        isFetching = false;
      }
      await sleep(getNextWaitMs(new Date()));
      continue;
    }

    if (latestSentiment && onlineDate <= latestSentiment && performanceUpToDate && cycleUpToDate) {
      log(`Online trading日 (${onlineDate}) 未领先情绪缓存 (${latestSentiment}) 且主快照同步，无需刷新。`);
      await sleep(getNextWaitMs(now));
      continue;
    }

    if (isFetching) {
      await sleep(30 * 1000);
      continue;
    }

    isFetching = true;
    log(
      `Detected new trading日 ${onlineDate} (sentiment: ${latestSentiment ?? 'none'}, performance: ${latestPerformance ?? 'none'}, cycle: ${latestCycleSnapshot ?? 'none'}, emotion: ${latestEmotionIndicator ?? 'none'}). Triggering download...`
    );
    try {
      const summary = await runStagesSequentially([
        { key: 'market-pipeline', name: 'Market Data Pipeline', run: fetchMarketData, retries: 1 },
        { key: 'emotion', name: 'Emotion Indicators', run: syncEmotionIndicators },
      ], {
        continueOnError: true,
        printSummary: true,
        printSummaryOnError: true,
        summaryLabel: 'auto-data',
        writeStatus: true,
        statusExtra: { mode: 'full-auto' },
      });
      printStageSummary(summary, 'auto-data');
      const failed = summary.filter((item) => item.status === 'failed');
      if (failed.length) {
        throw new Error(`auto sync completed with ${failed.length} failed stage(s)`);
      }
      log(`Download finished for ${onlineDate}. Files saved to ${DATA_DIR}.`);
    } catch (error) {
      console.error('[auto-data] Failed to fetch latest market data:', error);
    } finally {
      isFetching = false;
    }

    await sleep(getNextWaitMs(new Date()));
  }
};

runWatcher();
