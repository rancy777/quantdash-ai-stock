import { ExpertHoldingSnapshot } from '../types';
import { loadLocalJsonFile } from './localDataService';

const SNAPSHOT_FILE = 'expert_holding_snapshots.json';

export const getExpertHoldingSnapshots = async (): Promise<ExpertHoldingSnapshot[]> => {
  const payload = await loadLocalJsonFile<ExpertHoldingSnapshot[]>(SNAPSHOT_FILE);
  if (!Array.isArray(payload)) return [];
  return payload
    .filter((item): item is ExpertHoldingSnapshot => Boolean(item?.id && item?.date && Array.isArray(item?.records)))
    .sort((a, b) => b.date.localeCompare(a.date));
};
