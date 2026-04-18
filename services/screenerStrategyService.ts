import { resolveScreenerApiBase } from './apiConfig';
import { ScreenerStrategyCatalogEntry } from '../types';


const SCREENER_STRATEGIES_ENDPOINT = `${resolveScreenerApiBase()}/screener/strategies`;

type ScreenerStrategyCatalogResponse = {
  entries?: ScreenerStrategyCatalogEntry[];
};

export const fetchScreenerStrategyCatalog = async (): Promise<ScreenerStrategyCatalogEntry[]> => {
  try {
    const response = await fetch(SCREENER_STRATEGIES_ENDPOINT, {
      cache: 'no-store',
    });
    if (!response.ok) {
      return [];
    }
    const payload = (await response.json()) as ScreenerStrategyCatalogResponse;
    return Array.isArray(payload.entries) ? payload.entries : [];
  } catch (error) {
    console.warn('Failed to load screener strategy catalog', error);
    return [];
  }
};
