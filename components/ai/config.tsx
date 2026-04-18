import React from 'react';

import { AIPromptTemplateKey, ModelProviderMode, ModelProviderProtocol } from '../../types';

export const protocolOptions: { value: ModelProviderProtocol; label: string }[] = [
  { value: 'openai', label: 'OpenAI 兼容' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'custom', label: '自定义' },
];

export const providerTypeLabel: Record<ModelProviderMode, string> = {
  cloud: '云端模型',
  local: '本地模型',
};

export const SELECT_CLASS_NAME =
  'w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-cyan-500 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100';

export const PROVIDER_SELECT_CARD_CLASS_NAME =
  'w-full rounded-2xl border border-slate-200/80 bg-white px-4 py-3.5 text-left text-sm text-slate-900 shadow-[0_8px_24px_rgba(15,23,42,0.06)] outline-none transition hover:border-cyan-300 hover:shadow-[0_12px_30px_rgba(34,211,238,0.08)] focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100 dark:shadow-none dark:hover:border-cyan-500/30';

export const promptTemplateTabs: { key: AIPromptTemplateKey; label: string; hint: string }[] = [
  { key: 'reportSummary', label: '研报摘要模板', hint: '单篇研报摘要的默认提示词。' },
  { key: 'dailyReview', label: 'AI 当日复盘模板', hint: '最近交易日复盘的默认提示词。' },
  { key: 'ultraShortAnalysis', label: 'AI 超短线深度分析模板', hint: '偏 1 到 3 日节奏的超短博弈分析模板。' },
  { key: 'premarketPlan', label: '盘前计划模板', hint: '次日观察清单与交易预案的默认提示词。' },
  { key: 'stockObservation', label: '个股观察模板', hint: '预留给后续个股观察功能使用。' },
  { key: 'planValidation', label: '次日校验模板', hint: '用于评估盘前计划与次日实际盘面的偏差。' },
];

export const promptTemplateVariableHints: Record<AIPromptTemplateKey, string> = {
  reportSummary: '{{reportTitle}} {{sourceLabel}} {{orgLine}} {{researcherLine}} {{ratingLine}} {{contentBlock}}',
  dailyReview: '{{analysisDate}} {{stage}} {{confidence}} {{riskLevel}} {{volumeState}} {{latestVolumeAmount}} {{volumeChangeRate}} {{reasons}} {{rise}} {{fall}} {{flat}} {{bullBearSummary}} {{leaderSummary}} {{conceptSectorSummary}} {{industrySectorSummary}} {{newsSummary}} {{reportSummary}}',
  ultraShortAnalysis: '{{analysisDate}} {{stage}} {{confidence}} {{riskLevel}} {{volumeState}} {{latestVolumeAmount}} {{volumeChangeRate}} {{reasons}} {{rise}} {{fall}} {{flat}} {{bullBearSummary}} {{leaderSummary}} {{conceptSectorSummary}} {{industrySectorSummary}} {{newsSummary}} {{reportSummary}}',
  premarketPlan: '{{sourceAnalysisDate}} {{targetTradingDate}} {{dailyReviewContent}}',
  stockObservation: '{{symbol}} {{name}} {{industry}} {{concepts}} {{analysisDate}} {{latestPrice}} {{latestPctChange}} {{openPct}} {{closePct}} {{isOneWord}} {{klineSummary}} {{stage}} {{riskLevel}} {{volumeState}} {{leaderSummary}} {{conceptSectorSummary}} {{industrySectorSummary}} {{focusListStatus}} {{planTrackingStatus}} {{relatedNewsSummary}} {{relatedReportSummary}} {{cachedReportSummary}}',
  planValidation: '{{targetTradingDate}} {{validationDate}} {{premarketPlanContent}} {{stage}} {{riskLevel}} {{volumeState}} {{latestVolumeAmount}} {{volumeChangeRate}} {{rise}} {{fall}} {{flat}} {{bullBearSummary}} {{leaderSummary}} {{conceptSectorSummary}} {{industrySectorSummary}} {{newsSummary}} {{observedStocksSummary}}',
};

export const renderStructuredDocument = (content: string, tone: 'violet' | 'amber' | 'cyan') => {
  const className = tone === 'violet'
    ? 'border-violet-400/20 bg-white/40 dark:bg-white/[0.03]'
    : tone === 'amber'
      ? 'border-amber-400/20 bg-white/40 dark:bg-white/[0.03]'
      : 'border-cyan-400/20 bg-white/40 dark:bg-white/[0.03]';

  return (
    <div className={`mt-4 rounded-xl border p-4 ${className}`}>
      <div className="whitespace-pre-wrap text-sm leading-7 text-slate-700 dark:text-gray-200">
        {content}
      </div>
    </div>
  );
};
