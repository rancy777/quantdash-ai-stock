import fs from 'fs/promises';
import path from 'path';
import { A_SHARE_DIR, resolveDataReadCandidates, resolveDataWritePath } from './dataPaths.js';

const DATA_DIR = A_SHARE_DIR;
const OUTPUT_DIR = resolveDataWritePath('single_day_snapshots', 'auto');

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TRADING_DATE_CHECK_URL = (limit = 90) => (
  'https://push2his.eastmoney.com/api/qt/stock/kline/get'
  + '?secid=1.000001&fields1=f1&fields2=f51&klt=101&fqt=1&end=20500101'
  + `&lmt=${limit}&_=${Date.now()}`
);

const readJsonFile = async (fileName) => {
  for (const candidate of resolveDataReadCandidates(fileName)) {
    try {
      const raw = await fs.readFile(candidate, 'utf-8');
      return JSON.parse(raw);
    } catch {
      // try next candidate
    }
  }
  return null;
};

const isValidDate = (value) => {
  if (!DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return false;
  const normalized = [
    parsed.getFullYear(),
    String(parsed.getMonth() + 1).padStart(2, '0'),
    String(parsed.getDate()).padStart(2, '0'),
  ].join('-');
  return normalized === value;
};

const monthDayFromDate = (value) => value.slice(5);

const extractDateSetFromArray = (payload) => {
  const result = new Set();
  if (!Array.isArray(payload)) return result;
  for (const item of payload) {
    if (!item || typeof item !== 'object') continue;
    const fullDate = typeof item.fullDate === 'string' ? item.fullDate : null;
    const date = typeof item.date === 'string' ? item.date : null;
    if (fullDate && DATE_PATTERN.test(fullDate)) {
      result.add(fullDate);
      continue;
    }
    if (date && DATE_PATTERN.test(date)) {
      result.add(date);
    }
  }
  return result;
};

const getLocalTradingDates = async () => {
  const [sentiment, performance, emotion, bullBearSignal, boardHeightHistory] = await Promise.all([
    readJsonFile('sentiment.json'),
    readJsonFile('performance.json'),
    readJsonFile('emotion_indicators.json'),
    readJsonFile('bull_bear_signal.json'),
    readJsonFile('board_height_history.json'),
  ]);

  const dates = new Set([
    ...extractDateSetFromArray(sentiment),
    ...extractDateSetFromArray(emotion),
    ...extractDateSetFromArray(bullBearSignal),
    ...extractDateSetFromArray(boardHeightHistory),
  ]);

  if (Array.isArray(performance)) {
    for (const item of performance) {
      if (!item || typeof item !== 'object') continue;
      if (typeof item.fullDate === 'string' && DATE_PATTERN.test(item.fullDate)) {
        dates.add(item.fullDate);
      }
    }
  }

  return dates;
};

const fetchRemoteTradingDates = async () => {
  const response = await fetch(TRADING_DATE_CHECK_URL(), {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119 Safari/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const payload = await response.json();
  const klines = payload?.data?.klines;
  if (!Array.isArray(klines) || klines.length === 0) {
    throw new Error('No trading dates returned from index API');
  }

  const dates = new Set();
  for (const item of klines) {
    const [date] = String(item).split(',');
    if (DATE_PATTERN.test(date)) {
      dates.add(date);
    }
  }
  return dates;
};

const resolveTradingDateStatus = async (targetDate) => {
  try {
    const remoteDates = await fetchRemoteTradingDates();
    return {
      isTradingDate: remoteDates.has(targetDate),
      source: 'remote',
    };
  } catch (error) {
    const localDates = await getLocalTradingDates();
    if (localDates.size > 0) {
      return {
        isTradingDate: localDates.has(targetDate),
        source: 'local',
        fallbackReason: error instanceof Error ? error.message : String(error),
      };
    }
    return {
      isTradingDate: null,
      source: 'unavailable',
      fallbackReason: error instanceof Error ? error.message : String(error),
    };
  }
};

const findArrayItemByDate = (payload, fullDate, monthDay) => {
  if (!Array.isArray(payload)) return null;
  return (
    payload.find((item) => item?.fullDate === fullDate)
    ?? payload.find((item) => item?.date === fullDate)
    ?? payload.find((item) => item?.date === monthDay)
    ?? null
  );
};

const extractSectorRotationDay = (payload, monthDay) => {
  if (!payload || typeof payload !== 'object' || typeof payload.data !== 'object' || !payload.data) {
    return null;
  }
  const dayData = payload.data[monthDay];
  if (!dayData || typeof dayData !== 'object') {
    return null;
  }
  return Object.values(dayData)
    .filter((item) => item && typeof item === 'object')
    .sort((left, right) => Number(left.rank || 0) - Number(right.rank || 0));
};

const extractSectorPersistenceDay = (payload, monthDay) => {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.entries)) {
    return null;
  }
  return payload.entries.find((item) => item?.date === monthDay) ?? null;
};

const buildSnapshot = async (targetDate) => {
  const monthDay = monthDayFromDate(targetDate);
  const [
    sentiment,
    performance,
    emotionIndicators,
    bullBearSignal,
    limitUpStructure,
    repairRate,
    leaderState,
    boardHeightHistory,
    highRisk,
    cycleOverview,
    sectorRotationConcept,
    sectorRotationIndustry,
    sectorPersistenceConcept,
    sectorPersistenceIndustry,
  ] = await Promise.all([
    readJsonFile('sentiment.json'),
    readJsonFile('performance.json'),
    readJsonFile('emotion_indicators.json'),
    readJsonFile('bull_bear_signal.json'),
    readJsonFile('limit_up_structure.json'),
    readJsonFile('repair_rate.json'),
    readJsonFile('leader_state.json'),
    readJsonFile('board_height_history.json'),
    readJsonFile('high_risk.json'),
    readJsonFile('cycle_overview.json'),
    readJsonFile('sector_rotation_concept.json'),
    readJsonFile('sector_rotation_industry.json'),
    readJsonFile('sector_persistence_concept.json'),
    readJsonFile('sector_persistence_industry.json'),
  ]);

  const snapshot = {
    targetDate,
    monthDay,
    generatedAt: new Date().toISOString(),
    data: {
      sentiment: findArrayItemByDate(sentiment, targetDate, monthDay),
      performance: findArrayItemByDate(performance, targetDate, monthDay),
      emotion: findArrayItemByDate(emotionIndicators, targetDate, monthDay),
      bullBearSignal: findArrayItemByDate(bullBearSignal, targetDate, monthDay),
      limitUpStructure: findArrayItemByDate(limitUpStructure, targetDate, monthDay),
      repairRate: findArrayItemByDate(repairRate, targetDate, monthDay),
      leaderState: findArrayItemByDate(leaderState, targetDate, monthDay),
      boardHeight: findArrayItemByDate(boardHeightHistory, targetDate, monthDay),
      highRisk: findArrayItemByDate(highRisk, targetDate, monthDay),
      sectorRotation: {
        concept: extractSectorRotationDay(sectorRotationConcept, monthDay),
        industry: extractSectorRotationDay(sectorRotationIndustry, monthDay),
      },
      sectorPersistence: {
        concept: extractSectorPersistenceDay(sectorPersistenceConcept, monthDay),
        industry: extractSectorPersistenceDay(sectorPersistenceIndustry, monthDay),
      },
      cycleOverviewLatest: cycleOverview ?? null,
    },
  };

  const missingKeys = [];
  for (const [key, value] of Object.entries(snapshot.data)) {
    if (value === null) {
      missingKeys.push(key);
      continue;
    }
    if (typeof value === 'object' && !Array.isArray(value)) {
      const nestedValues = Object.values(value);
      if (nestedValues.length > 0 && nestedValues.every((item) => item == null)) {
        missingKeys.push(key);
      }
    }
  }

  return {
    ...snapshot,
    missingKeys,
  };
};

const main = async () => {
  const targetDate = String(process.argv[2] ?? '').trim();
  if (!isValidDate(targetDate)) {
    console.error('[single-day] Invalid date. Use YYYY-MM-DD, for example 2026-03-27');
    process.exitCode = 1;
    return;
  }

  const tradingDateStatus = await resolveTradingDateStatus(targetDate);
  if (tradingDateStatus.isTradingDate === false) {
    console.error(
      `[single-day] ${targetDate} is not a trading date (validated by ${tradingDateStatus.source}).`,
    );
    process.exitCode = 1;
    return;
  }
  if (tradingDateStatus.isTradingDate == null) {
    console.error(
      `[single-day] Unable to confirm whether ${targetDate} is a trading date. `
      + `Validation source unavailable: ${tradingDateStatus.fallbackReason ?? 'unknown reason'}`,
    );
    process.exitCode = 1;
    return;
  }

  const snapshot = await buildSnapshot(targetDate);
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const outputPath = path.join(OUTPUT_DIR, `${targetDate}.json`);
  await fs.writeFile(outputPath, JSON.stringify(snapshot, null, 2) + '\n', 'utf-8');

  console.log(`[single-day] wrote ${outputPath}`);
  if (snapshot.missingKeys.length > 0) {
    console.log(`[single-day] missing data sections: ${snapshot.missingKeys.join(', ')}`);
  } else {
    console.log('[single-day] all tracked sections were found in local snapshots');
  }
};

main().catch((error) => {
  console.error('[single-day] failed:', error);
  process.exitCode = 1;
});
