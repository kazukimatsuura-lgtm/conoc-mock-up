import type { AiDetectedItem, AiTakeoffResult, DrawingClassification } from '@/types/takeoff';

export interface AiTakeoffResponse {
  success: boolean;
  items: AiDetectedItem[];
  summary?: string;
  processingTime: number;
  modelVersion: string;
  classification?: DrawingClassification;
  error?: string;
}

// 寸法OCR結果の型
export interface DimensionOcrResult {
  success: boolean;
  dimensions: Array<{
    value: number;
    unit: string;
    text: string;
    type: 'length' | 'area' | 'height' | 'scale';
    confidence: number;
    location: { x: number; y: number };
    context?: string;
  }>;
  scale?: {
    detected: boolean;
    ratio?: string;
    pixelsPerMm?: number;
  };
  summary?: string;
  processingTime: number;
  error?: string;
}

// 部屋検出結果の型
export interface RoomDetectionResult {
  success: boolean;
  rooms: Array<{
    id: string;
    name: string;
    type: string;
    area?: number;
    perimeter?: number;
    confidence: number;
    boundary: Array<{ x: number; y: number }>;
    center?: { x: number; y: number };
    labelPosition?: { x: number; y: number };
  }>;
  totalArea?: number;
  roomCount: number;
  summary?: string;
  processingTime: number;
  error?: string;
}

// 開口部検出結果の型
export interface OpeningDetectionResult {
  success: boolean;
  openings: Array<{
    id: string;
    type: 'door' | 'window' | 'opening' | 'shutter';
    subtype: string;
    width?: number;
    height?: number;
    label?: string;
    confidence: number;
    location: { x: number; y: number };
    wallSide?: string;
    roomName?: string;
  }>;
  summary: {
    totalDoors: number;
    totalWindows: number;
    totalOpenings: number;
  };
  notes?: string;
  processingTime: number;
  error?: string;
}

/**
 * 図面画像をAIで分析し、設備・部材を自動検出する
 */
export async function analyzeDrawingWithAi(
  imageDataUrl: string,
  signal?: AbortSignal
): Promise<AiTakeoffResponse> {
  try {
    // 画像データの検証
    if (!imageDataUrl || !imageDataUrl.startsWith('data:')) {
      return {
        success: false,
        items: [],
        processingTime: 0,
        modelVersion: '',
        error: '画像データが不正です。図面を再度選択してください。',
      };
    }

    const response = await fetch('/api/ai-takeoff', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageData: imageDataUrl,
        mimeType: imageDataUrl.startsWith('data:image/jpeg') ? 'image/jpeg' : 'image/png',
      }),
      signal,
    });

    // レスポンスの解析
    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return {
        success: false,
        items: [],
        processingTime: 0,
        modelVersion: '',
        error: 'サーバーからの応答を解析できませんでした。しばらく待ってから再試行してください。',
      };
    }

    if (!response.ok) {
      const errorMessage = data.error || `サーバーエラー (${response.status})`;
      console.error('API error:', response.status, errorMessage);
      return {
        success: false,
        items: [],
        processingTime: 0,
        modelVersion: '',
        error: errorMessage,
      };
    }

    return {
      success: true,
      items: data.items || [],
      summary: data.summary,
      processingTime: data.processingTime,
      modelVersion: data.modelVersion,
      classification: data.classification,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw error; // キャンセル時はエラーを再スロー
    }

    console.error('AI takeoff error:', error);

    // エラータイプに応じた詳細メッセージ
    let errorMessage = 'AI分析に失敗しました';
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      errorMessage = 'サーバーに接続できません。ネットワーク接続を確認するか、しばらく待ってから再試行してください。';
    } else if (error instanceof Error) {
      errorMessage = `エラー: ${error.message}`;
    }

    return {
      success: false,
      items: [],
      processingTime: 0,
      modelVersion: '',
      error: errorMessage,
    };
  }
}

/**
 * 図面画像から寸法をOCRで読み取る
 */
export async function detectDimensions(
  imageDataUrl: string,
  signal?: AbortSignal
): Promise<DimensionOcrResult> {
  try {
    // 画像データの検証
    if (!imageDataUrl || !imageDataUrl.startsWith('data:')) {
      return {
        success: false,
        dimensions: [],
        processingTime: 0,
        error: '画像データが不正です。図面を再度選択してください。',
      };
    }

    const response = await fetch('/api/ai-dimension-ocr', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageData: imageDataUrl,
        mimeType: imageDataUrl.startsWith('data:image/jpeg') ? 'image/jpeg' : 'image/png',
      }),
      signal,
    });

    // レスポンスの解析
    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return {
        success: false,
        dimensions: [],
        processingTime: 0,
        error: 'サーバーからの応答を解析できませんでした。しばらく待ってから再試行してください。',
      };
    }

    if (!response.ok) {
      const errorMessage = data.error || `サーバーエラー (${response.status})`;
      console.error('API error:', response.status, errorMessage);
      return {
        success: false,
        dimensions: [],
        processingTime: 0,
        error: errorMessage,
      };
    }

    return {
      success: true,
      dimensions: data.dimensions || [],
      scale: data.scale,
      summary: data.summary,
      processingTime: data.processingTime,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw error;
    }
    console.error('Dimension OCR error:', error);

    // エラータイプに応じた詳細メッセージ
    let errorMessage = '寸法OCRに失敗しました';
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      errorMessage = 'サーバーに接続できません。ネットワーク接続を確認するか、しばらく待ってから再試行してください。';
    } else if (error instanceof Error) {
      errorMessage = `エラー: ${error.message}`;
    }

    return {
      success: false,
      dimensions: [],
      processingTime: 0,
      error: errorMessage,
    };
  }
}

