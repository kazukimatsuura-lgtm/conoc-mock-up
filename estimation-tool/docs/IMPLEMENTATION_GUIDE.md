# ツール実装ガイド

新しいCONOCツールを開発する際の実装手順です。

## 1. プロジェクト初期設定

### 1.1 Next.jsプロジェクト作成

```bash
npx create-next-app@latest conoc-{tool-name} --typescript --tailwind --app
cd conoc-{tool-name}
```

### 1.2 共通ライブラリをコピー

```bash
cp -r /path/to/共通要件フォルダ/src/lib/shared ./src/lib/
```

### 1.3 環境変数を設定

`.env.local`:

```env
NEXT_PUBLIC_MEMBERSHIP_API_URL=https://membership.conoc.jp
NEXT_PUBLIC_TOOL_SLUG=your-tool-slug
```

### 1.4 ツールのslugを決定

- 半角英小文字・数字・ハイフンのみ
- 例: `greenfile`, `kizuki`, `invoice-manager`
- **重要**: メンバーシップ管理画面でツール登録時に同じslugを入力

## 2. ライセンス認証ページの実装

### 2.1 ファイル構成

```
app/
├── license/
│   └── page.tsx       # ライセンス認証ページ
├── dashboard/
│   └── page.tsx       # 認証後のメインページ
└── layout.tsx
```

### 2.2 認証ページ実装例

```tsx
// app/license/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { verifyLicense, getStoredLicense } from '@/lib/shared';

const TOOL_SLUG = process.env.NEXT_PUBLIC_TOOL_SLUG || 'your-tool';
const DEMO_KEY = 'DEMO-C0N0-C2O2-4T00-LS24';

export default function LicensePage() {
  const router = useRouter();
  const [licenseKey, setLicenseKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 保存済みライセンスがあれば自動遷移
  useEffect(() => {
    const stored = getStoredLicense();
    if (stored?.success) {
      router.push('/dashboard');
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await verifyLicense(licenseKey, TOOL_SLUG);

    if (result.success) {
      router.push('/dashboard');
    } else {
      setError(result.error || '認証に失敗しました');
    }
    setLoading(false);
  };

  const handleDemo = async () => {
    setLoading(true);
    const result = await verifyLicense(DEMO_KEY, TOOL_SLUG);
    if (result.success) {
      router.push('/dashboard');
    } else {
      setError(result.error || 'デモ認証に失敗しました');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="max-w-md w-full p-8 bg-white rounded-lg shadow">
        <h1 className="text-2xl font-bold mb-6">ライセンス認証</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={licenseKey}
            onChange={(e) => setLicenseKey(e.target.value)}
            placeholder="ライセンスキーを入力"
            className="w-full p-3 border rounded"
          />

          {error && <p className="text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full p-3 bg-blue-600 text-white rounded"
          >
            {loading ? '認証中...' : '認証'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t">
          <button
            onClick={handleDemo}
            disabled={loading}
            className="w-full p-3 bg-gray-100 rounded"
          >
            デモ版を試す
          </button>
        </div>
      </div>
    </div>
  );
}
```

## 3. 認証状態の管理

### 3.1 認証チェック用のカスタムフック

```tsx
// hooks/useLicense.ts
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  getStoredLicense,
  canModifyData,
  isTrialExpired,
  getTrialRemainingDays,
  type StoredLicenseInfo
} from '@/lib/shared';

export function useLicense() {
  const router = useRouter();
  const [license, setLicense] = useState<StoredLicenseInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = getStoredLicense();
    if (!stored?.success) {
      router.push('/license');
      return;
    }
    setLicense(stored);
    setLoading(false);
  }, [router]);

  return {
    license,
    loading,
    canModify: canModifyData(license),
    isTrialExpired: isTrialExpired(license),
    trialDaysRemaining: getTrialRemainingDays(license),
    isDemo: license?.licenseType === 'DEMO',
    isTrial: license?.licenseType === 'TRIAL',
    isVip: license?.planType === 'VIP',
  };
}
```

### 3.2 保護されたページでの使用

```tsx
// app/dashboard/page.tsx
'use client';

import { useLicense } from '@/hooks/useLicense';

export default function DashboardPage() {
  const { license, loading, canModify, isDemo } = useLicense();

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h1>ダッシュボード</h1>
      <p>企業名: {license?.companyName}</p>
      <p>ライセンス: {license?.licenseType}</p>

      {!canModify && (
        <div className="bg-yellow-100 p-4 rounded">
          読み取り専用モードです。データの編集はできません。
        </div>
      )}
    </div>
  );
}
```

