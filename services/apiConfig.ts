const resolveBaseFromWindow = () => {
  if (typeof window === 'undefined') return null;
  return (window as any)?.__SCREENER_API__ ?? null;
};

export const resolveScreenerApiBase = () => {
  const envBase = (import.meta as any)?.env?.VITE_SCREENER_API;
  const runtimeBase = resolveBaseFromWindow();
  const base = envBase || runtimeBase || 'http://127.0.0.1:7878';
  return base.replace(/\/$/, '');
};

