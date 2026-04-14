import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { buildSentimentSnapshot } from './sentimentSnapshot.js';
import { A_SHARE_REPORTS_DIR, RESEARCH_REPORTS_DIR, resolveExistingDataPath } from './dataPaths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const TOOL_TEXT_LIMIT = 30;

const server = new McpServer(
  { name: 'quantdash-market-mcp', version: '0.1.0' },
  { capabilities: { logging: {} } }
);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchJson = async (url, timeout = 8000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      headers: {
        'user-agent': 'Mozilla/5.0 QuantDashMCP/0.1',
        accept: 'application/json,text/plain,*/*',
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
};

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


const getReportFilePath = (relativePath) => {
  const normalized = String(relativePath).replace(/\\/g, '/');
  const marketScopedPath = path.join(A_SHARE_REPORTS_DIR, ...normalized.split('/'));
  if (existsSync(marketScopedPath)) return marketScopedPath;
  return path.join(RESEARCH_REPORTS_DIR, ...normalized.split('/'));
};

const getFileReadAdvice = (previewType) => {
  if (previewType === 'pdf') {
    return {
      recommendedMode: 'direct_file',
      note: 'This PDF is better read directly by an AI model with native PDF support.',
    };
  }
  if (previewType === 'image') {
    return {
      recommendedMode: 'direct_file',
      note: 'This image file is better read directly by a multimodal AI model.',
    };
  }
  if (previewType === 'office') {
    return {
      recommendedMode: 'direct_file',
      note: 'This Office document should be read directly by an AI model that supports Office files.',
    };
  }
  if (previewType === 'text') {
    return {
      recommendedMode: 'either',
      note: 'This text-like file can be read directly or through MCP text content.',
    };
  }
  return {
    recommendedMode: 'direct_file',
    note: 'Prefer reading the original file directly if the target AI supports this format.',
  };
};

const getRecentTradingDates = async (count = 12) => {
  const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=1.000001&fields1=f1&fields2=f51,f52,f53,f54,f55,f57&klt=101&fqt=1&end=20500101&lmt=${count + 3}&_=${Date.now()}`;
  const data = await fetchJson(url, 6000);
  const klines = data?.data?.klines ?? [];
  return klines
    .map((line) => String(line).split(',')[0])
    .filter(Boolean)
    .slice(-(count + 1));
};

const getStockKlines = async (symbol, limit = 60) => {
  const market = String(symbol).startsWith('6') ? '1' : '0';
  const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${market}.${symbol}&fields1=f1&fields2=f51,f52,f53,f54,f55,f57&klt=101&fqt=1&end=20500101&lmt=${limit}&_=${Date.now()}`;
  const json = await fetchJson(url, 6000);
  const rows = json?.data?.klines ?? [];
  return rows.map((line) => {
    const [date, open, close, high, low, volume] = String(line).split(',');
    return {
      date,
      open: Number(open),
      close: Number(close),
      high: Number(high),
      low: Number(low),
      volume: Number(volume),
    };
  });
};

const getSingleDayPerformance = async (symbol, dateStr) => {
  const klines = await getStockKlines(symbol, 90);
  let targetIndex = -1;
  for (let i = klines.length - 1; i >= 0; i -= 1) {
    if (klines[i]?.date <= dateStr) {
      targetIndex = i;
      break;
    }
  }
  if (targetIndex <= 0) return null;
  const today = klines[targetIndex];
  const prev = klines[targetIndex - 1];
  if (!today || !prev || prev.close <= 0) return null;
  const openPct = ((today.open - prev.close) / prev.close) * 100;
  const closePct = ((today.close - prev.close) / prev.close) * 100;
  const isOneWord =
    Math.abs(today.open - today.close) < 0.001 &&
    Math.abs(today.open - today.high) < 0.001 &&
    Math.abs(today.open - today.low) < 0.001;
  return {
    openPct: Number(openPct.toFixed(2)),
    closePct: Number(closePct.toFixed(2)),
    isOneWord,
  };
};

const fetchLimitUpPool = async (dateStr) => {
  const apiDate = dateStr.replace(/-/g, '');
  const url = `https://push2ex.eastmoney.com/getTopicZTPool?ut=7eea3edcaed734bea9cbfc24409ed989&dpt=wz.ztzt&Pageindex=0&pagesize=500&sort=fbt%3Aasc&date=${apiDate}&_=${Date.now()}`;
  const data = await fetchJson(url, 5000);
  const pool = data?.data?.pool ?? [];
  return pool.map((item) => ({
    symbol: String(item.c),
    name: item.n,
    boardCount: Number(item.lbc ?? 0),
    industry: item.hybk || 'Unknown',
    limitUpTime: item.lbt || item.zttime || item.zttm || item.fbt || item.ftime || item.lst || null,
  }));
};

const fetchBrokenPool = async (dateStr) => {
  const apiDate = dateStr.replace(/-/g, '');
  const url = `https://push2ex.eastmoney.com/getTopicZBPool?ut=7eea3edcaed734bea9cbfc24409ed989&dpt=wz.ztzt&Pageindex=0&pagesize=500&sort=fbt%3Aasc&date=${apiDate}&_=${Date.now()}`;
  const data = await fetchJson(url, 5000);
  const pool = data?.data?.pool ?? [];
  return pool.map((item) => ({
    symbol: String(item.c),
    name: item.n,
    pctChange: Number(item.zdp ?? 0),
  }));
};

const fetchSectorBoardList = async (boardType) => {
  const fs = boardType === 'industry' ? 'm:90+t:3+f:!50' : 'm:90+t:2+f:!50';
  const url = `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=30&po=1&np=1&ut=bd1d9ddb04089700cf9c27f6f7426281&fltt=2&invt=2&fid=f3&fs=${encodeURIComponent(fs)}&fields=f12,f14,f3&_=${Date.now()}`;
  const data = await fetchJson(url, 5000);
  return Array.isArray(data?.data?.diff) ? data.data.diff : [];
};

const fetchSectorBoardHistory = async (code) => {
  const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=90.${code}&ut=fa5fd1943c7b386f172d6893dbfba10b&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61&klt=101&fqt=0&end=20500101&lmt=10&_=${Date.now()}`;
  const data = await fetchJson(url, 5000);
  const name = data?.data?.name || code;
  const klines = data?.data?.klines ?? [];
  return klines
    .map((line) => {
      const parts = String(line).split(',');
      return {
        date: parts[0],
        pctChange: Number(parts[8]),
        code,
        name,
      };
    })
    .filter((item) => item.date && !Number.isNaN(item.pctChange));
};

const buildStructure = (pool) => {
  let firstBoardCount = 0;
  let secondBoardCount = 0;
  let thirdBoardCount = 0;
  let highBoardCount = 0;

  for (const item of pool) {
    if (item.boardCount <= 1) firstBoardCount += 1;
    else if (item.boardCount === 2) secondBoardCount += 1;
    else if (item.boardCount === 3) thirdBoardCount += 1;
    else highBoardCount += 1;
  }

  const totalLimitUpCount = pool.length;
  return {
    firstBoardCount,
    secondBoardCount,
    thirdBoardCount,
    highBoardCount,
    totalLimitUpCount,
    firstBoardRatio: totalLimitUpCount ? Number(((firstBoardCount / totalLimitUpCount) * 100).toFixed(1)) : 0,
    relayCount: Math.max(totalLimitUpCount - firstBoardCount, 0),
  };
};

const buildRepairSnapshot = async () => {
  const tradingDates = await getRecentTradingDates(2);
  const currentDate = tradingDates[tradingDates.length - 2];
  const nextDate = tradingDates[tradingDates.length - 1];
  const brokenPool = await fetchBrokenPool(currentDate);

  let brokenRepairCount = 0;
  let bigFaceCount = 0;
  let bigFaceRepairCount = 0;

  for (const stock of brokenPool) {
    const performance = await getSingleDayPerformance(stock.symbol, nextDate);
    const repaired = performance !== null && performance.closePct > 0;
    if (repaired) brokenRepairCount += 1;
    if (stock.pctChange <= -5) {
      bigFaceCount += 1;
      if (repaired) bigFaceRepairCount += 1;
    }
  }

  return {
    sampleDate: currentDate,
    nextDate,
    brokenCount: brokenPool.length,
    brokenRepairCount,
    brokenRepairRate: brokenPool.length ? Number(((brokenRepairCount / brokenPool.length) * 100).toFixed(1)) : 0,
    bigFaceCount,
    bigFaceRepairCount,
    bigFaceRepairRate: bigFaceCount ? Number(((bigFaceRepairCount / bigFaceCount) * 100).toFixed(1)) : 0,
  };
};

const fetchMarketIndexAmountSeries = async (secid) => {
  const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secid}&ut=fa5fd1943c7b386f172d6893dbfba10b&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58&klt=101&fqt=0&end=20500101&lmt=12&_=${Date.now()}`;
  const data = await fetchJson(url, 6000);
  const klines = data?.data?.klines ?? [];
  return new Map(
    klines
      .map((line) => {
        const parts = String(line).split(',');
        const date = parts[0];
        const amount = Number(parts[6] ?? 0);
        return date && !Number.isNaN(amount) ? [date, amount] : null;
      })
      .filter(Boolean)
  );
};

const buildVolumeTrend = async () => {
  const [shSeries, szSeries] = await Promise.all([
    fetchMarketIndexAmountSeries('1.000001'),
    fetchMarketIndexAmountSeries('0.399001'),
  ]);
  const allDates = [...new Set([...shSeries.keys(), ...szSeries.keys()])].sort((a, b) => a.localeCompare(b)).slice(-8);
  return allDates
    .map((date, index) => {
      const amount = (shSeries.get(date) || 0) + (szSeries.get(date) || 0);
      const prevAmount =
        index > 0 ? ((shSeries.get(allDates[index - 1]) || 0) + (szSeries.get(allDates[index - 1]) || 0)) : 0;
      const changeRate = index > 0 && prevAmount > 0 ? Number((((amount - prevAmount) / prevAmount) * 100).toFixed(2)) : null;
      return {
        date,
        amount: Number((amount / 100000000).toFixed(0)),
        changeRate,
      };
    })
    .filter((item) => item.amount > 0);
};

const buildHighRiskHistory = async (days = 6) => {
  const tradingDates = await getRecentTradingDates(days + 2);
  const entries = [];
  for (let i = 0; i < tradingDates.length - 1; i += 1) {
    const currentDate = tradingDates[i];
    const nextDate = tradingDates[i + 1];
    const todayPool = await fetchLimitUpPool(currentDate);
    const brokenPool = await fetchBrokenPool(currentDate);
    const highBoardPool = todayPool.filter((item) => item.boardCount >= 4);

    let aKillCount = 0;
    let weakCount = 0;
    for (const stock of highBoardPool) {
      const perf = await getSingleDayPerformance(stock.symbol, nextDate);
      if (!perf) continue;
      if (perf.closePct <= -8) aKillCount += 1;
      if (perf.closePct < 0) weakCount += 1;
    }

    const brokenRate = todayPool.length ? Number(((brokenPool.length / todayPool.length) * 100).toFixed(1)) : 0;
    const riskLevel =
      aKillCount >= 2 || brokenRate >= 35 ? 'high' : aKillCount >= 1 || brokenRate >= 20 || weakCount >= 2 ? 'medium' : 'low';

    entries.push({
      date: currentDate,
      highBoardCount: highBoardPool.length,
      aKillCount,
      weakCount,
      brokenCount: brokenPool.length,
      brokenRate,
      riskLevel,
    });
    await delay(20);
  }

  return entries.slice(-days);
};

const getLeaderStatusLabel = ({ isOneWord, continued, nextClosePct, leaderCount, leaderBoardCount }) => {
  if (nextClosePct === null) {
    if (leaderCount >= 2 && leaderBoardCount >= 4) return 'high_leader_cluster';
    if (isOneWord) return 'one_word_watch';
    return 'await_confirmation';
  }
  if (isOneWord && continued) return 'one_word_acceleration';
  if (continued && nextClosePct >= 0) return 'strong_continuation';
  if (nextClosePct >= 3) return 'accepted_after_break';
  if (nextClosePct >= 0) return 'high_level_divergence';
  if (nextClosePct > -5) return 'weakening';
  return 'retreat_pressure';
};

const buildLeaderState = async (days = 5) => {
  const tradingDates = await getRecentTradingDates(Math.max(days + 1, 6));
  const targetDates = tradingDates.slice(-(days + 1));
  const entries = [];

  for (let i = 0; i < targetDates.length - 1; i += 1) {
    const currentDate = targetDates[i];
    const nextDate = targetDates[i + 1];
    const todayPool = await fetchLimitUpPool(currentDate);
    if (!todayPool.length) continue;

    const leaderBoardCount = todayPool.reduce((max, item) => Math.max(max, item.boardCount), 0);
    const leaders = todayPool.filter((item) => item.boardCount === leaderBoardCount);
    const leader = [...leaders].sort((a, b) => String(a.limitUpTime || '99:99:99').localeCompare(String(b.limitUpTime || '99:99:99')))[0];
    const secondHighestBoard = todayPool
      .filter((item) => item.boardCount < leaderBoardCount)
      .reduce((max, item) => Math.max(max, item.boardCount), 0);
    const threePlusCount = todayPool.filter((item) => item.boardCount >= 3).length;
    const nextPool = await fetchLimitUpPool(nextDate);
    const nextBoardMap = new Map(nextPool.map((item) => [item.symbol, item.boardCount]));
    const continuedCount = leaders.filter((item) => (nextBoardMap.get(item.symbol) || 0) > leaderBoardCount).length;
    const currentPerformance = await getSingleDayPerformance(leader.symbol, currentDate);
    const nextPerformance = await getSingleDayPerformance(leader.symbol, nextDate);

    entries.push({
      date: currentDate,
      leaderName: leader.name,
      leaderSymbol: leader.symbol,
      leaderBoardCount,
      leaderCount: leaders.length,
      secondHighestBoard,
      threePlusCount,
      continuedCount,
      nextOpenPct: nextPerformance?.openPct ?? null,
      nextClosePct: nextPerformance?.closePct ?? null,
      isOneWord: currentPerformance?.isOneWord ?? false,
      statusLabel: getLeaderStatusLabel({
        isOneWord: currentPerformance?.isOneWord ?? false,
        continued: continuedCount > 0,
        nextClosePct: nextPerformance?.closePct ?? null,
        leaderCount: leaders.length,
        leaderBoardCount,
      }),
    });
    await delay(30);
  }

  return entries;
};

const buildSectorPersistence = async (boardType = 'concept') => {
  const boardList = await fetchSectorBoardList(boardType);
  const candidates = boardList.slice(0, 20);
  const rows = [];
  for (const item of candidates) {
    try {
      const history = await fetchSectorBoardHistory(String(item.f12));
      rows.push(...history);
      await delay(20);
    } catch {
      // ignore single board failures
    }
  }

  const groupedByDate = new Map();
  for (const row of rows) {
    if (!groupedByDate.has(row.date)) groupedByDate.set(row.date, []);
    groupedByDate.get(row.date).push(row);
  }

  const sortedDates = [...groupedByDate.keys()].sort((a, b) => a.localeCompare(b)).slice(-5);
  const rankedByDate = sortedDates
    .map((date) => {
      const ranked = (groupedByDate.get(date) || []).sort((a, b) => b.pctChange - a.pctChange);
      return { date, ranked, leader: ranked[0] || null };
    })
    .filter((item) => item.leader);

  const topThreeCounts = new Map();
  for (const item of rankedByDate) {
    for (const sector of item.ranked.slice(0, 3)) {
      topThreeCounts.set(sector.name, (topThreeCounts.get(sector.name) || 0) + 1);
    }
  }

  const entries = rankedByDate.map((item, index) => {
    let streakDays = 1;
    for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
      if (rankedByDate[cursor].leader.name === item.leader.name) streakDays += 1;
      else break;
    }
    const prev = index > 0 ? rankedByDate[index - 1].leader : null;
    return {
      date: item.date,
      leaderName: item.leader.name,
      leaderCode: item.leader.code,
      leaderPctChange: Number(item.leader.pctChange.toFixed(2)),
      streakDays,
      topThreeAppearances: topThreeCounts.get(item.leader.name) || 1,
      strengthDelta: prev && prev.name === item.leader.name ? Number((item.leader.pctChange - prev.pctChange).toFixed(2)) : null,
    };
  });

  const current = entries[entries.length - 1];
  const strongestRepeat = [...topThreeCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  return {
    boardType,
    currentLeaderName: current?.leaderName ?? null,
    currentLeaderCode: current?.leaderCode ?? null,
    currentLeaderPctChange: current?.leaderPctChange ?? null,
    currentStreakDays: current?.streakDays ?? 0,
    currentTopThreeAppearances: current?.topThreeAppearances ?? 0,
    strongestRepeatName: strongestRepeat?.[0] ?? null,
    strongestRepeatCount: strongestRepeat?.[1] ?? 0,
    entries,
  };
};

const getNewsFeed = async (limit = 20, source = 'all') => {
  const clsNews = await safeReadJson('news_cls.json');
  const filterNews = await safeReadJson('news_newsfilter.json');
  const items = [...clsNews, ...filterNews]
    .filter((item) => source === 'all' || item.source === source)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    .slice(0, limit);
  return items;
};

const getResearchReports = async () => {
  const manifest = await safeReadJson('research_reports_manifest.json');
  if (!Array.isArray(manifest)) return [];
  return manifest.map((item) => ({
    ...item,
    filePath: getReportFilePath(item.relativePath),
    readAdvice: getFileReadAdvice(item.previewType),
  }));
};

const getResearchReportContent = async (reportId) => {
  const reports = await getResearchReports();
  const target = reports.find((item) => item.id === reportId);
  if (!target) {
    return { found: false, report: null, content: null };
  }

  if (target.previewType !== 'text') {
    return {
      found: true,
      report: target,
      content: null,
      note: 'This file type is not text-readable in MCP. Prefer direct file reading with an AI model that supports this format.',
    };
  }

  try {
    const filePath = getReportFilePath(target.relativePath);
    const content = await readFile(filePath, 'utf8');
    return {
      found: true,
      report: target,
      filePath,
      content,
    };
  } catch (error) {
    return {
      found: true,
      report: target,
      filePath: getReportFilePath(target.relativePath),
      content: null,
      note: error instanceof Error ? error.message : String(error),
    };
  }
};

const getExpertHoldingSnapshots = async () => {
  const snapshots = await safeReadJson('expert_holding_snapshots.json');
  if (!Array.isArray(snapshots)) return [];
  return snapshots
    .filter((item) => item && typeof item === 'object' && item.id && item.date && Array.isArray(item.records))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .map((item) => ({
      id: item.id,
      date: item.date,
      fileName: item.fileName,
      filePath: path.join(ROOT_DIR, '草原高手数据', item.fileName),
      recordCount: item.recordCount,
      groups: Array.isArray(item.groups) ? item.groups : [],
      positiveDailyCount: Array.isArray(item.records)
        ? item.records.filter((record) => typeof record?.dailyReturnPct === 'number' && record.dailyReturnPct > 0).length
        : 0,
      emptyPositionCount: Array.isArray(item.records)
        ? item.records.filter((record) => /空仓|无/.test(String(record?.holdings ?? ''))).length
        : 0,
      readAdvice: {
        recommendedMode: 'structured_data',
        note: 'This CSV has already been normalized into structured MCP data and is better analyzed as table data.',
      },
    }));
};

const getExpertHoldingSnapshotDetail = async (snapshotId) => {
  const snapshots = await safeReadJson('expert_holding_snapshots.json');
  if (!Array.isArray(snapshots)) {
    return {
      found: false,
      snapshotId,
      note: 'expert_holding_snapshots.json is missing or invalid.',
    };
  }

  const target = snapshots.find((item) => item?.id === snapshotId || item?.date === snapshotId);
  if (!target) {
    return {
      found: false,
      snapshotId,
      note: 'No expert holding snapshot matched the provided snapshotId/date.',
    };
  }

  const records = Array.isArray(target.records) ? target.records : [];
  return {
    found: true,
    id: target.id,
    date: target.date,
    fileName: target.fileName,
    filePath: path.join(ROOT_DIR, '草原高手数据', target.fileName),
    recordCount: target.recordCount,
    groups: Array.isArray(target.groups) ? target.groups : [],
    positiveDailyCount: records.filter((record) => typeof record?.dailyReturnPct === 'number' && record.dailyReturnPct > 0).length,
    negativeDailyCount: records.filter((record) => typeof record?.dailyReturnPct === 'number' && record.dailyReturnPct < 0).length,
    emptyPositionCount: records.filter((record) => /空仓|无/.test(String(record?.holdings ?? ''))).length,
    topDailyWinners: [...records]
      .filter((record) => typeof record?.dailyReturnPct === 'number')
      .sort((a, b) => (b.dailyReturnPct ?? -Infinity) - (a.dailyReturnPct ?? -Infinity))
      .slice(0, 5),
    topDailyLosers: [...records]
      .filter((record) => typeof record?.dailyReturnPct === 'number')
      .sort((a, b) => (a.dailyReturnPct ?? Infinity) - (b.dailyReturnPct ?? Infinity))
      .slice(0, 5),
    readAdvice: {
      recommendedMode: 'structured_data',
      note: 'This dataset is already normalized and is best analyzed as structured holdings data.',
    },
    records,
  };
};

const buildMarketDashboard = async () => {
  const tradingDates = await getRecentTradingDates(3);
  const latestTradingDate = tradingDates[tradingDates.length - 1];
  const latestPool = await fetchLimitUpPool(latestTradingDate);
  const structure = buildStructure(latestPool);
  const [repair, leaderHistory, sectorPersistence, news, volumeTrend, highRisk] = await Promise.all([
    buildRepairSnapshot(),
    buildLeaderState(5),
    buildSectorPersistence('concept'),
    getNewsFeed(10, 'all'),
    buildVolumeTrend(),
    buildHighRiskHistory(6),
  ]);
  const latestLeader = leaderHistory[leaderHistory.length - 1] ?? null;
  const latestVolume = volumeTrend[volumeTrend.length - 1] ?? null;
  const previousVolume = volumeTrend[volumeTrend.length - 2] ?? null;
  const latestRisk = highRisk[highRisk.length - 1] ?? null;

  const volumeState =
    latestVolume && previousVolume && latestVolume.changeRate !== null && previousVolume.changeRate !== null
      ? latestVolume.changeRate > 0 && previousVolume.changeRate > 0
        ? '持续放量'
        : latestVolume.changeRate < 0 && previousVolume.changeRate < 0
          ? '缩量再缩量'
          : latestVolume.changeRate > 0 && latestLeader && (latestLeader.nextClosePct ?? 0) < 0
            ? '放量滞涨'
            : '存量震荡'
      : '存量震荡';

  let cycleStage = '分歧';
  const cycleReasons = [];
  if ((latestRisk?.riskLevel === 'high') || ((latestLeader?.nextClosePct ?? 0) <= -5) || ((repair?.brokenRepairRate ?? 0) < 20)) {
    cycleStage = '退潮';
    cycleReasons.push('高位负反馈明显');
  } else if ((latestLeader?.leaderBoardCount ?? 0) <= 2 && structure.totalLimitUpCount < 20) {
    cycleStage = '冰点';
    cycleReasons.push('高度和涨停家数偏低');
  } else if ((repair?.brokenRepairRate ?? 0) >= 35 && (latestLeader?.nextClosePct ?? -99) >= 0 && volumeState !== '缩量再缩量') {
    cycleStage = '修复';
    cycleReasons.push('修复率回升，龙头反馈转正');
  } else if ((latestLeader?.leaderBoardCount ?? 0) >= 5 && structure.highBoardCount >= 3 && volumeState !== '缩量再缩量') {
    cycleStage = '主升';
    cycleReasons.push('高标梯队完整，量能未走弱');
  } else if (structure.firstBoardRatio >= 60 || (latestLeader?.leaderBoardCount ?? 0) <= 4) {
    cycleStage = '试错';
    cycleReasons.push('首板占比较高，低位试错明显');
  }
  if (volumeState === '持续放量') cycleReasons.push('量能持续抬升');
  if (volumeState === '缩量再缩量') cycleReasons.push('量能连续回落');
  if ((latestRisk?.aKillCount ?? 0) > 0) cycleReasons.push(`高位A杀 ${latestRisk.aKillCount} 家`);

  const cycleOverview = {
    stage: cycleStage,
    confidence: Math.min(95, (cycleStage === '退潮' ? 78 : cycleStage === '主升' ? 74 : cycleStage === '修复' ? 68 : 62) + (latestRisk?.riskLevel === 'high' ? 8 : 4)),
    riskLevel: latestRisk?.riskLevel === 'high' ? '高风险' : latestRisk?.riskLevel === 'medium' ? '中风险' : '低风险',
    volumeState,
    latestVolumeAmount: latestVolume?.amount ?? null,
    volumeChangeRate: latestVolume?.changeRate ?? null,
    reasons: cycleReasons.slice(0, 3),
  };

  return {
    generatedAt: new Date().toISOString(),
    latestTradingDate,
    cycleOverview,
    structure,
    repair,
    volumeTrend,
    highRisk,
    leader: latestLeader,
    sectorPersistence,
    newsSummary: news.map((item) => ({
      title: item.title,
      source: item.source,
      time: item.time,
      sentiment: item.sentiment,
      type: item.type,
      url: item.url || null,
    })),
  };
};

const toToolResult = (title, data) => ({
  content: [
    {
      type: 'text',
      text: `${title}\n${JSON.stringify(data, null, 2).slice(0, 12000)}`,
    },
  ],
  structuredContent: data,
});

server.registerTool(
  'get_market_dashboard',
  {
    description: 'Get the latest A-share market dashboard snapshot for AI analysis.',
    inputSchema: {},
  },
  async () => {
    const snapshot = await buildMarketDashboard();
    return toToolResult('market_dashboard', snapshot);
  }
);

server.registerTool(
  'get_leader_state',
  {
    description: 'Get recent leader-state history based on the highest limit-up ladder stocks.',
    inputSchema: {
      days: z.number().int().min(3).max(10).optional(),
    },
  },
  async ({ days = 5 }) => {
    const data = await buildLeaderState(days);
    return toToolResult('leader_state', { days, entries: data });
  }
);

server.registerTool(
  'get_sector_persistence',
  {
    description: 'Get sector persistence summary for concept or industry boards.',
    inputSchema: {
      boardType: z.enum(['concept', 'industry']).optional(),
    },
  },
  async ({ boardType = 'concept' }) => {
    const data = await buildSectorPersistence(boardType);
    return toToolResult('sector_persistence', data);
  }
);

server.registerTool(
  'get_cycle_overview',
  {
    description: 'Get the current market cycle overview, including stage, confidence, risk level, and core reasons.',
    inputSchema: {},
  },
  async () => {
    const dashboard = await buildMarketDashboard();
    return toToolResult('cycle_overview', dashboard.cycleOverview);
  }
);

server.registerTool(
  'get_volume_trend',
  {
    description: 'Get recent market volume trend data and interpreted volume state.',
    inputSchema: {},
  },
  async () => {
    const dashboard = await buildMarketDashboard();
    return toToolResult('volume_trend', {
      volumeState: dashboard.cycleOverview.volumeState,
      latestVolumeAmount: dashboard.cycleOverview.latestVolumeAmount,
      volumeChangeRate: dashboard.cycleOverview.volumeChangeRate,
      entries: dashboard.volumeTrend,
    });
  }
);

server.registerTool(
  'get_high_risk_panel',
  {
    description: 'Get recent high-risk panel data for high-board weakness, A-kill counts, and broken-board spread.',
    inputSchema: {},
  },
  async () => {
    const dashboard = await buildMarketDashboard();
    return toToolResult('high_risk_panel', {
      riskLevel: dashboard.cycleOverview.riskLevel,
      entries: dashboard.highRisk,
    });
  }
);

server.registerTool(
  'get_sentiment_snapshot',
  {
    description: 'Get a structured sentiment-cycle snapshot for one trading day, including coefficient, premium, broken rate, structure, repair, leader, board height, and emotion indicators.',
    inputSchema: {
      date: z.string().optional(),
    },
  },
  async ({ date }) => {
    const snapshot = await buildSentimentSnapshot(date);
    return toToolResult('sentiment_snapshot', snapshot);
  }
);

server.registerTool(
  'get_news_feed',
  {
    description: 'Read local intraday news gathered by this project.',
    inputSchema: {
      limit: z.number().int().min(1).max(100).optional(),
      source: z.string().optional(),
    },
  },
  async ({ limit = 20, source = 'all' }) => {
    const items = await getNewsFeed(limit, source);
    return toToolResult('news_feed', {
      count: items.length,
      items,
    });
  }
);

server.registerTool(
  'get_research_reports',
  {
    description: 'List locally managed research report files from the research_reports folder.',
    inputSchema: {},
  },
  async () => {
    const reports = await getResearchReports();
    return toToolResult('research_reports', {
      count: reports.length,
      items: reports,
    });
  }
);

server.registerTool(
  'get_research_report_content',
  {
    description: 'Read a text-based research report by id. Non-text formats return metadata and an explanatory note.',
    inputSchema: {
      reportId: z.string().min(1),
    },
  },
  async ({ reportId }) => {
    const result = await getResearchReportContent(reportId);
    return toToolResult('research_report_content', result);
  }
);

server.registerTool(
  'get_expert_holding_snapshots',
  {
    description: 'List synced 草原高手 CSV snapshots, with dates, group coverage, and quick summary counts.',
    inputSchema: {},
  },
  async () => {
    const snapshots = await getExpertHoldingSnapshots();
    return toToolResult('expert_holding_snapshots', {
      count: snapshots.length,
      items: snapshots,
    });
  }
);

server.registerTool(
  'get_expert_holding_snapshot',
  {
    description: 'Read one 草原高手 holding snapshot by date or snapshot id, including full records and summary leaders.',
    inputSchema: {
      snapshotId: z.string().min(1),
    },
  },
  async ({ snapshotId }) => {
    const result = await getExpertHoldingSnapshotDetail(snapshotId);
    return toToolResult('expert_holding_snapshot', result);
  }
);

const main = async () => {
  if (process.env.MCP_DRY_RUN === '1') {
    process.stdout.write('mcp-server-ok');
    return;
  }
  const transport = new StdioServerTransport();
  await server.connect(transport);
};

main().catch((error) => {
  console.error('MCP server error:', error);
  process.exit(1);
});
