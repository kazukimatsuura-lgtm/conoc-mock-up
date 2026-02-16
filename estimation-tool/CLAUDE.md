# CONOC 積算OCR - 開発ルール

## Gemini API モデル設定

**重要: Geminiモデルは必ず `gemini-3-flash-preview` を使用すること。**

変更禁止。このモデルで動作確認済み。

```typescript
const GEMINI_MODEL = 'gemini-3-flash-preview';
```

該当ファイル:
- `/src/lib/gemini.ts`
- `/src/app/api/ai-takeoff/route.ts`
- `/src/app/api/ai-dimension-ocr/route.ts`
- `/src/app/api/ai-room-detection/route.ts`
- `/src/app/api/ai-opening-detection/route.ts`

## その他の開発ルール

### ツールバー
- ポインタ、パン（手のひら）、ズーム（虫眼鏡）ツールは不要（削除済み）
- 図面移動: 右クリック+ドラッグ または 中クリック+ドラッグ
- ズーム: Ctrl/Cmd + マウスホイール

### UI
- ToolSettingsPanelは折りたたみ可能（ChevronUpボタン）
- 左パネル（図面一覧）と右パネル（拾い出し結果）も折りたたみ可能
