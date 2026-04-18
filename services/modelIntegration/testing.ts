import { ModelProviderConfig } from '../../types';
import { buildStoredAuthHeaders, handleAuthFailure } from '../authRequest';
import { MODEL_INVOKE_ENDPOINT } from './defaults';

export type ProviderConnectionTestResult = {
  ok: boolean;
  kind: 'success' | 'warning' | 'error';
  statusLabel: string;
  detail: string;
  checkedAt: string;
};

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const fetchWithTimeout = async (
  url: string,
  init: RequestInit,
  timeoutMs = 8000
): Promise<Response> => {
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
      const json = (await response.json()) as unknown;
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

  if (
    (provider.protocol === 'openai' || provider.protocol === 'custom') &&
    provider.mode === 'cloud' &&
    !provider.apiKey
  ) {
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
  if (
    (provider.protocol === 'openai' ||
      provider.protocol === 'custom' ||
      provider.protocol === 'anthropic' ||
      provider.protocol === 'gemini') &&
    provider.mode === 'cloud' &&
    !provider.apiKey.trim()
  ) {
    return buildResult('warning', '缺少 Token', '当前线路是云端模型，通常需要先填写 API Key。');
  }

  try {
    const response = await handleAuthFailure(
      await fetchWithTimeout(
        MODEL_INVOKE_ENDPOINT,
        {
          method: 'POST',
          headers: buildStoredAuthHeaders({ 'content-type': 'application/json' }, { required: true }),
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
      ),
      { required: true },
    );
    if (!response.ok) {
      return buildResult('error', `快速测试失败 ${response.status}`, await safeReadBody(response));
    }
    const payload = (await response.json()) as { content?: string };
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
