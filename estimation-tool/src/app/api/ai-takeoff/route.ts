import { NextRequest, NextResponse } from 'next/server';
import { TAKEOFF_CATEGORIES, CATEGORY_ITEM_TYPES } from '@/types/takeoff';
import { CLASSIFY_PROMPT, DRAWING_TYPE_PROMPTS, parseClassification } from '@/lib/ai-prompts';
import { normalizeAiResult } from '@/lib/ai-normalizer';
import { extractJSON } from '@/lib/gemini';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-3-flash-preview';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Gemini API共通呼び出し関数
async function callGemini(
  prompt: string,
  base64Data: string,
  mimeType: string,
  maxOutputTokens: number = 8192
): Promise<string> {
  const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: base64Data } },
        ],
      }],
      generationConfig: {
        temperature: 0.1,
        topK: 32,
        topP: 1,
        maxOutputTokens,
      },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('Gemini API error:', response.status, JSON.stringify(errorData, null, 2));
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textContent) {
    const finishReason = data.candidates?.[0]?.finishReason;
    throw new Error(finishReason ? `Gemini finished with: ${finishReason}` : 'No response from Gemini');
  }

  return textContent;
}

// カテゴリとアイテムタイプの情報を生成（汎用プロンプト用）
function getCategoryInfo(): string {
  return TAKEOFF_CATEGORIES.map(cat => {
    const items = CATEGORY_ITEM_TYPES[cat.id] || [];
    const itemList = items.map(item => `${item.id}(${item.label}, 単位:${item.unit})`).join(', ');
    return `- ${cat.id}(${cat.label}): ${itemList}`;
  }).join('\n');
}

// 汎用プロンプト（フォールバック用）
const GENERIC_PROMPT = `あなたは建築図面を分析する専門家です。
提供された建築図面画像を分析し、設備や部材を検出して拾い出しを行ってください。

## 検出対象カテゴリとアイテムタイプ
${getCategoryInfo()}

## 出力形式
必ず以下のJSON形式で出力してください。それ以外のテキストは含めないでください。
【重要】itemTypeは必ず日本語で出力してください（例：コンセント、照明器具、エアコン、配管など）

{
  "items": [
    {
      "itemType": "日本語のアイテム名",
      "category": "カテゴリID",
      "quantity": 数量,
      "unit": "単位",
      "confidence": 信頼度,
      "specification": "仕様（40文字以内）",
      "modelNumber": "型番",
      "standard": "規格",
      "remarks": "備考",
      "locations": [{"x": 0.5, "y": 0.5, "label": "位置"}]
    }
  ],
  "summary": "検出結果の概要説明（日本語）"
}

## 分析のルール
1. 図面内のシンボルや記号から設備を特定してください
2. 同じ種類のアイテムは1つのエントリにまとめ、quantityに個数を入れてください
3. locationsには検出した各アイテムの位置を相対座標(0〜1)で記載してください
4. confidenceは検出の確信度を0〜1で表してください
5. 全ての出力は日本語で記述してください
6. 型番・規格が図面から読み取れる場合は必ず含めてください`;

