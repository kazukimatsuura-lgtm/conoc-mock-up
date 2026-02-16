export type TakeoffSource = 'manual' | 'ai';
export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface ItemLocation {
  x: number;
  y: number;
  roomName?: string;
}

export interface ItemDimensions {
  length?: number;
  width?: number;
  height?: number;
  area?: number;
}

export interface TakeoffItem {
  id: string;
  drawingId: string;
  groupId?: string;          // 所属グループID（階層管理用）

  // === 大項目・仕様 ===
  itemType: string;           // 大項目（品名）
  specification?: string;     // 仕様 (40文字以内、2行以内)
  modelNumber?: string;       // 型番
  standard?: string;          // 規格
  category: string;
  subCategory?: string;

  // === 見積行（上段）===
  quantity: number;            // 数量
  unit: string;                // 単位
  unitPrice?: number;          // 単価
  amount?: number;             // 見積金額 (= quantity × unitPrice)

  // === 原価行（下段）===
  costQuantity?: number;       // 原価数量
  costUnit?: string;           // 原価単位
  costUnitPrice?: number;      // 原価単価
  costAmount?: number;         // 原価金額 (= costQuantity × costUnitPrice)

  // === 粗利 ===
  grossProfit?: number;        // 粗利 (= amount - costAmount)
  grossProfitRate?: number;    // 粗利率 (%) (= grossProfit / amount × 100)

  // === 備考 ===
  remarks?: string;            // 備考 (40文字以内、2行以内)
  internalMemo?: string;       // 社内用メモ (40文字以内、2行以内)

  // === 既存フィールド ===
  locations: ItemLocation[];
  dimensions?: ItemDimensions;
  confidence: number;
  source: TakeoffSource;
  notes?: string;

  // === カスタムフィールド ===
  customFields?: Record<string, string>;  // { [columnId]: value }

  // === 並び順 ===
  order?: number;             // 同一グループ内のソート順

  createdAt: string;
  updatedAt: string;
}

// 階層グループ（明細単位）
export interface TakeoffGroup {
  id: string;
  drawingId: string;
  parentId: string | null;  // null = ルートレベル
  name: string;             // 任意変更可能な名称
  level: number;            // 1〜5
  order: number;            // 同一親内のソート順
  hasDetail: boolean;       // "明細あり" / "明細なし"
  createdAt: string;
  updatedAt: string;
}

export const TAKEOFF_CATEGORIES = [
  { id: 'electrical', label: '電気設備', icon: '⚡' },
  { id: 'hvac', label: '空調設備', icon: '❄️' },
  { id: 'plumbing', label: '衛生設備', icon: '🚿' },
  { id: 'fire', label: '消防設備', icon: '🔥' },
  { id: 'structure', label: '建築(躯体)', icon: '🏗️' },
  { id: 'finish', label: '建築(仕上げ)', icon: '🎨' },
  { id: 'exterior', label: '外壁・屋根', icon: '🏠' },
  { id: 'elevator', label: '昇降設備', icon: '🛗' },
  { id: 'communication', label: '通信・弱電', icon: '📡' },
] as const;

