import { NextRequest, NextResponse } from 'next/server';
import { callGeminiVision, extractJSON, GEMINI_MODEL } from '@/lib/gemini';

const DIMENSION_OCR_PROMPT = `建築図面から寸法を読み取ってください。主要な寸法のみ（最大10個）。

JSON形式で出力:
{"dimensions":[{"value":10714,"unit":"mm","text":"10,714","type":"length","x":0.5,"y":0.3}],"scale":{"detected":true,"ratio":"1:100"},"summary":"概要"}

type: length(長さ), area(面積), height(高さ), scale(縮尺)
x,yは位置の相対座標(0-1)。`;

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

    console.log('[Dimension OCR] Calling Gemini API...');

    const response = await callGeminiVision({
      prompt: DIMENSION_OCR_PROMPT,
      imageData,
      mimeType,
    });

    if (response.error) {
      console.error('[Dimension OCR] API error:', response.error);
      return NextResponse.json(
        { error: response.error, details: 'Gemini API call failed' },
        { status: 500 }
      );
    }

    if (!response.text || response.text.trim().length === 0) {
      console.error('[Dimension OCR] Empty response from Gemini API');
      return NextResponse.json(
        { error: 'Empty response from Gemini API' },
        { status: 500 }
      );
    }

    console.log('[Dimension OCR] Response length:', response.text.length);

    const jsonStr = extractJSON(response.text);
    let result;
    try {
      result = JSON.parse(jsonStr);
      console.log('[Dimension OCR] Parsed dimensions:', result.dimensions?.length || 0);
    } catch (parseError) {
      console.error('[Dimension OCR] JSON parse error:', response.text.substring(0, 500));
      return NextResponse.json(
        {
          error: 'Failed to parse AI response',
          rawResponse: response.text.substring(0, 500)
        },
        { status: 500 }
      );
    }

    const validatedDimensions = (result.dimensions || []).map((dim: Record<string, unknown>) => ({
      value: Number(dim.value) || 0,
      unit: String(dim.unit || 'mm'),
      text: String(dim.text || ''),
      type: ['length', 'area', 'height', 'scale'].includes(String(dim.type))
        ? String(dim.type)
        : 'length',
      confidence: 0.9,
      location: {
        x: Math.min(1, Math.max(0, Number(dim.x) || 0)),
        y: Math.min(1, Math.max(0, Number(dim.y) || 0)),
      },
    }));

    const processingTime = Date.now() - startTime;
    console.log('[Dimension OCR] Success:', validatedDimensions.length, 'dimensions in', processingTime, 'ms');

    return NextResponse.json({
      success: true,
      dimensions: validatedDimensions,
      scale: result.scale || { detected: false },
      summary: result.summary || '',
      processingTime,
      modelVersion: GEMINI_MODEL,
    });

  } catch (error) {
    console.error('[Dimension OCR] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
