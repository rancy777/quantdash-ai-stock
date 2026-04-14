import {
  AIIntegrationSettings,
  AIPromptTemplates,
  AISkillDefinition,
  AISkillScope,
  ModelProviderConfig,
  ModelProviderMode,
  ModelProviderProtocol,
} from '../types';
import { resolveScreenerApiBase } from './apiConfig';

const AI_INTEGRATION_STORAGE_KEY = 'quantdash:ai-integration-settings';
const DEFAULT_PROJECT_PATH = 'C:\\Users\\lenvon\\Desktop\\quantdash---a-share-analytics';
const MODEL_INVOKE_ENDPOINT = `${resolveScreenerApiBase()}/integrations/model/invoke`;
const DEFAULT_SKILL_SCOPES: AISkillScope[] = [
  'dailyReview',
  'ultraShortAnalysis',
  'premarketPlan',
  'stockObservation',
  'planValidation',
];

const DEFAULT_PROMPT_TEMPLATES: AIPromptTemplates = {
  reportSummary: [
    '你是 QuantDash 的 A 股研报提炼助手，服务对象是偏交易和复盘场景的使用者。',
    '你的任务不是复述研报，而是提炼出“对盘面和决策真正有用的信息”。',
    '',
    '可用输入：',
    '- 研报标题：{{reportTitle}}',
    '- 来源：{{sourceLabel}}',
    '- 机构：{{orgLine}}',
    '- 研究员：{{researcherLine}}',
    '- 评级：{{ratingLine}}',
    '- 正文：{{contentBlock}}',
    '',
    '输出要求：',
    '1. 先写一句“核心结论”，不要复述标题。',
    '2. 再写“核心观点”，控制在 3 到 5 条，每条必须有信息增量。',
    '3. 单独写“交易相关线索”，重点提炼行业方向、催化剂、景气逻辑、相关个股或风格影响。',
    '4. 单独写“风险与不确定性”，只写研报中真实提到或能直接推导出的风险。',
    '5. 如果研报里有评级、目标价、盈利预测变化、超预期点，要明确列出；如果没有就不要编。',
    '',
    '风格要求：',
    '- 中文输出，专业、简洁、高信息密度。',
    '- 少写套话，不要出现“整体来看”“综上所述”这类空洞收尾。',
    '- 不要大段摘抄原文，不要假装知道研报没写的内容。',
    '- 如果正文信息很少，要明确说明“原文信息有限”。',
    '',
    '固定输出结构：',
    '一、核心结论',
    '二、核心观点',
    '三、交易相关线索',
    '四、风险与不确定性',
  ].join('\n'),
  dailyReview: [
    '你是 QuantDash 的 A 股盘后复盘助手，风格偏短线、情绪、板块与龙头博弈分析。',
    '你的目标是把最近交易日的结构化数据，压缩成一份可以直接用于次日交易准备的盘后复盘。',
    '',
    '可用输入：',
    '- 最近交易日：{{analysisDate}}',
    '- 情绪阶段：{{stage}}',
    '- 阶段置信度：{{confidence}}',
    '- 风险等级：{{riskLevel}}',
    '- 量能状态：{{volumeState}}',
    '- 两市成交额估计：{{latestVolumeAmount}} 亿',
    '- 量能变化：{{volumeChangeRate}}%',
    '- 情绪理由：{{reasons}}',
    '- 市场宽度：上涨 {{rise}}，下跌 {{fall}}，平盘 {{flat}}',
    '- 牛熊风向标：{{bullBearSummary}}',
    '- 龙头状态：{{leaderSummary}}',
    '- 概念板块：{{conceptSectorSummary}}',
    '- 行业板块：{{industrySectorSummary}}',
    '- 新闻摘要：{{newsSummary}}',
    '- 计划中提及的观察标的表现：{{observedStocksSummary}}',
    '- 研报摘要：{{reportSummary}}',
    '',
    '任务要求：',
    '1. 先给一句总判断，明确市场当前是修复、分歧、主升、退潮还是试错，不要模糊。',
    '2. 再写“情绪与结构”，必须结合情绪阶段、量能、涨跌家数、龙头状态来解释，而不是凭感觉。',
    '3. 再写“主线与板块”，明确最强方向、次强方向，以及它们强在何处、弱在何处。',
    '4. 再写“龙头与核心个股”，重点讲带动性、承接、是否具备继续观察价值。',
    '5. 再写“风险点”，必须指出哪些信号说明当前环境不适合激进出手。',
    '6. 最后写“下一交易日观察重点”，要求可执行、可验证。',
    '',
    '风格要求：',
    '- 先结论，后依据。',
    '- 少讲空泛宏观，多讲情绪、板块、龙头、结构。',
    '- 明确使用“最近交易日 {{analysisDate}}”这一表述，不要误写成今天。',
    '- 如果输入数据不足，必须明确指出数据不足，不要补脑。',
    '',
    '固定输出结构：',
    '一、市场总判断',
    '二、情绪与结构',
    '三、主线与板块',
    '四、龙头与核心个股',
    '五、风险点',
    '六、下一交易日观察重点',
    '七、结论依据与证据点',
  ].join('\n'),
  ultraShortAnalysis: [
    '你是 QuantDash 的 AI 超短线深度分析助手，服务对象是以 1 到 3 个交易日为核心节奏的 A 股超短交易者。',
    '你的任务不是泛泛复盘，而是围绕“情绪强弱、主线强度、龙头溢价、接力条件、风险断点”做高密度判断。',
    '',
    '可用输入：',
    '- 最近交易日：{{analysisDate}}',
    '- 情绪阶段：{{stage}}',
    '- 阶段置信度：{{confidence}}',
    '- 风险等级：{{riskLevel}}',
    '- 量能状态：{{volumeState}}',
    '- 两市成交额估计：{{latestVolumeAmount}} 亿',
    '- 量能变化：{{volumeChangeRate}}%',
    '- 情绪理由：{{reasons}}',
    '- 市场宽度：上涨 {{rise}}，下跌 {{fall}}，平盘 {{flat}}',
    '- 牛熊风向标：{{bullBearSummary}}',
    '- 龙头状态：{{leaderSummary}}',
    '- 概念板块：{{conceptSectorSummary}}',
    '- 行业板块：{{industrySectorSummary}}',
    '- 新闻摘要：{{newsSummary}}',
    '- 计划中提及的观察标的表现：{{observedStocksSummary}}',
    '- 研报摘要：{{reportSummary}}',
    '',
    '任务要求：',
    '1. 先给出一句“超短总判断”，明确当前更适合主攻、轻仓试错、只做前排还是防守观望。',
    '2. 写“情绪强弱与接力环境”，重点分析涨停质量、炸板/跌停反馈、量能承接、隔日溢价环境是否支持接力。',
    '3. 写“主线与轮动”，区分真正主线、强化分支、跟风支线和扰动题材，说明持续性差异。',
    '4. 写“龙头/前排/补涨梯队”，明确谁是锚定核心、谁能看分歧回封、谁只适合观察不适合追。',
    '5. 写“明日博弈重点”，必须具体到看哪些信号代表可做，哪些信号代表退潮扩散。',
    '6. 写“高风险动作清单”，明确哪些追高、接力、低吸场景胜率低，应主动回避。',
    '7. 如输入数据不足，必须明确标注不确定项，不要臆测。',
    '',
    '风格要求：',
    '- 只讲超短交易真正有用的信息，少讲空话。',
    '- 结论先行，语气直接，强调强弱、先后手和博弈条件。',
    '- 明确使用“最近交易日 {{analysisDate}}”表述，不要混写成今天。',
    '- 不给绝对化买卖建议，不写“必涨”“无脑上”。',
    '',
    '固定输出结构：',
    '一、超短总判断',
    '二、情绪强弱与接力环境',
    '三、主线与轮动',
    '四、龙头/前排/补涨梯队',
    '五、明日博弈重点',
    '六、高风险动作清单',
    '七、结论依据与证据点',
  ].join('\n'),
  premarketPlan: [
    '你是 QuantDash 的盘前计划助手，任务是把上一交易日复盘转成下一交易日可执行的观察清单与应对预案。',
    '',
    '可用输入：',
    '- 来源复盘交易日：{{sourceAnalysisDate}}',
    '- 目标交易日：{{targetTradingDate}}',
    '- 盘后复盘内容：{{dailyReviewContent}}',
    '',
    '任务要求：',
    '1. 先给一句“盘前总判断”，说明次日更像延续、分歧还是修复，不要模糊。',
    '2. 给出“重点观察方向”，按优先级排序。',
    '3. 给出“重点观察清单”，至少 5 条，每条都要包含观察对象或观察信号。',
    '4. 给出“交易预案”，至少覆盖强势延续、盘中分歧、明显退潮三种情形。',
    '5. 给出“风险提醒”，明确哪些情况下以控制节奏为主，不适合激进出手。',
    '6. 如果复盘里没有足够依据，不要硬写机会，要明确说观察为主。',
    '',
    '风格要求：',
    '- 中文输出，简洁、直接、偏执行。',
    '- 不写空洞鸡汤，不喊口号，不给必涨式表达。',
    '- 多写“看什么、怎么看、什么条件下成立”。',
    '',
    '固定输出结构：',
    '一、盘前总判断',
    '二、重点观察方向',
    '三、重点观察清单',
    '四、交易预案',
    '五、风险提醒',
    '六、结论依据与证据点',
  ].join('\n'),
  stockObservation: [
    '你是 QuantDash 的个股观察助手，任务是判断一只股票在当前市场环境中的位置、作用和观察重点。',
    '请严格基于输入数据判断，不要给绝对化买卖建议。',
    '',
    '可用输入：',
    '- 股票代码：{{symbol}}',
    '- 股票名称：{{name}}',
    '- 所属行业：{{industry}}',
    '- 关联概念：{{concepts}}',
    '- 最新交易日：{{analysisDate}}',
    '- 最新价格：{{latestPrice}}',
    '- 最新涨跌幅：{{latestPctChange}}%',
    '- 最新交易日开盘相对前收：{{openPct}}%',
    '- 最新交易日收盘相对前收：{{closePct}}%',
    '- 是否近似一字：{{isOneWord}}',
    '- 近 5 日 K 线摘要：{{klineSummary}}',
    '- 当前市场阶段：{{stage}}',
    '- 当前风险等级：{{riskLevel}}',
    '- 当前量能状态：{{volumeState}}',
    '- 龙头状态：{{leaderSummary}}',
    '- 概念板块强度：{{conceptSectorSummary}}',
    '- 行业板块强度：{{industrySectorSummary}}',
    '- 是否已在自选/重点关注：{{focusListStatus}}',
    '- 是否出现在最近盘前计划中：{{planTrackingStatus}}',
    '- 相关资讯摘要：{{relatedNewsSummary}}',
    '- 相关研报摘要：{{relatedReportSummary}}',
    '- 已有 AI 研报观点：{{cachedReportSummary}}',
    '',
    '任务要求：',
    '1. 先判断这只票当前更像启动、加速、分歧、修复还是退潮阶段。',
    '2. 结合是否在自选/盘前计划中，说明它当前属于重点跟踪、观察备选还是降低优先级。',
    '3. 说明它与所属板块、市场情绪之间的关系。',
    '4. 结合相关新闻、研报或已有 AI 研报观点，提炼当前最值得关注的催化和风险点。',
    '5. 给出下一步观察重点，强调什么信号成立才继续看。',
    '6. 给出失效条件，说明哪些迹象出现后要降低预期。',
    '',
    '风格要求：',
    '- 讲结构、讲位置、讲博弈关系。',
    '- 不要脱离板块单讲个股。',
    '- 不要给“明天必涨”“建议直接买入”这类表述。',
    '',
    '固定输出结构：',
    '一、个股定位',
    '二、与板块和情绪的关系',
    '三、当前强点',
    '四、当前弱点',
    '五、催化与风险线索',
    '六、下一步观察重点',
    '七、失效条件',
  ].join('\n'),
  planValidation: [
    '你是 QuantDash 的盘前计划次日校验助手，任务是评估上一份盘前计划与最新市场实际表现之间的偏差。',
    '你的目标不是事后诸葛亮，而是找出哪些判断成立、哪些判断偏差、偏差来自哪里，并给出下次改进方向。',
    '',
    '可用输入：',
    '- 来源盘前计划交易日：{{targetTradingDate}}',
    '- 校验所依据的最新交易日：{{validationDate}}',
    '- 原盘前计划内容：{{premarketPlanContent}}',
    '- 最新市场阶段：{{stage}}',
    '- 风险等级：{{riskLevel}}',
    '- 量能状态：{{volumeState}}',
    '- 两市成交额估计：{{latestVolumeAmount}} 亿',
    '- 量能变化：{{volumeChangeRate}}%',
    '- 市场宽度：上涨 {{rise}}，下跌 {{fall}}，平盘 {{flat}}',
    '- 牛熊风向标：{{bullBearSummary}}',
    '- 龙头状态：{{leaderSummary}}',
    '- 概念板块：{{conceptSectorSummary}}',
    '- 行业板块：{{industrySectorSummary}}',
    '- 新闻摘要：{{newsSummary}}',
    '',
    '任务要求：',
    '1. 先判断原盘前计划整体上是偏正确、部分正确还是明显偏差。',
    '2. 写出“验证结果”，明确哪些观察方向被市场验证，哪些没有。',
    '3. 写出“偏差来源”，说明是情绪误判、板块切换、龙头强弱变化、量能变化还是消息扰动。',
    '4. 写出“可复用经验”，总结下次盘前计划应如何修正。',
    '5. 所有判断都要结合给定数据，不要空泛评论。',
    '',
    '风格要求：',
    '- 结论先行，证据随后。',
    '- 语气客观，不自夸，不回避错误。',
    '- 用中文输出，保持高信息密度。',
    '',
    '固定输出结构：',
    '一、校验结论',
    '二、验证成立的部分',
    '三、验证失效或偏差的部分',
    '四、偏差来源',
    '五、下次修正建议',
    '六、结论依据与证据点',
  ].join('\n'),
};

