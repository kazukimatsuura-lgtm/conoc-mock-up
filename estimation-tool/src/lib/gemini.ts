// Gemini API共通ユーティリティ

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
export const GEMINI_MODEL = 'gemini-3-flash-preview';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export interface GeminiRequest {
  prompt: string;
  imageData: string;
  mimeType?: string;
  maxOutputTokens?: number;
}

export interface GeminiResponse {
  text: string;
  error?: string;
}

export async function callGeminiVision(request: GeminiRequest): Promise<GeminiResponse> {
  if (!GEMINI_API_KEY) {
    return { text: '', error: 'Gemini API key is not configured' };
  }

  // Base64データからプレフィックスを除去
  const base64Data = request.imageData.replace(/^data:image\/\w+;base64,/, '');

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: request.prompt },
              {
                inline_data: {
                  mime_type: request.mimeType || 'image/png',
                  data: base64Data,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          topK: 32,
          topP: 1,
          maxOutputTokens: request.maxOutputTokens || 8192,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Gemini API error:', response.status, JSON.stringify(errorData, null, 2));
      const errorMessage = errorData?.error?.message || `Gemini API error: ${response.status}`;
      return { text: '', error: errorMessage };
    }

    const data = await response.json();

    // candidatesが存在しない場合をチェック
    if (!data.candidates || data.candidates.length === 0) {
      console.error('Gemini API: No candidates in response', JSON.stringify(data, null, 2));
      return { text: '', error: 'No candidates in Gemini API response' };
    }

    // Geminiの応答からテキストを抽出（ai-takeoffと同じ方法）
    const textContent = data.candidates[0]?.content?.parts?.[0]?.text;

    if (!textContent) {
      // candidatesが空の場合や、finishReasonがSAFETYなどの場合をチェック
      const finishReason = data.candidates[0]?.finishReason;
      const safetyRatings = data.candidates[0]?.safetyRatings;
      
      if (finishReason && finishReason !== 'STOP') {
        console.error('Gemini API finish reason:', finishReason, safetyRatings);
        return { 
          text: '', 
          error: `Gemini API finished with reason: ${finishReason}` 
        };
      }
      
      console.error('Gemini API: No text content in response', JSON.stringify(data.candidates[0], null, 2));
      return { text: '', error: 'No response from Gemini API' };
    }

    return { text: textContent };
  } catch (error) {
    console.error('Gemini API call error:', error);
    return { text: '', error: String(error) };
  }
}

export function extractJSON(text: string): string {
  // マークダウンのコードブロックを除去
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    return jsonMatch[1].trim();
  }

  // コードブロックがない場合、直接JSONを探す
  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}');
  if (jsonStart !== -1 && jsonEnd !== -1) {
    return text.substring(jsonStart, jsonEnd + 1);
  }

  // 配列の場合
  const arrayStart = text.indexOf('[');
  const arrayEnd = text.lastIndexOf(']');
  if (arrayStart !== -1 && arrayEnd !== -1) {
    return text.substring(arrayStart, arrayEnd + 1);
  }

  return text;
}
