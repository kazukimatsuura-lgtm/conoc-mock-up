import { NextRequest, NextResponse } from 'next/server';
import { MATERIAL_CATEGORIES } from '@/types/material';
import type { MaterialCategory } from '@/types/material';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-3-flash-preview';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const MATERIAL_IMPORT_PROMPT = `あなたは建築資材データを分析する専門家です。
提供されたCSV/Excel形式のデータから、部材情報を抽出・カテゴリ分けしてください。

## カテゴリ一覧
${MATERIAL_CATEGORIES.map(c => `- ${c.id}: ${c.label}`).join('\n')}

## 出力形式
必ず以下のJSON形式で出力してください。

{
  "materials": [
    {
      "name": "部材名",
      "productNumber": "品番（あれば）",
      "category": "カテゴリID（上記から選択）",
      "manufacturer": "メーカー名（あれば）",
      "unitPrice": 単価（数値、あれば）,
      "unit": "単位（m², m, 枚, 個など）",
      "specifications": "規格・仕様",
      "dimensions": {
        "width": 幅mm（あれば）,
        "length": 長さmm（あれば）,
        "thickness": 厚さmm（あれば）
      },
      "confidence": 0.9,
      "rawData": { 元データのキーバリュー }
    }
  ],
  "columnMapping": {
    "検出したカラム名": "マッピング先フィールド"
  },
  "summary": "解析結果の概要"
}

## ルール
1. 部材名からカテゴリを推測
   - 「フローリング」「床材」「CF」→ flooring
   - 「クロス」「壁紙」「塗装」→ wall or paint
   - 「タイル」「タイルカーペット」→ tile or carpet
   - 「ドア」「建具」「SD」「WD」→ door
   - 「窓」「サッシ」→ window
   - 「照明」「コンセント」「スイッチ」→ electrical
   - 「エアコン」「換気扇」→ hvac
2. 価格データは数値に変換（カンマ除去、円記号除去）
3. 単位が不明な場合は推測
4. 元のデータは rawData に保持`;

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
    const { data, format = 'json' } = body;

    if (!data) {
      return NextResponse.json(
        { error: 'Data is required' },
        { status: 400 }
      );
    }

    // データを文字列に変換
    let dataString: string;
    if (typeof data === 'string') {
      dataString = data;
    } else if (Array.isArray(data)) {
      // 配列の場合はCSV風に変換
      if (data.length > 0 && typeof data[0] === 'object') {
        const headers = Object.keys(data[0]);
        const rows = data.map(row => headers.map(h => String(row[h] ?? '')).join(','));
        dataString = [headers.join(','), ...rows].join('\n');
      } else {
        dataString = JSON.stringify(data);
      }
    } else {
      dataString = JSON.stringify(data);
    }

    const prompt = `${MATERIAL_IMPORT_PROMPT}

## 入力データ（${format}形式）
${dataString}

上記のデータを分析し、部材マスタ用のJSONを出力してください。`;

    // Gemini API呼び出し
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          topK: 32,
          topP: 1,
          maxOutputTokens: 8192,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Gemini API error:', errorData);
      return NextResponse.json(
        { error: `Gemini API error: ${response.status}`, details: errorData },
        { status: response.status }
      );
    }

    const apiData = await response.json();
    const textContent = apiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textContent) {
      return NextResponse.json(
        { error: 'No response from Gemini API' },
        { status: 500 }
      );
    }

    // JSONを抽出
    let jsonStr = textContent;
    const jsonMatch = textContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    } else {
      const jsonStart = textContent.indexOf('{');
      const jsonEnd = textContent.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        jsonStr = textContent.substring(jsonStart, jsonEnd + 1);
      }
    }

    let result;
    try {
      result = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse material import response:', textContent);
      return NextResponse.json(
        {
          error: 'Failed to parse AI response',
          rawResponse: textContent.substring(0, 500)
        },
        { status: 500 }
      );
    }

    // 結果を検証・正規化
    const validCategories = MATERIAL_CATEGORIES.map(c => c.id);
    const validatedMaterials = (result.materials || []).map((m: Record<string, unknown>) => {
      const category = validCategories.includes(String(m.category) as MaterialCategory)
        ? String(m.category) as MaterialCategory
        : 'other';

      return {
        name: String(m.name || '不明'),
        productNumber: String(m.productNumber || ''),
        category,
        manufacturer: String(m.manufacturer || ''),
        unitPrice: m.unitPrice ? Number(m.unitPrice) : 0,
        unit: String(m.unit || '式'),
        specifications: String(m.specifications || ''),
        dimensions: m.dimensions ? {
          width: (m.dimensions as Record<string, unknown>).width ? Number((m.dimensions as Record<string, unknown>).width) : undefined,
          length: (m.dimensions as Record<string, unknown>).length ? Number((m.dimensions as Record<string, unknown>).length) : undefined,
          thickness: (m.dimensions as Record<string, unknown>).thickness ? Number((m.dimensions as Record<string, unknown>).thickness) : undefined,
        } : undefined,
        confidence: Math.min(1, Math.max(0, Number(m.confidence) || 0.5)),
        rawData: m.rawData || {},
      };
    });

    const processingTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      materials: validatedMaterials,
      columnMapping: result.columnMapping || {},
      summary: result.summary || '',
      processingTime,
      modelVersion: GEMINI_MODEL,
    });

  } catch (error) {
    console.error('Material import error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
