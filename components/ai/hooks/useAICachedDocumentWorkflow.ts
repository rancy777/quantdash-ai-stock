import { useEffect, useMemo, useState } from 'react';

import { ModelProviderConfig } from '../../../types';

type CachedDocumentEntry = {
  id: string;
  content: string;
};

type UseAICachedDocumentWorkflowOptions<TEntry extends CachedDocumentEntry> = {
  selectedProvider: ModelProviderConfig | null;
  getHistoryByProvider: (providerId: string) => TEntry[];
  getLatestCachedByProvider: (providerId: string) => TEntry | null;
  generateEntry: (payload: { providerId: string }) => Promise<TEntry>;
  updateStoredContent: (id: string, content: string) => TEntry | null;
  generateErrorMessage: string;
  saveErrorMessage: string;
};

export default function useAICachedDocumentWorkflow<TEntry extends CachedDocumentEntry>({
  selectedProvider,
  getHistoryByProvider,
  getLatestCachedByProvider,
  generateEntry,
  updateStoredContent,
  generateErrorMessage,
  saveErrorMessage,
}: UseAICachedDocumentWorkflowOptions<TEntry>) {
  const [entry, setEntry] = useState<TEntry | null>(null);
  const [selectedHistoryId, setSelectedHistoryId] = useState('');
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [editError, setEditError] = useState('');
  const [historyVersion, setHistoryVersion] = useState(0);

  const history = useMemo(
    () => (selectedProvider ? getHistoryByProvider(selectedProvider.id) : []),
    [getHistoryByProvider, historyVersion, selectedProvider]
  );

  useEffect(() => {
    setEditing(false);
    setEditError('');
    setDraft(entry?.content ?? '');
  }, [entry]);

  useEffect(() => {
    if (!selectedProvider) {
      setEntry(null);
      setSelectedHistoryId('');
      setError('');
      return;
    }

    const nextEntry = getLatestCachedByProvider(selectedProvider.id);
    setEntry(nextEntry);
    setSelectedHistoryId(nextEntry?.id ?? '');
    setError('');
  }, [getLatestCachedByProvider, selectedProvider]);

  useEffect(() => {
    if (!history.length) return;

    const nextEntry = history.find((item) => item.id === selectedHistoryId) ?? history[0];
    setEntry(nextEntry);
    if (selectedHistoryId !== nextEntry.id) {
      setSelectedHistoryId(nextEntry.id);
    }
  }, [history, selectedHistoryId]);

  const handleGenerate = async () => {
    if (!selectedProvider) return null;

    setGenerating(true);
    setError('');
    try {
      const nextEntry = await generateEntry({ providerId: selectedProvider.id });
      setEntry(nextEntry);
      setSelectedHistoryId(nextEntry.id);
      setHistoryVersion((current) => current + 1);
      return nextEntry;
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : generateErrorMessage);
      return null;
    } finally {
      setGenerating(false);
    }
  };

  const handleStartEdit = () => {
    if (!entry) return;
    setEditing(true);
    setEditError('');
    setDraft(entry.content);
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setEditError('');
    setDraft(entry?.content ?? '');
  };

  const handleSaveEdit = () => {
    if (!entry) return null;

    const updatedEntry = updateStoredContent(entry.id, draft);
    if (!updatedEntry) {
      setEditError(saveErrorMessage);
      return null;
    }

    setEntry(updatedEntry);
    setEditing(false);
    setEditError('');
    setHistoryVersion((current) => current + 1);
    return updatedEntry;
  };

  return {
    draft,
    editError,
    editing,
    entry,
    error,
    generating,
    handleCancelEdit,
    handleGenerate,
    handleSaveEdit,
    handleStartEdit,
    history,
    selectedHistoryId,
    setDraft,
    setSelectedHistoryId,
  };
}
