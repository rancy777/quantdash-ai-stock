import { readFile } from 'node:fs/promises';
import { resolveExistingDataPath } from './dataPaths.js';

const safeReadJson = async (fileName) => {
  try {
    const filePath = await resolveExistingDataPath(fileName);
    if (!filePath) return [];
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

export const normalizeDateLabel = (value, referenceYear = new Date().getFullYear()) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{2}-\d{2}$/.test(raw)) return `${referenceYear}-${raw}`;
  return raw;
};

export const compactDateLabel = (value) => {
  const normalized = normalizeDateLabel(value);
  return normalized.length >= 10 ? normalized.slice(5) : normalized;
};

export const matchDateValue = (candidate, targetDate) => {
  const normalizedTarget = normalizeDateLabel(targetDate);
  if (!normalizedTarget) return false;
  const targetCompact = compactDateLabel(normalizedTarget);
  const candidateNormalized = normalizeDateLabel(
    candidate,
    Number(normalizedTarget.slice(0, 4)) || new Date().getFullYear(),
  );
  return candidateNormalized === normalizedTarget || compactDateLabel(candidateNormalized) === targetCompact;
};

export const findEntryByDate = (items, targetDate) => {
  if (!Array.isArray(items) || !targetDate) return null;
  return items.find((item) => matchDateValue(item?.fullDate ?? item?.date, targetDate)) ?? null;
};

const derivePremiumSnapshot = (performanceEntry) => {
  if (!performanceEntry) return null;
  const successRate = Number((Number(performanceEntry.successRate || 0) * 100).toFixed(1));
  return {
    date: performanceEntry.fullDate ?? performanceEntry.date,
    premium: Number((((Number(performanceEntry.successRate) || 0) * 60) + ((Number(performanceEntry.avgBoardGain) || 0) * 10)).toFixed(2)),
    successRate,
    limitUpCount: Number(performanceEntry.limitUpCount) || 0,
    followThroughCount: Number(performanceEntry.followThroughCount) || 0,
    brokenCount: Number(performanceEntry.brokenCount) || 0,
    brokenRate: Number(((1 - (Number(performanceEntry.successRate) || 0)) * 100).toFixed(1)),
    avgBoardGain: Number(performanceEntry.avgBoardGain) || 0,
  };
};

