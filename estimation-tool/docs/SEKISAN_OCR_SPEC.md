# 積算OCR（Sekisan OCR）要件定義書

## 1. プロジェクト概要

### 1.1 プロジェクト名

積算OCR（Sekisan OCR）

### 1.2 プロジェクトの目的

建設業における図面からの数量拾い出し作業を、AI画像認識技術を活用して自動化・効率化するWebアプリケーションを開発します。従来の手作業による拾い出しと比較して、作業時間を80%以上削減し、ヒューマンエラーを最小化することを目指します。

### 1.3 ターゲットユーザー

**主要ターゲット:**
- 建設会社の積算担当者
- 設備工事会社（電気・空調・衛生・消防）の見積担当者
- 内装工事会社の積算担当者
- ゼネコンの現場監督・工事担当者

**副次ターゲット:**
- 建築設計事務所
- リフォーム会社
- 建設コンサルタント

### 1.4 ツール識別情報

| 項目 | 値 |
|------|-----|
| TOOL_ID (slug) | `sekisan-ocr` |
| toolVersion | `1.0` |
| バックアップファイル形式 | `sekisan_ocr_backup_YYYY-MM-DDTHH-MM-SS.json` |

### 1.5 プロジェクトスコープ

**スコープ内:**
- PDF/画像形式の図面アップロードと表示
- 図面の縮尺設定（キャリブレーション）機能
- CADライクな手動拾い出しツール
- Gemini 3 Flash PreviewによるAI自動拾い出し
- 複数図面の一括AI処理
- 拾い出し結果の編集・管理
- 集計表の作成とExcel/CSV/PDF出力

**スコープ外:**
- CADファイル（DWG/DXF）の直接編集
- 3D図面対応
- 見積書作成機能（集計表出力まで）
- 他社システムとのAPI連携
- モバイルアプリ（ネイティブ）

---

## 2. ライセンス別機能制限

> **注意**: ライセンス認証の詳細仕様は `docs/LICENSE_SPEC.md` を参照してください。
> 電子透かしの実装は `src/lib/shared/watermark/index.ts` を使用してください。

### 2.1 機能制限マトリクス

| 機能 | DEMO | TRIAL | VIP |
|------|------|-------|-----|
| 図面アップロード | 2枚まで | 20枚まで | 無制限 |
| 縮尺設定 | ○ | ○ | ○ |
| 手動拾い出し | ○ | ○ | ○ |
| AI自動拾い出し | ○（1図面ずつ） | ○ | ○ |
| 複数図面一括AI | × | ○ | ○ |
| データ保存 | × | ○ | ○ |
| Excel出力 | ○（透かし「デモ版」） | ○（透かし「トライアル」） | ○（透かし「企業名」） |
| サンプルデータ | プリロード済み | - | - |

### 2.2 STANDARD ライセンスの扱い

STANDARDライセンスはこのツールへのアクセス不可とし、ライセンスページにリダイレクトしてVIPへのアップグレード案内を表示します。

```typescript
// アクセス制御の実装
if (license.planType === 'STANDARD' && license.licenseType === 'PURCHASED') {
  // ライセンスページにリダイレクト
  router.push('/license?upgrade=vip');
}
```

---

## 3. 機能要件

### 3.1 プロジェクト管理

#### 3.1.1 CRUD操作

| 操作 | 説明 |
|------|------|
| 新規作成 | 名前、説明、図面アップロード |
| 一覧表示 | グリッド/リスト切り替え、ソート、検索 |
| 編集 | 名前、説明の変更 |
| 削除 | 確認ダイアログ付き |
| 複製 | プロジェクト全体を複製 |

#### 3.1.2 プロジェクトデータ構造

```typescript
interface Project {
  id: string;                    // UUID
  name: string;                  // 必須
  description?: string;          // 任意
  createdAt: string;             // ISO8601日時
  updatedAt: string;             // ISO8601日時
  drawings: Drawing[];           // 図面配列
  status: 'draft' | 'in_progress' | 'completed';
}
```

### 3.2 図面管理

#### 3.2.1 図面アップロード機能

| 項目 | 仕様 |
|------|------|
| 対応形式 | PDF, PNG, JPG, JPEG, TIFF |
| 最大ファイルサイズ | 50MB/ファイル |
| アップロード方式 | 複数ファイル同時、ドラッグ&ドロップ対応 |
| PDF処理 | 複数ページを個別図面として展開 |
| サムネイル | アップロード時に自動生成 |

