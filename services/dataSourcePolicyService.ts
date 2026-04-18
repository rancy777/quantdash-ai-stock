import type {
  DataSourcePolicyMode,
  DataSourcePolicyState,
  DataSourcePolicyStatus,
  SecondaryHealthState,
} from '../types';
import { resolveScreenerApiBase } from './apiConfig';
import { buildStoredAuthHeaders, handleAuthFailure } from './authRequest';

const API_BASE = resolveScreenerApiBase();

const ensureOk = async (response: Response) => {
  if (response.ok) return response;
  const detail = await response.text();
  throw new Error(detail || `Request failed with status ${response.status}`);
};

export const loadDataSourcePolicy = async (): Promise<DataSourcePolicyState> => {
  const response = await ensureOk(
    await handleAuthFailure(
      await fetch(`${API_BASE}/eastmoney/provider-policy`, {
        headers: buildStoredAuthHeaders(undefined, { required: true }),
        method: 'GET',
      }),
      { required: true },
    ),
  );
  return response.json();
};

export const loadDataSourceStatus = async (): Promise<DataSourcePolicyStatus> => {
  const response = await ensureOk(
    await handleAuthFailure(
      await fetch(`${API_BASE}/eastmoney/status`, {
        headers: buildStoredAuthHeaders(undefined, { required: true }),
        method: 'GET',
      }),
      { required: true },
    ),
  );
  const payload = await response.json();
  return {
    providerPolicy: payload.providerPolicy as DataSourcePolicyState,
    secondaryHealth: payload.secondaryHealth as SecondaryHealthState,
  };
};

export const updateDataSourcePolicy = async (
  globalMode: DataSourcePolicyMode,
  datasetOverrides: Record<string, DataSourcePolicyMode>,
): Promise<DataSourcePolicyState> => {
  const response = await ensureOk(
    await handleAuthFailure(
      await fetch(`${API_BASE}/eastmoney/provider-policy`, {
        body: JSON.stringify({ datasetOverrides, globalMode }),
        headers: buildStoredAuthHeaders(
          {
            'Content-Type': 'application/json',
          },
          { required: true },
        ),
        method: 'PUT',
      }),
      { required: true },
    ),
  );
  return response.json();
};

export const probeDataSourceHealth = async (): Promise<SecondaryHealthState> => {
  const response = await ensureOk(
    await handleAuthFailure(
      await fetch(`${API_BASE}/eastmoney/secondary-health/probe`, {
        headers: buildStoredAuthHeaders(undefined, { required: true }),
        method: 'POST',
      }),
      { required: true },
    ),
  );
  return response.json();
};