type ProviderSeed = {
  providerKey: string;
  displayName: string;
  mode: ModelProviderMode;
  protocol: ModelProviderProtocol;
  baseUrl: string;
  model: string;
  notes: string;
  enabled?: boolean;
  supportsMcp?: boolean;
};

const createProvider = (seed: ProviderSeed): ModelProviderConfig => {
  const now = new Date().toISOString();
  return {
    id: `${seed.providerKey}-${seed.mode}-${now}`,
    providerKey: seed.providerKey,
    displayName: seed.displayName,
    mode: seed.mode,
    protocol: seed.protocol,
    baseUrl: seed.baseUrl,
    model: seed.model,
    apiKey: '',
    enabled: seed.enabled ?? false,
    supportsMcp: seed.supportsMcp ?? true,
    notes: seed.notes,
    createdAt: now,
    updatedAt: now,
  };
};

const buildDefaultProviders = (): ModelProviderConfig[] => [
  createProvider({
    providerKey: 'openai',
    displayName: 'ChatGPT / OpenAI',
    mode: 'cloud',
    protocol: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-5.4',
    notes: '官方云端模型，适合通用投研、摘要和结构化分析。',
  }),
  createProvider({
    providerKey: 'doubao',
    displayName: '豆包 / 火山方舟',
    mode: 'cloud',
    protocol: 'openai',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    model: 'doubao-seed-1-6-thinking',
    notes: '豆包系模型建议通过火山方舟 OpenAI 兼容接口接入。',
  }),
  createProvider({
    providerKey: 'anthropic',
    displayName: 'Anthropic Claude',
    mode: 'cloud',
    protocol: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-5',
    notes: '长文本分析能力强，适合研报消化和复盘总结。',
  }),
  createProvider({
    providerKey: 'gemini',
    displayName: 'Gemini',
    mode: 'cloud',
    protocol: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com',
    model: 'gemini-2.5-pro',
    notes: '适合多模态和长上下文场景。',
  }),
  createProvider({
    providerKey: 'siliconflow',
    displayName: '硅基流动 / SiliconFlow',
    mode: 'cloud',
    protocol: 'openai',
    baseUrl: 'https://api.siliconflow.cn/v1',
    model: 'Pro/zai-org/GLM-4.7',
    notes: 'OpenAI 兼容接口。前端填写 API Key 即可直接调用，适合接入国产模型线路。',
  }),
  createProvider({
    providerKey: 'deepseek',
    displayName: 'DeepSeek',
    mode: 'cloud',
    protocol: 'openai',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-reasoner',
    notes: '成本较低，适合批量处理和草稿分析。',
  }),
  createProvider({
    providerKey: 'zhipu',
    displayName: '智谱 GLM',
    mode: 'cloud',
    protocol: 'openai',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4-plus',
    notes: '国内可用性较好，适合做备用分析线路。',
  }),
  createProvider({
    providerKey: 'openrouter',
    displayName: 'OpenRouter 备用聚合',
    mode: 'cloud',
    protocol: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'openai/gpt-5.4',
    notes: '作为聚合备份线路保留，不是主默认选择。',
  }),
  createProvider({
    providerKey: 'ollama',
    displayName: 'Ollama 本地模型',
    mode: 'local',
    protocol: 'openai',
    baseUrl: 'http://127.0.0.1:11434/v1',
    model: 'qwen2.5:14b-instruct',
    notes: '本地部署首选，先启动 `ollama serve`，再拉取模型。',
  }),
  createProvider({
    providerKey: 'lmstudio',
    displayName: 'LM Studio',
    mode: 'local',
    protocol: 'openai',
    baseUrl: 'http://127.0.0.1:1234/v1',
    model: 'local-model',
    notes: '适合桌面端本地推理，需开启 OpenAI Compatible Server。',
  }),
  createProvider({
    providerKey: 'custom-openai',
    displayName: '自定义 OpenAI 兼容',
    mode: 'local',
    protocol: 'openai',
    baseUrl: 'http://127.0.0.1:8000/v1',
    model: 'custom-model',
    notes: '适用于 vLLM、Xinference、OneAPI 或自建网关。',
  }),
];

