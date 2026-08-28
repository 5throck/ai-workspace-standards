---
sync_version: 1
---

**言語**: [English](README.md) · [한국어](README_ko.md) · [Español](README_es.md) · [日本語](README_ja.md)

---

# AI ワークスペース標準 (AI Workspace Standards)

> **すべてのAIコーディングツールにおけるVibe CodingおよびHarness Engineeringのマスター設定。**

このリポジトリは、ワークスペースルート以下のすべてのプロジェクトで使用される共有ワークスペース標準を定義します。ワークスペースルート（Windows: `C:\git` · macOS/Linux: `~/git`）として直接クローンするよう設計されており、すべてのプロジェクトが同じAI動作、ワークフロー、品質ルールを自動的に継承します。

---

## これは何ですか？

現代のAI支援開発では、単なるプロンプト以上のものが必要です。すべてのAIツールがすべてのプロジェクトで従うべき**一貫性のある、強制可能な動作契約**が必要です。このリポジトリは以下を提供します：

| 関心事 | ファイル | 対象 |
|---------|---------|------|
| 共有ワークスペース標準 | [`CONSTITUTION.md`](CONSTITUTION.md) | すべてのAIツール |
| Claude Codeの動作 | [`CLAUDE.md`](CLAUDE.md) | Claude Code (CLI + Desktop) |
| Gemini / Antigravityの動作 | [`GEMINI.md`](GEMINI.md) | Gemini CLI + Antigravityエンジン |
| 変更履歴 | [`CHANGELOG.md`](CHANGELOG.md) | すべて |

### 2つの哲学、1つの標準

**Vibe Coding** - AIが運転を握ります。開発者が意図を説明し、AIエージェント（PM → アーキテクト → デザイナー → コーダー → テスト実行者）がワークフロー全体を自律的に実行します。これらの標準は、自律的な実行を安全で監査可能に保つガードレールを定義します。

**Harness Engineering** - 開発者がループに留まります。AIツールは精密機器：外科的な編集、明示的な計画、必須のレビューゲートです。これらの標準は、AIの出力を予測可能でレビュー可能に保つハーネスを定義します。

---

## 前提条件 (Prerequisites)

**このワークスペースを使用する前に**、必要なソフトウェアがインストールされていることを確認してください：

> **📖 詳細ガイド**: 完全なインストール手順とトラブルシューティングについては [Getting Started](docs/getting-started.md) を参照してください。

### 必須ツール

