import { resolveScreenerApiBase } from './apiConfig';
import { buildStoredAuthHeaders, handleAuthFailure } from './authRequest';
import { loadLocalJsonFile } from './localDataService';
import { SyncRuntimeStatus, SyncStatusPayload } from '../types';

const DEFAULT_RUNTIME_STATUS: SyncRuntimeStatus = {
  state: 'idle',
  trigger: null,
  mode: null,
  startedAt: null,
  finishedAt: null,
  exitCode: null,
  error: null,
  pid: null,
};

export const loadSyncStatus = async () =>
  loadLocalJsonFile<SyncStatusPayload>('sync_status.json', { timeout: 1200 });

export const fetchSyncRuntimeStatus = async (): Promise<SyncRuntimeStatus> => {
  try {
    const response = await handleAuthFailure(
      await fetch(`${resolveScreenerApiBase()}/sync/runtime-status`, {
        cache: 'no-store',
        headers: buildStoredAuthHeaders(undefined, { required: false }),
      }),
      { required: false },
    );
    if (!response.ok) {
      return DEFAULT_RUNTIME_STATUS;
    }
    return (await response.json()) as SyncRuntimeStatus;
  } catch {
    return DEFAULT_RUNTIME_STATUS;
  }
};

export const triggerStartupSync = async (mode: 'startup' | 'market' | 'offline' = 'startup') => {
  const response = await handleAuthFailure(
    await fetch(`${resolveScreenerApiBase()}/sync/startup-check?mode=${mode}`, {
      headers: buildStoredAuthHeaders(undefined, { required: true }),
      method: 'POST',
    }),
    { required: true },
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }
  return response.json();
};