const normalizeProvider = (provider: Partial<ModelProviderConfig>, fallback?: ModelProviderConfig): ModelProviderConfig => {
  const now = new Date().toISOString();
  const mode = provider.mode ?? fallback?.mode ?? 'cloud';
  const apiKey = provider.apiKey ?? fallback?.apiKey ?? '';
  return {
    id: provider.id ?? fallback?.id ?? `provider-${now}`,
    providerKey: provider.providerKey ?? fallback?.providerKey ?? 'custom',
    displayName: provider.displayName ?? fallback?.displayName ?? '未命名模型',
    mode,
    protocol: provider.protocol ?? fallback?.protocol ?? 'openai',
    baseUrl: provider.baseUrl ?? fallback?.baseUrl ?? '',
    model: provider.model ?? fallback?.model ?? '',
    apiKey,
    enabled:
      mode === 'cloud'
        ? Boolean((provider.enabled ?? fallback?.enabled ?? false) && apiKey.trim())
        : provider.enabled ?? fallback?.enabled ?? false,
    supportsMcp: provider.supportsMcp ?? fallback?.supportsMcp ?? true,
    notes: provider.notes ?? fallback?.notes ?? '',
    createdAt: provider.createdAt ?? fallback?.createdAt ?? now,
    updatedAt: provider.updatedAt ?? now,
  };
};

