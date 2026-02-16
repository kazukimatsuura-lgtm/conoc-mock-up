import type { AiDetectedItem, DrawingClassification } from '@/types/takeoff';

// ============================================================
// Helpers
// ============================================================

/** Truncate a string to `max` characters, appending "..." when trimmed. */
function truncate(str: string | undefined | null, max: number): string {
  if (!str) return '';
  const s = String(str).trim();
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}

/** Safely coerce an unknown value to a finite number, defaulting to 0. */
function safeNum(val: unknown): number {
  if (val === null || val === undefined) return 0;
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

/** Build a specification string from size / material / spec fields. */
function buildSpec(obj: Record<string, unknown>): string | undefined {
  const parts: string[] = [];
  for (const key of ['サイズ', '寸法', 'size', '材質', 'material', '仕様', 'spec']) {
    const v = obj[key];
    if (v !== undefined && v !== null && v !== '') parts.push(String(v));
  }
  if (parts.length === 0) return undefined;
  return truncate(parts.join(' '), 40) || undefined;
}

/** Build a remarks string from 備考 / 設置場所 etc. */
function buildRemarks(obj: Record<string, unknown>): string | undefined {
  const parts: string[] = [];
  for (const key of ['備考', '設置場所', '設置箇所', 'remarks', 'note']) {
    const v = obj[key];
    if (v !== undefined && v !== null && v !== '') parts.push(String(v));
  }
  if (parts.length === 0) return undefined;
  return truncate(parts.join(' '), 40) || undefined;
}

/** Extract an array from `raw[key]`, returning [] if missing/non-array. */
function arr(raw: Record<string, unknown>, key: string): Record<string, unknown>[] {
  const v = raw[key];
  return Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
}

// ============================================================
// Base confidence — derived from classification confidence
// ============================================================

let baseConfidence = 0.7;

function conf(): number {
  return Math.round(baseConfidence * 100) / 100;
}

// ============================================================
// Per-type normalizers
// ============================================================

function normalizeArchitectural(raw: Record<string, unknown>): AiDetectedItem[] {
  const items: AiDetectedItem[] = [];

  // --- 部屋 ---
  for (const room of arr(raw, '部屋')) {
    const roomName = String(room['部屋名'] ?? room['名称'] ?? '');

    // 床仕上げ
    if (room['床仕上げ'] !== undefined && room['床仕上げ'] !== null) {
      items.push({
        itemType: `${roomName} 床仕上げ - ${String(room['床仕上げ'])}`,
        category: 'finish',
        quantity: safeNum(room['面積_m2']),
        unit: 'm²',
        confidence: conf(),
        specification: buildSpec(room as Record<string, unknown>),
        modelNumber: room['型番'] ? String(room['型番']) : undefined,
        standard: room['規格'] ? String(room['規格']) : undefined,
        remarks: buildRemarks(room as Record<string, unknown>),
        locations: [],
      });
    }

    // 壁仕上げ
    if (room['壁仕上げ'] !== undefined && room['壁仕上げ'] !== null) {
      items.push({
        itemType: `${roomName} 壁仕上げ - ${String(room['壁仕上げ'])}`,
        category: 'finish',
        quantity: 0,
        unit: 'm²',
        confidence: conf(),
        specification: buildSpec(room as Record<string, unknown>),
        remarks: buildRemarks(room as Record<string, unknown>),
        locations: [],
      });
    }

    // 天井仕上げ
    if (room['天井仕上げ'] !== undefined && room['天井仕上げ'] !== null) {
      items.push({
        itemType: `${roomName} 天井仕上げ - ${String(room['天井仕上げ'])}`,
        category: 'finish',
        quantity: 0,
        unit: 'm²',
        confidence: conf(),
        specification: buildSpec(room as Record<string, unknown>),
        remarks: buildRemarks(room as Record<string, unknown>),
        locations: [],
      });
    }

    // 巾木
    if (room['巾木'] !== undefined && room['巾木'] !== null) {
      items.push({
        itemType: `${roomName} 巾木 - ${String(room['巾木'])}`,
        category: 'finish',
        quantity: 0,
        unit: 'm',
        confidence: conf(),
        specification: buildSpec(room as Record<string, unknown>),
        remarks: buildRemarks(room as Record<string, unknown>),
        locations: [],
      });
    }
  }

  // --- 建具 ---
  for (const item of arr(raw, '建具')) {
    const symbol = String(item['記号'] ?? '');
    const kind = String(item['種別'] ?? item['名称'] ?? '');
    items.push({
      itemType: `${symbol} ${kind}`.trim(),
      category: 'finish',
      quantity: safeNum(item['数量']),
      unit: '枚',
      confidence: conf(),
      specification: buildSpec(item),
      modelNumber: item['型番'] ? String(item['型番']) : undefined,
      standard: item['規格'] ? String(item['規格']) : undefined,
      remarks: buildRemarks(item),
      locations: [],
    });
  }

  // --- 外壁 ---
  for (const item of arr(raw, '外壁')) {
    items.push({
      itemType: String(item['名称'] ?? item['種類'] ?? '外壁'),
      category: 'exterior',
      quantity: safeNum(item['面積_m2']),
      unit: 'm²',
      confidence: conf(),
      specification: buildSpec(item),
      modelNumber: item['型番'] ? String(item['型番']) : undefined,
      standard: item['規格'] ? String(item['規格']) : undefined,
      remarks: buildRemarks(item),
      locations: [],
    });
  }

  // --- 屋根 ---
  for (const item of arr(raw, '屋根')) {
    items.push({
      itemType: String(item['名称'] ?? item['種類'] ?? '屋根'),
      category: 'exterior',
      quantity: safeNum(item['面積_m2']),
      unit: 'm²',
      confidence: conf(),
      specification: buildSpec(item),
      modelNumber: item['型番'] ? String(item['型番']) : undefined,
      standard: item['規格'] ? String(item['規格']) : undefined,
      remarks: buildRemarks(item),
      locations: [],
    });
  }

  // --- 防水 ---
  for (const item of arr(raw, '防水')) {
    items.push({
      itemType: String(item['名称'] ?? item['種類'] ?? '防水'),
      category: 'exterior',
      quantity: safeNum(item['面積_m2']),
      unit: 'm²',
      confidence: conf(),
      specification: buildSpec(item),
      remarks: buildRemarks(item),
      locations: [],
    });
  }

  // --- 階段 ---
  for (const item of arr(raw, '階段')) {
    items.push({
      itemType: String(item['名称'] ?? item['種類'] ?? '階段'),
      category: 'structure',
      quantity: 1,
      unit: '基',
      confidence: conf(),
      specification: buildSpec(item),
      remarks: buildRemarks(item),
      locations: [],
    });
  }

  // --- 造作_家具 ---
  for (const item of arr(raw, '造作_家具')) {
    items.push({
      itemType: String(item['名称'] ?? item['種類'] ?? '造作家具'),
      category: 'finish',
      quantity: safeNum(item['数量']),
      unit: '個',
      confidence: conf(),
      specification: buildSpec(item),
      modelNumber: item['型番'] ? String(item['型番']) : undefined,
      standard: item['規格'] ? String(item['規格']) : undefined,
      remarks: buildRemarks(item),
      locations: [],
    });
  }

  // --- 手すり_笠木 ---
  for (const item of arr(raw, '手すり_笠木')) {
    items.push({
      itemType: String(item['名称'] ?? item['種類'] ?? '手すり・笠木'),
      category: 'finish',
      quantity: 0,
      unit: 'm',
      confidence: conf(),
      specification: buildSpec(item),
      remarks: buildRemarks(item),
      locations: [],
    });
  }

  // --- タイル_石工事 ---
  for (const item of arr(raw, 'タイル_石工事')) {
    items.push({
      itemType: String(item['名称'] ?? item['種類'] ?? 'タイル・石工事'),
      category: 'finish',
      quantity: safeNum(item['面積_m2']),
      unit: 'm²',
      confidence: conf(),
      specification: buildSpec(item),
      remarks: buildRemarks(item),
      locations: [],
    });
  }

  // --- 塗装 ---
  for (const item of arr(raw, '塗装')) {
    items.push({
      itemType: String(item['名称'] ?? item['種類'] ?? '塗装'),
      category: 'finish',
      quantity: safeNum(item['面積_m2']),
      unit: 'm²',
      confidence: conf(),
      specification: buildSpec(item),
      remarks: buildRemarks(item),
      locations: [],
    });
  }

  // --- 雑工事 ---
  for (const item of arr(raw, '雑工事')) {
    items.push({
      itemType: String(item['名称'] ?? item['種類'] ?? '雑工事'),
      category: 'finish',
      quantity: safeNum(item['数量']),
      unit: '個',
      confidence: conf(),
      specification: buildSpec(item),
      remarks: buildRemarks(item),
      locations: [],
    });
  }

  return items;
}

// ------------------------------------------------------------------

function normalizeStructural(raw: Record<string, unknown>): AiDetectedItem[] {
  const items: AiDetectedItem[] = [];

  const mappings: { key: string; unit: string }[] = [
    { key: '基礎', unit: 'm³' },
    { key: '杭', unit: '本' },
    { key: '柱', unit: '本' },
    { key: '梁', unit: '本' },
    { key: 'スラブ', unit: 'm²' },
    { key: '壁', unit: 'm²' },
    { key: 'ブレース', unit: '個' },
    { key: '鉄筋', unit: 'kg' },
    { key: '鉄骨', unit: 'kg' },
    { key: 'コンクリート', unit: 'm³' },
    { key: '型枠', unit: 'm²' },
    { key: 'アンカーボルト', unit: '本' },
    { key: '金物', unit: '個' },
    { key: 'プレキャスト', unit: '個' },
  ];

  for (const { key, unit } of mappings) {
    for (const item of arr(raw, key)) {
      items.push({
        itemType: String(item['名称'] ?? item['種類'] ?? key),
        category: 'structure',
        quantity: safeNum(item['数量'] ?? item['量'] ?? item['面積_m2'] ?? item['体積_m3'] ?? item['重量_kg']),
        unit,
        confidence: conf(),
        specification: buildSpec(item),
        modelNumber: item['型番'] ? String(item['型番']) : undefined,
        standard: item['規格'] ? String(item['規格']) : undefined,
        remarks: buildRemarks(item),
        locations: [],
      });
    }
  }

  return items;
}

// ------------------------------------------------------------------

function normalizeElectrical(raw: Record<string, unknown>): AiDetectedItem[] {
  const items: AiDetectedItem[] = [];

  const mappings: { key: string; category: string; unit: string }[] = [
    { key: '幹線', category: 'electrical', unit: 'm' },
    { key: '配線', category: 'electrical', unit: 'm' },
    { key: '照明器具', category: 'electrical', unit: '台' },
    { key: 'コンセント', category: 'electrical', unit: '個' },
    { key: 'スイッチ', category: 'electrical', unit: '個' },
    { key: '分電盤', category: 'electrical', unit: '面' },
    { key: '弱電', category: 'communication', unit: '個' },
    { key: '火災報知', category: 'fire', unit: '個' },
    { key: '電線管', category: 'electrical', unit: 'm' },
    { key: 'プルボックス', category: 'electrical', unit: '個' },
    { key: '接地', category: 'electrical', unit: '式' },
    { key: '避雷', category: 'electrical', unit: '式' },
  ];

  for (const { key, category, unit } of mappings) {
    for (const item of arr(raw, key)) {
      // 弱電 items may specify 台 as unit override
      const resolvedUnit = item['単位'] ? String(item['単位']) : unit;
      items.push({
        itemType: String(item['名称'] ?? item['種類'] ?? key),
        category,
        quantity: safeNum(item['数量'] ?? item['長さ_m']),
        unit: resolvedUnit,
        confidence: conf(),
        specification: buildSpec(item),
        modelNumber: item['型番'] ? String(item['型番']) : undefined,
        standard: item['規格'] ? String(item['規格']) : undefined,
        remarks: buildRemarks(item),
        locations: [],
      });
    }
  }

  return items;
}

// ------------------------------------------------------------------

function normalizeHvac(raw: Record<string, unknown>): AiDetectedItem[] {
  const items: AiDetectedItem[] = [];

  const mappings: { key: string; unit: string }[] = [
    { key: 'ダクト', unit: 'm²' },
    { key: 'ダンパー', unit: '個' },
    { key: '制気口', unit: '個' },
    { key: 'チャンバー', unit: '個' },
    { key: '空調機器', unit: '台' },
    { key: '換気機器', unit: '台' },
    { key: '冷媒配管', unit: 'm' },
    { key: 'ドレン配管', unit: 'm' },
    { key: '吊り金物', unit: '個' },
    { key: 'スリーブ', unit: '個' },
    { key: '点検口', unit: '個' },
  ];

  for (const { key, unit } of mappings) {
    for (const item of arr(raw, key)) {
      items.push({
        itemType: String(item['名称'] ?? item['種類'] ?? key),
        category: 'hvac',
        quantity: safeNum(item['数量'] ?? item['面積_m2'] ?? item['長さ_m']),
        unit,
        confidence: conf(),
        specification: buildSpec(item),
        modelNumber: item['型番'] ? String(item['型番']) : undefined,
        standard: item['規格'] ? String(item['規格']) : undefined,
        remarks: buildRemarks(item),
        locations: [],
      });
    }
  }

  return items;
}

// ------------------------------------------------------------------

function normalizePlumbing(raw: Record<string, unknown>): AiDetectedItem[] {
  const items: AiDetectedItem[] = [];

  const mappings: { key: string; category: string; unit: string }[] = [
    { key: '配管', category: 'plumbing', unit: 'm' },
    { key: 'バルブ', category: 'plumbing', unit: '個' },
    { key: '衛生器具', category: 'plumbing', unit: '台' },
    { key: '水栓金具', category: 'plumbing', unit: '個' },
    { key: 'トラップ', category: 'plumbing', unit: '個' },
    { key: '通気弁', category: 'plumbing', unit: '個' },
    { key: '機器', category: 'plumbing', unit: '台' },
    { key: '排水桝', category: 'plumbing', unit: '個' },
    { key: '量水器', category: 'plumbing', unit: '個' },
    { key: '消火設備', category: 'fire', unit: '個' },
    { key: '保温', category: 'plumbing', unit: 'm' },
  ];

  for (const { key, category, unit } of mappings) {
    for (const item of arr(raw, key)) {
      // 消火設備 items may specify 本 as unit override
      const resolvedUnit = item['単位'] ? String(item['単位']) : unit;
      items.push({
        itemType: String(item['名称'] ?? item['種類'] ?? key),
        category,
        quantity: safeNum(item['数量'] ?? item['長さ_m']),
        unit: resolvedUnit,
        confidence: conf(),
        specification: buildSpec(item),
        modelNumber: item['型番'] ? String(item['型番']) : undefined,
        standard: item['規格'] ? String(item['規格']) : undefined,
        remarks: buildRemarks(item),
        locations: [],
      });
    }
  }

  return items;
}

// ------------------------------------------------------------------

function normalizeExterior(raw: Record<string, unknown>): AiDetectedItem[] {
  const items: AiDetectedItem[] = [];

  const mappings: { key: string; unit: string }[] = [
    { key: '土工事', unit: 'm³' },
    { key: '舗装', unit: 'm²' },
    { key: '縁石', unit: 'm' },
    { key: '塀_フェンス', unit: 'm' },
    { key: '門', unit: '基' },
    { key: 'カーポート', unit: '基' },
    { key: '排水', unit: 'm' },
    { key: '擁壁', unit: 'm' },
    { key: '階段', unit: '基' },
    { key: '植栽', unit: '本' },
    { key: '照明', unit: '台' },
    { key: '散水栓', unit: '個' },
    { key: '物置', unit: '基' },
    { key: 'サイン', unit: '個' },
  ];

  for (const { key, unit } of mappings) {
    for (const item of arr(raw, key)) {
      // 排水 items may specify 個 as unit override
      const resolvedUnit = item['単位'] ? String(item['単位']) : unit;
      items.push({
        itemType: String(item['名称'] ?? item['種類'] ?? key),
        category: 'exterior',
        quantity: safeNum(item['数量'] ?? item['面積_m2'] ?? item['体積_m3'] ?? item['長さ_m']),
        unit: resolvedUnit,
        confidence: conf(),
        specification: buildSpec(item),
        modelNumber: item['型番'] ? String(item['型番']) : undefined,
        standard: item['規格'] ? String(item['規格']) : undefined,
        remarks: buildRemarks(item),
        locations: [],
      });
    }
  }

  return items;
}

// ============================================================
// Main export
// ============================================================

/**
 * Normalize raw JSON output from specialized drawing prompts
 * into a flat `AiDetectedItem[]` array.
 *
 * @param drawingType - The detected drawing type (e.g. "意匠図", "構造図", ...)
 * @param rawResult   - The raw JSON object returned by the AI model
 * @param classification - The full drawing classification result
 * @returns Normalized array of detected items
 */
export function normalizeAiResult(
  drawingType: string,
  rawResult: Record<string, unknown>,
  classification: DrawingClassification,
): AiDetectedItem[] {
  // Set module-level confidence from classification
  baseConfidence = (classification.confidence ?? 0.8) * 0.85;

  switch (drawingType) {
    case '意匠図':
      return normalizeArchitectural(rawResult);
    case '構造図':
      return normalizeStructural(rawResult);
    case '電気設備図':
      return normalizeElectrical(rawResult);
    case '空調換気設備図':
      return normalizeHvac(rawResult);
    case '給排水衛生設備図':
      return normalizePlumbing(rawResult);
    case '外構図':
      return normalizeExterior(rawResult);
    default:
      return [];
  }
}
