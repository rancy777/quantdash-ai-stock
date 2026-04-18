import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';

import {
  createCustomProvider,
  saveAIIntegrationSettings,
  testModelProviderConnection,
  testModelProviderPrompt,
  type ProviderConnectionTestResult,
} from '../../../services/modelIntegrationService';
import { AIIntegrationSettings, ModelProviderConfig, ModelProviderMode } from '../../../types';

type UseAIProviderSettingsOptions = {
  settings: AIIntegrationSettings;
  setSettings: Dispatch<SetStateAction<AIIntegrationSettings>>;
  setSaveFeedback: Dispatch<SetStateAction<string>>;
};

export default function useAIProviderSettings({
  settings,
  setSettings,
  setSaveFeedback,
}: UseAIProviderSettingsOptions) {
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(settings.preferredProviderId);
  const [isProviderDropdownOpen, setIsProviderDropdownOpen] = useState(false);
  const [testingProviderId, setTestingProviderId] = useState<string | null>(null);
  const [pingTestingProviderId, setPingTestingProviderId] = useState<string | null>(null);
  const [connectionResults, setConnectionResults] = useState<Record<string, ProviderConnectionTestResult>>({});
  const providerDropdownRef = useRef<HTMLDivElement | null>(null);

  const selectedProvider = useMemo(
    () => settings.providers.find((item) => item.id === selectedProviderId) ?? settings.providers[0] ?? null,
    [selectedProviderId, settings.providers]
  );
  const cloudProviders = useMemo(
    () => settings.providers.filter((item) => item.mode === 'cloud'),
    [settings.providers]
  );
  const localProviders = useMemo(
    () => settings.providers.filter((item) => item.mode === 'local'),
    [settings.providers]
  );
  const configuredCloudProviders = useMemo(
    () => settings.providers.filter((item) => item.mode === 'cloud' && item.apiKey.trim()),
    [settings.providers]
  );
  const configuredProviders = useMemo(
    () =>
      settings.providers.filter(
        (item) => (item.mode === 'cloud' && item.apiKey.trim()) || (item.mode === 'local' && item.enabled)
      ),
    [settings.providers]
  );
  const selectedProviderTestResult = selectedProvider ? connectionResults[selectedProvider.id] : undefined;

  useEffect(() => {
    if (!settings.providers.length) {
      if (selectedProviderId !== null) {
        setSelectedProviderId(null);
      }
      return;
    }

    if (!selectedProviderId || !settings.providers.some((item) => item.id === selectedProviderId)) {
      setSelectedProviderId(settings.providers[0].id);
    }
  }, [selectedProviderId, settings.providers]);

  useEffect(() => {
    if (!isProviderDropdownOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!providerDropdownRef.current?.contains(event.target as Node)) {
        setIsProviderDropdownOpen(false);
      }
    };
    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, [isProviderDropdownOpen]);

  const handleSaveSettings = () => {
    const next = saveAIIntegrationSettings({
      ...settings,
      preferredProviderId: selectedProvider?.id ?? settings.preferredProviderId,
    });
    setSettings(next);
    setSaveFeedback('已保存到本地浏览器');
  };

  const handleAddProvider = (mode: ModelProviderMode) => {
    const nextProvider = createCustomProvider(mode);
    setSettings((current) => ({
      ...current,
      providers: [nextProvider, ...current.providers],
      preferredProviderId: current.preferredProviderId ?? nextProvider.id,
    }));
    setSelectedProviderId(nextProvider.id);
  };

  const handleDeleteProvider = (providerId: string) => {
    const nextSelectedId = settings.providers.filter((item) => item.id !== providerId)[0]?.id ?? null;

    setSettings((current) => {
      const nextProviders = current.providers.filter((item) => item.id !== providerId);
      return {
        ...current,
        providers: nextProviders,
        preferredProviderId:
          current.preferredProviderId === providerId ? nextProviders[0]?.id ?? null : current.preferredProviderId,
      };
    });
    setSelectedProviderId((current) => (current === providerId ? nextSelectedId : current));
    setConnectionResults((current) => {
      if (!(providerId in current)) {
        return current;
      }

      const { [providerId]: _removedResult, ...rest } = current;
      return rest;
    });
  };

  const updateProvider = (
    providerId: string,
    updater: (provider: ModelProviderConfig) => ModelProviderConfig
  ) => {
    setSettings((current) => ({
      ...current,
      providers: current.providers.map((item) =>
        item.id === providerId ? { ...updater(item), updatedAt: new Date().toISOString() } : item
      ),
    }));
  };

  const patchProvider = (providerId: string, changes: Partial<ModelProviderConfig>) => {
    updateProvider(providerId, (provider) => ({
      ...provider,
      ...changes,
    }));
  };

  const handleSelectProvider = (providerId: string) => {
    setSelectedProviderId(providerId);
    setIsProviderDropdownOpen(false);
  };

  const toggleProviderDropdown = () => {
    setIsProviderDropdownOpen((current) => !current);
  };

  const handleConnectionTest = async () => {
    if (!selectedProvider) return;

    setTestingProviderId(selectedProvider.id);
    const result = await testModelProviderConnection(selectedProvider);
    setConnectionResults((current) => ({
      ...current,
      [selectedProvider.id]: result,
    }));
    setTestingProviderId(null);
  };

  const handlePromptPingTest = async () => {
    if (!selectedProvider) return;

    setPingTestingProviderId(selectedProvider.id);
    const result = await testModelProviderPrompt(selectedProvider);
    setConnectionResults((current) => ({
      ...current,
      [selectedProvider.id]: result,
    }));
    setPingTestingProviderId(null);
  };

  const handleSetPreferredProvider = (providerId: string) => {
    setSettings((current) => ({
      ...current,
      preferredProviderId: providerId,
    }));
  };

  return {
    cloudProviders,
    configuredCloudProviders,
    configuredProviders,
    handleAddProvider,
    handleConnectionTest,
    handleDeleteProvider,
    handlePromptPingTest,
    handleSaveSettings,
    handleSelectProvider,
    handleSetPreferredProvider,
    isProviderDropdownOpen,
    localProviders,
    patchProvider,
    pingTestingProviderId,
    providerDropdownRef,
    selectedProvider,
    selectedProviderId,
    selectedProviderTestResult,
    testingProviderId,
    toggleProviderDropdown,
  };
}
