import { ResearchReportFile } from '../types';
import { loadLocalJsonFile } from './localDataService';
import { getReportUrlCandidates } from './dataPathService';
import { listUploadedResearchReports, loadUploadedResearchReportText } from './reportUploadService';

const REPORT_MANIFEST = 'research_reports/a_share/manifest.json';

const normalizeLocalReportUrl = (value?: string | null) => {
  const candidates = getReportUrlCandidates(value);
  const encoded = candidates
    .map((candidate) => {
      const [pathname, search = ''] = candidate.split('?');
      const encodedPath = pathname
        .split('/')
        .map((segment, index) => {
          if (index === 0 || segment.length === 0) return segment;
          try {
            return encodeURIComponent(decodeURIComponent(segment));
          } catch {
            return encodeURIComponent(segment);
          }
        })
        .join('/');
      return search ? `${encodedPath}?${search}` : encodedPath;
    })
    .find(Boolean);
  return encoded ?? value ?? undefined;
};

const normalizeReport = (item: ResearchReportFile): ResearchReportFile => ({
  ...item,
  title: item.title || item.name.replace(/\.[^.]+$/, ''),
  publishedAt: item.publishedAt || item.updatedAt,
  sourceLabel: item.sourceLabel || (item.sourceType === 'upload' ? '手动上传' : '本地目录'),
  sourceKey: item.sourceKey || (item.sourceType === 'upload' ? 'manual-upload' : 'local-files'),
  category: item.category || (item.sourceType === 'upload' ? 'manual-upload' : 'local-files'),
  reportKind: item.reportKind || (item.sourceType === 'upload' ? 'upload' : 'file'),
  stockCode: item.stockCode,
  stockName: item.stockName,
  orgName: item.orgName,
  rating: item.rating,
  researcher: item.researcher,
  industryName: item.industryName,
  tags: item.tags ?? [],
  pdfUrl: item.pdfUrl,
  url: item.sourceType === 'upload' ? item.url : normalizeLocalReportUrl(item.url) ?? item.url,
  pdfLocalUrl: normalizeLocalReportUrl(item.pdfLocalUrl),
  pdfLocalPath: item.pdfLocalPath,
});

export const getResearchReports = async (): Promise<ResearchReportFile[]> => {
  const payload = await loadLocalJsonFile<ResearchReportFile[]>(REPORT_MANIFEST);
  const localReports = Array.isArray(payload)
    ? payload
        .filter((item): item is ResearchReportFile => Boolean(item?.id && item?.url && item?.name))
        .map(normalizeReport)
    : [];
  const uploadedReports = (await listUploadedResearchReports()).map(normalizeReport);

  return [...uploadedReports, ...localReports]
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
};

export const loadResearchReportText = async (report: ResearchReportFile): Promise<string | null> => {
  if (report.sourceType === 'upload') {
    return loadUploadedResearchReportText(report.id);
  }
  if (report.previewType !== 'text') return null;
  try {
    const response = await fetch(report.url, { cache: 'no-store' });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
};