| ツール | バージョン | 目的 | インストール |
|------|---------|---------|---------|
| **Git** | 2.x+ | バージョン管理、フック自動化 | [git-scm.com](https://git-scm.com/downloads) |
| **Bun** ⭐ | 1.x+ | TypeScriptスクリプト、プロジェクト作成（必須） | `curl -fsSL https://bun.sh/install \| bash` |

**破壊的変更**: Bunはプロジェクト作成に**必須**になりました（Python/PowerShellインラインコードに置き換え）。

### オプションツール

| ツール | 目的 | インストール |
|------|---------|---------|
| **GitHub CLI (gh)** | PR自動化 | [cli.github.com](https://cli.github.com/) |

### クイック確認

```bash
# 必須ツールの確認
git --version    # 2.x.xが表示されるはず
bun --version    # 1.x.xが表示されるはず
gh --version     # オプショナル: PR自動化
```

**ツールのインストール**: 詳細なインストール手順については [Getting Started](docs/getting-started.md#-essential-software-must-have) を参照してください。

---

## クイックスタート (Quick Start)

### 0. 前提条件のインストール（未インストールの場合）

```bash
# Bunのインストール（必須）— https://bun.sh/docs/installation
curl -fsSL https://bun.sh/install | bash   # Unix/Linux/macOS
powershell -c "irm bun.sh/install.ps1 | iex"  # Windows

# インストールの確認
git --version
bun --version
```

> **注意**: `scripts/install-bun.sh`および`install-bun.ps1`は削除されました。ワークスペーススクリプトを使用する前に、[bun.sh](https://bun.sh)から直接Bunをインストールしてください。

### 1. ワークスペースルートとしてクローン

```bash
# Windows
git clone https://github.com/5throck/ai-workspace-standards.git C:\git

# macOS / Linux
git clone https://github.com/5throck/ai-workspace-standards.git ~/git
```

### 2. Claude Codeを起動

```bash
claude
```

> Gitフック（`.githooks/`）は、最初のClaudeセッション開始時に`.claude/settings.json`の`SessionStart`フックを通じて自動的に設定されます — 手動の`git config`は不要です。

### 3. 最初のプロジェクトを作成

```bash
# デフォルト（最新テンプレート、co-developバリアント）— すべてのプラットフォーム
bun scripts/new-project.ts "my-project-name"

# バリアントを指定
bun scripts/new-project.ts "my-project-name" --variant co-develop

# 特定のテンプレートバージョンを使用（利用可能: bun scripts/list-template-versions.ts）
bun scripts/new-project.ts "my-project-name" --version 0.5.0
```

> **[破壊的変更 — 2026-06-11]**: `bash scripts/new-project.sh`および`.\scripts\new-project.ps1`は`bun scripts/new-project.ts`に置き換えられました（ADR-0036）。それに応じてエイリアスやCIパイプラインを更新してください。

> **AIツールショートカット**: Claude Codeでは、スクリプトを直接実行する代わりに`/new-project "my-project-name"`を使用できます。

各新規プロジェクトは、選択したテンプレートバリアントから`docs/context.md`、`AGENTS.md`、`agents/pm.md`、および必要なすべての設定ファイルとともにスキャフォールドされます。テンプレートのバージョンとバリアントはトレーサビリティのために`docs/context.md`に記録されます。

### 4. 新規プロジェクトに移動してPMキックオフを開始

**重要**: 現在のAIセッションを終了し、新しく作成されたプロジェクトディレクトリ内で新しいセッションを開始する必要があります。ワークスペースルートに留まると、AIはプロジェクト固有の設定を読み込まず、キックオフミーティングをスキップします。

**より良い結果のためのコンテキスト提供**

PMエージェントは、明確なコンテキストを提供すると最もよく機能します：
1. **プロジェクト目標** - 何を構築するか
2. **エージェントチームのヒント**（オプショナル） - 推奨される専門エージェント
3. **期待される出力** - 実装計画、デザイン、コード

```bash
# 1. 現在のAIセッションを終了（実行中の場合）
# 2. 新しく作成したプロジェクトフォルダに移動
cd "my-project-name"

# 3. 新しいAIセッションを開始してプロジェクトコンテキストを読み込む
claude
# または
agy
```

**例：テトリスゲームの構築**

```
> "TypeScriptでテトリスゲームを構築してください。専門エージェントチームを設定
> し（メカニクス用のgame-design、衝突検出用のgame-logic、レンダリング用の
>  graphics、テスト用のqa）、キックオフミーティングを開始して実装計画を
>  作成してください。"
```

これにより、PMエージェントは以下の明確なコンテキストを得られます：
- 特定の要件を理解する
- 適切なエージェントチームを設定する（デフォルトまたはカスタム）
- 集中されたキックオフアジェンダを生成する
- 承認のための具体的な計画を提示する



---

## リポジトリ構造 (Repository Structure)

```
C:\git\ (ワークスペースルート - このリポジトリ)
├── CONSTITUTION.md          # マスター標準 - 毎セッションで最初に読む
├── CLAUDE.md                # Claude Codeワークスペース動作
├── GEMINI.md                # Gemini CLI / Antigravityワークスペース動作
├── SECURITY.md              # 標準GitHub脆弱性報告ポリシー
├── CHANGELOG.md             # ワークスペースレベルの変更履歴
├── README.md                # このファイル（英語）
├── README_ko.md             # このファイル（韓国語）
├── README_es.md             # このファイル（スペイン語）
├── README_ja.md             # このファイル（日本語）
├── memory/                  # ワークスペースレベルのメモリログ
├── agents/                  # ワークスペースレベルの専門エージェント
├── skills/                  # ワークスペースレベルの再利用可能スキル
├── tests/                   # 統合および単体テストスイート
├── scripts/                 # コア自動化および監査スクリプト
├── .githooks/               # PRポリシーとルールを強制するGitフック
├── .claude/ & .gemini/      # AIツールグローバル設定とカスタムスラッシュコマンド
└── templates/               # バージョン管理されたAIプロジェクトテンプレート (co-develop, co-design, etc.)
    ├── common/              # すべてのバリアントで共有されるスクリプト、フック、スキル
    ├── co-develop/          # ✅ 安定 — フルソフトウェア開発エージェントチーム
    ├── co-design/           # ✅ 安定 — UI/UXデザイン専門エージェントチーム
    ├── co-work/             # ✅ 安定 — 一般コラボレーション・ドキュメントエージェントチーム
    ├── co-security/         # ✅ 安定 — レッドチーム・脅威モデリングエージェントチーム
    ├── co-consult/          # ✅ 安定 — 戦略コンサルティング・分析エージェントチーム
    ├── co-deck/             # 🔶 ベータ — 講義・プレゼン資料制作エージェントチーム
    ├── co-game/             # ✅ 安定 — HTML5 Canvasゲーム開発エージェントチーム
    ├── co-export/           # 🔶 ベータ — 輸出入貿易コンプライアンスエージェントチーム
    ├── co-news/             # 🔶 ベータ — 経済・金融ジャーナリズムエージェントチーム（KR国プロファイル同梱）
    ├── co-abap/             # ✅ 安定 — SAP ABAP開発エージェントチーム
    ├── co-hr/               # 🔶 ベータ — 労務・HRコンサルティングエージェントチーム（KR国プロファイル同梱）
    ├── co-safety/           # 🔶 ベータ — EHS/GxPコンプライアンスプラットフォームエージェントチーム
    └── co-price/            # ⚠️ ベータ — 多業種対応の価格管理・コンサルティングシミュレータ（K-Beautyサンプルデータ同梱）
```

各サブプロジェクトは独自のディレクトリとGitリポジトリに存在します：

```
C:\git\
├── my-project\              # 独立したGitリポジトリ
│   ├── docs/context.md      # プロジェクトナレッジ（すべてのAIツール）
│   ├── AGENTS.md            # エージェントインデックス
│   ├── CLAUDE.md            # プロジェクトレベルのClaude Codeオーバーライド
│   └── GEMINI.md            # プロジェクトレベルのGeminiオーバーライド
└── another-project\         # 別の独立したGitリポジトリ
```

---

## セッション開始チェックリスト (Session Start Checklist)

すべてのAIセッションは、このチェックリストを実行することから始まります（`CONSTITUTION.md`で定義）：

0. `git config core.hooksPath .githooks`
1. `CONSTITUTION.md`を読む（このワークスペース標準）
2. プロジェクトの`docs/context.md`を読む
3. `AGENTS.md`を読む（正規エージェントロスター）
4. `memory/MEMORY.md`で最近の変更を確認
5. `docs/context.md ## Session Start Skills`からスキルを読み込む

---

## マルチエージェントワークフロー (Multi-Agent Workflow)

このワークスペースの各テンプレートバリアントは、その目的に特化して高度に最適化された**マルチエージェントワークフローとエージェントチーム**を提供します。

- **co-develop**: ソフトウェア開発と検証のための6フェーズ線形ガバナンスパイプライン
- **co-design**: 迅速なプロトタイピングと継続的なユーザー検証に焦点を当てた5フェーズのイテレティブデザインネイティブワークフロー
- **co-work**: 並列ドラフトと継続的なステークホルダーレビューに焦点を当てた6フェーズの非同期コラボレーションワークフロー
- **co-security**: レッドチームオペレーション、脅威モデリング、Ansibleベースのパッチ自動化をカバーする6フェーズのセキュリティエンゲージメントワークフロー
- **co-consult**: リサーチ、分析、成果物作成、クライアント納品をカバーする7フェーズの戦略コンサルティングワークフロー
- **co-deck**: リサーチから印刷可能PDFまでの11ステージの講義資料制作ワークフロー（5つの承認ゲート付き）
- **co-game**: Vanilla TypeScriptを使用したHTML5 Canvasゲーム開発ワークフロー（ゲームデザイン、アーケード/パズルジャンル、ビジュアルアート、サウンド、エンジン実装、デバッグ、テスト用の専門エージェント）
- **co-export**: HS分類、輸出管理・制裁スクリーニング、FTA原産地判定、関税還付、物流調整、市場参入戦略、外国規制モニタリング、貿易書類を網羅する貿易コンプライアンスワークフロー
- **co-news**: 上場企業を担当する経済記者向けの経済・金融ジャーナリズムワークフロー — 金融開示リサーチ（DART、KR国プロファイルのk-dart経由）、商法リサーチ（k-law、KRプロファイル）、引用台帳ベースのファクトチェック、AIっぽさの低減、金融インフォグラフィック生成。管轄固有のデータソース・法令はdocs/countries/配下の国プロファイル経由で付加されます（KRプロファイル同梱、他国はプロファイル追加）
- **co-abap**: PM主導のオーケストレーション、6つのSAPモジュールアナリスト（SD、MM、FI、CO、PP、LE）、技術実行エージェント、自動化QAチェーン（SyntaxCheck → RunUnitTests → GetCodeCoverage → RunATCCheck）を備えた6段階のSAP ABAP開発ワークフロー
- **co-hr**: 案件インテーク、対象管轄の労働法コンプライアンス監査（docs/countries/配下の国プロファイル — KRプロファイル同梱）、HRM/HRD設計、組織再編・変革管理を網羅する4段階の労務・HRコンサルティングワークフロー（k-law/k-kosis規制リサーチ連携 — KRスコープのスキルでKR対象プロジェクトのみに付加、12エージェントロスター）
- **co-safety**: A 6-phase EHS/GxP compliance workflow covering Korean occupational safety (OSHA-KR, SAPA), process safety management (PSM), GxP pharmaceutical quality (GMP/GLP/GDP/GCP/GVP), medical device safety (KGMP-MD, ISO 13485), and 15 industry-specific domains (chemical, construction, semiconductor, battery, shipbuilding, steelmaking, etc.) across a 40+ agent roster
- **co-price**: 15人の専門エージェント（財務戦略、コスト管理、P&L監査、価格戦略、市場インテリジェンス、エンゲージメント・ディレクション等）を備えた多業種対応の価格管理・コンサルティングシミュレータ（K-Beautyサンプルデータ同梱） — 複数製品・複数チャネルの価格管理、複式簿記P&L予測、市場調査分析（Van Westendorp / Gabor-Granger）、コストショック感応度、流通トレードライン管理をカバー

**💡 ワークフローの詳細確認方法**
特定のエージェントロスターとガバナンスフェーズは、各生成プロジェクトのドキュメント内で管理されます。プロジェクトをスキャフォールド後、以下を確認してください：
1. `AGENTS.md`: プロジェクトにデプロイされたエージェントのロールと権限の完全な仕様
2. `docs/context.md`: 初期セッションキックオフのためのプロジェクト目標とワークフローコンテキスト

---

## テンプレートバリアント (Template Variants)

新規プロジェクトはバージョン管理されたテンプレートバリアントからスキャフォールドされます。テンプレートはGitで`template-vX.Y.Z`としてタグ付けされています。

| バリアント | ステータス | 説明 |
|---------|--------|-------------|
| `co-develop` | ✅ 安定 | フルソフトウェア開発ワークフロー — PM、アーキテクト、デザイナー、コーダー、テスト実行者、セキュリティモニター |
| `co-design` | ✅ 安定 | UI/UXデザインワークフロー — PM、デザインリード、UXリサーチャー、ビジュアルデザイナー、プロトタイプエンジニア、ストーリーテラー、サービスデザイナー、タイポグラフィエキスパート |
| `co-work` | ✅ 安定 | 一般コラボレーションワークフロー — PM、アナリスト、テクニカルライター、コンテンツライター、プロジェクトコーディネーター、ストーリーテラー、MS365エキスパート |
| `co-security` | ✅ 安定 | セキュリティエンゲージメントワークフロー — PM、レッドチームリード、ペンテスター、脅威モデラー、パッチエンジニア、レポートライター |
| `co-consult` | ✅ 安定 | 戦略コンサルティングワークフロー — エンゲージメントリーダー、ストラテジーアナリスト、業界エキスパート、チェンジマネジメントパートナー、コミュニケーションリード、ソリューションアーキテクトなど |
| `co-deck` | 🔶 ベータ | 講義資料制作ワークフロー — PM、バージョン管理、リサーチ、ストーリーライン、デザイン、ビルド、測定、エクスポート |
| `co-game` | ✅ 安定 | HTML5 Canvasゲーム開発ワークフロー — PM、ゲームデザイナー、アーケード/パズルデザイナー、ビジュアルアーティスト、サウンドデザイナー、ゲームデベロッパー、ゲームデバッガー、テスト実行者、セキュリティモニター |
| `co-export` | 🔶 ベータ | 輸出入貿易コンプライアンス — HS分類、輸出管理・制裁スクリーニング、FTA原産地、関税還付、物流、市場参入、規制モニタリング、貿易書類 |
| `co-news` | 🔶 ベータ | 経済・金融ジャーナリズム — PM、リポーター、ファクトチェッカー、財務アナリスト、法務リサーチャー、スタイル編集者、ビジュアル編集者。管轄データは国プロファイル経由（KRプロファイル同梱） |
| `co-abap` | ✅ 安定 | SAP ABAP開発ワークフロー — PM、アーキテクト、コーダー、テスト実行者、DBA、DevOps管理者、SAP調査担当、モジュールアナリスト（SD、MM、FI、CO、PP、LE）、Interface/Fiori/Form専門家、セキュリティモニター |
| `co-hr` | 🔶 ベータ | 労務・HRコンサルティングワークフロー — PM、労務コンプライアンスアナリスト、労働関係スペシャリスト、安全衛生担当、採用スペシャリスト、報酬・給与アナリスト、人事評価コンサルタント、L&Dスペシャリスト、キャリア・後継コンサルタント、組織設計コンサルタント、変革管理パートナー、データアナリスト。労働法の適用範囲は国プロファイル経由（KRプロファイル同梱） |
| `co-safety` | 🔶 ベータ | EHS/GxP compliance platform workflow — PM/CSO, 40+ specialist agents (emergency, compliance, legal, training, PSM, risk, audit, 15 industry domains, 5 GxP domains), k-law regulatory research integration (KR-scoped) |
| `co-price` | ⚠️ ベータ | 多業種対応の価格管理・コンサルティングシミュレータ（K-Beautyサンプルデータ同梱） — PM、リードアーキテクト、コアエンジン開発、CPA監査、財務戦略リード、コスト・資産管理、UX、L10N監査、QA、DevOps、セキュリティ監査/モニター、価格戦略ストラテジスト、市場インテリジェンスアナリスト、エンゲージメントディレクター |

### バージョンとバリアントの選択

```bash
# 利用可能なテンプレートバージョンを一覧表示
bun scripts/list-template-versions.ts

# 最新テンプレートを使用（デフォルト）
bun scripts/new-project.ts my-project

# 特定のバージョンを使用
bun scripts/new-project.ts my-project --version 0.5.0

# 特定のバリアントを使用
bun scripts/new-project.ts my-project --variant co-develop
```

### テンプレートの検証

テンプレートファイルを変更する場合、構造的問題を検出するためにライフサイクルバリデーターを実行してください：

```bash
bun scripts/validate-templates.ts
```

チェック内容：エージェントフロントマターの完全性、必須セクション（`## Meeting Participation`、`## Dispatch Protocol`）、AGENTS.mdロスターパリティ、共有ファイル同期警告。また、`templates/`ファイルがステージングされるとプレコミットフックで自動的に実行されます。

---

## 設計原則 (Design Principles)

- **`docs/context.md`は唯一の信頼源 (Single Source of Truth)** — すべてのプロジェクトにおいて、すべてのAIツールが共有します。
- **`CLAUDE.md` / `GEMINI.md`（プロジェクトレベル）にはプラットフォーム固有のオーバーライドのみが含まれます。**
- **PRのみのワークフロー** — すべての変更はPull Requestを通じて`main`に到達します。直接プッシュは`.githooks/pre-push`でブロックされます。
- **Conventional Commits** — `feat:` / `fix:` / `docs:` / `refactor:` / `chore:` / `test:` / `perf:` / `ci:` / `style:` / `revert:`
- **TypeScriptのみのスクリプト** — すべての`scripts/`は`bun`で実行される`.ts`ファイル（ADR-0036）。`.sh/.ps1`のペアはありません。
- **コーディングガイドラインは監査されます** — `audit.ts`は`docs/context.md`に`## Coding Guidelines`がない場合、ビルドを失敗させます。
- **セキュリティファーストのスキャフォールド** — プロジェクトには自動的にシークレット検出（`.gitleaks.toml`）、`SECURITY.md`、クレデンシャルリークを防ぐ安全なプレコミットフックが装備されます。

---

## 📚 学習リソース (Learning Resources)

このワークスペースが初めての方は、初心者向けの入門コースから始めてください：

**[Claude Code and Multi-Agent Harness](https://5throck.github.io/intro-to-ai-harness/)**

AI初心者およびClaude Desktop Appユーザー（macOS、Windows、Linux）向けの実践的なハンズオンガイドです。4パート・全13章で構成され、基礎概念、2つの実践プロジェクト（co-consult、co-deck）、カスタムエージェント/スキル/チームの構築、ワークフロー自動化をステップバイステップの演習とともに扱います。

さらに深く学びたい実践者向けには、包括的な教育ハンドブックもあります：

**[Multi-Agent Harness Engineering ハンドブック](https://5throck.github.io/multi-agent-harness-handbook/)**

このハンドブックは2日間の集中プログラムで、以下の内容をカバーします：
- **Day 1 — 一般ユーザー**: AIの基礎概念、Vibe Coding vs. Harness Engineeringの原則、ガードレール、権限モデル、基本的なマルチエージェント操作
- **Day 2 — IT専門家**: アーキテクチャの詳細解説（SSOT階層 L0→L1→L2）、エンタープライズ展開戦略、カスタムバリアントエンジニアリング（フェーズA/B）、総合演習プロジェクト

すべての概念は4つのプラットフォーム（Claude Code、Claude Desktop App、Antigravity CLI、Antigravity 2.0）でデモンストレーションされます。

---

## コントリビューション (Contributing)

これは**パブリックリポジトリ**です。Pull Requestを通じてコントリビューションを歓迎します。

1. `main`から命名規則に従ってブランチを作成：`feat/<slug>`、`fix/<slug>`、または`docs/<slug>`
2. すべてのPRは`bun scripts/audit.ts`にパスする必要があります
3. マージ前に`CHANGELOG.md`の`[Unreleased]`にエントリを追加
4. `CONSTITUTION.md §8 - Coding Behavior Guidelines`に従う
5. マージ前に**1件以上の承認レビュー**が必要です

---

## ライセンス (License)

AGPL-3.0 - [LICENSE](LICENSE)を参照

---

*Maintained by [@5throck](https://github.com/5throck) · Last Updated: 2026-08-28*
