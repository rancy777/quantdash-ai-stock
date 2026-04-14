import { getJsonCandidatePaths } from './dataPathService';

type LoadLocalJsonOptions = {
  timeout?: number;
  cacheBustToken?: number | string;
};

const getPublicBase = () => (import.meta.env.BASE_URL ?? '/').replace(/\/?$/, '/');

export const loadLocalJsonFile = async <T>(
  fileName: string,
  options: LoadLocalJsonOptions = {},
): Promise<T | null> => {
  if (typeof window === 'undefined') return null;

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), options.timeout ?? 1500);
  const cacheBustToken = options.cacheBustToken ?? Date.now();
  const candidates = getJsonCandidatePaths(fileName);

  try {
    for (const candidate of candidates) {
      const response = await fetch(`${getPublicBase()}${candidate}?v=${cacheBustToken}`, {
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!response.ok) continue;

      const contentType = response.headers.get('content-type') || '';
      const raw = await response.text();
      if (!raw.trim() || contentType.includes('text/html') || raw.trim().startsWith('<!DOCTYPE')) {
        continue;
      }

      return JSON.parse(raw) as T;
    }

    return null;
  } catch (error) {
    if ((error as Error).name !== 'AbortError') {
      console.warn(`Failed to load local data file ${fileName}`, error);
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
};

export const checkLocalPublicFileExists = async (
  fileName: string,
  timeout = 1000,
): Promise<boolean> => {
  if (typeof window === 'undefined') return false;

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeout);
  const candidates = getJsonCandidatePaths(fileName);
  try {
    for (const candidate of candidates) {
      const response = await fetch(`${getPublicBase()}${candidate}?v=${Date.now()}`, {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-store',
      });
      if (response.ok) return true;
    }
    return false;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
};