export const buildSentimentSnapshot = async (targetDate) => {
  const [
    sentimentHistory,
    performanceHistory,
    structureHistory,
    repairHistory,
    leaderHistory,
    boardHeightHistory,
    emotionIndicators,
    bullBearHistory,
    indexFuturesLongShort,
    cycleOverview,
    volumeTrend,
    highRiskHistory,
  ] = await Promise.all([
    safeReadJson('sentiment.json'),
    safeReadJson('performance.json'),
    safeReadJson('limit_up_structure.json'),
    safeReadJson('repair_rate.json'),
    safeReadJson('leader_state.json'),
    safeReadJson('board_height_history.json'),
    safeReadJson('emotion_indicators.json'),
    safeReadJson('bull_bear_signal.json'),
    safeReadJson('index_futures_long_short.json'),
    safeReadJson('cycle_overview.json'),
    safeReadJson('market_volume_trend.json'),
    safeReadJson('high_risk.json'),
  ]);

  const availableDates = Array.from(
    new Set(
      [
        ...(Array.isArray(sentimentHistory) ? sentimentHistory.map((item) => normalizeDateLabel(item?.date)) : []),
        ...(Array.isArray(performanceHistory) ? performanceHistory.map((item) => normalizeDateLabel(item?.fullDate ?? item?.date)) : []),
        ...(Array.isArray(bullBearHistory) ? bullBearHistory.map((item) => normalizeDateLabel(item?.date)) : []),
        ...(Array.isArray(emotionIndicators) ? emotionIndicators.map((item) => normalizeDateLabel(item?.date)) : []),
      ].filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b));

  const selectedDate = normalizeDateLabel(
    targetDate || availableDates[availableDates.length - 1] || new Date().toISOString().slice(0, 10),
  );
  const selectedCompactDate = compactDateLabel(selectedDate);

  const sentimentEntry = findEntryByDate(sentimentHistory, selectedDate);
  const performanceEntry = findEntryByDate(performanceHistory, selectedDate);
  const structureEntry = findEntryByDate(structureHistory, selectedDate);
  const repairEntry = findEntryByDate(repairHistory, selectedDate);
  const leaderEntry = findEntryByDate(leaderHistory, selectedDate);
  const boardHeightEntry = findEntryByDate(boardHeightHistory, selectedDate);
  const emotionEntry = findEntryByDate(emotionIndicators, selectedDate);
  const bullBearEntry = findEntryByDate(bullBearHistory, selectedDate);
  const volumeEntry = findEntryByDate(volumeTrend, selectedDate);
  const highRiskEntry = findEntryByDate(highRiskHistory, selectedDate);

  const indexFuturesSnapshot = Array.isArray(indexFuturesLongShort)
    ? indexFuturesLongShort
        .map((series) => {
          const point = Array.isArray(series?.history)
            ? series.history.find((item) => matchDateValue(item?.date, selectedDate))
            : null;
          if (!point) return null;
          const ratio = point.shortPosition > 0 ? Number((point.longPosition / point.shortPosition).toFixed(4)) : null;
          return {
            code: series.code,
            label: series.label,
            mainContract: series.mainContract,
            date: normalizeDateLabel(point.date),
            longPosition: point.longPosition,
            shortPosition: point.shortPosition,
            longShortRatio: ratio,
          };
        })
        .filter(Boolean)
    : [];

  return {
    selectedDate,
    selectedCompactDate,
    availableDates,
    snapshot: {
      sentiment: sentimentEntry ? {
        date: normalizeDateLabel(sentimentEntry.date),
        coefficient: Number(sentimentEntry.value) || 0,
        height: Number(sentimentEntry.height) || 0,
        limitUpCount: Number(sentimentEntry.limitUpCount) || 0,
        limitDownCount: Number(sentimentEntry.limitDownCount) || 0,
        riseCount: Number(sentimentEntry.riseCount) || 0,
        rawZt: sentimentEntry.rawZt ?? null,
      } : null,
      premium: derivePremiumSnapshot(performanceEntry),
      structure: structureEntry ? {
        date: selectedDate,
        firstBoardCount: Number(structureEntry.firstBoardCount) || 0,
        secondBoardCount: Number(structureEntry.secondBoardCount) || 0,
        thirdBoardCount: Number(structureEntry.thirdBoardCount) || 0,
        highBoardCount: Number(structureEntry.highBoardCount) || 0,
        totalLimitUpCount: Number(structureEntry.totalLimitUpCount) || 0,
        firstBoardRatio: Number(structureEntry.firstBoardRatio) || 0,
        relayCount: Number(structureEntry.relayCount) || 0,
        highBoardRatio: Number(structureEntry.highBoardRatio) || 0,
      } : null,
      repair: repairEntry ? {
        date: selectedDate,
        brokenCount: Number(repairEntry.brokenCount) || 0,
        brokenRepairCount: Number(repairEntry.brokenRepairCount) || 0,
        brokenRepairRate: Number(repairEntry.brokenRepairRate) || 0,
        bigFaceCount: Number(repairEntry.bigFaceCount) || 0,
        bigFaceRepairCount: Number(repairEntry.bigFaceRepairCount) || 0,
        bigFaceRepairRate: Number(repairEntry.bigFaceRepairRate) || 0,
      } : null,
      leader: leaderEntry ? {
        date: selectedDate,
        leaderSymbol: leaderEntry.leaderSymbol,
        leaderName: leaderEntry.leaderName,
        leaderBoardCount: Number(leaderEntry.leaderBoardCount) || 0,
        leaderCount: Number(leaderEntry.leaderCount) || 0,
        secondHighestBoard: Number(leaderEntry.secondHighestBoard) || 0,
        threePlusCount: Number(leaderEntry.threePlusCount) || 0,
        continuedCount: Number(leaderEntry.continuedCount) || 0,
        nextOpenPct: leaderEntry.nextOpenPct ?? null,
        nextClosePct: leaderEntry.nextClosePct ?? null,
        isOneWord: Boolean(leaderEntry.isOneWord),
        statusLabel: leaderEntry.statusLabel ?? null,
      } : null,
      boardHeight: boardHeightEntry ? {
        date: normalizeDateLabel(boardHeightEntry.fullDate ?? boardHeightEntry.date),
        mainBoardHighest: Number(boardHeightEntry.mainBoardHighest) || 0,
        mainBoardHighestNames: boardHeightEntry.mainBoardHighestNames ?? [],
        mainBoardHighestSymbols: boardHeightEntry.mainBoardHighestSymbols ?? [],
        mainBoardSecondHighest: Number(boardHeightEntry.mainBoardSecondHighest) || 0,
        mainBoardSecondHighestNames: boardHeightEntry.mainBoardSecondHighestNames ?? [],
        mainBoardSecondHighestSymbols: boardHeightEntry.mainBoardSecondHighestSymbols ?? [],
        chinextHighest: Number(boardHeightEntry.chinextHighest) || 0,
        chinextHighestNames: boardHeightEntry.chinextHighestNames ?? [],
        chinextHighestSymbols: boardHeightEntry.chinextHighestSymbols ?? [],
      } : null,
      emotionIndicators: emotionEntry ? {
        date: normalizeDateLabel(emotionEntry.date),
        ftseA50: Number(emotionEntry.ftseA50) || 0,
        nasdaq: Number(emotionEntry.nasdaq) || 0,
        dowJones: Number(emotionEntry.dowJones) || 0,
        sp500: Number(emotionEntry.sp500) || 0,
        offshoreRmb: Number(emotionEntry.offshoreRmb) || 0,
        ashareAvgValuation: Number(emotionEntry.ashareAvgValuation) || 0,
        indexFuturesLongShortRatio: Number(emotionEntry.indexFuturesLongShortRatio) || 0,
      } : null,
      bullBearSignal: bullBearEntry ?? null,
      indexFuturesLongShort: indexFuturesSnapshot,
      volumeTrend: volumeEntry ? {
        date: normalizeDateLabel(volumeEntry.fullDate ?? volumeEntry.date),
        amount: Number(volumeEntry.amount) || 0,
        changeRate: volumeEntry.changeRate ?? null,
      } : null,
      highRisk: highRiskEntry ? {
        date: selectedDate,
        highBoardCount: Number(highRiskEntry.highBoardCount) || 0,
        aKillCount: Number(highRiskEntry.aKillCount) || 0,
        weakCount: Number(highRiskEntry.weakCount) || 0,
        brokenCount: Number(highRiskEntry.brokenCount) || 0,
        brokenRate: Number(highRiskEntry.brokenRate) || 0,
        riskLevel: highRiskEntry.riskLevel ?? null,
      } : null,
      cycleOverview: cycleOverview && !Array.isArray(cycleOverview) ? cycleOverview : null,
    },
  };
};
