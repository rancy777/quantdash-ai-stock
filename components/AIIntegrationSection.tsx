import React, { useRef, useState } from 'react';
import GlassCard from './ui/GlassCard';
import Badge from './ui/Badge';
import { AIIntegrationSettings, AIPromptTemplateKey } from '../types';
import {
  getDefaultPromptTemplates,
  loadAIIntegrationSettings,
} from '../services/modelIntegrationService';
import {
  AIDailyReviewEntry,
  AIPlanValidationEntry,
  AIPremarketPlanEntry,
  AIUltraShortAnalysisEntry,
  generateAIDailyReview,
  generateAIPlanValidation,
  generateAIPremarketPlan,
  generateAIUltraShortAnalysis,
  getDailyReviewHistoryByProvider,
  getLatestCachedDailyReviewByProvider,
  getLatestCachedPlanValidationByProvider,
  getLatestCachedPremarketPlanByProvider,
  getLatestCachedUltraShortAnalysisByProvider,
  getPlanValidationHistoryByProvider,
  getPremarketPlanHistoryByProvider,
  getUltraShortAnalysisHistoryByProvider,
  updateStoredDailyReviewContent,
  updateStoredPlanValidationContent,
  updateStoredPremarketPlanContent,
  updateStoredUltraShortAnalysisContent,
} from '../services/aiDailyReviewService';
import { addSymbolsToFocusList, extractObservedSymbols } from '../services/focusListService';
import { AIStockObservationRequest } from '../services/aiNavigationService';
import { emitStockDetailRequest } from '../services/stockNavigationService';
import AIWorkspaceHeader from './ai/AIWorkspaceHeader';
import AIFeishuConfigCard from './ai/AIFeishuConfigCard';
import AIModelConfigCard from './ai/AIModelConfigCard';
import AIModelSidebar from './ai/AIModelSidebar';
import AIPromptTemplateCard from './ai/AIPromptTemplateCard';
import AIDailyReviewPanel from './ai/panels/AIDailyReviewPanel';
import AIPlanValidationPanel from './ai/panels/AIPlanValidationPanel';
import AIPremarketPlanPanel from './ai/panels/AIPremarketPlanPanel';
import AIStockObservationPanel from './ai/panels/AIStockObservationPanel';
import AIUltraShortAnalysisPanel from './ai/panels/AIUltraShortAnalysisPanel';
import useAICachedDocumentWorkflow from './ai/hooks/useAICachedDocumentWorkflow';
import useAIFeishuConfigWorkflow from './ai/hooks/useAIFeishuConfigWorkflow';
import useAIProviderSettings from './ai/hooks/useAIProviderSettings';
import useAIStockObservationWorkflow from './ai/hooks/useAIStockObservationWorkflow';
import useAIWorkspaceFeedback from './ai/hooks/useAIWorkspaceFeedback';

interface AIIntegrationSectionProps {
  stockObservationRequest?: AIStockObservationRequest | null;
  onStockObservationRequestHandled?: (request: AIStockObservationRequest) => void;
}