const buildDefaultSettings = (): AIIntegrationSettings => {
  const providers = buildDefaultProviders();
  return {
    providers,
    preferredProviderId: providers[0]?.id ?? null,
    mcpProjectPath: DEFAULT_PROJECT_PATH,
    promptTemplates: DEFAULT_PROMPT_TEMPLATES,
    skills: [],
    updatedAt: new Date().toISOString(),
  };
};

const normalizePromptTemplates = (templates?: Partial<AIPromptTemplates> | null): AIPromptTemplates => ({
  reportSummary: templates?.reportSummary?.trim() || DEFAULT_PROMPT_TEMPLATES.reportSummary,
  dailyReview: templates?.dailyReview?.trim() || DEFAULT_PROMPT_TEMPLATES.dailyReview,
  ultraShortAnalysis:
    templates?.ultraShortAnalysis?.trim() || DEFAULT_PROMPT_TEMPLATES.ultraShortAnalysis,
  premarketPlan: templates?.premarketPlan?.trim() || DEFAULT_PROMPT_TEMPLATES.premarketPlan,
  stockObservation: templates?.stockObservation?.trim() || DEFAULT_PROMPT_TEMPLATES.stockObservation,
  planValidation: templates?.planValidation?.trim() || DEFAULT_PROMPT_TEMPLATES.planValidation,
});