#### 3.2.2 図面データ構造

```typescript
interface Drawing {
  id: string;                    // UUID
  projectId: string;             // 親プロジェクトID
  fileName: string;              // 元ファイル名
  fileSize: number;              // バイト数
  mimeType: string;              // ファイル種別
  pageNumber?: number;           // PDFの場合のページ番号
  imageData: string;             // Base64またはBlob参照
  thumbnailData: string;         // サムネイルBase64
  scale?: ScaleConfig;           // 縮尺情報
  status: 'pending' | 'processing' | 'completed' | 'error';
  takeoffItems: TakeoffItem[];   // 拾い出しアイテム
  createdAt: string;
  updatedAt: string;
}
```

#### 3.2.3 図面操作機能

- 並び替え（ドラッグ&ドロップ）
- 削除
- 縮尺設定
- AI拾い出し実行

### 3.3 図面ビューア

#### 3.3.1 表示機能

| 機能 | 操作方法 |
|------|----------|
| パン | ドラッグでスクロール |
| ズーム | 25%〜200%、マウスホイール対応 |
| フィット表示 | 画面に合わせる |
| 回転 | 90度単位 |
| グリッド表示 | ON/OFF切り替え |
| ミニマップ | 表示/非表示 |

#### 3.3.2 座標・寸法表示

- マウス座標のリアルタイム表示
- 縮尺に基づく実寸換算表示

### 3.4 縮尺設定（キャリブレーション）

#### 3.4.1 設定方法

1. 図面上の2点をクリックして基準線を指定
2. 画面上のピクセル長を自動計測
3. 実寸法を手動入力（mm/cm/m単位選択可）
4. 縮尺を自動計算（例：1:100）

#### 3.4.2 プリセット縮尺

`1:10`, `1:20`, `1:50`, `1:100`, `1:200`, `1:500`, `カスタム`

#### 3.4.3 縮尺データ構造

```typescript
interface ScaleConfig {
  pixelLength: number;           // 画面上の長さ(px)
  realLength: number;            // 実寸(mm)
  unit: 'mm' | 'cm' | 'm';       // 表示単位
  ratio: number;                 // 縮尺比（例：100）
  pixelPerMm: number;            // 1mmあたりのピクセル数
}
```

#### 3.4.4 適用オプション

- 現在の図面のみに適用
- 全図面に一括適用

### 3.5 手動拾い出しツール

#### 3.5.1 点カウントツール

| 機能 | 説明 |
|------|------|
| マーク | クリックで点をマーク |
| 連番表示 | 1, 2, 3... |
| カウント | 同一種別の個数をカウント |
| 編集 | 点の削除・移動 |

#### 3.5.2 線計測ツール

| 機能 | 説明 |
|------|------|
| 描画 | 2点クリックで線を描画 |
| 計測 | 長さを自動計算（縮尺適用） |
| 表示 | 単位表示（mm/m） |
| 編集 | 線の削除・編集 |

#### 3.5.3 面積計測ツール

| 機能 | 説明 |
|------|------|
| 描画 | 多角形の頂点をクリックで指定 |
| 確定 | ダブルクリックまたはEnterで確定 |
| 計測 | 面積を自動計算（縮尺適用） |
| 表示 | 単位表示（m²） |
| 編集 | 多角形の削除・編集 |

#### 3.5.4 矩形選択ツール

| 機能 | 説明 |
|------|------|
| 描画 | ドラッグで矩形を描画 |
| 計測 | 縦・横・面積を自動計算 |

#### 3.5.5 共通機能

- スナップ機能（グリッド、端点）
- アンドゥ/リドゥ
- キーボードショートカット

### 3.6 AI自動拾い出し（VIP機能）

#### 3.6.1 AI処理フロー

```
1. 図面画像をGemini 3 Flash Preview APIに送信
2. プロンプトに基づきシンボル・ルート・面積・テキストを検出
3. 検出結果をJSON形式で受信
4. 結果を解析して拾い出しアイテムに変換
```

#### 3.6.2 検出対象カテゴリ

<details>
<summary><strong>電気設備</strong></summary>

| サブカテゴリ | 検出対象 |
|-------------|---------|
| 照明器具 | 蛍光灯、ダウンライト、非常灯、誘導灯等 |
| コンセント・スイッチ | 単相100V、単相200V、三相200V、防水型等 |
| 配線 | 電線、ケーブルラック、配線ダクト等 |
| 盤類 | 分電盤、配電盤、制御盤等 |
| 弱電 | 火災報知器、インターホン、LAN、電話、TV等 |
</details>

