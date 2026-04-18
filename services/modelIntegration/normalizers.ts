import {
  AIIntegrationSettings,
  AIPromptTemplates,
  AISkillDefinition,
  AISkillScope,
  ModelProviderConfig,
} from '../../types';
import {
  buildDefaultProviders,
  DEFAULT_PROJECT_PATH,
  DEFAULT_PROMPT_TEMPLATES,
  DEFAULT_SKILL_SCOPES,
} from './defaults';

export const normalizeProvider = (
  provider: Partial<ModelProviderConfig>,
  fallback?: ModelProviderConfig
): ModelProviderConfig => {
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

export const buildDefaultSettings = (): AIIntegrationSettings => {
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

export const normalizePromptTemplates = (
  templates?: Partial<AIPromptTemplates> | null
): AIPromptTemplates => ({
  reportSummary: templates?.reportSummary?.trim() || DEFAULT_PROMPT_TEMPLATES.reportSummary,
  dailyReview: templates?.dailyReview?.trim() || DEFAULT_PROMPT_TEMPLATES.dailyReview,
  ultraShortAnalysis:
    templates?.ultraShortAnalysis?.trim() || DEFAULT_PROMPT_TEMPLATES.ultraShortAnalysis,
  premarketPlan: templates?.premarketPlan?.trim() || DEFAULT_PROMPT_TEMPLATES.premarketPlan,
  stockObservation:
    templates?.stockObservation?.trim() || DEFAULT_PROMPT_TEMPLATES.stockObservation,
  planValidation: templates?.planValidation?.trim() || DEFAULT_PROMPT_TEMPLATES.planValidation,
});

export const normalizeSkillScopes = (scopes?: AISkillScope[] | null): AISkillScope[] => {
  const normalized = Array.isArray(scopes)
    ? scopes.filter(
        (scope): scope is AISkillScope =>
          DEFAULT_SKILL_SCOPES.includes(scope) || scope === 'reportSummary'
      )
    : [];
  return normalized.length > 0 ? normalized : [...DEFAULT_SKILL_SCOPES];
};

export const normalizeSkill = (skill: Partial<AISkillDefinition>): AISkillDefinition => {
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

export const normalizeSkills = (
  skills?: Partial<AISkillDefinition>[] | null
): AISkillDefinition[] => (Array.isArray(skills) ? skills.map((skill) => normalizeSkill(skill)) : []);
