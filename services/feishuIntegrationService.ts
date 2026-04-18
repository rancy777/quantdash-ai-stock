import { FeishuBotConfig, FeishuBotConfigTestResult } from '../types';
import { resolveScreenerApiBase } from './apiConfig';
import { buildStoredAuthHeaders, handleAuthFailure } from './authRequest';

const FEISHU_CONFIG_ENDPOINT = `${resolveScreenerApiBase()}/integrations/feishu/config`;
const FEISHU_TEST_ENDPOINT = `${resolveScreenerApiBase()}/integrations/feishu/test`;

const normalizeConfig = (payload?: Partial<FeishuBotConfig> | null): FeishuBotConfig => ({
  appId: payload?.appId ?? '',
  appSecret: payload?.appSecret ?? '',
  verificationToken: payload?.verificationToken ?? '',
  aiBaseUrl: payload?.aiBaseUrl ?? '',
  aiApiKey: payload?.aiApiKey ?? '',
  aiModel: payload?.aiModel ?? '',
});

const readJsonOrThrow = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const detail = await response.text();
    let parsed: { detail?: string; message?: string } | null = null;
    try {
      parsed = detail ? JSON.parse(detail) : null;
    } catch {
      parsed = null;
    }
    throw new Error(parsed?.detail || parsed?.message || detail || `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
};

export const loadFeishuBotConfig = async (): Promise<FeishuBotConfig> => {
  const response = await handleAuthFailure(
    await fetch(FEISHU_CONFIG_ENDPOINT, {
      headers: buildStoredAuthHeaders(undefined, { required: true }),
    }),
    { required: true },
  );
  const payload = await readJsonOrThrow<Partial<FeishuBotConfig>>(response);
  return normalizeConfig(payload);
};

export const saveFeishuBotConfig = async (config: FeishuBotConfig): Promise<FeishuBotConfig> => {
  const response = await fetch(FEISHU_CONFIG_ENDPOINT, {
    method: 'PUT',
    headers: buildStoredAuthHeaders(
      {
        'content-type': 'application/json',
      },
      { required: true },
    ),
    body: JSON.stringify(config),
  });
  await handleAuthFailure(response, { required: true });
  const payload = await readJsonOrThrow<Partial<FeishuBotConfig>>(response);
  return normalizeConfig(payload);
};

export const testFeishuBotConfig = async (config: FeishuBotConfig): Promise<FeishuBotConfigTestResult> => {
  const response = await fetch(FEISHU_TEST_ENDPOINT, {
    method: 'POST',
    headers: buildStoredAuthHeaders(
      {
        'content-type': 'application/json',
      },
      { required: true },
    ),
    body: JSON.stringify(config),
  });
  await handleAuthFailure(response, { required: true });
  return readJsonOrThrow<FeishuBotConfigTestResult>(response);
};
