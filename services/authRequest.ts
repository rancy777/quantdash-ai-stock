import { clearStoredAuthToken, getStoredAuthToken } from './authStorage';

export class AuthExpiredError extends Error {
  constructor(message = '登录已过期，请重新登录') {
    super(message);
    this.name = 'AuthExpiredError';
  }
}

export const buildStoredAuthHeaders = (
  headers?: HeadersInit,
  options?: { required?: boolean },
): Headers => {
  const nextHeaders = new Headers(headers);
  const token = getStoredAuthToken();
  if (!token) {
    if (options?.required) {
      throw new AuthExpiredError('请先登录后再执行该操作');
    }
    return nextHeaders;
  }

  nextHeaders.set('Authorization', `Bearer ${token}`);
  return nextHeaders;
};

export const handleAuthFailure = async (
  response: Response,
  options?: { required?: boolean },
): Promise<Response> => {
  if (response.status !== 401) {
    return response;
  }

  clearStoredAuthToken();
  if (options?.required) {
    const detail = await response.text().catch(() => '');
    throw new AuthExpiredError(detail || '登录已过期，请重新登录');
  }
  return response;
};