const normalizeSkillScopes = (scopes?: AISkillScope[] | null): AISkillScope[] => {
  const normalized = Array.isArray(scopes)
    ? scopes.filter((scope): scope is AISkillScope => DEFAULT_SKILL_SCOPES.includes(scope) || scope === 'reportSummary')
    : [];
  return normalized.length > 0 ? normalized : [...DEFAULT_SKILL_SCOPES];
};

const normalizeSkill = (skill: Partial<AISkillDefinition>): AISkillDefinition => {
  const now = new Date().toISOString();
  return {
    id: skill.id ?? `skill-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`,
    name: skill.name?.trim() || '未命名 Skill',
    description: skill.description?.trim() || '',
    instructions: skill.instructions?.trim() || '',
    githubRepo: skill.githubRepo?.trim() || '',
    githubNotes: skill.githubNotes?.trim() || '',
    scopes: normalizeSkillScopes(skill.scopes),
    enabled: Boolean(skill.enabled),
    createdAt: skill.createdAt ?? now,
    updatedAt: now,
  };
};

const normalizeSkills = (skills?: Partial<AISkillDefinition>[] | null): AISkillDefinition[] =>
  Array.isArray(skills) ? skills.map((skill) => normalizeSkill(skill)) : [];

export const getDefaultAIIntegrationSettings = (): AIIntegrationSettings => buildDefaultSettings();

