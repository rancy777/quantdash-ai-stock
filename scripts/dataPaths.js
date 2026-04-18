import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ROOT_DIR = path.resolve(__dirname, '..');
export const DATA_DIR = path.join(ROOT_DIR, 'data');
export const MARKETS_DIR = path.join(DATA_DIR, 'markets');
export const A_SHARE_DIR = path.join(MARKETS_DIR, 'a_share');
export const SYSTEM_DIR = path.join(DATA_DIR, 'system');
export const RESEARCH_REPORTS_DIR = path.join(DATA_DIR, 'research_reports');
export const A_SHARE_REPORTS_DIR = path.join(RESEARCH_REPORTS_DIR, 'a_share');

const SYSTEM_FILES = new Set(['sync_status.json', 'auth.db']);

const toPosix = (value) => String(value || '').replace(/\\/g, '/').replace(/^\/+/, '');

const buildCandidates = (fileName, kind = 'auto') => {
  const normalized = toPosix(fileName);
  if (!normalized) return [];

  if (kind === 'system' || (kind === 'auto' && SYSTEM_FILES.has(normalized))) {
    return [path.join(SYSTEM_DIR, normalized), path.join(DATA_DIR, normalized)];
  }

  if (kind === 'research-manifest' || normalized === 'research_reports_manifest.json' || normalized === 'research_reports/a_share/manifest.json') {
    return [
      path.join(A_SHARE_REPORTS_DIR, 'manifest.json'),
      path.join(DATA_DIR, 'research_reports_manifest.json'),
    ];
  }

  if (kind === 'research-dir') {
    return [path.join(A_SHARE_REPORTS_DIR, normalized)];
  }

  if (normalized.startsWith('markets/') || normalized.startsWith('system/') || normalized.startsWith('research_reports/')) {
    return [path.join(DATA_DIR, normalized)];
  }

  return [path.join(A_SHARE_DIR, normalized), path.join(DATA_DIR, normalized)];
};

export const resolveDataWritePath = (fileName, kind = 'auto') => buildCandidates(fileName, kind)[0];

export const resolveDataReadCandidates = (fileName, kind = 'auto') => buildCandidates(fileName, kind);

export const resolveExistingDataPath = async (fileName, kind = 'auto') => {
  const candidates = buildCandidates(fileName, kind);
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // ignore
    }
  }
  return candidates[0] ?? null;
};

export const ensureParentDir = async (filePath) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
};
