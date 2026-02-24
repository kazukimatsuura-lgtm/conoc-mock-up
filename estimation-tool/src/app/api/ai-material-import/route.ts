import { NextRequest, NextResponse } from 'next/server';
import { MATERIAL_CATEGORIES } from '@/types/material';
import type { MaterialCategory } from '@/types/material';
import {
  CLASSIFY_MATERIAL_PROMPT,
  DOMAIN_PROMPTS,
  DOMAIN_LABELS,
} from '@/lib/material-prompts';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-3-flash-preview';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// ---------------------------------------------------------------------------
// Geminiテキスト呼び出し（画像なし）
// ---------------------------------------------------------------------------
async function callGeminiText(
  prompt: string,
  maxOutputTokens = 8192
): Promise<{ text: string; error?: string }> {
  if (!GEMINI_API_KEY) {
    return { text: '', error: 'Gemini API key is not configured' };
  }

  const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
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
    console.error('Gemini API error:', errorData);
    return { text: '', error: `Gemini API error: ${response.status}` };
  }

  const data = await response.json();
  const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textContent) {
    return { text: '', error: 'No response from Gemini API' };
  }
  return { text: textContent };
}

// ---------------------------------------------------------------------------
// JSON抽出
// ---------------------------------------------------------------------------
function extractJSON(text: string): string {
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) return jsonMatch[1].trim();

  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}');
  if (jsonStart !== -1 && jsonEnd !== -1) {
    return text.substring(jsonStart, jsonEnd + 1);
  }

  const arrayStart = text.indexOf('[');
  const arrayEnd = text.lastIndexOf(']');
  if (arrayStart !== -1 && arrayEnd !== -1) {
    return text.substring(arrayStart, arrayEnd + 1);
  }
  return text;
}

// ---------------------------------------------------------------------------
// バリデーション
// ---------------------------------------------------------------------------
const validCategories = MATERIAL_CATEGORIES.map(c => c.id);

function validateMaterial(m: Record<string, unknown>) {
  const category = validCategories.includes(String(m.category) as MaterialCategory)
    ? (String(m.category) as MaterialCategory)
    : 'other';

  return {
    name: String(m.name || '不明'),
    productNumber: String(m.productNumber || ''),
    category,
    manufacturer: String(m.manufacturer || ''),
    unitPrice: m.unitPrice != null ? Number(m.unitPrice) : 0,
    unit: String(m.unit || '式'),
    specifications: String(m.specifications || ''),
    dimensions: m.dimensions
      ? {
          width: (m.dimensions as Record<string, unknown>).width
            ? Number((m.dimensions as Record<string, unknown>).width)
            : undefined,
          length: (m.dimensions as Record<string, unknown>).length
            ? Number((m.dimensions as Record<string, unknown>).length)
            : undefined,
          thickness: (m.dimensions as Record<string, unknown>).thickness
            ? Number((m.dimensions as Record<string, unknown>).thickness)
            : undefined,
        }
      : undefined,
    confidence: Math.min(1, Math.max(0, Number(m.confidence) || 0.5)),
    rawData: (m.rawData as Record<string, unknown>) || {},
  };
}

// ---------------------------------------------------------------------------
// 重複除去（name + productNumber で判定）
// ---------------------------------------------------------------------------
function deduplicateMaterials(
  materials: ReturnType<typeof validateMaterial>[]
): ReturnType<typeof validateMaterial>[] {
  const seen = new Map<string, ReturnType<typeof validateMaterial>>();

  for (const m of materials) {
    const key = `${m.name}||${m.productNumber}`.toLowerCase();
    const existing = seen.get(key);
    // より高いconfidenceの方を採用
    if (!existing || m.confidence > existing.confidence) {
      seen.set(key, m);
    }
  }
  return Array.from(seen.values());
}