export const loadAIIntegrationSettings = (): AIIntegrationSettings => {
  if (typeof window === 'undefined') {
    return buildDefaultSettings();
  }

  try {
    const raw = window.localStorage.getItem(AI_INTEGRATION_STORAGE_KEY);
    if (!raw) {
      const defaults = buildDefaultSettings();
      window.localStorage.setItem(AI_INTEGRATION_STORAGE_KEY, JSON.stringify(defaults));
      return defaults;
    }

    const parsed = JSON.parse(raw) as Partial<AIIntegrationSettings>;
    const defaultSettings = buildDefaultSettings();
    const defaultProvidersByKey = new Map(
      defaultSettings.providers.map((item) => [item.providerKey, item] as const)
    );
    const parsedProviders = Array.isArray(parsed.providers) ? parsed.providers : [];
    const normalizedParsedProviders = parsedProviders.length > 0
      ? parsedProviders.map((item) => normalizeProvider(item, defaultProvidersByKey.get(item.providerKey ?? '')))
      : defaultSettings.providers;
    const existingProviderKeys = new Set(normalizedParsedProviders.map((item) => item.providerKey));
    const missingDefaultProviders = defaultSettings.providers.filter((item) => !existingProviderKeys.has(item.providerKey));
    const providers = [...normalizedParsedProviders, ...missingDefaultProviders];

    return {
      providers,
      preferredProviderId:
        parsed.preferredProviderId && providers.some((item) => item.id === parsed.preferredProviderId)
          ? parsed.preferredProviderId
          : providers[0]?.id ?? null,
      mcpProjectPath: parsed.mcpProjectPath || DEFAULT_PROJECT_PATH,
      promptTemplates: normalizePromptTemplates(parsed.promptTemplates),
      skills: normalizeSkills(parsed.skills),
      updatedAt: parsed.updatedAt || defaultSettings.updatedAt,
    };
  } catch (error) {
    console.warn('Failed to load AI integration settings', error);
    return buildDefaultSettings();
  }
};

export const saveAIIntegrationSettings = (settings: AIIntegrationSettings): AIIntegrationSettings => {
  const normalized: AIIntegrationSettings = {
    ...settings,
    providers: settings.providers.map((item) => normalizeProvider(item)),
    promptTemplates: normalizePromptTemplates(settings.promptTemplates),
    skills: normalizeSkills(settings.skills),
    updatedAt: new Date().toISOString(),
  };

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(AI_INTEGRATION_STORAGE_KEY, JSON.stringify(normalized));
  }

  return normalized;
};

export const createCustomProvider = (mode: ModelProviderMode): ModelProviderConfig =>
  createProvider({
    providerKey: mode === 'local' ? 'custom-local' : 'custom-cloud',
    displayName: mode === 'local' ? '新的本地模型' : '新的云端模型',
    mode,
    protocol: 'openai',
    baseUrl: mode === 'local' ? 'http://127.0.0.1:8000/v1' : 'https://api.example.com/v1',
    model: '',
    notes: mode === 'local' ? '填写本地推理服务地址，例如 Ollama / LM Studio / vLLM。' : '填写供应商 API 地址和模型名。',
    enabled: false,
  });

export const maskApiKey = (value: string): string => {
  if (!value) return '未填写';
  if (value.length <= 8) return `${value.slice(0, 2)}***`;
  return `${value.slice(0, 4)}***${value.slice(-4)}`;
};

export const buildMcpServerConfigSnippet = (projectPath: string): string =>
  JSON.stringify(
    {
      mcpServers: {
        quantdash: {
          command: 'npm',
          args: ['run', 'mcp:server'],
          cwd: projectPath || DEFAULT_PROJECT_PATH,
        },
      },
    },
    null,
    2
  );

