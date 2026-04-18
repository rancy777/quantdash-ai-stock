import importlib
import signal
import sys
import threading
import time

MODULES = [
    ("cls_telegraph_to_dingtalk_single", "CLS"),
    ("newsfilter_to_dingtalk", "NF"),
]


def starter(module_name, name):
    try:
        func = importlib.import_module(module_name)
        func.main() if hasattr(func, "main") else func.run()
    except ModuleNotFoundError as e:
        print(f"[{name}] 依赖缺失，已跳过：{e}")
    except Exception as e:
        print(f"[{name}] 线程退出：", e)

threads = [
    threading.Thread(target=starter, args=(module_name, name), daemon=True)
    for module_name, name in MODULES
]

for t in threads: t.start()
print("★ 两路新闻抓取已启动（CLS + NF），结果会写入 data 目录供前端展示")

# 主线程安心睡
signal.signal(signal.SIGINT, lambda s, f: sys.exit(0))
while True:
    time.sleep(1)
