const SYSTEM_FILE_NAMES = new Set(['sync_status.json', 'auth.db']);
const REPORT_MANIFEST_FILE_NAMES = new Set(['research_reports_manifest.json', 'research_reports/a_share/manifest.json']);

const normalizePath = (value: string): string => value.replace(/^\/+/, '').replace(/\\/g, '/');
const resolvePrimaryJsonPath = (normalized: string): string => {
  if (REPORT_MANIFEST_FILE_NAMES.has(normalized)) {
    return 'research_reports/a_share/manifest.json';
  }

  if (SYSTEM_FILE_NAMES.has(normalized)) {
    return `system/${normalized}`;
  }

  if (normalized.startsWith('markets/') || normalized.startsWith('system/') || normalized.startsWith('research_reports/')) {
    return normalized;
  }

  return `markets/a_share/${normalized}`;
};

export const getJsonCandidatePaths = (fileName: string): string[] => {
  const normalized = normalizePath(fileName);
  const primary = resolvePrimaryJsonPath(normalized);
  if (primary === normalized) {
    return [primary];
  }
  return [primary, normalized];
};

export const getReportUrlCandidates = (value?: string | null): string[] => {
  if (!value) return [];
  const normalized = value.replace(/\\/g, '/');
  const deduped = new Set<string>([normalized]);

  if (normalized.startsWith('/research_reports/')) {
    deduped.add(normalized.replace('/research_reports/', '/research_reports/a_share/'));
  } else if (normalized.startsWith('/research_reports/a_share/')) {
    deduped.add(normalized.replace('/research_reports/a_share/', '/research_reports/'));
  }

  return Array.from(deduped);
};