// ---------------------------------------------------------------------------
// メインハンドラ — 2段階エージェントパイプライン
// ---------------------------------------------------------------------------
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
      if (data.length > 0 && typeof data[0] === 'object') {
        const headers = Object.keys(data[0]);
        const rows = data.map(row =>
          headers.map(h => String(row[h] ?? '')).join(',')
        );
        dataString = [headers.join(','), ...rows].join('\n');
      } else {
        dataString = JSON.stringify(data);
      }
    } else {
      dataString = JSON.stringify(data);
    }

    // =====================================================================
    // 第1段階: 分類エージェント — どの分野の資材が含まれているか判定
    // =====================================================================
    console.log('[material-import] Stage 1: Classifying data...');

    const classifyPrompt = `${CLASSIFY_MATERIAL_PROMPT}\n\n## 入力データ（${format}形式）\n${dataString}`;
    const classifyResult = await callGeminiText(classifyPrompt, 2048);

    let domains: string[] = [];

    if (classifyResult.error) {
      console.error('[material-import] Classification failed:', classifyResult.error);
      // フォールバック: 全ドメインに投げる
      domains = Object.keys(DOMAIN_PROMPTS);
    } else {
      try {
        const classification = JSON.parse(extractJSON(classifyResult.text));
        domains = Array.isArray(classification.domains) ? classification.domains : [];
        console.log('[material-import] Detected domains:', domains, 'confidence:', classification.confidence);
      } catch {
        console.error('[material-import] Failed to parse classification, using all domains');
        domains = Object.keys(DOMAIN_PROMPTS);
      }
    }

    // ドメインが空 → 全ドメインで試行
    if (domains.length === 0) {
      domains = Object.keys(DOMAIN_PROMPTS);
    }

    // 有効なドメインのみフィルタ
    domains = domains.filter(d => DOMAIN_PROMPTS[d]);

    // hardwareは常に含める（他エージェントが取りこぼした資材を拾うため）
    if (!domains.includes('hardware')) {
      domains.push('hardware');
    }

    // =====================================================================
    // 第2段階: 各分野の専門エージェントに順次投入
    // =====================================================================
    console.log('[material-import] Stage 2: Running specialized agents for:', domains);

    const allMaterials: ReturnType<typeof validateMaterial>[] = [];
    const domainResults: { domain: string; count: number }[] = [];

    for (const domain of domains) {
      const specializedPrompt = DOMAIN_PROMPTS[domain];
      const label = DOMAIN_LABELS[domain] || domain;

      console.log(`[material-import] Running ${label} agent...`);

      const prompt = `${specializedPrompt}\n\n## 入力データ（${format}形式）\n${dataString}\n\n上記のデータから、あなたの担当分野の資材を全て抽出してJSON形式で出力してください。担当外の資材は無視してください。`;

      const result = await callGeminiText(prompt, 16384);

      if (result.error) {
        console.error(`[material-import] ${label} agent error:`, result.error);
        continue;
      }

      try {
        const parsed = JSON.parse(extractJSON(result.text));
        const materials = (parsed.materials || []).map((m: Record<string, unknown>) =>
          validateMaterial(m)
        );
        allMaterials.push(...materials);
        domainResults.push({ domain, count: materials.length });
        console.log(`[material-import] ${label}: ${materials.length} materials extracted`);
      } catch (parseErr) {
        console.error(`[material-import] ${label} agent parse error:`, parseErr);
      }
    }

    // =====================================================================
    // マージ＆重複除去
    // =====================================================================
    const deduplicated = deduplicateMaterials(allMaterials);
    const processingTime = Date.now() - startTime;

    const summaryParts = domainResults
      .filter(r => r.count > 0)
      .map(r => `${DOMAIN_LABELS[r.domain] || r.domain}: ${r.count}件`);

    return NextResponse.json({
      success: true,
      materials: deduplicated,
      columnMapping: {},
      summary: `${deduplicated.length}件の資材を検出（${summaryParts.join('、')}）`,
      processingTime,
      modelVersion: GEMINI_MODEL,
      domains: domainResults,
    });
  } catch (error) {
    console.error('Material import error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
