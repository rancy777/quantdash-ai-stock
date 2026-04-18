import {
  AIIntegrationSettings,
  ModelProviderConfig,
  ModelProviderMode,
} from '../../types';
import {
  AI_INTEGRATION_STORAGE_KEY,
  DEFAULT_PROJECT_PATH,
  createProvider,
} from './defaults';
import {
  buildDefaultSettings,
  normalizePromptTemplates,
  normalizeProvider,
  normalizeSkills,
} from './normalizers';

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
    const normalizedParsedProviders =
      parsedProviders.length > 0
        ? parsedProviders.map((item) =>
            normalizeProvider(item, defaultProvidersByKey.get(item.providerKey ?? ''))
          )
        : defaultSettings.providers;
    const existingProviderKeys = new Set(normalizedParsedProviders.map((item) => item.providerKey));
    const missingDefaultProviders = defaultSettings.providers.filter(
      (item) => !existingProviderKeys.has(item.providerKey)
    );
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

export const saveAIIntegrationSettings = (
  settings: AIIntegrationSettings
): AIIntegrationSettings => {
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
    notes:
      mode === 'local'
        ? '填写本地推理服务地址，例如 Ollama / LM Studio / vLLM。'
        : '填写供应商 API 地址和模型名。',
    enabled: false,
  });
