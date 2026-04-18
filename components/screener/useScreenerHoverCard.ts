import React, { useCallback, useRef, useState } from 'react';

import { Stock } from '../../types';

const DEFAULT_CARD_SIZE = { width: 900, height: 700 };

const useScreenerHoverCard = () => {
  const [hoveredStock, setHoveredStock] = useState<Stock | null>(null);
  const [cardPos, setCardPos] = useState({ x: 0, y: 0 });
  const [cardSize, setCardSize] = useState(DEFAULT_CARD_SIZE);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mousePosRef = useRef({ x: 0, y: 0 });

  const handleCardSizeChange = useCallback((size: { width: number; height: number }) => {
    setCardSize((prev) => (prev.width === size.width && prev.height === size.height ? prev : size));
  }, []);

  const handleMouseEnter = useCallback((event: React.MouseEvent, stock: Stock) => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    mousePosRef.current = { x: event.clientX, y: event.clientY };
    hoverTimeoutRef.current = setTimeout(() => {
      setCardPos(mousePosRef.current);
      setHoveredStock(stock);
    }, 400);
  }, []);

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    mousePosRef.current = { x: event.clientX, y: event.clientY };
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    closeTimeoutRef.current = setTimeout(() => {
      setHoveredStock(null);
    }, 300);
  }, []);

  const handleCardMouseEnter = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  const handleCardMouseLeave = useCallback(() => {
    setHoveredStock(null);
  }, []);

  const cardStyle = useCallback(() => {
    const gap = 20;
    let left = cardPos.x + gap;
    let top = cardPos.y;

    if (left + cardSize.width > window.innerWidth) left = cardPos.x - cardSize.width - gap;
    if (top + cardSize.height > window.innerHeight) top = window.innerHeight - cardSize.height - gap;

    return {
      position: 'fixed' as const,
      left: `${left}px`,
      top: `${top}px`,
      zIndex: 100,
      pointerEvents: 'auto' as const,
    };
  }, [cardPos, cardSize]);

  return {
    hoveredStock,
    cardStyle,
    handleCardMouseEnter,
    handleCardMouseLeave,
    handleCardSizeChange,
    handleMouseEnter,
    handleMouseLeave,
    handleMouseMove,
  };
};

export default useScreenerHoverCard;