// カテゴリごとのアイテムタイプ定義
export const CATEGORY_ITEM_TYPES: Record<string, { id: string; label: string; unit: string }[]> = {
  electrical: [
    { id: 'outlet', label: 'コンセント', unit: '個' },
    { id: 'switch', label: 'スイッチ', unit: '個' },
    { id: 'lighting', label: '照明器具', unit: '台' },
    { id: 'distribution_board', label: '分電盤', unit: '面' },
    { id: 'cable_tray', label: 'ケーブルラック', unit: 'm' },
    { id: 'conduit', label: '電線管', unit: 'm' },
    { id: 'pull_box', label: 'プルボックス', unit: '個' },
    { id: 'junction_box', label: 'ジャンクションボックス', unit: '個' },
  ],
  hvac: [
    { id: 'air_conditioner', label: 'エアコン', unit: '台' },
    { id: 'ventilation_fan', label: '換気扇', unit: '台' },
    { id: 'air_handling_unit', label: '空調機', unit: '台' },
    { id: 'duct', label: 'ダクト', unit: 'm²' },
    { id: 'diffuser', label: '吹出口', unit: '個' },
    { id: 'return_grille', label: '吸込口', unit: '個' },
    { id: 'damper', label: 'ダンパー', unit: '個' },
    { id: 'refrigerant_pipe', label: '冷媒配管', unit: 'm' },
  ],
  plumbing: [
    { id: 'toilet', label: '便器', unit: '台' },
    { id: 'lavatory', label: '洗面器', unit: '台' },
    { id: 'sink', label: '流し台', unit: '台' },
    { id: 'water_heater', label: '給湯器', unit: '台' },
    { id: 'water_pipe', label: '給水管', unit: 'm' },
    { id: 'drain_pipe', label: '排水管', unit: 'm' },
    { id: 'valve', label: 'バルブ', unit: '個' },
    { id: 'pump', label: 'ポンプ', unit: '台' },
    { id: 'water_tank', label: '水槽', unit: '基' },
  ],
  fire: [
    { id: 'smoke_detector', label: '煙感知器', unit: '個' },
    { id: 'heat_detector', label: '熱感知器', unit: '個' },
    { id: 'fire_alarm', label: '発信機', unit: '個' },
    { id: 'fire_extinguisher', label: '消火器', unit: '本' },
    { id: 'sprinkler_head', label: 'スプリンクラーヘッド', unit: '個' },
    { id: 'fire_hydrant', label: '消火栓', unit: '基' },
    { id: 'emergency_light', label: '誘導灯', unit: '台' },
    { id: 'fire_door', label: '防火扉', unit: '枚' },
  ],
  structure: [
    { id: 'column', label: '柱', unit: '本' },
    { id: 'beam', label: '梁', unit: '本' },
    { id: 'slab', label: 'スラブ', unit: 'm²' },
    { id: 'wall', label: '壁', unit: 'm²' },
    { id: 'foundation', label: '基礎', unit: 'm³' },
    { id: 'rebar', label: '鉄筋', unit: 'kg' },
    { id: 'concrete', label: 'コンクリート', unit: 'm³' },
    { id: 'formwork', label: '型枠', unit: 'm²' },
  ],
  finish: [
    { id: 'floor', label: '床仕上げ', unit: 'm²' },
    { id: 'wall_finish', label: '壁仕上げ', unit: 'm²' },
    { id: 'ceiling', label: '天井仕上げ', unit: 'm²' },
    { id: 'baseboard', label: '巾木', unit: 'm' },
    { id: 'crown_molding', label: '回り縁', unit: 'm' },
    { id: 'door', label: 'ドア', unit: '枚' },
    { id: 'window', label: '窓', unit: '枚' },
    { id: 'partition', label: '間仕切り', unit: 'm²' },
  ],
  exterior: [
    { id: 'exterior_wall', label: '外壁', unit: 'm²' },
    { id: 'roof', label: '屋根', unit: 'm²' },
    { id: 'waterproofing', label: '防水', unit: 'm²' },
    { id: 'insulation', label: '断熱材', unit: 'm²' },
    { id: 'siding', label: 'サイディング', unit: 'm²' },
    { id: 'gutter', label: '雨樋', unit: 'm' },
    { id: 'balcony', label: 'バルコニー', unit: 'm²' },
  ],
  elevator: [
    { id: 'elevator', label: 'エレベーター', unit: '基' },
    { id: 'escalator', label: 'エスカレーター', unit: '基' },
    { id: 'dumbwaiter', label: '小荷物専用昇降機', unit: '基' },
  ],
  communication: [
    { id: 'lan_outlet', label: 'LANコンセント', unit: '個' },
    { id: 'telephone_outlet', label: '電話コンセント', unit: '個' },
    { id: 'tv_outlet', label: 'TVコンセント', unit: '個' },
    { id: 'intercom', label: 'インターホン', unit: '台' },
    { id: 'security_camera', label: '監視カメラ', unit: '台' },
    { id: 'access_control', label: '入退室管理', unit: '台' },
    { id: 'speaker', label: 'スピーカー', unit: '台' },
  ],
};

export const TAKEOFF_UNITS = [
  '個', '台', '本', '枚', '面', '基', 'm', 'm²', 'm³', 'kg', 'セット', '式', '---'
] as const;

// カスタムカラム（ユーザー定義列）
export interface CustomColumn {
  id: string;
  drawingId: string;       // 図面単位で管理
  name: string;            // カラム名（例: "サイズ", "メーカー"）
  type: 'text' | 'number'; // 値のタイプ
  width: number;           // カラム幅 (px)
  order: number;           // 表示順
  createdAt: string;
  updatedAt: string;
}

// 図面分類結果
export interface DrawingClassification {
  図面種別: string;
  sub_types: string[];
  図面名: string;
  図面詳細種別: string;
  縮尺: string;
  階数: string;
  建物用途: string;
  confidence: number;
}

// AI拾い出し結果の型
export interface AiTakeoffResult {
  items: AiDetectedItem[];
  processingTime: number;
  modelVersion: string;
}

export interface AiDetectedItem {
  itemType: string;
  category: string;
  quantity: number;
  unit: string;
  confidence: number;
  specification?: string;
  modelNumber?: string;
  standard?: string;
  remarks?: string;
  locations: { x: number; y: number; label?: string }[];
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}
