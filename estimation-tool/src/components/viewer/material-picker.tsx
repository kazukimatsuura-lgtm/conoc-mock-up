'use client';

import { useState, useMemo } from 'react';
import { Search, Package, X } from 'lucide-react';
import { Modal, Button } from '@/components/ui';
import { useMaterialStore } from '@/stores/material-store';
import { MATERIAL_CATEGORIES } from '@/types/material';
import type { Material, MaterialCategory } from '@/types/material';
import { cn } from '@/lib/utils';

interface MaterialPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (material: Material) => void;
  category?: string;
}

export function MaterialPicker({
  isOpen,
  onClose,
  onSelect,
  category,
}: MaterialPickerProps) {
  const { materials, searchMaterials, getMaterialsByCategory } = useMaterialStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<MaterialCategory | 'all'>('all');

  const filteredMaterials = useMemo(() => {
    let result = materials;

    if (searchQuery) {
      result = searchMaterials(searchQuery);
    } else if (selectedCategory !== 'all') {
      result = getMaterialsByCategory(selectedCategory);
    }

    return result;
  }, [materials, searchQuery, selectedCategory, searchMaterials, getMaterialsByCategory]);

  const getCategoryLabel = (categoryId: string) => {
    const cat = MATERIAL_CATEGORIES.find(c => c.id === categoryId);
    return cat?.label || categoryId;
  };

  const handleSelect = (material: Material) => {
    onSelect(material);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="部材マスタから単価を選択"
      size="lg"
    >
      <div className="space-y-4">
        {/* Search & Filter */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="部材名、品番で検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#0099CB] focus:border-[#0099CB]"
              autoFocus
            />
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as MaterialCategory | 'all')}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#0099CB]"
          >
            <option value="all">すべて</option>
            {MATERIAL_CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.label}</option>
            ))}
          </select>
        </div>

        {/* Material List */}
        <div className="max-h-96 overflow-y-auto border rounded-lg">
          {filteredMaterials.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Package size={48} className="mb-3" />
              <p className="text-sm">
                {searchQuery ? '検索結果がありません' : '部材が登録されていません'}
              </p>
              {!searchQuery && (
                <Button
                  variant="secondary"
                  className="mt-4"
                  onClick={() => window.open('/materials', '_blank')}
                >
                  部材マスタを開く
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y">
              {filteredMaterials.map((material) => (
                <button
                  key={material.id}
                  onClick={() => handleSelect(material)}
                  className="w-full flex items-center gap-4 p-3 hover:bg-[#E0F4FA] transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-800 truncate">
                        {material.name}
                      </span>
                      {material.productNumber && (
                        <span className="text-xs text-gray-500 font-mono">
                          {material.productNumber}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded">
                        {getCategoryLabel(material.category)}
                      </span>
                      {material.manufacturer && (
                        <span className="text-xs text-gray-500">
                          {material.manufacturer}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-gray-800">
                      ¥{material.unitPrice.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">/{material.unit}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center pt-2 border-t">
          <p className="text-sm text-gray-500">
            {filteredMaterials.length} 件の部材
          </p>
          <Button variant="secondary" onClick={onClose}>
            キャンセル
          </Button>
        </div>
      </div>
    </Modal>
  );
}