export const buildProviderUsageSnippet = (provider: ModelProviderConfig): string => {
  const baseUrl = provider.baseUrl || 'https://api.example.com/v1';
  const model = provider.model || 'your-model';
  if (provider.protocol === 'anthropic') {
    return `curl ${baseUrl}/messages \\
  -H "x-api-key: ${provider.apiKey || 'YOUR_API_KEY'}" \\
  -H "anthropic-version: 2023-06-01" \\
  -H "content-type: application/json" \\
  -d '{
    "model": "${model}",
    "max_tokens": 1024,
    "messages": [{"role": "user", "content": "请读取 QuantDash MCP 数据后给出盘面摘要"}]
  }'`;
  }

  if (provider.protocol === 'gemini') {
    return `POST ${baseUrl}/v1beta/models/${model}:generateContent?key=${provider.apiKey || 'YOUR_API_KEY'}`;
  }

  return `curl ${baseUrl}/chat/completions \\
  -H "Authorization: Bearer ${provider.apiKey || 'YOUR_API_KEY'}" \\
  -H "content-type: application/json" \\
  -d '{
    "model": "${model}",
    "messages": [{"role": "user", "content": "请结合 QuantDash MCP 返回的数据生成盘后复盘"}]
  }'`;
};

export const getDefaultPromptTemplates = (): AIPromptTemplates => DEFAULT_PROMPT_TEMPLATES;

export const getEnabledSkillsForScope = (
  settings: Pick<AIIntegrationSettings, 'skills'>,
  scope: AISkillScope
): AISkillDefinition[] =>
  (settings.skills ?? [])
    .filter((skill) => skill.enabled && skill.instructions.trim() && skill.scopes.includes(scope))
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));

export const renderSkillInstructions = (skills: AISkillDefinition[]): string => {
  if (!skills.length) return '';

  return [
    '当前已启用以下 Skills。它们是本次任务的额外分析框架与约束，优先级高于默认风格要求，但不能违背事实数据：',
    ...skills.map((skill, index) => {
      const repoLine = skill.githubRepo ? `GitHub 仓库/路径：${skill.githubRepo}` : '';
      const notesLine = skill.githubNotes ? `仓库上下文：${skill.githubNotes}` : '';
      return [
        `${index + 1}. ${skill.name}${skill.description ? ` - ${skill.description}` : ''}`,
        repoLine,
        notesLine,
        `执行规则：${skill.instructions}`,
      ]
        .filter(Boolean)
        .join('\n');
    }),
  ].join('\n\n');
};

export const renderPromptTemplate = (
  template: string,
  variables: Record<string, string | number | null | undefined>
): string =>
  template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    const value = variables[key];
    return value === null || value === undefined || value === '' ? '—' : String(value);
  });

export type ProviderConnectionTestResult = {
  ok: boolean;
  kind: 'success' | 'warning' | 'error';
  statusLabel: string;
  detail: string;
  checkedAt: string;
};

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const fetchWithTimeout = async (url: string, init: RequestInit, timeoutMs = 8000): Promise<Response> => {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
};

const buildResult = (
  kind: ProviderConnectionTestResult['kind'],
  statusLabel: string,
  detail: string
): ProviderConnectionTestResult => ({
  ok: kind === 'success',
  kind,
  statusLabel,
  detail,
  checkedAt: new Date().toISOString(),
});

const safeReadBody = async (response: Response): Promise<string> => {
  try {
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const json = await response.json();
      return JSON.stringify(json).slice(0, 220);
    }
    return (await response.text()).slice(0, 220);
  } catch {
    return '';
  }
};