## 4. TRIALバナーの実装

```tsx
// components/TrialBanner.tsx
'use client';

import { useLicense } from '@/hooks/useLicense';

export function TrialBanner() {
  const { license, isTrial, trialDaysRemaining, isTrialExpired } = useLicense();

  if (!isTrial) return null;

  if (isTrialExpired) {
    return (
      <div className="bg-red-600 text-white py-3 px-4 text-center">
        トライアル期間が終了しました。
        <a href="https://membership.conoc.jp/tools" className="underline ml-2">
          購入はこちら
        </a>
      </div>
    );
  }

  // 色の決定: 7日超→青、3-7日→オレンジ、3日以下→赤
  let bgColor = 'bg-blue-600';
  if (trialDaysRemaining !== null) {
    if (trialDaysRemaining <= 3) bgColor = 'bg-red-600';
    else if (trialDaysRemaining <= 7) bgColor = 'bg-orange-500';
  }

  return (
    <div className={`${bgColor} text-white py-2 px-4 text-center`}>
      トライアル期間：残り{trialDaysRemaining}日
    </div>
  );
}
```

## 5. データ編集の制御

### 5.1 編集可否のチェック

```tsx
// 編集ページでの使用例
'use client';

import { useLicense } from '@/hooks/useLicense';

export default function EditPage() {
  const { canModify, isTrialExpired, isDemo } = useLicense();

  if (!canModify) {
    return (
      <div className="p-8">
        <h1>編集できません</h1>
        {isDemo && <p>デモ版ではデータを保存できません。</p>}
        {isTrialExpired && <p>トライアル期間が終了しました。</p>}
        <a href="https://membership.conoc.jp/tools">購入はこちら</a>
      </div>
    );
  }

  return (
    <form>
      {/* 編集フォーム */}
    </form>
  );
}
```

### 5.2 保存ボタンの無効化

```tsx
<button
  type="submit"
  disabled={!canModify || loading}
  className={`px-4 py-2 rounded ${
    canModify ? 'bg-blue-600 text-white' : 'bg-gray-300 cursor-not-allowed'
  }`}
>
  保存
</button>
```

## 6. 透かし（ウォーターマーク）の適用

### 6.1 Excel出力時

```tsx
import { getWatermarkConfig, getExcelWatermarkComment } from '@/lib/shared';

function exportToExcel(data: any[], license: StoredLicenseInfo) {
  const config = getWatermarkConfig(license);
  const comment = getExcelWatermarkComment(config);

  // ExcelJSなどを使用してコメントを追加
  worksheet.getCell('A1').note = comment;
}
```

### 6.2 PDF出力時

```tsx
import { getWatermarkConfig, getPdfWatermarkFooter } from '@/lib/shared';

function exportToPdf(data: any[], license: StoredLicenseInfo) {
  const config = getWatermarkConfig(license);
  const footer = getPdfWatermarkFooter(config);

  // PDF生成ライブラリでフッターを追加
  // footer.left, footer.center, footer.right を使用
}
```

## 7. デプロイ前のチェックリスト

- [ ] 環境変数 `NEXT_PUBLIC_TOOL_SLUG` を設定
- [ ] メンバーシップ管理画面でツールを登録（同じslugを使用）
- [ ] メンバーシップサイトの CORS設定に本番URLを追加
- [ ] DEMO認証が動作することを確認
- [ ] TRIAL認証が動作することを確認
- [ ] PURCHASED認証が動作することを確認
- [ ] 透かしが正しく表示されることを確認
- [ ] TRIALバナーが正しく表示されることを確認
- [ ] 編集制限が正しく動作することを確認

## 8. CORS設定の追加

新しいツールをデプロイする際、メンバーシップサイトの認証APIにCORS許可を追加：

```typescript
// conoc-membership-platform/app/api/license/verify/route.ts

const ALLOWED_ORIGINS = [
  // ... 既存のオリジン
  'https://conoc-your-new-tool.vercel.app',  // 追加
];
```

## 9. トラブルシューティング

### CORS エラー

```
Access-Control-Allow-Origin ヘッダーがない
```

→ メンバーシップサイトの ALLOWED_ORIGINS に追加

### 401 Unauthorized

```
Invalid license key
```

→ ライセンスキーが正しいか確認。DEMOキーは `DEMO-C0N0-C2O2-4T00-LS24`

### 403 Forbidden

```
Tool not purchased with this license
```

→ そのライセンスで対象ツールが購入されていない

### TRIAL期限エラー

```
Trial period has expired
```

→ TRIALの14日間が経過。購入を案内
