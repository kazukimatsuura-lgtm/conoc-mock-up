# 積算OCR（Sekisan OCR）

建設図面からの数量拾い出しを自動化するAI OCRツールです。

## 開発状況

### Phase 1（基盤構築）- 完了
- [x] 共通基盤実装（ライセンス認証、電子透かし）
- [x] プロジェクト管理CRUD
- [x] 図面アップロード・表示
- [x] 図面ビューア基本機能（パン、ズーム）
- [x] 縮尺設定機能

### Phase 2（手動拾い出し）- 未着手
- [ ] 点カウントツール
- [ ] 線計測ツール
- [ ] 面積計測ツール
- [ ] 矩形選択ツール
- [ ] 拾い出し結果の表示・編集

### Phase 3（AI機能）- 未着手
- [ ] Gemini API連携
- [ ] 単一図面AI拾い出し
- [ ] 複数図面一括処理
- [ ] AI結果の表示・編集

### Phase 4（出力機能）- 未着手
- [ ] 集計表機能
- [ ] Excelエクスポート（透かし付き）
- [ ] CSVエクスポート
- [ ] PDFエクスポート（拾い図付き）

### Phase 5（仕上げ）- 未着手
- [ ] 設定画面
- [ ] データエクスポート/インポート
- [ ] UI/UX調整
- [ ] テスト・バグ修正

## セットアップ

```bash
# 依存関係のインストール
npm install

# 開発サーバーの起動
npm run dev

# ビルド
npm run build
```

## 環境変数

`.env.local` を作成：

```env
NEXT_PUBLIC_MEMBERSHIP_API_URL=https://conoc-membership-platform.vercel.app
NEXT_PUBLIC_TOOL_SLUG=sekisan-ocr
GEMINI_API_KEY=your-gemini-api-key
```

## 技術スタック

- **フレームワーク**: Next.js 14 (App Router)
- **言語**: TypeScript
- **UIライブラリ**: shadcn/ui
- **スタイリング**: Tailwind CSS
- **状態管理**: Zustand
- **ローカルDB**: Dexie.js (IndexedDB)
- **PDF処理**: PDF.js

## ドキュメント

- [要件定義書](./docs/SEKISAN_OCR_SPEC.md)
- [ライセンス認証仕様書](./docs/LICENSE_SPEC.md)
- [実装ガイド](./docs/IMPLEMENTATION_GUIDE.md)

---

# CONOC Tools 共通ライブラリ

CONOCツール群で使用する共通のライセンス認証・透かし機能のライブラリです。

## ディレクトリ構成

```
共通要件フォルダ/
├── README.md                    # このファイル
├── docs/
│   ├── LICENSE_SPEC.md          # ライセンス認証仕様書
│   └── IMPLEMENTATION_GUIDE.md  # ツール実装ガイド
└── src/
    └── lib/
        └── shared/
            ├── index.ts         # エクスポート
            ├── types/
            │   └── license.ts   # 型定義
            ├── auth/
            │   └── license.ts   # 認証関数
            └── watermark/
                └── index.ts     # 透かし機能
```

## セットアップ手順

### 1. 新規ツールプロジェクト作成

```bash
npx create-next-app@latest my-tool --typescript --tailwind --app
cd my-tool
```

### 2. 共通ライブラリをコピー

```bash
cp -r /path/to/共通要件フォルダ/src/lib/shared ./src/lib/
```

### 3. 環境変数を設定

`.env.local` を作成：

```env
# メンバーシップサイトのURL
NEXT_PUBLIC_MEMBERSHIP_API_URL=https://membership.conoc.jp

# このツールのslug（メンバーシップ管理画面で登録したものと同じ）
NEXT_PUBLIC_TOOL_SLUG=my-tool
```

### 4. ライセンス認証ページを実装

詳細は `docs/IMPLEMENTATION_GUIDE.md` を参照。

## 主要な関数

### 認証関連

| 関数名 | 説明 |
|--------|------|
| `verifyLicense(key, toolId)` | ライセンスキーを認証 |
| `getStoredLicense()` | 保存済みライセンス情報を取得 |
| `clearLicense()` | ライセンス情報をクリア |
| `isVipPlan(license)` | VIPプランか判定 |
| `canUseAiFeatures(license)` | AI機能使用可能か判定 |
| `canModifyData(license)` | データ変更可能か判定 |
| `isTrialExpired(license)` | トライアル期限切れか判定 |
| `getTrialRemainingDays(license)` | トライアル残り日数を取得 |

### 透かし関連

| 関数名 | 説明 |
|--------|------|
| `getWatermarkConfig(license)` | 透かし設定を取得 |
| `getWatermarkText(config)` | 透かしテキストを生成 |
| `applyWatermarkToCanvas(canvas, config)` | Canvas画像に透かしを適用 |
| `getPdfWatermarkFooter(config)` | PDF用フッター情報を取得 |
| `getExcelWatermarkComment(config)` | Excel用コメントを生成 |

## ライセンスタイプ

| タイプ | 説明 | データ保存 | 有効期限 |
|--------|------|------------|----------|
| DEMO | デモ体験用 | 不可 | なし |
| TRIAL | 14日間トライアル | 可 | ツールごとに14日 |
| PURCHASED | 購入済み | 可 | ライセンスによる |

## 関連ドキュメント

- [ライセンス認証仕様書](./docs/LICENSE_SPEC.md)
- [ツール実装ガイド](./docs/IMPLEMENTATION_GUIDE.md)
