import { FeishuBotConfig, FeishuBotConfigTestResult } from '../types';
import { resolveScreenerApiBase } from './apiConfig';

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
    throw new Error(detail || `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
};

export const loadFeishuBotConfig = async (): Promise<FeishuBotConfig> => {
  const response = await fetch(FEISHU_CONFIG_ENDPOINT);
  const payload = await readJsonOrThrow<Partial<FeishuBotConfig>>(response);
  return normalizeConfig(payload);
};

export const saveFeishuBotConfig = async (config: FeishuBotConfig): Promise<FeishuBotConfig> => {
  const response = await fetch(FEISHU_CONFIG_ENDPOINT, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(config),
  });
  const payload = await readJsonOrThrow<Partial<FeishuBotConfig>>(response);
  return normalizeConfig(payload);
};

export const testFeishuBotConfig = async (config: FeishuBotConfig): Promise<FeishuBotConfigTestResult> => {
  const response = await fetch(FEISHU_TEST_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(config),
  });
  return readJsonOrThrow<FeishuBotConfigTestResult>(response);
};
