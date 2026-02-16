// 部材マスタの型定義

export type MaterialCategory =
  | 'flooring'      // 床材
  | 'wall'          // 壁材
  | 'ceiling'       // 天井材
  | 'door'          // 建具（ドア）
  | 'window'        // 建具（窓）
  | 'paint'         // 塗装
  | 'tile'          // タイル
  | 'carpet'        // カーペット
  | 'furniture'     // 家具
  | 'electrical'    // 電気設備
  | 'plumbing'      // 配管設備
  | 'hvac'          // 空調設備
  | 'other';        // その他

export const MATERIAL_CATEGORIES: { id: MaterialCategory; label: string }[] = [
  { id: 'flooring', label: '床材' },
  { id: 'wall', label: '壁材' },
  { id: 'ceiling', label: '天井材' },
  { id: 'door', label: '建具（ドア）' },
  { id: 'window', label: '建具（窓）' },
  { id: 'paint', label: '塗装' },
  { id: 'tile', label: 'タイル' },
  { id: 'carpet', label: 'カーペット' },
  { id: 'furniture', label: '家具' },
  { id: 'electrical', label: '電気設備' },
  { id: 'plumbing', label: '配管設備' },
  { id: 'hvac', label: '空調設備' },
  { id: 'other', label: 'その他' },
];

export interface Material {
  id: string;
  name: string;                  // 部材名
  productNumber: string;         // 品番
  category: MaterialCategory;    // カテゴリ
  manufacturer: string;          // メーカー/販売元
  unitPrice: number;             // 単価
  unit: string;                  // 単位（m², m, 枚, 個など）
  specifications: string;        // 規格・仕様
  dimensions?: {                 // 寸法
    width?: number;              // 幅 (mm)
    length?: number;             // 長さ (mm)
    thickness?: number;          // 厚さ (mm)
  };
  color?: string;                // 表示色（UI用）
  notes?: string;                // 備考
  createdAt: string;
  updatedAt: string;
}

export interface MaterialImportResult {
  success: boolean;
  imported: number;
  failed: number;
  errors: string[];
  materials: Material[];
}

// AIによる部材解析結果
export interface MaterialAnalysisResult {
  name: string;
  productNumber?: string;
  category: MaterialCategory;
  manufacturer?: string;
  unitPrice?: number;
  unit?: string;
  specifications?: string;
  confidence: number;
  rawData: Record<string, unknown>;
}