<details>
<summary><strong>空調設備</strong></summary>

| サブカテゴリ | 検出対象 |
|-------------|---------|
| 空調機器 | エアコン、パッケージ、ファンコイル、全熱交換器等 |
| ダクト | 給気、排気、還気ダクト等 |
| 吹出口・吸込口 | アネモ、ライン型、ユニバーサル型等 |
| 配管 | 冷媒管、ドレン管、冷温水管等 |
</details>

<details>
<summary><strong>衛生設備</strong></summary>

| サブカテゴリ | 検出対象 |
|-------------|---------|
| 衛生器具 | 便器、洗面台、流し台、浴槽等 |
| 給排水配管 | 給水管、給湯管、排水管、通気管等 |
| 機器類 | 給湯器、ポンプ、受水槽等 |
| 付属品 | バルブ、継手、排水桝等 |
</details>

<details>
<summary><strong>消防設備</strong></summary>

| サブカテゴリ | 検出対象 |
|-------------|---------|
| 消火設備 | スプリンクラーヘッド、消火栓、消火器、消火ポンプ等 |
| 警報設備 | 感知器、発信機、ベル、受信機等 |
| 避難設備 | 誘導灯、非常照明、避難はしご等 |
</details>

<details>
<summary><strong>建築（躯体）</strong></summary>

| サブカテゴリ | 検出対象 |
|-------------|---------|
| コンクリート | 基礎、柱、梁、床、壁等 |
| 鉄筋 | 各種鉄筋 |
| 型枠 | 型枠 |
| 鉄骨 | 柱、梁、ブレース等 |
</details>

<details>
<summary><strong>建築（仕上げ）</strong></summary>

| サブカテゴリ | 検出対象 |
|-------------|---------|
| 床仕上げ | フローリング、タイル、カーペット、長尺シート等 |
| 壁仕上げ | クロス、塗装、タイル、パネル等 |
| 天井仕上げ | 石膏ボード、化粧板、システム天井等 |
| その他 | 巾木、廻縁、建具等 |
</details>

<details>
<summary><strong>外壁・屋根</strong></summary>

| サブカテゴリ | 検出対象 |
|-------------|---------|
| 外壁 | 窯業系サイディング、金属サイディング、ALC、タイル、塗装等 |
| 屋根 | 瓦、スレート、金属屋根、防水等 |
| 付帯 | 雨樋、シーリング、水切り等 |
</details>

<details>
<summary><strong>土木</strong></summary>

| サブカテゴリ | 検出対象 |
|-------------|---------|
| 舗装 | アスファルト、コンクリート、インターロッキング等 |
| 構造物 | 擁壁、側溝、U字溝、マンホール等 |
| 土工 | 掘削、盛土、埋戻し等 |
</details>

#### 3.6.3 単一図面処理

- 選択した図面に対してAI拾い出しを実行
- 検出カテゴリを選択可能
- 検出感度を調整可能
- 既存結果への追加または置き換えを選択可能

#### 3.6.4 複数図面一括処理（VIP/TRIAL限定）

- 選択した複数図面を順次処理
- 進捗表示（○/○枚完了）
- バックグラウンド処理対応
- エラー発生時も他の図面の処理を継続

### 3.7 拾い出し結果管理

#### 3.7.1 拾い出しアイテムデータ構造

```typescript
interface TakeoffItem {
  id: string;                    // UUID
  drawingId: string;             // 図面ID
  itemType: string;              // アイテム種別名
  category: string;              // カテゴリ
  subCategory?: string;          // サブカテゴリ
  quantity: number;              // 数量
  unit: string;                  // 単位
  unitPrice?: number;            // 単価（任意）
  amount?: number;               // 金額（自動計算）
  locations: ItemLocation[];     // 位置情報配列
  dimensions?: {                 // 寸法情報
    length?: number;
    width?: number;
    height?: number;
    area?: number;
  };
  confidence: number;            // AI検出信頼度 0-1
  source: 'manual' | 'ai';       // 入力元
  notes?: string;                // 備考
  createdAt: string;
  updatedAt: string;
}

interface ItemLocation {
  x: number;
  y: number;
  roomName?: string;
}
```

#### 3.7.2 結果表示機能

