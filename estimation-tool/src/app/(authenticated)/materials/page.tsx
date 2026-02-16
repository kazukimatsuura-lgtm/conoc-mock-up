'use client';

import { useState, useCallback, useRef } from 'react';
import {
  Package,
  Plus,
  Upload,
  Search,
  Trash2,
  Edit2,
  Loader2,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { Button, Modal } from '@/components/ui';
import { Header } from '@/components/layout';
import { useMaterialStore } from '@/stores/material-store';
import { MATERIAL_CATEGORIES } from '@/types/material';
import type { Material, MaterialCategory } from '@/types/material';
import { cn } from '@/lib/utils';


export default function MaterialsPage() {
  const {
    materials,
    addMaterial,
    addMaterials,
    updateMaterial,
    deleteMaterial,
    searchMaterials,
    getMaterialsByCategory,
  } = useMaterialStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<MaterialCategory | 'all'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);

  // Import state
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<Material[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // フィルタリングされた部材リスト
  const filteredMaterials = searchQuery
    ? searchMaterials(searchQuery)
    : selectedCategory === 'all'
      ? materials
      : getMaterialsByCategory(selectedCategory);

  // CSVパース
  const parseCSV = (text: string): Record<string, string>[] => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const row: Record<string, string> = {};
      headers.forEach((header, i) => {
        row[header] = values[i] || '';
      });
      return row;
    });
  };

  // ファイルインポート処理
  const handleFileImport = useCallback(async (file: File) => {
    setIsImporting(true);
    setImportError(null);
    setImportPreview(null);

    try {
      const text = await file.text();
      const data = parseCSV(text);

      if (data.length === 0) {
        setImportError('ファイルにデータがありません');
        return;
      }

      // AIでカテゴリ分け
      const response = await fetch('/api/ai-material-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, format: 'csv' }),
      });

      const result = await response.json();

      if (!response.ok) {
        setImportError(result.error || 'インポートに失敗しました');
        return;
      }

      // プレビュー用に変換
      const previewMaterials: Material[] = result.materials.map((m: Record<string, unknown>, idx: number) => ({
        id: `preview_${idx}`,
        name: String(m.name || ''),
        productNumber: String(m.productNumber || ''),
        category: String(m.category || 'other') as MaterialCategory,
        manufacturer: String(m.manufacturer || ''),
        unitPrice: Number(m.unitPrice) || 0,
        unit: String(m.unit || '式'),
        specifications: String(m.specifications || ''),
        dimensions: m.dimensions as Material['dimensions'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      setImportPreview(previewMaterials);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'ファイルの読み込みに失敗しました');
    } finally {
      setIsImporting(false);
    }
  }, []);

  // インポート確定
  const handleConfirmImport = useCallback(() => {
    if (!importPreview) return;

    const materialsToAdd = importPreview.map(({ id, createdAt, updatedAt, ...rest }) => rest);
    addMaterials(materialsToAdd);
    setImportPreview(null);
    setShowImportModal(false);
  }, [importPreview, addMaterials]);

  // カテゴリラベル取得
  const getCategoryLabel = (categoryId: string) => {
    const category = MATERIAL_CATEGORIES.find(c => c.id === categoryId);
    return category?.label || categoryId;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />

      <main className="flex-1 pt-[76px] pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  <Package className="text-[#0088B4]" />
                  部材マスタ
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                  {materials.length} 件の部材が登録されています
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="secondary"
                icon={Upload}
                onClick={() => setShowImportModal(true)}
              >
                インポート
              </Button>
              <Button
                variant="primary"
                icon={Plus}
                onClick={() => setShowAddModal(true)}
              >
                部材を追加
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
            <div className="flex gap-4 items-center">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="部材名、品番、メーカーで検索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#0099CB] focus:border-[#0099CB]"
                />
              </div>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value as MaterialCategory | 'all')}
                className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#0099CB]"
              >
                <option value="all">すべてのカテゴリ</option>
                {MATERIAL_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Materials Table */}
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">部材名</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">品番</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">カテゴリ</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">メーカー</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">単価</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">単位</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredMaterials.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                        {searchQuery || selectedCategory !== 'all'
                          ? '条件に一致する部材がありません'
                          : '部材が登録されていません。インポートまたは追加してください。'}
                      </td>
                    </tr>
                  ) : (
                    filteredMaterials.map((material) => (
                      <tr key={material.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-800">{material.name}</div>
                          {material.specifications && (
                            <div className="text-xs text-gray-500 mt-0.5">{material.specifications}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-sm text-gray-600">
                          {material.productNumber || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-cyan-100 text-[#006A8E]">
                            {getCategoryLabel(material.category)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {material.manufacturer || '-'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          {material.unitPrice > 0 ? `¥${material.unitPrice.toLocaleString()}` : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{material.unit}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => setEditingMaterial(material)}
                              className="p-1.5 hover:bg-gray-100 rounded text-gray-600"
                              title="編集"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm('この部材を削除しますか？')) {
                                  deleteMaterial(material.id);
                                }
                              }}
                              className="p-1.5 hover:bg-red-50 rounded text-red-500"
                              title="削除"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* Add/Edit Modal */}
      <MaterialFormModal
        isOpen={showAddModal || !!editingMaterial}
        onClose={() => {
          setShowAddModal(false);
          setEditingMaterial(null);
        }}
        material={editingMaterial}
        onSave={(data) => {
          if (editingMaterial) {
            updateMaterial(editingMaterial.id, data);
          } else {
            addMaterial(data);
          }
          setShowAddModal(false);
          setEditingMaterial(null);
        }}
      />

      {/* Import Modal */}
      <Modal
        isOpen={showImportModal}
        onClose={() => {
          setShowImportModal(false);
          setImportPreview(null);
          setImportError(null);
        }}
        title="部材データのインポート"
        size="lg"
      >
        <div className="space-y-4">
          {!importPreview ? (
            <>
              <div className="bg-[#E0F4FA] border border-[#0099CB] rounded-lg p-4">
                <h4 className="font-medium text-[#006A8E] mb-2">AIによる自動カテゴリ分け</h4>
                <p className="text-sm text-cyan-700">
                  CSVファイルをアップロードすると、AIが自動的に部材の名称から
                  カテゴリを推測し、単価や仕様を整理します。
                </p>
              </div>

              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-[#0099CB] transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileImport(file);
                  }}
                />
                {isImporting ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-8 h-8 text-[#0099CB] animate-spin" />
                    <p className="text-gray-600">AIで解析中...</p>
                  </div>
                ) : (
                  <>
                    <FileSpreadsheet className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 mb-1">クリックしてファイルを選択</p>
                    <p className="text-sm text-gray-400">CSV形式に対応</p>
                  </>
                )}
              </div>

              {importError && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
                  <AlertCircle size={18} />
                  <span className="text-sm">{importError}</span>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-lg">
                <CheckCircle2 size={18} />
                <span className="text-sm">{importPreview.length} 件の部材を検出しました</span>
              </div>

              <div className="max-h-96 overflow-y-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left">部材名</th>
                      <th className="px-3 py-2 text-left">カテゴリ</th>
                      <th className="px-3 py-2 text-right">単価</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {importPreview.map((m, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-3 py-2">{m.name}</td>
                        <td className="px-3 py-2">
                          <span className="text-xs bg-cyan-100 text-[#006A8E] px-2 py-0.5 rounded">
                            {getCategoryLabel(m.category)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {m.unitPrice > 0 ? `¥${m.unitPrice.toLocaleString()}` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setImportPreview(null);
                    setImportError(null);
                  }}
                >
                  やり直す
                </Button>
                <Button variant="primary" onClick={handleConfirmImport}>
                  {importPreview.length} 件をインポート
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}

// 部材フォームモーダル
function MaterialFormModal({
  isOpen,
  onClose,
  material,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  material: Material | null;
  onSave: (data: Omit<Material, 'id' | 'createdAt' | 'updatedAt'>) => void;
}) {
  const [formData, setFormData] = useState({
    name: '',
    productNumber: '',
    category: 'other' as MaterialCategory,
    manufacturer: '',
    unitPrice: 0,
    unit: '式',
    specifications: '',
  });

  // Reset form when modal opens
  useState(() => {
    if (material) {
      setFormData({
        name: material.name,
        productNumber: material.productNumber,
        category: material.category,
        manufacturer: material.manufacturer,
        unitPrice: material.unitPrice,
        unit: material.unit,
        specifications: material.specifications,
      });
    } else {
      setFormData({
        name: '',
        productNumber: '',
        category: 'other',
        manufacturer: '',
        unitPrice: 0,
        unit: '式',
        specifications: '',
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={material ? '部材を編集' : '部材を追加'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            部材名 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#0099CB]"
            placeholder="例：タイルカーペット"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">品番</label>
            <input
              type="text"
              value={formData.productNumber}
              onChange={(e) => setFormData({ ...formData, productNumber: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#0099CB]"
              placeholder="例：TC-1001"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">カテゴリ</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value as MaterialCategory })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#0099CB]"
            >
              {MATERIAL_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">メーカー</label>
          <input
            type="text"
            value={formData.manufacturer}
            onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#0099CB]"
            placeholder="例：東リ"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">単価（円）</label>
            <input
              type="number"
              value={formData.unitPrice}
              onChange={(e) => setFormData({ ...formData, unitPrice: Number(e.target.value) })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#0099CB]"
              placeholder="0"
              min="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">単位</label>
            <input
              type="text"
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#0099CB]"
              placeholder="例：m², 枚, 個"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">規格・仕様</label>
          <textarea
            value={formData.specifications}
            onChange={(e) => setFormData({ ...formData, specifications: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#0099CB]"
            rows={2}
            placeholder="例：500x500mm、厚さ6.5mm"
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="secondary" onClick={onClose}>
            キャンセル
          </Button>
          <Button type="submit" variant="primary">
            {material ? '更新' : '追加'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
