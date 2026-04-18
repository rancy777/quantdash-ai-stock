import { Stock } from '../types';
import { resolveScreenerApiBase } from './apiConfig';
import { getStoredAuthToken } from './authStorage';

const parseResponse = async (res: Response) => {
  const text = await res.text();
  let data: any = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { detail: text };
    }
  }
  if (!res.ok) {
    const message =
      res.status === 401 && !getStoredAuthToken()
        ? '未检测到登录凭证，请先登录后再使用 pywencai 选股。'
        : data?.detail || data?.message || text || '选股请求失败';
    throw new Error(message);
  }
  return data;
};

export type PywencaiScreenerResult = {
  strategy: string;
  question: string;
  count: number;
  results: Stock[];
};

export const runPywencaiScreener = async (question: string): Promise<PywencaiScreenerResult> => {
  const trimmedQuestion = question.trim();
  if (!trimmedQuestion) {
    throw new Error('请输入一句话选股条件');
  }

  const apiBase = resolveScreenerApiBase();
  const token = getStoredAuthToken();
  const headers: HeadersInit = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(
    `${apiBase}/screener?strategy=pywencai&query=${encodeURIComponent(trimmedQuestion)}`,
    { headers },
  );
  const payload = await parseResponse(response);

  return {
    strategy: String(payload?.strategy || 'pywencai'),
    question: String(payload?.question || trimmedQuestion),
    count: Number(payload?.count || 0),
    results: Array.isArray(payload?.results) ? (payload.results as Stock[]) : [],
  };
};