/**
 * 図面画像から部屋境界を検出
 */
export async function detectRooms(
  imageDataUrl: string,
  signal?: AbortSignal
): Promise<RoomDetectionResult> {
  try {
    if (!imageDataUrl || !imageDataUrl.startsWith('data:')) {
      return {
        success: false,
        rooms: [],
        roomCount: 0,
        processingTime: 0,
        error: '画像データが不正です。図面を再度選択してください。',
      };
    }

    const response = await fetch('/api/ai-room-detection', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageData: imageDataUrl,
        mimeType: imageDataUrl.startsWith('data:image/jpeg') ? 'image/jpeg' : 'image/png',
      }),
      signal,
    });

    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return {
        success: false,
        rooms: [],
        roomCount: 0,
        processingTime: 0,
        error: 'サーバーからの応答を解析できませんでした。しばらく待ってから再試行してください。',
      };
    }

    if (!response.ok) {
      const errorMessage = data.error || `サーバーエラー (${response.status})`;
      console.error('API error:', response.status, errorMessage);
      return {
        success: false,
        rooms: [],
        roomCount: 0,
        processingTime: 0,
        error: errorMessage,
      };
    }

    return {
      success: true,
      rooms: data.rooms || [],
      totalArea: data.totalArea,
      roomCount: data.roomCount,
      summary: data.summary,
      processingTime: data.processingTime,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw error;
    }
    console.error('Room detection error:', error);

    let errorMessage = '部屋検出に失敗しました';
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      errorMessage = 'サーバーに接続できません。ネットワーク接続を確認するか、しばらく待ってから再試行してください。';
    } else if (error instanceof Error) {
      errorMessage = `エラー: ${error.message}`;
    }

    return {
      success: false,
      rooms: [],
      roomCount: 0,
      processingTime: 0,
      error: errorMessage,
    };
  }
}

/**
 * 図面画像から開口部（ドア・窓）を検出
 */
export async function detectOpenings(
  imageDataUrl: string,
  signal?: AbortSignal
): Promise<OpeningDetectionResult> {
  try {
    // 画像データの検証
    if (!imageDataUrl || !imageDataUrl.startsWith('data:')) {
      return {
        success: false,
        openings: [],
        summary: { totalDoors: 0, totalWindows: 0, totalOpenings: 0 },
        processingTime: 0,
        error: '画像データが不正です。図面を再度選択してください。',
      };
    }

    const response = await fetch('/api/ai-opening-detection', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageData: imageDataUrl,
        mimeType: imageDataUrl.startsWith('data:image/jpeg') ? 'image/jpeg' : 'image/png',
      }),
      signal,
    });

    // レスポンスの解析
    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return {
        success: false,
        openings: [],
        summary: { totalDoors: 0, totalWindows: 0, totalOpenings: 0 },
        processingTime: 0,
        error: 'サーバーからの応答を解析できませんでした。しばらく待ってから再試行してください。',
      };
    }

    if (!response.ok) {
      const errorMessage = data.error || `サーバーエラー (${response.status})`;
      console.error('API error:', response.status, errorMessage);
      return {
        success: false,
        openings: [],
        summary: { totalDoors: 0, totalWindows: 0, totalOpenings: 0 },
        processingTime: 0,
        error: errorMessage,
      };
    }

    return {
      success: true,
      openings: data.openings || [],
      summary: data.summary,
      notes: data.notes,
      processingTime: data.processingTime,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw error;
    }
    console.error('Opening detection error:', error);

    // エラータイプに応じた詳細メッセージ
    let errorMessage = '開口部検出に失敗しました';
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      errorMessage = 'サーバーに接続できません。ネットワーク接続を確認するか、しばらく待ってから再試行してください。';
    } else if (error instanceof Error) {
      errorMessage = `エラー: ${error.message}`;
    }

    return {
      success: false,
      openings: [],
      summary: { totalDoors: 0, totalWindows: 0, totalOpenings: 0 },
      processingTime: 0,
      error: errorMessage,
    };
  }
}

/**
 * Canvas要素から画像データURLを取得
 */
export function getCanvasImageData(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png');
}

/**
 * 画像URLからBase64データを取得
 */
export async function imageUrlToBase64(imageUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageUrl;
  });
}

/**
 * AI検出結果を相対座標から絶対座標に変換
 */
export function convertRelativeToAbsolute(
  items: AiDetectedItem[],
  canvasWidth: number,
  canvasHeight: number
): AiDetectedItem[] {
  return items.map(item => ({
    ...item,
    locations: item.locations.map(loc => ({
      ...loc,
      x: loc.x * canvasWidth,
      y: loc.y * canvasHeight,
    })),
    boundingBox: item.boundingBox
      ? {
          x: item.boundingBox.x * canvasWidth,
          y: item.boundingBox.y * canvasHeight,
          width: item.boundingBox.width * canvasWidth,
          height: item.boundingBox.height * canvasHeight,
        }
      : undefined,
  }));
}
