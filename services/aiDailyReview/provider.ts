import type { ModelProviderConfig } from '../../types';
import { resolveScreenerApiBase } from '../apiConfig';
import { buildStoredAuthHeaders, handleAuthFailure } from '../authRequest';

import { trimTrailingSlash } from './utils';

const MODEL_INVOKE_ENDPOINT = `${resolveScreenerApiBase()}/integrations/model/invoke`;

export const resolveAIReviewProvider = (
  providers: ModelProviderConfig[],
  preferredProviderId?: string | null,
  providerId?: string | null,
): ModelProviderConfig => {
  const provider =
    providers.find((item) => item.id === providerId) ??
    providers.find((item) => item.id === preferredProviderId) ??
    providers.find((item) => item.enabled);

  if (!provider) {
    throw new Error('没有可用的 AI 模型线路，请先在 AI对接 页面启用至少一条模型。');
  }
  if (!provider.baseUrl || !provider.model) {
    throw new Error(`模型线路 ${provider.displayName} 缺少 baseUrl 或 model 配置。`);
  }

  return provider;
};

export const invokeAIReviewProvider = async (
  provider: ModelProviderConfig,
  prompt: string,
  systemPrompt: string,
): Promise<string> => {
  const response = await handleAuthFailure(
    await fetch(MODEL_INVOKE_ENDPOINT, {
      method: 'POST',
      headers: buildStoredAuthHeaders({ 'content-type': 'application/json' }, { required: true }),
      body: JSON.stringify({
        providerKey: provider.providerKey,
        protocol: provider.protocol,
        baseUrl: trimTrailingSlash(provider.baseUrl),
        apiKey: provider.apiKey,
        model: provider.model,
        systemPrompt,
        userPrompt: prompt,
        temperature: 0.25,
        maxTokens: 1600,
      }),
    }),
    { required: true },
  );
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `模型请求失败: ${response.status}`);
  }
  const payload = await response.json() as { content?: string };
  return payload.content?.trim() ?? '';
};