| 機能 | 説明 |
|------|------|
| カテゴリ別グループ表示 | カテゴリごとにグループ化 |
| フィルター | カテゴリ、信頼度でフィルタリング |
| ソート | 種別、数量、信頼度でソート |
| 検索 | テキスト検索 |
| ハイライト | 図面上へのハイライト表示 |

#### 3.7.3 編集機能

- アイテムの追加（手動）
- アイテムの編集（種別、数量、単位、備考等）
- アイテムの削除
- 位置の再指定

### 3.8 集計・出力

#### 3.8.1 集計表機能

| 機能 | 説明 |
|------|------|
| 表示切替 | カテゴリ別/図面別/部屋別 |
| 単価入力 | 各アイテムに単価を設定 |
| 金額計算 | 自動計算 |
| 合計表示 | 合計金額を表示 |
| インライン編集 | 表内で直接編集 |

#### 3.8.2 エクスポート形式

| 形式 | 内容 |
|------|------|
| Excel (.xlsx) | 集計表シート、図面別内訳シート、透かし埋め込み |
| CSV (.csv) | 数量データのみ |
| PDF (.pdf) | 集計表、マーキング付き拾い図 |

### 3.9 データ管理

#### 3.9.1 ローカルストレージ

| データ種別 | 保存先 |
|-----------|--------|
| プロジェクトデータ | IndexedDB |
| ライセンス情報 | LocalStorage（共通ライブラリ使用） |

#### 3.9.2 データエクスポート/インポート

**エクスポートファイル形式:** `sekisan_ocr_backup_YYYY-MM-DDTHH-MM-SS.json`

**JSONエクスポートデータ構造:**

```typescript
interface ExportData {
  toolId: 'sekisan-ocr';
  toolVersion: '1.0';
  exportedAt: string;            // ISO8601日時
  licenseId: string;
  data: {
    projects: Project[];
  };
}
```

#### 3.9.3 ストレージ容量管理

| 使用率 | アクション |
|--------|----------|
| 80%以上 | 警告（オレンジ） |
| 95%以上 | 警告（赤） |
| 100% | 保存制限 |

### 3.10 設定画面

#### 3.10.1 ライセンス情報表示

> 共通ライブラリの `getStoredLicense()` を使用

- 企業名
- ライセンス種別
- プラン種別
- 有効期限（TRIAL時）
- 残日数（TRIAL時）

#### 3.10.2 データ管理

- ストレージ使用量表示
- JSONエクスポートボタン
- JSONインポートボタン
- データクリア機能

#### 3.10.3 表示設定

- デフォルト縮尺設定
- デフォルト検出カテゴリ設定
- グリッド表示のON/OFFデフォルト

#### 3.10.4 ライセンス操作

> 共通ライブラリの `clearLicense()` を使用

- ログアウト（ライセンスクリア）
- 別のライセンスで認証

---

## 4. 非機能要件

### 4.1 パフォーマンス

| 項目 | 目標 |
|------|------|
| ページ初期表示 | 3秒以内 |
| 図面表示（10MB以下） | 2秒以内 |
| AI拾い出し（1図面） | 60秒以内 |
| ズーム・パン操作 | 60fps維持 |

### 4.2 可用性

- オフライン時もローカルデータで動作（AI機能除く）
- ブラウザクラッシュ時のデータ復旧（IndexedDB）

### 4.3 セキュリティ

- API通信はHTTPS必須
- ユーザーデータはローカルのみ保存（AI処理時の図面データ除く）

### 4.4 ブラウザ対応

| ブラウザ | 対応 |
|---------|------|
| Chrome（最新版） | 推奨 |
| Edge（最新版） | 推奨 |
| Firefox（最新版） | 対応 |
| Safari（最新版） | 対応 |
| IE11 | 非対応 |

### 4.5 画面解像度

| 項目 | 値 |
|------|-----|
| 推奨 | 1920x1080以上 |
| 最小 | 1280x720 |

---

## 5. 技術仕様

### 5.1 フロントエンド技術スタック

| 項目 | 技術 |
|------|------|
| フレームワーク | Next.js 14（App Router） |
| 言語 | TypeScript |
| UIライブラリ | shadcn/ui |
| スタイリング | Tailwind CSS |
| 状態管理 | Zustand |
| ローカルDB | Dexie.js（IndexedDB） |
| 図面描画 | Fabric.js または Konva.js |
| PDF処理 | PDF.js |
| Excel出力 | ExcelJS |
| PDF出力 | jsPDF |

### 5.2 AI/API