export const testModelProviderConnection = async (
  provider: ModelProviderConfig
): Promise<ProviderConnectionTestResult> => {
  const baseUrl = trimTrailingSlash(provider.baseUrl.trim());
  if (!baseUrl) {
    return buildResult('warning', '未配置 Base URL', '先填写接口地址，再做连通性测试。');
  }

  if ((provider.protocol === 'openai' || provider.protocol === 'custom') && provider.mode === 'cloud' && !provider.apiKey) {
    return buildResult('warning', '缺少 Token', '当前线路是云端 OpenAI 兼容接口，通常需要先填写 API Key。');
  }

  if (provider.protocol === 'gemini' && !provider.apiKey) {
    return buildResult('warning', '缺少 Token', 'Gemini 测试需要 API Key，先填写后再探测。');
  }

  if (provider.protocol === 'anthropic' && !provider.apiKey) {
    return buildResult('warning', '缺少 Token', 'Anthropic 测试需要 API Key，先填写后再探测。');
  }

  try {
    if (provider.protocol === 'gemini') {
      const url = `${baseUrl}/v1beta/models?key=${encodeURIComponent(provider.apiKey)}`;
      const response = await fetchWithTimeout(
        url,
        {
          method: 'GET',
          headers: { accept: 'application/json' },
        },
        10000
      );
      if (response.ok) {
        return buildResult('success', 'Gemini 可达', '已成功读取模型列表接口。');
      }
      return buildResult('error', `Gemini 返回 ${response.status}`, await safeReadBody(response));
    }

    if (provider.protocol === 'anthropic') {
      const url = `${baseUrl}/v1/models`;
      const response = await fetchWithTimeout(
        url,
        {
          method: 'GET',
          headers: {
            accept: 'application/json',
            'x-api-key': provider.apiKey,
            'anthropic-version': '2023-06-01',
          },
        },
        10000
      );
      if (response.ok) {
        return buildResult('success', 'Anthropic 可达', '已成功读取模型列表接口。');
      }
      return buildResult('error', `Anthropic 返回 ${response.status}`, await safeReadBody(response));
    }

    const url = `${baseUrl}/models`;
    const headers: Record<string, string> = {
      accept: 'application/json',
    };
    if (provider.apiKey) {
      headers.Authorization = `Bearer ${provider.apiKey}`;
    }
    if (provider.providerKey === 'openrouter') {
      headers['HTTP-Referer'] = 'https://quantdash.local';
      headers['X-Title'] = 'QuantDash';
    }
    const response = await fetchWithTimeout(
      url,
      {
        method: 'GET',
        headers,
      },
      10000
    );
    if (response.ok) {
      const message =
        provider.mode === 'local' ? '本地 OpenAI 兼容接口可达。' : '云端 OpenAI 兼容接口可达。';
      return buildResult('success', '接口可达', message);
    }
    return buildResult('error', `接口返回 ${response.status}`, await safeReadBody(response));
  } catch (error) {
    const message =
      error instanceof DOMException && error.name === 'AbortError'
        ? '请求超时。请检查本地服务是否已启动，或网络是否可访问该接口。'
        : error instanceof Error
          ? error.message
          : '未知错误';
    return buildResult(
      'error',
      '测试失败',
      `浏览器未能连通该接口。若是本地模型，请确认服务已启动；若是云端接口，请留意 CORS 或网络代理。${message ? ` (${message})` : ''}`
    );
  }
};

export const testModelProviderPrompt = async (
  provider: ModelProviderConfig
): Promise<ProviderConnectionTestResult> => {
  const baseUrl = trimTrailingSlash(provider.baseUrl.trim());
  if (!baseUrl) {
    return buildResult('warning', '未配置 Base URL', '先填写接口地址，再做快速测试。');
  }
  if (!provider.model.trim()) {
    return buildResult('warning', '未配置模型名', '先填写模型名，再做快速测试。');
  }
  if ((provider.protocol === 'openai' || provider.protocol === 'custom' || provider.protocol === 'anthropic' || provider.protocol === 'gemini') && provider.mode === 'cloud' && !provider.apiKey.trim()) {
    return buildResult('warning', '缺少 Token', '当前线路是云端模型，通常需要先填写 API Key。');
  }

  try {
    const response = await fetchWithTimeout(
      MODEL_INVOKE_ENDPOINT,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          providerKey: provider.providerKey,
          protocol: provider.protocol,
          baseUrl,
          apiKey: provider.apiKey,
          model: provider.model,
          systemPrompt: 'Reply with OK only.',
          userPrompt: 'ping',
          temperature: 0,
          maxTokens: 8,
        }),
      },
      45000
    );
    if (!response.ok) {
      return buildResult('error', `快速测试失败 ${response.status}`, await safeReadBody(response));
    }
    const payload = await response.json() as { content?: string };
    const content = payload.content?.trim() ?? '';
    return buildResult(
      'success',
      '快速测试成功',
      content ? `模型已返回内容：${content}` : '模型已返回空响应，请检查该模型是否可用。'
    );
  } catch (error) {
    return buildResult(
      'error',
      '快速测试失败',
      error instanceof Error ? error.message : '未知错误'
    );
  }
};
