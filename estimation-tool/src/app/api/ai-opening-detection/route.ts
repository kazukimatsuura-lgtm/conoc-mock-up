import { NextRequest, NextResponse } from 'next/server';
import { callGeminiVision, extractJSON, GEMINI_MODEL } from '@/lib/gemini';

const OPENING_DETECTION_PROMPT = `あなたは建築図面から開口部を検出する専門家です。
提供された建築図面画像から、すべてのドア・窓などの開口部を検出してください。

## 検出対象
1. ドア
   - 片開きドア（スイングドア）
   - 両開きドア
   - 引き戸（引違い、片引き）
   - 折れ戸
2. 窓
   - 腰窓
   - 掃き出し窓
   - 高窓
   - FIX窓（はめ殺し）
3. その他
   - 開口（壁の開口部）
   - シャッター
   - ガラスブロック

## 出力形式
必ず以下のJSON形式で出力してください。

{
  "openings": [
    {
      "id": "opening_1",
      "type": "door" | "window" | "opening" | "shutter",
      "subtype": "swing" | "double" | "sliding" | "folding" | "casement" | "fix" | "other",
      "width": 幅（mm、図面から読み取れる場合）,
      "height": 高さ（mm、図面から読み取れる場合）,
      "label": "図面上のラベル（例：WD-1, SD-1）",
      "confidence": 信頼度（0.0〜1.0）,
      "location": {
        "x": 画像内のX座標（0〜1の相対値）,
        "y": 画像内のY座標（0〜1の相対値）
      },
      "wallSide": "north" | "south" | "east" | "west" | "unknown",
      "roomName": "接する部屋名（わかれば）"
    }
  ],
  "summary": {
    "totalDoors": ドア数,
    "totalWindows": 窓数,
    "totalOpenings": 開口数
  },
  "notes": "検出に関する補足"
}

## ルール
1. 図面記号から開口部の種類を判定
   - 円弧 → スイングドア
   - 二重線 → 引違い窓/ドア
   - X印 → FIX窓
2. 寸法表記があれば読み取り
3. 記号ラベル（WD-1等）があれば記録
4. 壁の向きを推定して記録`;

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { imageData, mimeType = 'image/png' } = body;

    if (!imageData) {
      return NextResponse.json(
        { error: 'Image data is required' },
        { status: 400 }
      );
    }

    const response = await callGeminiVision({
      prompt: OPENING_DETECTION_PROMPT,
      imageData,
      mimeType,
    });

    if (response.error) {
      return NextResponse.json(
        { error: response.error },
        { status: 500 }
      );
    }

    const jsonStr = extractJSON(response.text);
    let result;
    try {
      result = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse opening detection response:', response.text);
      return NextResponse.json(
        {
          error: 'Failed to parse AI response',
          rawResponse: response.text.substring(0, 500)
        },
        { status: 500 }
      );
    }

    // 結果を検証・正規化
    const validatedOpenings = (result.openings || []).map((opening: Record<string, unknown>, index: number) => ({
      id: String(opening.id || `opening_${index + 1}`),
      type: ['door', 'window', 'opening', 'shutter'].includes(String(opening.type))
        ? String(opening.type)
        : 'opening',
      subtype: String(opening.subtype || 'other'),
      width: opening.width ? Number(opening.width) : undefined,
      height: opening.height ? Number(opening.height) : undefined,
      label: opening.label ? String(opening.label) : undefined,
      confidence: Math.min(1, Math.max(0, Number(opening.confidence) || 0.5)),
      location: opening.location ? {
        x: Math.min(1, Math.max(0, Number((opening.location as Record<string, unknown>).x) || 0)),
        y: Math.min(1, Math.max(0, Number((opening.location as Record<string, unknown>).y) || 0)),
      } : { x: 0, y: 0 },
      wallSide: opening.wallSide ? String(opening.wallSide) : 'unknown',
      roomName: opening.roomName ? String(opening.roomName) : undefined,
    }));

    const processingTime = Date.now() - startTime;

    const doors = validatedOpenings.filter((o: { type: string }) => o.type === 'door');
    const windows = validatedOpenings.filter((o: { type: string }) => o.type === 'window');

    return NextResponse.json({
      success: true,
      openings: validatedOpenings,
      summary: {
        totalDoors: doors.length,
        totalWindows: windows.length,
        totalOpenings: validatedOpenings.length,
      },
      notes: result.notes || '',
      processingTime,
      modelVersion: GEMINI_MODEL,
    });

  } catch (error) {
    console.error('Opening detection error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
