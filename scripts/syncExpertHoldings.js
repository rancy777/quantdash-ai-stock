import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const SOURCE_DIR = path.join(ROOT_DIR, '草原高手数据');
const OUTPUT_PATH = path.join(ROOT_DIR, 'data', 'expert_holding_snapshots.json');

const CSV_PREFIX = '复利杯高手持仓记录_';

const parseNumber = (value) => {
  const normalized = String(value ?? '').replace(/,/g, '').trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? null : parsed;
};

const parsePercent = (value) => {
  const normalized = String(value ?? '').replace('%', '').trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? null : parsed;
};

const parseCsvLine = (line) => {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  result.push(current);
  return result.map((item) => item.trim());
};

const normalizeDateFromFileName = (fileName) => {
  const match = fileName.match(/(\d{8})/);
  if (!match) return null;
  const raw = match[1];
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
};

const buildSnapshotFromCsv = async (fullPath) => {
  const fileName = path.basename(fullPath);
  const date = normalizeDateFromFileName(fileName);
  if (!date) return null;

  const raw = await fs.readFile(fullPath, 'utf8');
  const lines = raw
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length <= 1) {
    return {
      id: date,
      date,
      fileName,
      recordCount: 0,
      groups: [],
      records: [],
    };
  }

  const records = lines.slice(1).map((line) => {
    const [group, nickname, assetScaleWan, dailyReturnPct, weeklyReturnPct, holdings, notes] = parseCsvLine(line);
    return {
      group: group || '未知组别',
      nickname: nickname || '未知昵称',
      assetScaleWan: parseNumber(assetScaleWan),
      dailyReturnPct: parsePercent(dailyReturnPct),
      weeklyReturnPct: parsePercent(weeklyReturnPct),
      holdings: holdings || '',
      notes: notes || '',
    };
  });

  const groups = [...new Set(records.map((item) => item.group))];

  return {
    id: date,
    date,
    fileName,
    recordCount: records.length,
    groups,
    records,
  };
};

const syncExpertHoldings = async () => {
  let files = [];
  try {
    files = await fs.readdir(SOURCE_DIR);
  } catch (error) {
    console.error(`Failed to read ${SOURCE_DIR}:`, error);
    process.exit(1);
  }

  const csvFiles = files
    .filter((name) => name.startsWith(CSV_PREFIX) && name.toLowerCase().endsWith('.csv'))
    .sort();

  const snapshots = [];
  for (const fileName of csvFiles) {
    const fullPath = path.join(SOURCE_DIR, fileName);
    const snapshot = await buildSnapshotFromCsv(fullPath);
    if (snapshot) snapshots.push(snapshot);
  }

  snapshots.sort((a, b) => b.date.localeCompare(a.date));
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(snapshots, null, 2), 'utf8');
  console.log(`Synced ${snapshots.length} expert holding snapshots to ${OUTPUT_PATH}`);
};

syncExpertHoldings().catch((error) => {
  console.error('Failed to sync expert holdings:', error);
  process.exit(1);
});
