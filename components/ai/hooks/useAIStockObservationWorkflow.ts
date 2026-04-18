import React, { useEffect, useMemo, useState } from 'react';

import { addSymbolsToFocusList, loadFocusList } from '../../../services/focusListService';
import {
  AIStockObservationEntry,
  generateAIStockObservation,
  getLatestCachedStockObservationByProvider,
  getStockObservationHistoryByProvider,
  updateStoredStockObservationContent,
} from '../../../services/aiDailyReviewService';
import { AIStockObservationRequest } from '../../../services/aiNavigationService';
import { AIPromptTemplateKey, ModelProviderConfig, Stock } from '../../../types';

type UseAIStockObservationWorkflowArgs = {
  selectedProvider: ModelProviderConfig | null;
  stockObservationRequest: AIStockObservationRequest | null;
  onStockObservationRequestHandled?: (request: AIStockObservationRequest) => void;
  setActiveIntegrationTab: React.Dispatch<React.SetStateAction<'models' | 'ai' | 'feishu'>>;
  setSelectedPromptTemplateKey: React.Dispatch<React.SetStateAction<AIPromptTemplateKey>>;
  setPlanActionFeedback: React.Dispatch<React.SetStateAction<string>>;
  stockObservationSectionRef: React.RefObject<HTMLDivElement | null>;
};

