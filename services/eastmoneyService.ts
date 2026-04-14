type FetchFallbackOptions = {
  timeout?: number;
};

export type DataSource = 'local' | 'api' | 'unknown';

export const fetchJsonWithFallback = async (url: string, options: FetchFallbackOptions = {}) => {
  const timeout = options.timeout ?? 8000;

  const fetchWithTimeout = async (resource: string) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(resource, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      return response;
    } finally {
      clearTimeout(id);
    }
  };

  try {
    const res = await fetchWithTimeout(url);
    return await res.json();
  } catch {
    // Continue to proxies
  }

  try {
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const res = await fetchWithTimeout(proxyUrl);
    const data = await res.json();
    if (data.contents) {
      return typeof data.contents === 'string' ? JSON.parse(data.contents) : data.contents;
    }
  } catch {
    // Continue
  }

  try {
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
    const res = await fetchWithTimeout(proxyUrl);
    return await res.json();
  } catch {
    // Continue
  }

  throw new Error('All fetch methods failed');
};