const AIIntegrationSection: React.FC<AIIntegrationSectionProps> = ({
  stockObservationRequest = null,
  onStockObservationRequestHandled,
}) => {
  const [activeIntegrationTab, setActiveIntegrationTab] = useState<'models' | 'ai' | 'feishu'>('models');
  const [settings, setSettings] = useState<AIIntegrationSettings>(() => loadAIIntegrationSettings());
  const [selectedPromptTemplateKey, setSelectedPromptTemplateKey] = useState<AIPromptTemplateKey>('dailyReview');
  const stockObservationSectionRef = useRef<HTMLDivElement | null>(null);
  const {
    copyFeedback,
    copyToClipboard,
    documentActionFeedback,
    handleCopyDocument,
    handleExportMarkdown,
    notifyDocumentSaved,
    planActionFeedback,
    saveFeedback,
    setPlanActionFeedback,
    setSaveFeedback,
  } = useAIWorkspaceFeedback();
  const {
    feishuConfig,
    feishuError,
    feishuFeedback,
    feishuLoading,
    feishuSaving,
    feishuTestResult,
    feishuTesting,
    handleSaveFeishuConfig,
    handleTestFeishuConfig,
    updateFeishuConfig,
  } = useAIFeishuConfigWorkflow();

  const {
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
  } = useAIProviderSettings({
    settings,
    setSettings,
    setSaveFeedback,
  });
  const {
    draft: dailyReviewDraft,
    editError: dailyReviewEditError,
    editing: editingDailyReview,
    entry: dailyReview,
    error: dailyReviewError,
    generating: generatingDailyReview,
    handleCancelEdit: handleCancelEditDailyReview,
    handleGenerate: handleGenerateDailyReview,
    handleSaveEdit: saveDailyReviewEdit,
    handleStartEdit: handleStartEditDailyReview,
    history: dailyReviewHistory,
    selectedHistoryId: selectedDailyReviewId,
    setDraft: setDailyReviewDraft,
    setSelectedHistoryId: setSelectedDailyReviewId,
  } = useAICachedDocumentWorkflow<AIDailyReviewEntry>({
    selectedProvider,
    getHistoryByProvider: getDailyReviewHistoryByProvider,
    getLatestCachedByProvider: getLatestCachedDailyReviewByProvider,
    generateEntry: generateAIDailyReview,
    updateStoredContent: updateStoredDailyReviewContent,
    generateErrorMessage: '生成当日复盘失败',
    saveErrorMessage: '保存失败：复盘内容不能为空。',
  });
  const {
    draft: ultraShortAnalysisDraft,
    editError: ultraShortAnalysisEditError,
    editing: editingUltraShortAnalysis,
    entry: ultraShortAnalysis,
    error: ultraShortAnalysisError,
    generating: generatingUltraShortAnalysis,
    handleCancelEdit: handleCancelEditUltraShortAnalysis,
    handleGenerate: handleGenerateUltraShortAnalysis,
    handleSaveEdit: saveUltraShortAnalysisEdit,
    handleStartEdit: handleStartEditUltraShortAnalysis,
    history: ultraShortAnalysisHistory,
    selectedHistoryId: selectedUltraShortAnalysisId,
    setDraft: setUltraShortAnalysisDraft,
    setSelectedHistoryId: setSelectedUltraShortAnalysisId,
  } = useAICachedDocumentWorkflow<AIUltraShortAnalysisEntry>({
    selectedProvider,
    getHistoryByProvider: getUltraShortAnalysisHistoryByProvider,
    getLatestCachedByProvider: getLatestCachedUltraShortAnalysisByProvider,
    generateEntry: generateAIUltraShortAnalysis,
    updateStoredContent: updateStoredUltraShortAnalysisContent,
    generateErrorMessage: '生成 AI 超短线深度分析失败',
    saveErrorMessage: '保存失败：分析内容不能为空。',
  });
  const {
    draft: premarketPlanDraft,
    editError: premarketPlanEditError,
    editing: editingPremarketPlan,
    entry: premarketPlan,
    error: premarketPlanError,
    generating: generatingPremarketPlan,
    handleCancelEdit: handleCancelEditPremarketPlan,
    handleGenerate: handleGeneratePremarketPlan,
    handleSaveEdit: savePremarketPlanEdit,
    handleStartEdit: handleStartEditPremarketPlan,
    history: premarketPlanHistory,
    selectedHistoryId: selectedPremarketPlanId,
    setDraft: setPremarketPlanDraft,
    setSelectedHistoryId: setSelectedPremarketPlanId,
  } = useAICachedDocumentWorkflow<AIPremarketPlanEntry>({
    selectedProvider,
    getHistoryByProvider: getPremarketPlanHistoryByProvider,
    getLatestCachedByProvider: getLatestCachedPremarketPlanByProvider,
    generateEntry: generateAIPremarketPlan,
    updateStoredContent: updateStoredPremarketPlanContent,
    generateErrorMessage: '生成盘前计划失败',
    saveErrorMessage: '保存失败：盘前计划内容不能为空。',
  });
  const {
    draft: planValidationDraft,
    editError: planValidationEditError,
    editing: editingPlanValidation,
    entry: planValidation,
    error: planValidationError,
    generating: generatingPlanValidation,
    handleCancelEdit: handleCancelEditPlanValidation,
    handleGenerate: handleGeneratePlanValidation,
    handleSaveEdit: savePlanValidationEdit,
    handleStartEdit: handleStartEditPlanValidation,
    history: planValidationHistory,
    selectedHistoryId: selectedPlanValidationId,
    setDraft: setPlanValidationDraft,
    setSelectedHistoryId: setSelectedPlanValidationId,
  } = useAICachedDocumentWorkflow<AIPlanValidationEntry>({
    selectedProvider,
    getHistoryByProvider: getPlanValidationHistoryByProvider,
    getLatestCachedByProvider: getLatestCachedPlanValidationByProvider,
    generateEntry: generateAIPlanValidation,
    updateStoredContent: updateStoredPlanValidationContent,
    generateErrorMessage: '生成次日校验失败',
    saveErrorMessage: '保存失败：次日校验内容不能为空。',
  });
  const {
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
  } = useAIStockObservationWorkflow({
    selectedProvider,
    stockObservationRequest,
    onStockObservationRequestHandled,
    setActiveIntegrationTab,
    setSelectedPromptTemplateKey,
    setPlanActionFeedback,
    stockObservationSectionRef,
  });
  const observedSymbols = premarketPlan ? extractObservedSymbols(premarketPlan.content) : [];
  const selectedPromptTemplate = settings.promptTemplates[selectedPromptTemplateKey];
  const showDailyReviewPanel = selectedPromptTemplateKey === 'dailyReview';
  const showUltraShortAnalysisPanel = selectedPromptTemplateKey === 'ultraShortAnalysis';
  const showPremarketPlanPanel = selectedPromptTemplateKey === 'premarketPlan';
  const showStockObservationPanel = selectedPromptTemplateKey === 'stockObservation';
  const showPlanValidationPanel = selectedPromptTemplateKey === 'planValidation';

  const handlePromptTemplateChange = (key: AIPromptTemplateKey, value: string) => {
    setSettings((current) => ({
      ...current,
      promptTemplates: {
        ...current.promptTemplates,
        [key]: value,
      },
    }));
  };

  const handleResetPromptTemplate = (key: AIPromptTemplateKey) => {
    const defaults = getDefaultPromptTemplates();
    handlePromptTemplateChange(key, defaults[key]);
    setSaveFeedback('模板已恢复默认');
  };

  const handleSaveDailyReviewEdit = () => {
    const updated = saveDailyReviewEdit();
    if (!updated) return;
    notifyDocumentSaved('AI 当日复盘');
  };

  const handleSaveUltraShortAnalysisEdit = () => {
    const updated = saveUltraShortAnalysisEdit();
    if (!updated) return;
    notifyDocumentSaved('AI 超短线深度分析');
  };

  const handleSavePremarketPlanEdit = () => {
    const updated = savePremarketPlanEdit();
    if (!updated) return;
    notifyDocumentSaved('盘前计划');
  };

  const handleSavePlanValidationEdit = () => {
    const updated = savePlanValidationEdit();
    if (!updated) return;
    notifyDocumentSaved('次日校验');
  };

  const handleAddObservedSymbols = async () => {
    if (observedSymbols.length === 0) {
      setPlanActionFeedback('盘前计划里没有识别到股票代码');
      return;
    }
    try {
      const result = await addSymbolsToFocusList(observedSymbols);
      const modeLabel = result.mode === 'remote' ? '自选' : '本地重点关注';
      await refreshFocusList();
      if (result.addedSymbols.length === 0) {
        setPlanActionFeedback(`观察标的已存在于${modeLabel}`);
        return;
      }
      setPlanActionFeedback(`已加入${modeLabel}: ${result.addedSymbols.join('、')}`);
    } catch (error) {
      console.warn('Failed to add observed symbols', error);
      setPlanActionFeedback(error instanceof Error ? error.message : '加入自选失败');
    }
  };

  return (
    <div className="h-full overflow-auto pr-1">
      <AIWorkspaceHeader
        activeTab={activeIntegrationTab}
        configuredProvidersCount={configuredProviders.length}
        selectedProviderLabel={selectedProvider?.displayName ?? '未选择模型'}
        feishuStatusLabel={feishuTestResult?.statusLabel ?? '待测试'}
        onTabChange={setActiveIntegrationTab}
      />

      <div className={`grid grid-cols-1 gap-6 ${activeIntegrationTab === 'models' ? 'xl:grid-cols-[360px_minmax(0,1fr)]' : ''}`}>
        <div className="space-y-6">
          {activeIntegrationTab === 'feishu' && (
            <AIFeishuConfigCard
              feishuLoading={feishuLoading}
              feishuSaving={feishuSaving}
              feishuTesting={feishuTesting}
              feishuFeedback={feishuFeedback}
              feishuError={feishuError}
              feishuConfig={feishuConfig}
              feishuTestResult={feishuTestResult}
              onUpdateFeishuConfig={updateFeishuConfig}
              onSaveFeishuConfig={handleSaveFeishuConfig}
              onTestFeishuConfig={handleTestFeishuConfig}
            />
          )}

          {activeIntegrationTab === 'models' && (
            <AIModelSidebar
              providersCount={settings.providers.length}
              configuredProvidersCount={configuredProviders.length}
              configuredCloudProvidersCount={configuredCloudProviders.length}
              localProvidersCount={localProviders.length}
              selectedProvider={selectedProvider}
              selectedProviderId={selectedProviderId}
              selectedProviderTestResult={selectedProviderTestResult}
              isProviderDropdownOpen={isProviderDropdownOpen}
              providerDropdownRef={providerDropdownRef}
              cloudProviders={cloudProviders}
              localProviders={localProviders}
              onToggleDropdown={toggleProviderDropdown}
              onSelectProvider={handleSelectProvider}
              onAddProvider={handleAddProvider}
            />
          )}
        </div>

        <div className="space-y-6">
          {activeIntegrationTab === 'ai' && (
            <AIPromptTemplateCard
              selectedPromptTemplateKey={selectedPromptTemplateKey}
              selectedPromptTemplate={selectedPromptTemplate}
              selectedProvider={selectedProvider}
              generatingStockObservation={generatingStockObservation}
              stockObservationSymbol={stockObservationSymbol}
              onPromptTemplateSelect={setSelectedPromptTemplateKey}
              onCopyTemplate={() => copyToClipboard('提示词模板', selectedPromptTemplate)}
              onResetTemplate={() => handleResetPromptTemplate(selectedPromptTemplateKey)}
              onSaveTemplate={handleSaveSettings}
              onPromptTemplateChange={handlePromptTemplateChange}
              onStockObservationSymbolChange={setStockObservationSymbol}
              onGenerateStockObservation={handleGenerateStockObservation}
            />
          )}

          {activeIntegrationTab === 'models' && (
          <div className="space-y-6">

          <AIModelConfigCard
            selectedProvider={selectedProvider}
            selectedProviderTestResult={selectedProviderTestResult}
            pingTesting={pingTestingProviderId === selectedProvider?.id}
            testing={testingProviderId === selectedProvider?.id}
            settingsUpdatedAt={settings.updatedAt}
            onPromptPingTest={handlePromptPingTest}
            onConnectionTest={handleConnectionTest}
            onSaveSettings={handleSaveSettings}
            onPatchProvider={patchProvider}
            onSetPreferredProvider={handleSetPreferredProvider}
            onDeleteProvider={handleDeleteProvider}
          />

          <GlassCard title="本地模型">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="rounded-xl border border-slate-200/70 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                <div className="text-sm font-semibold text-slate-800 dark:text-gray-100">Ollama</div>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-gray-300">
                  地址通常填 `http://127.0.0.1:11434/v1`，模型填本地已拉取的名称。
                </p>
              </div>
              <div className="rounded-xl border border-slate-200/70 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                <div className="text-sm font-semibold text-slate-800 dark:text-gray-100">LM Studio</div>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-gray-300">
                  先开启 OpenAI Compatible Server，再填 `http://127.0.0.1:1234/v1`。
                </p>
              </div>
              <div className="rounded-xl border border-slate-200/70 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                <div className="text-sm font-semibold text-slate-800 dark:text-gray-100">自建服务</div>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-gray-300">
                  只要你的网关或推理服务兼容 OpenAI 接口，就能直接接入这一页。
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200/70 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
              <div className="text-sm font-semibold text-slate-800 dark:text-gray-100">当前策略</div>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-gray-300">
                当前真正使用的 AI 功能只保留两项：`AI 当日复盘` 和 `盘前计划`。模型配置、提示词模板、本地模型接入都围绕这两项服务。
              </p>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-gray-400">
              {settings.preferredProviderId && (
                <Badge variant="green">
                  默认模型：
                  {settings.providers.find((item) => item.id === settings.preferredProviderId)?.displayName ?? '未设置'}
                </Badge>
              )}
              {copyFeedback && <Badge variant="blue">{copyFeedback}</Badge>}
              {saveFeedback && <Badge variant="purple">{saveFeedback}</Badge>}
              {planActionFeedback && <Badge variant="blue">{planActionFeedback}</Badge>}
            </div>
          </GlassCard>
          </div>
          )}

          {activeIntegrationTab === 'ai' && (
          <>
          {selectedPromptTemplateKey === 'reportSummary' && (
            <GlassCard title="研报摘要">
              <div className="rounded-xl border border-slate-200/70 bg-white/70 p-6 text-sm leading-7 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
                当前切换的是 <code>研报摘要模板</code>。研报摘要的实际使用入口在 <code>信息采集 / 研报 / AI 摘要</code>，这里不再重复展示其它 AI 分析模块。
              </div>
            </GlassCard>
          )}

          {showUltraShortAnalysisPanel && (
            <AIUltraShortAnalysisPanel
              canGenerate={Boolean(selectedProvider)}
              generating={generatingUltraShortAnalysis}
              error={ultraShortAnalysisError}
              history={ultraShortAnalysisHistory}
              selectedHistoryId={selectedUltraShortAnalysisId}
              analysis={ultraShortAnalysis}
              editing={editingUltraShortAnalysis}
              draft={ultraShortAnalysisDraft}
              editError={ultraShortAnalysisEditError}
              documentActionMessage={
                documentActionFeedback?.scope === 'AI 超短线深度分析'
                  ? documentActionFeedback.message
                  : undefined
              }
              onGenerate={handleGenerateUltraShortAnalysis}
              onHistorySelect={setSelectedUltraShortAnalysisId}
              onStartEdit={handleStartEditUltraShortAnalysis}
              onSaveEdit={handleSaveUltraShortAnalysisEdit}
              onCancelEdit={handleCancelEditUltraShortAnalysis}
              onDraftChange={setUltraShortAnalysisDraft}
              onCopy={() => ultraShortAnalysis && handleCopyDocument('AI 超短线深度分析', ultraShortAnalysis.content)}
              onExport={() =>
                ultraShortAnalysis &&
                handleExportMarkdown(
                  'AI 超短线深度分析',
                  ultraShortAnalysis.content,
                  `最近交易日 ${ultraShortAnalysis.analysisDate} · ${ultraShortAnalysis.providerName}`
                )
              }
            />
          )}

          {showDailyReviewPanel && (
            <AIDailyReviewPanel
              canGenerate={Boolean(selectedProvider)}
              generating={generatingDailyReview}
              selectedProviderLabel={selectedProvider?.displayName}
              error={dailyReviewError}
              history={dailyReviewHistory}
              selectedHistoryId={selectedDailyReviewId}
              review={dailyReview}
              editing={editingDailyReview}
              draft={dailyReviewDraft}
              editError={dailyReviewEditError}
              documentActionMessage={
                documentActionFeedback?.scope === 'AI 当日复盘'
                  ? documentActionFeedback.message
                  : undefined
              }
              onGenerate={handleGenerateDailyReview}
              onHistorySelect={setSelectedDailyReviewId}
              onStartEdit={handleStartEditDailyReview}
              onSaveEdit={handleSaveDailyReviewEdit}
              onCancelEdit={handleCancelEditDailyReview}
              onDraftChange={setDailyReviewDraft}
              onCopy={() => dailyReview && handleCopyDocument('AI 当日复盘', dailyReview.content)}
              onExport={() =>
                dailyReview &&
                handleExportMarkdown(
                  'AI 当日复盘',
                  dailyReview.content,
                  `最近交易日 ${dailyReview.analysisDate} · ${dailyReview.providerName}`
                )
              }
            />
          )}

          {showPremarketPlanPanel && (
            <AIPremarketPlanPanel
              canGenerate={Boolean(selectedProvider)}
              generating={generatingPremarketPlan}
              error={premarketPlanError}
              history={premarketPlanHistory}
              selectedHistoryId={selectedPremarketPlanId}
              plan={premarketPlan}
              editing={editingPremarketPlan}
              draft={premarketPlanDraft}
              editError={premarketPlanEditError}
              observedSymbols={observedSymbols}
              documentActionMessage={
                documentActionFeedback?.scope === '盘前计划'
                  ? documentActionFeedback.message
                  : undefined
              }
              onGenerate={handleGeneratePremarketPlan}
              onHistorySelect={setSelectedPremarketPlanId}
              onStartEdit={handleStartEditPremarketPlan}
              onSaveEdit={handleSavePremarketPlanEdit}
              onCancelEdit={handleCancelEditPremarketPlan}
              onDraftChange={setPremarketPlanDraft}
              onCopy={() => premarketPlan && handleCopyDocument('盘前计划', premarketPlan.content)}
              onExport={() =>
                premarketPlan &&
                handleExportMarkdown(
                  '盘前计划',
                  premarketPlan.content,
                  `目标交易日 ${premarketPlan.targetTradingDate} · ${premarketPlan.providerName}`
                )
              }
              onAddObservedSymbols={handleAddObservedSymbols}
              onOpenStockObservation={(symbol) => {
                void openStockObservation(symbol, '盘前计划观察标的');
              }}
            />
          )}

          {showStockObservationPanel && (
            <AIStockObservationPanel
              containerRef={stockObservationSectionRef}
              canGenerate={Boolean(selectedProvider)}
              generating={generatingStockObservation}
              symbol={stockObservationSymbol}
              error={stockObservationError}
              history={stockObservationHistory}
              selectedHistoryId={selectedStockObservationId}
              observation={stockObservation}
              editing={editingStockObservation}
              draft={stockObservationDraft}
              editError={stockObservationEditError}
              documentActionMessage={
                documentActionFeedback?.scope === '个股观察'
                  ? documentActionFeedback.message
                  : undefined
              }
              focusListItems={focusListItems}
              focusListMode={focusListMode}
              focusListLoading={focusListLoading}
              onGenerate={handleGenerateStockObservation}
              onSymbolChange={setStockObservationSymbol}
              onHistorySelect={setSelectedStockObservationId}
              onRefreshFocusList={() => {
                void refreshFocusList();
              }}
              onOpenSavedStockObservation={(symbol, sourceLabel) => {
                void openStockObservation(symbol, sourceLabel);
              }}
              onAddToFocusList={() => {
                void handleAddCurrentObservationToFocusList();
              }}
              onOpenStockDetail={(symbol) => emitStockDetailRequest(symbol, 'ai-stock-observation')}
              onStartEdit={handleStartEditStockObservation}
              onSaveEdit={() => {
                const updated = handleSaveStockObservationEdit();
                if (!updated) return;
                notifyDocumentSaved('个股观察');
              }}
              onCancelEdit={handleCancelEditStockObservation}
              onDraftChange={setStockObservationDraft}
              onCopy={() => stockObservation && handleCopyDocument('个股观察', stockObservation.content)}
              onExport={() =>
                stockObservation &&
                handleExportMarkdown(
                  '个股观察',
                  stockObservation.content,
                  `${stockObservation.name} ${stockObservation.symbol} · ${stockObservation.providerName}`
                )
              }
            />
          )}

          {showPlanValidationPanel && (
            <AIPlanValidationPanel
              canGenerate={Boolean(selectedProvider)}
              generating={generatingPlanValidation}
              error={planValidationError}
              history={planValidationHistory}
              selectedHistoryId={selectedPlanValidationId}
              validation={planValidation}
              editing={editingPlanValidation}
              draft={planValidationDraft}
              editError={planValidationEditError}
              documentActionMessage={
                documentActionFeedback?.scope === '次日校验'
                  ? documentActionFeedback.message
                  : undefined
              }
              onGenerate={handleGeneratePlanValidation}
              onHistorySelect={setSelectedPlanValidationId}
              onStartEdit={handleStartEditPlanValidation}
              onSaveEdit={handleSavePlanValidationEdit}
              onCancelEdit={handleCancelEditPlanValidation}
              onDraftChange={setPlanValidationDraft}
              onCopy={() => planValidation && handleCopyDocument('次日校验', planValidation.content)}
              onExport={() =>
                planValidation &&
                handleExportMarkdown(
                  '次日校验',
                  planValidation.content,
                  `计划 ${planValidation.targetTradingDate} · 校验 ${planValidation.validationDate} · ${planValidation.providerName}`
                )
              }
            />
          )}
          </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIIntegrationSection;
