import fs from 'fs/promises';
import { ensureParentDir, resolveDataReadCandidates, resolveDataWritePath } from './dataPaths.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const DEFAULT_STAGE_RETRIES = Math.max(1, Number(process.env.SYNC_STAGE_RETRIES ?? '') || 2);
const DEFAULT_RETRY_DELAY_MS = Math.max(0, Number(process.env.SYNC_RETRY_DELAY_MS ?? '') || 1500);
const SELECTED_STAGE_KEYS = new Set(
  String(process.env.SYNC_STAGES ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean),
);

const normalizeDate = (value) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseIsoDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const getEmotionTargetDate = (onlineTradingDate) => {
  const parsed = parseIsoDate(onlineTradingDate);
  if (!parsed) return null;

  const cursor = new Date(parsed);
  do {
    cursor.setDate(cursor.getDate() - 1);
  } while (cursor.getDay() === 0 || cursor.getDay() === 6);

  return normalizeDate(cursor);
};

export const shouldIncludeStage = (key) => {
  if (!SELECTED_STAGE_KEYS.size) return true;
  return SELECTED_STAGE_KEYS.has(String(key ?? '').toLowerCase());
};

export const readJsonFile = async (fileName) => {
  for (const candidate of resolveDataReadCandidates(fileName)) {
    try {
      const raw = await fs.readFile(candidate, 'utf-8');
      return JSON.parse(raw);
    } catch {
      // try next candidate
    }
  }
  try {
    return null;
  } catch {
    return null;
  }
};

export const writeJsonFile = async (fileName, payload) => {
  const outputPath = resolveDataWritePath(fileName, fileName === 'sync_status.json' ? 'system' : 'auto');
  await ensureParentDir(outputPath);
  await fs.writeFile(
    outputPath,
    JSON.stringify(payload, null, 2) + '\n',
    'utf-8',
  );
};

export const getFileDateStamp = async (fileName) => {
  for (const candidate of resolveDataReadCandidates(fileName)) {
    try {
      const stats = await fs.stat(candidate);
      return normalizeDate(stats.mtime);
    } catch {
      // try next candidate
    }
  }
  return null;
};

export const getLatestOnlineTradingDate = async () => {
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
    throw new Error(`Failed to fetch latest trading date: HTTP ${res.status}`);
  }
  const data = await res.json();
  const latest = data?.data?.klines?.[0];
  if (!latest) {
    throw new Error('Latest trading date missing from EastMoney response');
  }
  const [dateStr] = String(latest).split(',');
  if (!dateStr) {
    throw new Error('Unable to parse latest trading date');
  }
  return dateStr;
};

