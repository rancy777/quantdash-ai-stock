import { ModelProviderConfig, ReportAISummaryEntry, ResearchReportFile } from '../types';
import { resolveScreenerApiBase } from './apiConfig';
import {
  getEnabledSkillsForScope,
  loadAIIntegrationSettings,
  renderPromptTemplate,
  renderSkillInstructions,
} from './modelIntegrationService';

const REPORT_AI_SUMMARY_STORAGE_KEY = 'quantdash:report-ai-summaries';
const MODEL_INVOKE_ENDPOINT = `${resolveScreenerApiBase()}/integrations/model/invoke`;

type SummaryRequestPayload = {
  report: ResearchReportFile;
  reportText: string | null;
  providerId?: string | null;
};

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const getStoredSummaryEntries = (): ReportAISummaryEntry[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(REPORT_AI_SUMMARY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ReportAISummaryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveStoredSummaryEntries = (entries: ReportAISummaryEntry[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(REPORT_AI_SUMMARY_STORAGE_KEY, JSON.stringify(entries));
};

const appendSkillInstructions = (prompt: string, instructions: string): string =>
  instructions
    ? `${prompt}\n\n五、启用的 Skills\n${instructions}\n\n请执行以上 Skills 的约束，但不要编造研报正文里不存在的内容。`
    : prompt;

const buildReportPrompt = (
  report: ResearchReportFile,
  reportText: string | null,
  template: string
): { prompt: string; mode: 'fulltext' | 'metadata' } => {
  const summary = report.summary?.trim() ?? '';
  const text = reportText?.trim() ?? '';
  const contentMode = text ? 'fulltext' : 'metadata';
  const contentBlock = text
    ? text.slice(0, 12000)
    : [
        `标题: ${report.title ?? report.name}`,
        `来源: ${report.sourceLabel ?? '未知'}`,
        report.orgName ? `机构: ${report.orgName}` : '',
        report.researcher ? `作者: ${report.researcher}` : '',
        report.stockCode ? `股票代码: ${report.stockCode}` : '',
        report.stockName ? `股票名称: ${report.stockName}` : '',
        report.rating ? `评级: ${report.rating}` : '',
        report.industryName ? `行业: ${report.industryName}` : '',
        report.category ? `分类: ${report.category}` : '',
        report.tags?.length ? `标签: ${report.tags.join('、')}` : '',
        summary ? `现有摘要: ${summary}` : '',
      ]
        .filter(Boolean)
        .join('\n');

  const prompt = renderPromptTemplate(template, {
    reportTitle: report.title ?? report.name,
    sourceLabel: report.sourceLabel ?? '未知',
    orgLine: report.orgName ? `机构: ${report.orgName}` : '',
    researcherLine: report.researcher ? `作者: ${report.researcher}` : '',
    ratingLine: report.rating ? `评级: ${report.rating}` : '',
    contentBlock: contentBlock || '暂无正文，只能依据元数据摘要。',
  });

  return {
    prompt,
    mode: contentMode,
  };
};

const summarizeWithProvider = async (
  provider: ModelProviderConfig,
  prompt: string
): Promise<string> => {
  const response = await fetch(MODEL_INVOKE_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      providerKey: provider.providerKey,
      protocol: provider.protocol,
      baseUrl: trimTrailingSlash(provider.baseUrl),
      apiKey: provider.apiKey,
      model: provider.model,
      systemPrompt: '你是专业的中文证券研究助理，擅长把研报压缩成高质量摘要。',
      userPrompt: prompt,
      temperature: 0.2,
      maxTokens: 1200,
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `模型请求失败: ${response.status}`);
  }
  const payload = await response.json() as { content?: string };
  return payload.content?.trim() ?? '';
};

export const getEnabledSummaryProviders = (): ModelProviderConfig[] => {
  const settings = loadAIIntegrationSettings();
  return settings.providers.filter((item) => item.enabled);
};

export const getCachedReportAISummary = (
  reportId: string,
  providerId: string
): ReportAISummaryEntry | null =>
  getStoredSummaryEntries().find((item) => item.reportId === reportId && item.providerId === providerId) ?? null;

export const generateReportAISummary = async ({
  report,
  reportText,
  providerId,
}: SummaryRequestPayload): Promise<ReportAISummaryEntry> => {
  const settings = loadAIIntegrationSettings();
  const provider =
    settings.providers.find((item) => item.id === providerId) ??
    settings.providers.find((item) => item.id === settings.preferredProviderId) ??
    settings.providers.find((item) => item.enabled);

  if (!provider) {
    throw new Error('没有可用的 AI 模型线路，请先到 AI对接 页面启用至少一条线路。');
  }

  if (!provider.baseUrl || !provider.model) {
    throw new Error(`模型线路 ${provider.displayName} 缺少 baseUrl 或 model 配置。`);
  }

  const { prompt, mode } = buildReportPrompt(report, reportText, settings.promptTemplates.reportSummary);
  const finalPrompt = appendSkillInstructions(
    prompt,
    renderSkillInstructions(getEnabledSkillsForScope(settings, 'reportSummary'))
  );
  const summary = (await summarizeWithProvider(provider, finalPrompt)).trim();
  if (!summary) {
    throw new Error(`模型 ${provider.displayName} 没有返回可用摘要。`);
  }

  const entry: ReportAISummaryEntry = {
    id: `${report.id}:${provider.id}`,
    reportId: report.id,
    providerId: provider.id,
    providerName: provider.displayName,
    summary,
    generatedAt: new Date().toISOString(),
    contentMode: mode,
  };

  const nextEntries = [
    entry,
    ...getStoredSummaryEntries().filter((item) => !(item.reportId === report.id && item.providerId === provider.id)),
  ];
  saveStoredSummaryEntries(nextEntries);
  return entry;
};