// 汎用プロンプトでの分析（フォールバック）
async function fallbackGenericAnalysis(
  base64Data: string,
  mimeType: string,
  startTime: number
) {
  const textContent = await callGemini(GENERIC_PROMPT, base64Data, mimeType, 8192);
  const jsonStr = extractJSON(textContent);

  let result;
  try {
    result = JSON.parse(jsonStr);
  } catch {
    console.error('Failed to parse fallback response:', textContent.substring(0, 500));
    return NextResponse.json(
      { error: 'Failed to parse AI response' },
      { status: 500 }
    );
  }

  // 結果を検証・正規化
  const validatedItems = (result.items || []).map((item: Record<string, unknown>) => ({
    itemType: String(item.itemType || 'unknown'),
    category: String(item.category || 'electrical'),
    quantity: Math.max(1, Math.round(Number(item.quantity) || 1)),
    unit: String(item.unit || '個'),
    confidence: Math.min(1, Math.max(0, Number(item.confidence) || 0.5)),
    specification: item.specification ? String(item.specification).slice(0, 40) : undefined,
    modelNumber: item.modelNumber ? String(item.modelNumber) : undefined,
    standard: item.standard ? String(item.standard) : undefined,
    remarks: item.remarks ? String(item.remarks).slice(0, 40) : undefined,
    locations: Array.isArray(item.locations)
      ? item.locations.map((loc: Record<string, unknown>) => ({
          x: Math.min(1, Math.max(0, Number(loc.x) || 0)),
          y: Math.min(1, Math.max(0, Number(loc.y) || 0)),
          label: loc.label ? String(loc.label) : undefined,
        }))
      : [],
  }));

  return NextResponse.json({
    success: true,
    items: validatedItems,
    summary: result.summary || '',
    processingTime: Date.now() - startTime,
    modelVersion: GEMINI_MODEL,
  });
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  if (!GEMINI_API_KEY) {
    return NextResponse.json(
      { error: 'Gemini API key is not configured' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { imageData, mimeType = 'image/png' } = body;

    if (!imageData) {
      return NextResponse.json(
        { error: 'Image data is required' },
        { status: 400 }
      );
    }

    // Base64データからプレフィックスを除去
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');

    // ===== 第1段階: 図面分類 =====
    let classification;
    try {
      const classifyResponse = await callGemini(CLASSIFY_PROMPT, base64Data, mimeType, 4096);
      classification = parseClassification(classifyResponse);
      console.log('[AI Takeoff] Classification:', classification.図面種別, `(confidence: ${classification.confidence})`);
    } catch (classifyError) {
      console.error('[AI Takeoff] Classification failed, falling back to generic:', classifyError);
      return fallbackGenericAnalysis(base64Data, mimeType, startTime);
    }

    // 分類confidence < 0.3 or "その他" → 汎用プロンプトにフォールバック
    if (classification.confidence < 0.3 || classification.図面種別 === 'その他') {
      console.log('[AI Takeoff] Low confidence or unknown type, using generic prompt');
      return fallbackGenericAnalysis(base64Data, mimeType, startTime);
    }

    // ===== 第2段階: 種別に応じた専用プロンプト =====
    const specializedPrompt = DRAWING_TYPE_PROMPTS[classification.図面種別];
    if (!specializedPrompt) {
      console.log('[AI Takeoff] No specialized prompt for:', classification.図面種別);
      return fallbackGenericAnalysis(base64Data, mimeType, startTime);
    }

    let rawResult: Record<string, unknown>;
    try {
      const takeoffResponse = await callGemini(specializedPrompt, base64Data, mimeType, 16384);
      const jsonStr = extractJSON(takeoffResponse);
      rawResult = JSON.parse(jsonStr);
    } catch (parseError) {
      // リトライ1回
      console.warn('[AI Takeoff] First attempt failed, retrying:', parseError);
      try {
        const retryResponse = await callGemini(specializedPrompt, base64Data, mimeType, 16384);
        const retryJsonStr = extractJSON(retryResponse);
        rawResult = JSON.parse(retryJsonStr);
      } catch (retryError) {
        console.error('[AI Takeoff] Retry failed, falling back to generic:', retryError);
        return fallbackGenericAnalysis(base64Data, mimeType, startTime);
      }
    }

    // ===== 正規化: 種別固有JSON → AiDetectedItem[] =====
    const items = normalizeAiResult(classification.図面種別, rawResult, classification);

    const processingTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      items,
      summary: `${classification.図面種別}（${classification.図面詳細種別 || ''}）- ${items.length}件検出`,
      processingTime,
      modelVersion: GEMINI_MODEL,
      classification,
    });

  } catch (error) {
    console.error('AI takeoff error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