| 項目 | 値 |
|------|-----|
| AIモデル | Gemini 3 Flash Preview |
| API呼び出し | サーバーサイド（/api/ルート経由） |
| 画像送信 | Base64エンコード |

### 5.3 環境変数

```env
# 共通（IMPLEMENTATION_GUIDE.md参照）
NEXT_PUBLIC_MEMBERSHIP_API_URL=https://membership.conoc.jp
NEXT_PUBLIC_TOOL_SLUG=sekisan-ocr

# 積算OCR固有
GEMINI_API_KEY=your-gemini-api-key  # サーバーサイドのみ
```

### 5.4 ディレクトリ構成

```
app/
├── api/
│   ├── license/
│   │   └── verify/
│   │       └── route.ts      # ライセンス認証プロキシ
│   └── gemini/
│       └── route.ts          # Gemini API呼び出し
├── dashboard/
│   └── page.tsx              # ダッシュボード（プロジェクト一覧）
├── projects/
│   └── page.tsx              # プロジェクト管理
├── viewer/
│   └── [projectId]/
│       └── page.tsx          # 図面ビューア・拾い出し
├── results/
│   └── [projectId]/
│       └── page.tsx          # 集計・出力
├── settings/
│   └── page.tsx              # 設定画面
├── license/
│   └── page.tsx              # ライセンス認証
├── layout.tsx
└── page.tsx                  # エントリーポイント

src/
├── components/
│   ├── ui/                   # shadcn/ui コンポーネント
│   ├── viewer/               # 図面ビューア関連
│   │   ├── DrawingCanvas.tsx
│   │   ├── ToolBar.tsx
│   │   ├── ScaleCalibration.tsx
│   │   ├── PointTool.tsx
│   │   ├── LineTool.tsx
│   │   ├── AreaTool.tsx
│   │   └── MiniMap.tsx
│   ├── takeoff/              # 拾い出し関連
│   │   ├── TakeoffList.tsx
│   │   ├── TakeoffItem.tsx
│   │   ├── CategoryFilter.tsx
│   │   └── AiProcessingModal.tsx
│   ├── export/               # 出力関連
│   │   ├── SummaryTable.tsx
│   │   └── ExportButtons.tsx
│   ├── project/              # プロジェクト関連
│   │   ├── ProjectCard.tsx
│   │   ├── ProjectList.tsx
│   │   └── ProjectForm.tsx
│   └── common/               # 共通コンポーネント
│       ├── TrialBanner.tsx
│       └── StorageIndicator.tsx
├── lib/
│   ├── shared/               # 共通ライブラリ（既存）
│   │   ├── index.ts
│   │   ├── auth/
│   │   │   └── license.ts
│   │   ├── types/
│   │   │   └── license.ts
│   │   └── watermark/
│   │       └── index.ts
│   ├── gemini.ts             # Gemini API クライアント
│   ├── excel-generator.ts    # Excel生成
│   ├── pdf-generator.ts      # PDF生成
│   ├── data-export.ts        # データエクスポート/インポート
│   └── storage.ts            # IndexedDB操作
├── stores/
│   ├── project-store.ts      # プロジェクト状態管理
│   ├── viewer-store.ts       # ビューア状態管理
│   └── takeoff-store.ts      # 拾い出し状態管理
├── types/
│   ├── project.ts
│   ├── drawing.ts
│   └── takeoff.ts
└── hooks/
    ├── useLicense.ts         # ライセンス状態（IMPLEMENTATION_GUIDE.md参照）
    ├── useProject.ts
    ├── useViewer.ts
    └── useTakeoff.ts

public/
└── samples/                  # デモ用サンプル図面
```

---

## 6. AI拾い出しプロンプト設計

### 6.1 システムプロンプト