const parseMonthDay = (value, referenceDate = new Date()) => {
  if (typeof value !== 'string' || !/^\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [month, day] = value.split('-').map(Number);
  if (!Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  let year = referenceDate.getFullYear();
  const candidate = new Date(year, month - 1, day);
  if (
    Number.isNaN(candidate.getTime()) ||
    candidate.getMonth() !== month - 1 ||
    candidate.getDate() !== day
  ) {
    return null;
  }

  if (normalizeDate(candidate) > normalizeDate(referenceDate)) {
    year -= 1;
  }

  const resolved = new Date(year, month - 1, day);
  return Number.isNaN(resolved.getTime()) ? null : resolved;
};

const getLatestRecordDate = (payload) => {
  if (!Array.isArray(payload) || payload.length === 0) {
    return null;
  }
  return typeof payload.at(-1)?.date === 'string' ? payload.at(-1).date : null;
};

const inferLocalSyncContext = async () => {
  const [sentiment, performance, emotion, leaderState] = await Promise.all([
    readJsonFile('sentiment.json'),
    readJsonFile('performance.json'),
    readJsonFile('emotion_indicators.json'),
    readJsonFile('leader_state.json'),
  ]);

  const sentimentDate = getLatestRecordDate(sentiment);
  const emotionDate = getLatestRecordDate(emotion);
  const performanceDate = getLatestRecordDate(performance);
  const cycleDate = getLatestRecordDate(leaderState);

  const isoCandidates = [sentimentDate, emotionDate]
    .map((value) => parseIsoDate(value))
    .filter(Boolean)
    .sort((left, right) => right.getTime() - left.getTime());

  const monthDayCandidates = [performanceDate, cycleDate]
    .map((value) => parseMonthDay(value))
    .filter(Boolean)
    .sort((left, right) => right.getTime() - left.getTime());

  const onlineTradingDate = isoCandidates[0]
    ? normalizeDate(isoCandidates[0])
    : null;
  const onlineMonthDay = onlineTradingDate?.slice(5)
    ?? (monthDayCandidates[0] ? normalizeDate(monthDayCandidates[0]).slice(5) : null);
  const emotionTargetDate = onlineTradingDate
    ? getEmotionTargetDate(onlineTradingDate)
    : null;

  if (!onlineTradingDate && !onlineMonthDay) {
    return null;
  }

  return {
    onlineTradingDate,
    onlineMonthDay,
    emotionTargetDate,
    source: 'local-fallback',
  };
};

export const getOrCreateSyncContext = async (context = {}) => {
  let onlineTradingDate = context.onlineTradingDate ?? null;

  if (!onlineTradingDate) {
    try {
      onlineTradingDate = await getLatestOnlineTradingDate();
    } catch (error) {
      const fallbackContext = await inferLocalSyncContext();
      if (!fallbackContext?.onlineTradingDate) {
        throw error;
      }
      console.warn(
        '[sync] Failed to fetch latest online trading date, falling back to local snapshot context:',
        error instanceof Error ? error.message : error,
      );
      return {
        ...fallbackContext,
        ...context,
        onlineTradingDate: fallbackContext.onlineTradingDate,
        onlineMonthDay: context.onlineMonthDay ?? fallbackContext.onlineMonthDay,
        emotionTargetDate: context.emotionTargetDate ?? fallbackContext.emotionTargetDate,
      };
    }
  }

  return {
    ...context,
    onlineTradingDate,
    onlineMonthDay: context.onlineMonthDay ?? onlineTradingDate.slice(5),
    emotionTargetDate: context.emotionTargetDate ?? getEmotionTargetDate(onlineTradingDate),
  };
};

const normalizeShouldRunResult = (value) => {
  if (value === false) return { run: false, reason: 'condition returned false' };
  if (value === true || value === undefined || value === null) return { run: true, reason: null };
  if (typeof value === 'string') return { run: false, reason: value };
  if (typeof value === 'object' && 'run' in value) {
    return {
      run: Boolean(value.run),
      reason: value.reason ?? null,
    };
  }
  return { run: Boolean(value), reason: null };
};

export const runStage = async (name, task, options = {}) => {
  const retries = Math.max(1, options.retries ?? DEFAULT_STAGE_RETRIES);
  const retryDelayMs = Math.max(0, options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS);
  let lastError = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    const startedAt = Date.now();
    console.log(`[sync] ${name} started (${attempt}/${retries})`);
    try {
      const result = await task();
      const durationMs = Date.now() - startedAt;
      console.log(`[sync] ${name} completed in ${(durationMs / 1000).toFixed(1)}s`);
      return result;
    } catch (error) {
      lastError = error;
      const durationMs = Date.now() - startedAt;
      console.error(
        `[sync] ${name} failed in ${(durationMs / 1000).toFixed(1)}s (${attempt}/${retries}):`,
        error instanceof Error ? error.message : error,
      );
      if (attempt < retries && retryDelayMs > 0) {
        await sleep(retryDelayMs * attempt);
      }
    }
  }

  throw lastError ?? new Error(`${name} failed`);
};

export const printStageSummary = (summary, label = 'sync') => {
  const completed = summary.filter((item) => item.status === 'completed');
  const skipped = summary.filter((item) => item.status === 'skipped');
  const failed = summary.filter((item) => item.status === 'failed');

  console.log(
    `[${label}] summary: completed=${completed.length} skipped=${skipped.length} failed=${failed.length}`,
  );

  if (completed.length) {
    console.log(
      `[${label}] completed: ${completed.map((item) => item.name).join(', ')}`,
    );
  }
  if (skipped.length) {
    console.log(
      `[${label}] skipped: ${skipped
        .map((item) => `${item.name}${item.reason ? ` (${item.reason})` : ''}`)
        .join(', ')}`,
    );
  }
  if (failed.length) {
    console.log(
      `[${label}] failed: ${failed
        .map((item) => `${item.name}${item.reason ? ` (${item.reason})` : ''}`)
        .join(', ')}`,
    );
  }
};

const collectLatestSnapshotDates = async () => {
  const [
    sentiment,
    performance,
    emotion,
    leaderState,
    klineManifest,
  ] = await Promise.all([
    readJsonFile('sentiment.json'),
    readJsonFile('performance.json'),
    readJsonFile('emotion_indicators.json'),
    readJsonFile('leader_state.json'),
    readJsonFile('kline-manifest.json'),
  ]);

  return {
    sentiment: Array.isArray(sentiment) ? sentiment.at(-1)?.date ?? null : null,
    performance: Array.isArray(performance) ? performance.at(-1)?.date ?? null : null,
    emotion: Array.isArray(emotion) ? emotion.at(-1)?.date ?? null : null,
    cycle: Array.isArray(leaderState) ? leaderState.at(-1)?.date ?? null : null,
    klineManifestCount: Array.isArray(klineManifest) ? klineManifest.length : 0,
    klineManifestStamp: await getFileDateStamp('kline-manifest.json'),
  };
};

export const writeSyncStatus = async ({
  trigger = 'sync',
  context = {},
  summary = [],
  startedAt,
  finishedAt,
  extra = {},
} = {}) => {
  const completed = summary.filter((item) => item.status === 'completed').length;
  const skipped = summary.filter((item) => item.status === 'skipped').length;
  const failed = summary.filter((item) => item.status === 'failed').length;
  const payload = {
    trigger,
    startedAt: new Date(startedAt ?? Date.now()).toISOString(),
    finishedAt: new Date(finishedAt ?? Date.now()).toISOString(),
    durationMs: Math.max(0, (finishedAt ?? Date.now()) - (startedAt ?? Date.now())),
    updatedAt: new Date().toISOString(),
    overallStatus: failed > 0 ? 'failed' : 'completed',
    counts: {
      completed,
      skipped,
      failed,
      total: summary.length,
    },
    onlineTradingDate: context.onlineTradingDate ?? null,
    onlineMonthDay: context.onlineMonthDay ?? null,
    latestSnapshots: await collectLatestSnapshotDates(),
    stages: summary.map((item) => ({
      key: item.key,
      name: item.name,
      status: item.status,
      reason: item.reason ?? null,
      startedAt: item.startedAt ?? null,
      finishedAt: item.finishedAt ?? null,
      durationMs: item.durationMs ?? null,
    })),
    extra,
  };

  await writeJsonFile('sync_status.json', payload);
  return payload;
};

export const runStagesSequentially = async (stages, options = {}) => {
  const summary = [];
  let context = options.context ?? {};
  const startedAt = Date.now();

  if (options.resolveContext) {
    context = await options.resolveContext(context);
  }

  for (const stage of stages) {
    if (stage.key && !shouldIncludeStage(stage.key)) {
      console.log(`[sync] ${stage.name} skipped by SYNC_STAGES filter`);
      summary.push({
        key: stage.key ?? stage.name,
        name: stage.name,
        status: 'skipped',
        reason: 'filtered by SYNC_STAGES',
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs: 0,
      });
      continue;
    }

    if (stage.shouldRun) {
      const decision = normalizeShouldRunResult(await stage.shouldRun(context));
      if (!decision.run) {
        const nowIso = new Date().toISOString();
        console.log(
          `[sync] ${stage.name} skipped${decision.reason ? `: ${decision.reason}` : ''}`,
        );
        summary.push({
          key: stage.key ?? stage.name,
          name: stage.name,
          status: 'skipped',
          reason: decision.reason ?? null,
          startedAt: nowIso,
          finishedAt: nowIso,
          durationMs: 0,
        });
        continue;
      }
    }

    const stageStartedAt = Date.now();
    try {
      await runStage(stage.name, () => stage.run(context), {
        retries: stage.retries ?? options.retries,
        retryDelayMs: stage.retryDelayMs ?? options.retryDelayMs,
      });
      const stageFinishedAt = Date.now();
      summary.push({
        key: stage.key ?? stage.name,
        name: stage.name,
        status: 'completed',
        reason: null,
        startedAt: new Date(stageStartedAt).toISOString(),
        finishedAt: new Date(stageFinishedAt).toISOString(),
        durationMs: stageFinishedAt - stageStartedAt,
      });
    } catch (error) {
      const stageFinishedAt = Date.now();
      const failure = {
        key: stage.key ?? stage.name,
        name: stage.name,
        status: 'failed',
        reason: error instanceof Error ? error.message : String(error),
        error: error instanceof Error ? error : new Error(String(error)),
        startedAt: new Date(stageStartedAt).toISOString(),
        finishedAt: new Date(stageFinishedAt).toISOString(),
        durationMs: stageFinishedAt - stageStartedAt,
      };
      summary.push(failure);
      if (!options.continueOnError) {
        if (options.printSummaryOnError) {
          printStageSummary(summary, options.summaryLabel ?? 'sync');
        }
        if (options.writeStatus) {
          await writeSyncStatus({
            trigger: options.summaryLabel ?? 'sync',
            context,
            summary,
            startedAt,
            finishedAt: Date.now(),
            extra: options.statusExtra ?? {},
          });
        }
        throw failure.error;
      }
    }
  }

  if (options.printSummary) {
    printStageSummary(summary, options.summaryLabel ?? 'sync');
  }

  if (options.writeStatus) {
    await writeSyncStatus({
      trigger: options.summaryLabel ?? 'sync',
      context,
      summary,
      startedAt,
      finishedAt: Date.now(),
      extra: options.statusExtra ?? {},
    });
  }

  return summary;
};
