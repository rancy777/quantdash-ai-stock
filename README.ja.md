[简体中文](./README.md) | [English](./README.en.md) | 日本語

# QuantDash 中国A株トレーディングダッシュボード

QuantDash は、A株市場の振り返り、センチメント観測、セクターローテーション、AI を使った引け後レビュー、翌営業日の準備をまとめて扱うための Vite + React ベースのダッシュボードです。

主な用途:

- 市場センチメントサイクルの観測
- 売り圧力と高値リスクの確認
- 連板構造と主導銘柄の追跡
- セクターローテーションとテーマ継続性の確認
- 個別銘柄レビュー、Kライン確認、パターン認識
- AI 日次レビュー、寄り前プラン、銘柄メモ、レポート要約
- 個人用 `skills` による分析フローの再利用

中国語の完全版マニュアル: [项目使用手册.md](./项目使用手册.md)

## 言語

- 中国語: [README.md](./README.md)
- 英語: [README.en.md](./README.en.md)
- 日本語: [README.ja.md](./README.ja.md)

## 今後の更新予定

1. `LLM Wiki` ナレッジベース
2. 銘柄監視条件の自動アラート
3. エリオット波動と缠论描画機能の改善
4. 香港株・米国株データの接続
5. 开盘啦 データの接続

## スクリーンショット

![Screenshot 01](./images/3bf3d1dc-0c25-4d52-b944-c6e9b4389eaf.png)
![Screenshot 02](./images/4f6ef0a9-e07d-4232-9e5b-8f2bac492cf1.png)
![Screenshot 03](./images/f7af157d-7c69-4346-94b0-530801de7bb5.png)
![Screenshot 04](./images/18c31766-eccb-43fd-a08d-ab959cf38d9d.png)

## ライセンス

- このリポジトリは [`PolyForm Noncommercial 1.0.0`](./LICENSE) に基づいて提供されます。
- メンテナの追加許可なしに商用利用することはできません。
- 公開リポジトリには `.env.local`、ローカルデータベース、サードパーティレポート原文、Web スナップショット、個人研究資料は含まれません。
- 利用、デプロイ、再配布の前に、コードライセンスとデータソースのライセンス範囲を確認してください。

## 主な機能

- `Sentiment Cycle`: 売り圧力係数、修復率、連板構造、主導銘柄状態、高値リスク
- `Sector Cycle`: セクターローテーション、テーマ継続性、主要テーマの追跡
- `Stock View`: 銘柄一覧、Kライン、単日パフォーマンス、パターン認識
- `AI Module`: 日次レビュー、寄り前プラン、銘柄メモ、レポート要約
- `Information Hub`: ローカルレポート一覧と重要ニュース集約
- `Skills`: 再利用可能なプロンプトルールと個人分析フレーム
- `Model Access`: OpenAI、DeepSeek、Ollama、LM Studio、AnythingLLM、SiliconFlow、火山方舟
- `Extensions`: ローカル MCP Server と Feishu Bot 連携

## 対応モデル / プラットフォーム

| モデル / プラットフォーム | 状態 | 備考 |
| --- | --- | --- |
| [OpenAI](https://openai.com/) | ✅ | OpenAI 互換 API 形式のモデルに対応 |
| [Ollama](https://ollama.com/) | ✅ | ローカル LLM 実行環境 |
| [LM Studio](https://lmstudio.ai/) | ✅ | ローカル LLM 実行環境 |
| [AnythingLLM](https://anythingllm.com/) | ✅ | ローカル知識ベース / 文書 QA |
| [DeepSeek](https://deepseek.com/) | ✅ | `deepseek-reasoner`、`deepseek-chat` などに対応 |
| [SiliconFlow](https://siliconflow.cn/) | ✅ | OpenAI 互換のモデル集約プラットフォーム |
| [Volcano Ark](https://www.volcengine.com/product/ark) | ✅ | 豆包などのモデル接続プラットフォーム |

## クイックスタート

フロントエンドのみ起動する場合:

1. `npm install`
2. `npm run dev`

ローカル同期、Python 収集、レポート同期、Feishu Bot 連携も使う場合:

1. `npm install`
2. `pip install -r requirements.txt`
3. `Copy-Item .env.example .env.local`
4. 必要な環境変数を設定
5. `npm run dev`

公開リポジトリを clone した直後の初回確認:

`npm run sync:startup-check`

統一された起動入口:

- 起動: `npm run start:project`
- 停止: `npm run stop:project`

Windows では `start_project.bat` / `start_project.ps1`、macOS / Linux では `start_project.sh` / `stop_project.sh` を利用できます。

## 主な環境変数

- `TUSHARE_API_KEY`
- `TUSHARE_API_BASE_URL`
- `PYWENCAI_COOKIE`
- `FEISHU_APP_ID`
- `FEISHU_APP_SECRET`
- `FEISHU_BOT_AI_BASE_URL`
- `FEISHU_BOT_AI_API_KEY`
- `FEISHU_BOT_AI_MODEL`

フロントエンド表示とローカルファイル読み込みだけなら、これらは未設定でも利用できます。

## データポリシー

- この公開リポジトリには完全なローカル市場データ、ローカル認証状態、サードパーティ原文は含まれません。
- 市場スナップショットをローカルで再構築するには `npm run sync:*` または Python 収集スクリプトを使用してください。
- データディレクトリ方針: [data/README.md](./data/README.md)

## プロジェクトの位置づけ

QuantDash は単なるチャートビューアではありません。以下をまとめて扱うためのワークスペースです。

- 監視
- 引け後の振り返り
- 寄り前準備
- 構造化メモ
- ローカル構造化データに基づく AI 分析