```
あなたは建設図面の数量拾い出しを行う専門AIです。
提供された図面画像から、指定されたカテゴリに該当する項目を検出し、JSON形式で出力してください。

## 検出対象
- 電気設備（照明器具、コンセント・スイッチ、配線、分電盤等）
- 空調設備（空調機器、ダクト、吹出口・吸込口、配管等）
- 衛生設備（衛生器具、給排水配管、バルブ・継手等）
- 消防設備（スプリンクラー、感知器、消火栓、誘導灯等）
- 建築躯体（コンクリート、鉄筋、型枠、鉄骨等）
- 建築仕上げ（床・壁・天井仕上げ、建具等）
- 外壁・屋根（外壁材、屋根材、付帯設備等）
- 土木（舗装、構造物、土工等）

## 出力形式
{
  "drawing_info": {
    "scale": "図面の縮尺（読み取れない場合は'unknown'）",
    "drawing_type": "図面種別（例: '電気設備平面図'）"
  },
  "items": [
    {
      "id": "連番",
      "item_type": "具体的な名称",
      "category": "上記カテゴリから選択",
      "sub_category": "詳細分類",
      "quantity": "検出数量",
      "unit": "単位（個, m, m², m³, kg, 本, 枚, 台等）",
      "locations": [
        { "x": "X座標", "y": "Y座標", "room_name": "部屋名" }
      ],
      "dimensions": "寸法情報（該当する場合）",
      "confidence": "検出信頼度(0.0-1.0)",
      "notes": "仕様・型番等の補足情報"
    }
  ],
  "summary": [
    { "category": "カテゴリ名", "total_items": "合計数" }
  ]
}

## 検出ルール
1. 同一種別のアイテムは個別にカウントする
2. 配管・ダクト・配線は可能な限りルートを追跡して長さを算出する
3. 面積は輪郭を検出して算出する
4. 図面上のテキスト（寸法値、部屋名、仕様等）はOCRで読み取る
5. 検出できない項目は無理に出力しない
6. 信頼度が低い場合は0.5以下の値を設定する
```

### 6.2 ユーザープロンプトテンプレート

```
この図面から以下のカテゴリの項目を拾い出してください。

対象カテゴリ: {categories}
縮尺: {scale}

検出した項目は指定されたJSON形式で出力してください。
```

### 6.3 API呼び出し実装

```typescript
// src/lib/gemini.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function analyzeDrawing(
  imageBase64: string,
  categories: string[],
  scale?: string
): Promise<TakeoffResult> {
  const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

  const prompt = `この図面から以下のカテゴリの項目を拾い出してください。

対象カテゴリ: ${categories.join(', ')}
縮尺: ${scale || '不明'}

検出した項目は指定されたJSON形式で出力してください。`;

  const result = await model.generateContent([
    { text: SYSTEM_PROMPT },
    { text: prompt },
    {
      inlineData: {
        mimeType: 'image/png',
        data: imageBase64,
      },
    },
  ]);

  const response = await result.response;
  const text = response.text();

  // JSONをパースして返却
  return JSON.parse(text);
}
```

---

## 7. 開発フェーズ

### Phase 1: 基盤構築

**タスク:**
- [x] 共通基盤の利用（ライセンス認証、電子透かし）← **既存ライブラリ使用**
- [ ] プロジェクト管理CRUD
- [ ] 図面アップロード・表示
- [ ] 図面ビューア基本機能（パン、ズーム）
- [ ] 縮尺設定機能

### Phase 2: 手動拾い出し

**タスク:**
- [ ] 点カウントツール
- [ ] 線計測ツール
- [ ] 面積計測ツール
- [ ] 矩形選択ツール
- [ ] 拾い出し結果の表示・編集

### Phase 3: AI機能

**タスク:**
- [ ] Gemini API連携
- [ ] 単一図面AI拾い出し
- [ ] 複数図面一括処理
- [ ] AI結果の表示・編集

### Phase 4: 出力機能

**タスク:**
- [ ] 集計表機能
- [ ] Excelエクスポート（透かし付き）
- [ ] CSVエクスポート
- [ ] PDFエクスポート（拾い図付き）

### Phase 5: 仕上げ

**タスク:**
- [ ] 設定画面
- [ ] データエクスポート/インポート
- [ ] UI/UX調整
- [ ] テスト・バグ修正

---

## 8. 参照ドキュメント

| ドキュメント | 説明 |
|-------------|------|
| `docs/LICENSE_SPEC.md` | ライセンス認証の詳細仕様 |
| `docs/IMPLEMENTATION_GUIDE.md` | ツール実装ガイド |
| `src/lib/shared/` | 共通ライブラリ（認証・透かし） |

---

## 9. 関連ツール

| slug | ツール名 | 状態 |
|------|---------|------|
| `greenfile` | グリーンファイル | 実装済み |
| `phototag` | PhotoTag Local | 要件定義済み |
| `drawingdiff` | Drawing Diff Local | 要件定義済み |
| `sekisan-ocr` | 積算OCR | **本ドキュメント** |

---

## 更新履歴

| 日付 | バージョン | 内容 |
|------|-----------|------|
| 2026-01-16 | 1.0 | 初版作成 |
