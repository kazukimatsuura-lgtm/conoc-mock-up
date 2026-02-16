import { NextRequest, NextResponse } from 'next/server';
import { callGeminiVision, extractJSON, GEMINI_MODEL } from '@/lib/gemini';

const ROOM_DETECTION_PROMPT = `建築図面から部屋を検出してください。主要な部屋のみ（最大6部屋）。

JSON形式で出力:
{"rooms":[{"name":"リビング","type":"living","area":20.5,"x":0.3,"y":0.4}],"summary":"概要"}

typeの値: living, bedroom, kitchen, bathroom, toilet, storage, corridor, entrance, balcony, other
x,yは部屋中心の相対座標(0-1)。`;

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

    console.log('[Room Detection] Calling Gemini API...');

    const response = await callGeminiVision({
      prompt: ROOM_DETECTION_PROMPT,
      imageData,
      mimeType,
    });

    if (response.error) {
      console.error('[Room Detection] API error:', response.error);
      return NextResponse.json(
        { error: response.error, details: 'Gemini API call failed' },
        { status: 500 }
      );
    }

    if (!response.text || response.text.trim().length === 0) {
      console.error('[Room Detection] Empty response from Gemini API');
      return NextResponse.json(
        { error: 'Empty response from Gemini API' },
        { status: 500 }
      );
    }

    console.log('[Room Detection] Response length:', response.text.length);

    const jsonStr = extractJSON(response.text);
    let result;
    try {
      result = JSON.parse(jsonStr);
      console.log('[Room Detection] Parsed rooms:', result.rooms?.length || 0);
    } catch (parseError) {
      console.error('[Room Detection] JSON parse error:', response.text.substring(0, 500));
      return NextResponse.json(
        {
          error: 'Failed to parse AI response',
          rawResponse: response.text.substring(0, 500)
        },
        { status: 500 }
      );
    }

    const validatedRooms = (result.rooms || []).map((room: Record<string, unknown>, index: number) => ({
      id: `room_${index + 1}`,
      name: String(room.name || `Room ${index + 1}`),
      type: String(room.type || 'other'),
      area: room.area ? Number(room.area) : undefined,
      confidence: 0.9,
      boundary: [],
      center: {
        x: Math.min(1, Math.max(0, Number(room.x) || 0.5)),
        y: Math.min(1, Math.max(0, Number(room.y) || 0.5)),
      },
    }));

    const processingTime = Date.now() - startTime;
    console.log('[Room Detection] Success:', validatedRooms.length, 'rooms in', processingTime, 'ms');

    return NextResponse.json({
      success: true,
      rooms: validatedRooms,
      totalArea: result.totalArea || undefined,
      roomCount: validatedRooms.length,
      summary: result.summary || '',
      processingTime,
      modelVersion: GEMINI_MODEL,
    });

  } catch (error) {
    console.error('[Room Detection] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