export default function useAIStockObservationWorkflow({
  selectedProvider,
  stockObservationRequest,
  onStockObservationRequestHandled,
  setActiveIntegrationTab,
  setSelectedPromptTemplateKey,
  setPlanActionFeedback,
  stockObservationSectionRef,
}: UseAIStockObservationWorkflowArgs) {
  const [stockObservation, setStockObservation] = useState<AIStockObservationEntry | null>(null);
  const [selectedStockObservationId, setSelectedStockObservationId] = useState('');
  const [stockObservationError, setStockObservationError] = useState('');
  const [generatingStockObservation, setGeneratingStockObservation] = useState(false);
  const [stockObservationSymbol, setStockObservationSymbol] = useState('');
  const [editingStockObservation, setEditingStockObservation] = useState(false);
  const [stockObservationDraft, setStockObservationDraft] = useState('');
  const [stockObservationEditError, setStockObservationEditError] = useState('');
  const [stockObservationHistoryVersion, setStockObservationHistoryVersion] = useState(0);
  const [focusListItems, setFocusListItems] = useState<Stock[]>([]);
  const [focusListMode, setFocusListMode] = useState<'remote' | 'local'>('local');
  const [focusListLoading, setFocusListLoading] = useState(false);

  const stockObservationHistory = useMemo(
    () => (selectedProvider ? getStockObservationHistoryByProvider(selectedProvider.id) : []),
    [selectedProvider, stockObservationHistoryVersion]
  );

  const refreshFocusList = async () => {
    setFocusListLoading(true);
    try {
      const result = await loadFocusList();
      setFocusListItems(result.items);
      setFocusListMode(result.mode);
    } catch (error) {
      console.warn('Failed to load focus list', error);
      setFocusListItems([]);
      setFocusListMode('local');
    } finally {
      setFocusListLoading(false);
    }
  };

  useEffect(() => {
    setEditingStockObservation(false);
    setStockObservationEditError('');
    setStockObservationDraft(stockObservation?.content ?? '');
  }, [stockObservation]);

  useEffect(() => {
    if (!selectedProvider) {
      setStockObservation(null);
      setSelectedStockObservationId('');
      setStockObservationSymbol('');
      setStockObservationError('');
      return;
    }
    const nextStockObservation = getLatestCachedStockObservationByProvider(selectedProvider.id);
    setStockObservation(nextStockObservation);
    setSelectedStockObservationId(nextStockObservation?.id ?? '');
    setStockObservationSymbol(nextStockObservation?.symbol ?? '');
    setStockObservationError('');
  }, [selectedProvider]);

  useEffect(() => {
    if (!stockObservationHistory.length) return;
    const next = stockObservationHistory.find((item) => item.id === selectedStockObservationId) ?? stockObservationHistory[0];
    setStockObservation(next);
    setStockObservationSymbol(next.symbol);
    if (selectedStockObservationId !== next.id) {
      setSelectedStockObservationId(next.id);
    }
  }, [stockObservationHistory, selectedStockObservationId]);

  useEffect(() => {
    void refreshFocusList();
  }, []);

  const generateStockObservationForSymbol = async (symbol: string) => {
    if (!selectedProvider) return;
    const normalizedSymbol = symbol.trim();
    if (!normalizedSymbol) return;
    setGeneratingStockObservation(true);
    setStockObservationError('');
    try {
      const entry = await generateAIStockObservation({
        providerId: selectedProvider.id,
        symbol: normalizedSymbol,
      });
      setStockObservation(entry);
      setSelectedStockObservationId(entry.id);
      setStockObservationSymbol(entry.symbol);
      setStockObservationHistoryVersion((current) => current + 1);
    } catch (error) {
      setStockObservationError(error instanceof Error ? error.message : '生成个股观察失败');
    } finally {
      setGeneratingStockObservation(false);
    }
  };

  const handleGenerateStockObservation = async () => {
    await generateStockObservationForSymbol(stockObservationSymbol);
  };

  const openStockObservation = async (symbol: string, sourceLabel: string) => {
    const normalizedSymbol = symbol.trim();
    if (!normalizedSymbol) return;
    setActiveIntegrationTab('ai');
    setStockObservationSymbol(normalizedSymbol);
    setSelectedPromptTemplateKey('stockObservation');
    setPlanActionFeedback(`已从${sourceLabel}切到个股观察：${normalizedSymbol}`);
    stockObservationSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    await generateStockObservationForSymbol(normalizedSymbol);
  };

  const handleAddCurrentObservationToFocusList = async () => {
    if (!stockObservation) return;
    try {
      const result = await addSymbolsToFocusList([stockObservation.symbol]);
      await refreshFocusList();
      const modeLabel = result.mode === 'remote' ? '自选' : '本地重点关注';
      if (result.addedSymbols.length === 0) {
        setPlanActionFeedback(`${stockObservation.symbol} 已存在于${modeLabel}`);
        return;
      }
      setPlanActionFeedback(`已加入${modeLabel}: ${stockObservation.symbol}`);
    } catch (error) {
      console.warn('Failed to add current stock observation to focus list', error);
      setPlanActionFeedback(error instanceof Error ? error.message : '加入自选失败');
    }
  };

  const handleStartEditStockObservation = () => {
    if (!stockObservation) return;
    setEditingStockObservation(true);
    setStockObservationEditError('');
    setStockObservationDraft(stockObservation.content);
  };

  const handleCancelEditStockObservation = () => {
    setEditingStockObservation(false);
    setStockObservationEditError('');
    setStockObservationDraft(stockObservation?.content ?? '');
  };

  const handleSaveStockObservationEdit = () => {
    if (!stockObservation) return null;
    const updated = updateStoredStockObservationContent(stockObservation.id, stockObservationDraft);
    if (!updated) {
      setStockObservationEditError('保存失败：个股观察内容不能为空。');
      return null;
    }
    setStockObservation(updated);
    setEditingStockObservation(false);
    setStockObservationEditError('');
    setStockObservationHistoryVersion((current) => current + 1);
    return updated;
  };

  useEffect(() => {
    if (!stockObservationRequest || !selectedProvider) return;
    const normalizedSymbol = stockObservationRequest.symbol.trim();
    if (!normalizedSymbol) {
      onStockObservationRequestHandled?.(stockObservationRequest);
      return;
    }
    setActiveIntegrationTab('ai');
    setStockObservationSymbol(normalizedSymbol);
    setSelectedPromptTemplateKey('stockObservation');
    setPlanActionFeedback(`已切换到个股观察：${normalizedSymbol}`);
    stockObservationSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    void generateStockObservationForSymbol(normalizedSymbol).finally(() => {
      onStockObservationRequestHandled?.(stockObservationRequest);
    });
  }, [
    onStockObservationRequestHandled,
    selectedProvider,
    setActiveIntegrationTab,
    setPlanActionFeedback,
    setSelectedPromptTemplateKey,
    stockObservationRequest,
    stockObservationSectionRef,
  ]);

  return {
    focusListItems,
    focusListLoading,
    focusListMode,
    generatingStockObservation,
    editingStockObservation,
    selectedStockObservationId,
    stockObservation,
    stockObservationDraft,
    stockObservationEditError,
    stockObservationError,
    stockObservationHistory,
    stockObservationSymbol,
    handleAddCurrentObservationToFocusList,
    handleCancelEditStockObservation,
    handleGenerateStockObservation,
    handleSaveStockObservationEdit,
    handleStartEditStockObservation,
    openStockObservation,
    refreshFocusList,
    setSelectedStockObservationId,
    setStockObservationDraft,
    setStockObservationSymbol,
  };
}
