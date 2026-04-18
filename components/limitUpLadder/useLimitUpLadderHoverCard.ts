import React, { useCallback, useEffect, useRef, useState } from 'react';

import { Stock } from '../../types';

const HOVER_CARD_DEFAULT_SIZE = { width: 900, height: 760 };

const useLimitUpLadderHoverCard = () => {
  const [hoveredStock, setHoveredStock] = useState<Stock | null>(null);
  const [cardPos, setCardPos] = useState({ x: 0, y: 0 });
  const hoverCardSizeRef = useRef(HOVER_CARD_DEFAULT_SIZE);
  const mousePosRef = useRef({ x: 0, y: 0 });
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  const updateHoverCardPosition = useCallback(() => {
    const { width, height } = hoverCardSizeRef.current;
    const padding = 16;
    let x = mousePosRef.current.x + 20;
    let y = mousePosRef.current.y + 20;

    if (x + width + padding > window.innerWidth) {
      x = Math.max(padding, mousePosRef.current.x - width - 20);
    }
    if (y + height + padding > window.innerHeight) {
      y = Math.max(padding, window.innerHeight - height - padding);
    }

    setCardPos({ x, y });
  }, []);

  const openHoverCard = useCallback(
    (stock: Stock) => {
      setHoveredStock(stock);
      updateHoverCardPosition();
    },
    [updateHoverCardPosition],
  );

  const startCloseTimer = useCallback(() => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    closeTimeoutRef.current = setTimeout(() => {
      setHoveredStock(null);
    }, 200);
  }, []);

  const handleMouseEnter = useCallback(
    (event: React.MouseEvent<HTMLDivElement>, stock: Stock) => {
      mousePosRef.current = { x: event.clientX, y: event.clientY };
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = setTimeout(() => {
        openHoverCard(stock);
      }, 350);
    },
    [openHoverCard],
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      mousePosRef.current = { x: event.clientX, y: event.clientY };
      if (hoveredStock) {
        updateHoverCardPosition();
      }
    },
    [hoveredStock, updateHoverCardPosition],
  );

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    startCloseTimer();
  }, [startCloseTimer]);

  const closeHoverInstant = useCallback(() => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    setHoveredStock(null);
  }, []);

  const clearCloseTimer = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  const handleSizeChange = useCallback(
    (size?: { width: number; height: number }) => {
      hoverCardSizeRef.current = size || HOVER_CARD_DEFAULT_SIZE;
      updateHoverCardPosition();
    },
    [updateHoverCardPosition],
  );

  return {
    hoveredStock,
    cardPos,
    handleMouseEnter,
    handleMouseMove,
    handleMouseLeave,
    startCloseTimer,
    closeHoverInstant,
    clearCloseTimer,
    handleSizeChange,
  };
};

export default useLimitUpLadderHoverCard;
