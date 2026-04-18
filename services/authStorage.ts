const AUTH_TOKEN_STORAGE_KEY = 'quantdash:auth-token';
const LEGACY_AUTH_TOKEN_STORAGE_KEYS = [
  'quantdash:token',
  'authToken',
  'token',
  'screenerToken',
] as const;

const ALL_AUTH_TOKEN_STORAGE_KEYS = [AUTH_TOKEN_STORAGE_KEY, ...LEGACY_AUTH_TOKEN_STORAGE_KEYS] as const;

const hasWindow = () => typeof window !== 'undefined';

export const getStoredAuthToken = (): string | null => {
  if (!hasWindow()) return null;

  const canonicalToken = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  if (canonicalToken) {
    return canonicalToken;
  }

  for (const key of LEGACY_AUTH_TOKEN_STORAGE_KEYS) {
    const legacyToken = window.localStorage.getItem(key);
    if (legacyToken) {
      window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, legacyToken);
      return legacyToken;
    }
  }

  return null;
};

export const saveStoredAuthToken = (token: string) => {
  if (!hasWindow()) return;
  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  LEGACY_AUTH_TOKEN_STORAGE_KEYS.forEach((key) => {
    window.localStorage.removeItem(key);
  });
};

export const clearStoredAuthToken = () => {
  if (!hasWindow()) return;
  ALL_AUTH_TOKEN_STORAGE_KEYS.forEach((key) => {
    window.localStorage.removeItem(key);
  });
};

export const migrateLegacyAuthToken = (): string | null => getStoredAuthToken();

export { AUTH_TOKEN_STORAGE_KEY, LEGACY_AUTH_TOKEN_STORAGE_KEYS };
