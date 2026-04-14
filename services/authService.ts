import { resolveScreenerApiBase } from './apiConfig';

export interface AuthResponse {
  token: string;
  username: string;
}

const getBaseHeaders = () => ({
  'Content-Type': 'application/json',
});

const handleJsonResponse = async (res: Response) => {
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const message = data?.detail || data?.message || '请求失败，请稍后重试';
    throw new Error(message);
  }
  return data;
};

export const registerUser = async (username: string, password: string): Promise<AuthResponse> => {
  const apiBase = resolveScreenerApiBase();
  const res = await fetch(`${apiBase}/auth/register`, {
    method: 'POST',
    headers: getBaseHeaders(),
    body: JSON.stringify({ username, password }),
  });
  return handleJsonResponse(res);
};

export const loginUser = async (username: string, password: string): Promise<AuthResponse> => {
  const apiBase = resolveScreenerApiBase();
  const res = await fetch(`${apiBase}/auth/login`, {
    method: 'POST',
    headers: getBaseHeaders(),
    body: JSON.stringify({ username, password }),
  });
  return handleJsonResponse(res);
};

export const fetchCurrentUser = async (token: string): Promise<{ username: string }> => {
  const apiBase = resolveScreenerApiBase();
  const res = await fetch(`${apiBase}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return handleJsonResponse(res);
};

export const logoutUser = async (token: string) => {
  const apiBase = resolveScreenerApiBase();
  await fetch(`${apiBase}/auth/logout`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export const changePasswordRequest = async (
  token: string,
  oldPassword: string,
  newPassword: string
): Promise<void> => {
  const apiBase = resolveScreenerApiBase();
  const res = await fetch(`${apiBase}/auth/change-password`, {
    method: 'POST',
    headers: {
      ...getBaseHeaders(),
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ oldPassword, newPassword }),
  });
  await handleJsonResponse(res);
};
