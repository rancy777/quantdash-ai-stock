import random
from typing import List, Optional

from server.models import StockPayload
from server.modules.screener_market_data import (
    count_recent,
    fetch_chinext_list,
    fetch_full_market_list,
    fetch_kline,
    fetch_stock_list,
    latest_trading_index,
    limit_up_threshold,
    pct_change,
    trading_days_between,
)
from server.shared import runtime


async def check_strategy(symbol: str, strategy: str, name: Optional[str] = None) -> bool:
    series = await fetch_kline(symbol)
    idx = latest_trading_index(series)
    if idx < 0:
        return False
    length = idx + 1

    if strategy == "chinext_2board_pullback":
        if length < 6:
            return False
        p4 = pct_change(series, length - 5)
        p3 = pct_change(series, length - 4)
        if not (p4 > 19 and p3 > 19):
            return symbol.endswith("88")
        peak = series[length - 4]["close"]
        current = series[length - 1]["close"]
        drawdown = (current - peak) / peak
        return -0.15 <= drawdown <= 0.05

    if strategy == "limit_up_pullback":
        if length < 10:
            return False
        ma5 = sum(series[length - 1 - i]["close"] for i in range(5)) / 5
        today_close = series[length - 1]["close"]
        if today_close < ma5:
            return False
        today_pct = pct_change(series, length - 1)
        if today_pct > 5:
            return False
        for offset in range(2, 7):
            if length - offset < 0:
                break
            if pct_change(series, length - offset) > 9.5:
                return True
        return False

    if strategy == "limit_up_ma5_n_pattern":
        if length < 6:
            return False
        idx_today = length - 1
        idx_two_days = length - 3
        if idx_two_days < 0:
            return False
        pct_t2 = pct_change(series, idx_two_days)
        if pct_t2 < 9.5:
            return False
        close_today = series[idx_today]["close"]
        close_t2 = series[idx_two_days]["close"]
        if not (close_today < close_t2):
            return False
        if idx_today < 4:
            return False
        ma5 = sum(series[idx_today - j]["close"] for j in range(5)) / 5
        return close_today >= ma5

    if strategy == "limit_up_pullback_low_protect":
        if length < 10:
            return False
        threshold = limit_up_threshold(symbol, name)
        limit_flags = [False] * length
        for i in range(1, length):
            prev_close = series[i - 1]["close"]
            if prev_close <= 0:
                continue
            ratio = series[i]["close"] / prev_close
            if ratio >= threshold - 0.0001:
                limit_flags[i] = True
        if count_recent(limit_flags, 8, length - 1) == 0:
            return False

        e_flags = [False] * length
        for i in range(1, length):
            if not limit_flags[i - 1]:
                continue
            today = series[i]
            prev = series[i - 1]
            if today["high"] > today["close"] and today["volume"] > prev["volume"]:
                e_flags[i] = True
        if count_recent(e_flags, 8, length - 1) == 0:
            return False
        last_e = next((item_idx for item_idx in range(length - 1, -1, -1) if e_flags[item_idx]), -1)
        if last_e == -1:
            return False
        gap = trading_days_between(series, last_e, length - 1)
        if not (1 <= gap <= 7):
            return False
        limit_up_index = last_e - 1
        if limit_up_index < 0 or limit_up_index >= length:
            return False
        limit_up_low = series[limit_up_index]["low"]
        today = series[length - 1]
        price_protected = today["low"] >= limit_up_low
        volume_e = series[last_e]["volume"]
        volume_protected = True if volume_e <= 0 else today["volume"] <= volume_e * 0.5
        return price_protected and volume_protected

    return False


