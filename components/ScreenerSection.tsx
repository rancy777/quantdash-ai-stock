import React from 'react';

import { getScreenerStrategyTagText, SCREENER_STRATEGIES } from './screener/config';
import ScreenerHoverCard from './screener/ScreenerHoverCard';
import ScreenerResultsPane from './screener/ScreenerResultsPane';
import ScreenerStrategyPanel from './screener/ScreenerStrategyPanel';
import useScreenerHoverCard from './screener/useScreenerHoverCard';
import useScreenerScanWorkflow from './screener/useScreenerScanWorkflow';


const ScreenerSection: React.FC = () => {
  const {
    actionLabel,
    activeStrategy,
    conceptStats,
    hiddenStrategyCards,
    idleHint,
    isPywencaiMode,
    isScanning,
    results,
    scanError,
    scanProgress,
    scanStatus,
    selectStrategy,
    setStockQuery,
    stockQuery,
    toggleStrategyCardVisibility,
    handleStartScan,
  } = useScreenerScanWorkflow();
  const {
    hoveredStock,
    cardStyle,
    handleCardMouseEnter,
    handleCardMouseLeave,
    handleCardSizeChange,
    handleMouseEnter,
    handleMouseLeave,
    handleMouseMove,
  } = useScreenerHoverCard();
  const strategyTagText = getScreenerStrategyTagText(activeStrategy);

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full relative">
      <ScreenerStrategyPanel
        activeStrategy={activeStrategy}
        actionLabel={actionLabel}
        hiddenStrategyCards={hiddenStrategyCards}
        isPywencaiMode={isPywencaiMode}
        isScanning={isScanning}
        scanError={scanError}
        stockQuery={stockQuery}
        strategies={SCREENER_STRATEGIES}
        onSelectStrategy={selectStrategy}
        onStartScan={handleStartScan}
        onStockQueryChange={setStockQuery}
        onToggleStrategyCardVisibility={toggleStrategyCardVisibility}
      />

      <ScreenerResultsPane
        conceptStats={conceptStats}
        idleHint={idleHint}
        isPywencaiMode={isPywencaiMode}
        isScanning={isScanning}
        results={results}
        scanError={scanError}
        scanProgress={scanProgress}
        scanStatus={scanStatus}
        strategyTagText={strategyTagText}
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />

      {hoveredStock && (
        <ScreenerHoverCard
          stock={hoveredStock}
          style={cardStyle()}
          onMouseEnter={handleCardMouseEnter}
          onMouseLeave={handleCardMouseLeave}
          onSizeChange={handleCardSizeChange}
        />
      )}
    </div>
  );
};

export default ScreenerSection;
