import asyncio
import sys
import os

# 添加当前目录到Python路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from screener_service import fetch_kline

async def test_kline_fetch():
    """测试K线数据获取功能"""
    # 测试几个不同的股票代码
    test_symbols = ["600089", "300395", "000858"]  # 特变电工、菲利华、五粮液
    
    for symbol in test_symbols:
        print(f"\n测试获取 {symbol} 的K线数据...")
        try:
            kline_data = await fetch_kline(symbol)
            if kline_data:
                print(f"✓ 成功获取 {symbol} 的K线数据，共 {len(kline_data)} 条记录")
                print(f"  最新一条记录: {kline_data[-1]}")
            else:
                print(f"✗ 无法获取 {symbol} 的K线数据")
        except Exception as e:
            print(f"✗ 获取 {symbol} 的K线数据时发生错误: {e}")

if __name__ == "__main__":
    asyncio.run(test_kline_fetch())
