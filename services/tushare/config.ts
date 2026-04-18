export type TushareMarketBreadthResponse = {
  code: string;
  message: string;
  data?: {
    fields: string[];
    items: any[];
  };
};

const PLACEHOLDER_KEY = 'YOUR_TUSHARE_API_KEY_HERE';

export const getTushareConfig = () => {
  const apiKey =
    import.meta.env.TUSHARE_API_KEY ||
    import.meta.env.VITE_TUSHARE_API_KEY ||
    PLACEHOLDER_KEY;
  const baseUrl =
    import.meta.env.TUSHARE_API_BASE_URL ||
    import.meta.env.VITE_TUSHARE_API_BASE_URL ||
    'https://api.tushare.pro';

  return { apiKey, baseUrl };
};

export const hasUsableTushareApiKey = (apiKey: string): boolean => {
  const normalizedKey = apiKey.trim();
  return normalizedKey.length > 0 && normalizedKey !== PLACEHOLDER_KEY;
};
