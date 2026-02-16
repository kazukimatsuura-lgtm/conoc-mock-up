# ライセンス認証仕様書

## 概要

CONOCツール群は、メンバーシップサイト（membership.conoc.jp）の認証APIを使用してライセンス認証を行います。

## ライセンスキーの形式

```
{TYPE}-{XXXX}-{XXXX}-{XXXX}-{XXXX}
```

| プレフィックス | 説明 |
|---------------|------|
| `DEMO` | デモ体験用（共通キー） |
| `TRIAL` | トライアル用 |
| `STD` | スタンダードプラン購入済み |
| `VIP` | VIPプラン購入済み |

### DEMOキー（共通）

全ツール共通で使用できるDEMOキー：

```
DEMO-C0N0-C2O2-4T00-LS24
```

## 認証フロー

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  ツールアプリ │     │  認証API         │     │  Supabase DB    │
└──────┬──────┘     └────────┬────────┘     └────────┬────────┘
       │                     │                       │
       │ POST /api/license/verify                    │
       │ { licenseKey, toolId }                      │
       │────────────────────▶│                       │
       │                     │ licenses テーブル検索   │
       │                     │──────────────────────▶│
       │                     │                       │
       │                     │◀──────────────────────│
       │                     │                       │
       │                     │ [TRIALの場合]          │
       │                     │ trial_tool_usage 確認  │
       │                     │──────────────────────▶│
       │                     │                       │
       │                     │ [PURCHASEDの場合]      │
       │                     │ tool_ids に含まれるか確認│
       │                     │                       │
       │ レスポンス           │                       │
       │◀────────────────────│                       │
       │                     │                       │
       │ LocalStorageに保存   │                       │
       │                     │                       │
```

## ツール識別子（slug）

各ツールは一意の識別子（slug）を持ちます。

| slug | ツール名 |
|------|---------|
| `greenfile` | 安全書類作成支援ツール |
| `kizuki` | きづき工程管理 |

### slug の決め方

1. 半角英小文字・数字・ハイフンのみ使用
2. ツール名を端的に表す短い文字列
3. 一度決めたら変更しない（認証に影響するため）

### slug の登録

1. メンバーシップ管理画面でツールを登録
2. 「ツール識別子（slug）」フィールドに入力
3. ツールアプリ側で同じslugを使用

## ライセンスタイプ別の挙動

### DEMO

| 項目 | 内容 |
|------|------|
| 認証 | 共通DEMOキーで認証 |
| 有効期限 | なし（常に有効） |
| データ保存 | 不可（セッション内のみ） |
| 機能制限 | AI機能あり、写真10枚まで |
| 透かし | 「【デモ版】CONOC Tools - Demo Version」 |
| デモデータ | 事前ロードされたサンプルデータあり |

### TRIAL

| 項目 | 内容 |
|------|------|
| 認証 | メンバーシップサイトで発行されたTRIALキー |
| 有効期限 | **ツールごとに**初回認証から14日間 |
| データ保存 | 可 |
| 機能制限 | AI機能あり、写真100枚まで |
| 透かし | 「【トライアル】{企業名} / {ライセンスID}」 |
| 期限切れ後 | 読み取り専用（データ閲覧のみ可能） |

#### TRIALの期間管理

- `trial_tool_usage` テーブルで管理
- `license_id` + `tool_id（slug）` の組み合わせで一意
- 初回認証時に `expires_at` を設定（14日後）

```sql
-- trial_tool_usage テーブル構造
CREATE TABLE trial_tool_usage (
  id UUID PRIMARY KEY,
  license_id TEXT NOT NULL,
  tool_id TEXT NOT NULL,           -- slug（例: 'greenfile'）
  first_auth_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE(license_id, tool_id)
);
```

### PURCHASED（スタンダード/VIP）

| 項目 | スタンダード | VIP |
|------|-------------|-----|
| 認証 | STDキー | VIPキー |
| 有効期限 | ライセンスによる | ライセンスによる |
| データ保存 | 可 | 可 |
| AI機能 | なし | あり |
| 写真制限 | 無制限 | 無制限 |
| 透かし | 「{企業名} 専用 / {ライセンスID}」 | 同左 |

#### ツール購入確認

PURCHASEDライセンスは、購入したツールのみ使用可能：

```typescript
// licenses テーブルの tool_ids カラム
// 例: ['758fe5ed-2270-476d-9ae8-df9e47d10332', 'abc123...']

if (toolId && license.tool_ids && !license.tool_ids.includes(toolId)) {
  return { error: 'Tool not purchased with this license' };
}
```

## API仕様

### POST /api/license/verify

#### リクエスト

```json
{
  "licenseKey": "TRIAL-XXXX-XXXX-XXXX-XXXX",
  "toolId": "greenfile"
}
```

#### 成功レスポンス

```json
{
  "success": true,
  "licenseId": "LIC-12345",
  "companyName": "株式会社テスト",
  "contactEmail": "test@example.com",
  "licenseType": "TRIAL",
  "planType": "STANDARD",
  "expiresAt": "2025-01-28T00:00:00.000Z",
  "daysRemaining": 14,
  "features": {
    "aiOcr": true,
    "aiAnalysis": true,
    "pdfExport": true
  },
  "limits": {
    "maxPhotos": 100,
    "watermarkType": "TRIAL",
    "canSaveData": true,
    "hasPreloadedDemoData": false
  }
}
```

#### エラーレスポンス

```json
{
  "success": false,
  "error": "Invalid license key"
}
```

#### エラーコード

| HTTPステータス | error | 説明 |
|---------------|-------|------|
| 400 | License key is required | キーが空 |
| 400 | Tool ID is required for trial license | TRIALでtoolIdが空 |
| 401 | Invalid license key | キーが存在しない |
| 401 | License is inactive | ライセンスが無効化されている |
| 401 | License expired | 有効期限切れ |
| 401 | Trial period has expired | TRIALの14日が経過 |
| 403 | Tool not purchased with this license | 未購入のツール |
| 500 | Internal server error | サーバーエラー |

## オフライン対応

- 最後の認証から30日間はオフラインでも使用可能
- `lastVerifiedAt` をLocalStorageに保存
- オンライン復帰時に自動で再認証

## CORS設定

認証APIは以下のオリジンからのアクセスを許可：

```typescript
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
  'http://localhost:3004',
  'http://localhost:3005',
  'https://conoc-green-file.vercel.app',
  'https://conoc-kizuki.vercel.app',
  // 新しいツールを追加する際はここに追加
];
```

**新しいツールをデプロイする際は、メンバーシップサイトの `/api/license/verify/route.ts` に本番URLを追加してください。**