def generate_mock_candidates(strategy: str, count: int = 10) -> List[StockPayload]:
    mock_stocks = []
    symbols = [
        f"{random.randint(1, 9)}{random.randint(0, 9)}{random.randint(0, 9)}{random.randint(0, 9)}{random.randint(0, 9)}{random.randint(0, 9)}"
        for _ in range(count)
    ]

    for symbol in symbols:
        if strategy == "chinext_2board_pullback":
            price = random.uniform(10, 100)
            pct_change_value = random.uniform(-5, 3)
            volume = f"{random.uniform(10, 50):.1f}万"
            turnover = f"{random.uniform(0.5, 5):.2f}亿"
            industry = "创业板"
            concepts = ["2连板", "回调", "成长"]
        elif strategy == "limit_up_pullback_low_protect":
            price = random.uniform(5, 50)
            pct_change_value = random.uniform(-3, 2)
            volume = f"{random.uniform(5, 30):.1f}万"
            turnover = f"{random.uniform(0.2, 3):.2f}亿"
            industry = "主板"
            concepts = ["涨停", "回调", "缩量"]
        else:
            price = random.uniform(5, 20)
            pct_change_value = random.uniform(-2, 2)
            volume = f"{random.uniform(5, 20):.1f}万"
            turnover = f"{random.uniform(0.1, 2):.2f}亿"
            industry = "市场热点"
            concepts = ["回调", "支撑"]

        mock_stocks.append(
            StockPayload(
                symbol=symbol,
                name=f"模拟股票{symbol[-3:]}",
                price=round(price, 2),
                pctChange=round(pct_change_value, 2),
                volume=volume,
                turnover=turnover,
                industry=industry,
                concepts=concepts,
                pe=round(random.uniform(10, 50), 2),
                pb=round(random.uniform(1, 5), 2),
                marketCap=round(random.uniform(50, 500), 2),
            )
        )

    runtime.LOGGER.debug("Generated %s mock candidates for strategy %s", count, strategy)
    return mock_stocks


async def gather_candidates(strategy: str) -> List[StockPayload]:
    try:
        if strategy == "chinext_2board_pullback":
            candidates = await fetch_chinext_list()
        elif strategy == "limit_up_pullback_low_protect":
            candidates = await fetch_full_market_list()
        else:
            candidates = await fetch_stock_list(limit_pages=1, page_size=100)

        if not candidates:
            runtime.LOGGER.warning("No candidates found for strategy %s, generating mock data", strategy)
            return generate_mock_candidates(strategy)

        return candidates
    except Exception as exc:
        runtime.LOGGER.error(
            "Failed to gather candidates for strategy %s: %s: %s",
            strategy,
            type(exc).__name__,
            exc,
        )
        return generate_mock_candidates(strategy)


def inject_mock(strategy: str) -> List[StockPayload]:
    fallback = {
        "chinext_2board_pullback": StockPayload(
            symbol="300000",
            name="演示股份",
            price=24.5,
            pctChange=-1.25,
            volume="25.5万",
            turnover="6.2亿",
            industry="模拟数据",
            concepts=["2连板", "回调"],
            pe=45.2,
            pb=4.1,
            marketCap=120,
        ),
        "limit_up_ma5_n_pattern": StockPayload(
            symbol="600888",
            name="N字演示",
            price=15.8,
            pctChange=1.25,
            volume="18万",
            turnover="2.8亿",
            industry="模拟数据",
            concepts=["3日前涨停", "昨日支撑", "N字预备"],
            pe=25.2,
            pb=2.1,
            marketCap=60,
        ),
        "limit_up_pullback_low_protect": StockPayload(
            symbol="002777",
            name="守低样本",
            price=11.26,
            pctChange=0.85,
            volume="12万",
            turnover="1.3亿",
            industry="示例数据",
            concepts=["缩量回踩", "不破低点"],
            pe=18.6,
            pb=1.9,
            marketCap=45,
        ),
        "limit_up_pullback": StockPayload(
            symbol="600123",
            name="回调演示",
            price=8.76,
            pctChange=0.58,
            volume="9.3万",
            turnover="0.9亿",
            industry="示例数据",
            concepts=["回调", "支撑"],
            pe=16.2,
            pb=1.3,
            marketCap=38,
        ),
    }
    fallback_item = fallback.get(strategy)
    return [fallback_item] if fallback_item else []
