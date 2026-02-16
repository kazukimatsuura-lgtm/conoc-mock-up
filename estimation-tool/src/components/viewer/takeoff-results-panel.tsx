'use client';

import { useState, useMemo, useCallback } from 'react';
import { ChevronDown, Trash2, Plus, Eye, Database, X, Package, Table2 } from 'lucide-react';
import { Button, Modal } from '@/components/ui';
import { TAKEOFF_CATEGORIES, CATEGORY_ITEM_TYPES, type TakeoffItem } from '@/types/takeoff';
import { useTakeoffStore } from '@/stores/takeoff-store';
import { useViewerStore } from '@/stores/viewer-store';
import { MaterialPicker } from './material-picker';
import { cn } from '@/lib/utils';

interface TakeoffResultsPanelProps {
  drawingId?: string;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
}

const CATEGORY_OPTIONS = [
  { id: '全て', label: '全て' },
  ...TAKEOFF_CATEGORIES.map((c) => ({ id: c.id, label: c.label })),
];

export function TakeoffResultsPanel({
  selectedCategory,
  onCategoryChange,
}: TakeoffResultsPanelProps) {
  const { items, selectedItemIds, toggleItemSelection, deleteItem, deleteSelectedItems, updateItem, addItem } = useTakeoffStore();
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(TAKEOFF_CATEGORIES.map(c => c.id)));
  const [showMaterialPicker, setShowMaterialPicker] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);

  // 新規追加用のフォーム状態
  const [newItem, setNewItem] = useState<{
    category: string;
    itemType: string;
    quantity: number;
    unit: string;
    unitPrice: number;
  }>({
    category: TAKEOFF_CATEGORIES[0]?.id || '',
    itemType: '',
    quantity: 1,
    unit: '個',
    unitPrice: 0,
  });

  const filteredItems = items.filter((item) => {
    if (selectedCategory === '全て') return true;
    return item.category === selectedCategory;
  });

  const groupedItems = TAKEOFF_CATEGORIES.reduce((acc, category) => {
    const categoryItems = filteredItems.filter((item) => item.category === category.id);
    if (categoryItems.length > 0) {
      acc[category.id] = categoryItems;
    }
    return acc;
  }, {} as Record<string, TakeoffItem[]>);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const handleOpenMaterialPicker = (itemId: string) => {
    setEditingItemId(itemId);
    setShowMaterialPicker(true);
  };

  const handleMaterialSelect = (material: { unitPrice: number; unit: string; name: string }) => {
    if (editingItemId) {
      updateItem(editingItemId, {
        unitPrice: material.unitPrice,
        amount: (items.find(i => i.id === editingItemId)?.quantity || 0) * material.unitPrice,
      });
    }
    setEditingItemId(null);
  };

  const handleUnitPriceChange = useCallback((itemId: string, value: string) => {
    const price = parseFloat(value) || 0;
    const item = items.find(i => i.id === itemId);
    if (item) {
      updateItem(itemId, {
        unitPrice: price,
        amount: item.quantity * price,
      });
    }
  }, [items, updateItem]);

  const handleQuantityChange = useCallback((itemId: string, value: string) => {
    const quantity = parseFloat(value) || 0;
    const item = items.find(i => i.id === itemId);
    if (item) {
      updateItem(itemId, {
        quantity,
        amount: quantity * (item.unitPrice || 0),
      });
    }
  }, [items, updateItem]);

  const totalAmount = useMemo(() => {
    return filteredItems.reduce((sum, item) => {
      return sum + (item.amount || (item.quantity * (item.unitPrice || 0)));
    }, 0);
  }, [filteredItems]);

  const currentCategoryLabel = CATEGORY_OPTIONS.find(c => c.id === selectedCategory)?.label || '全て';

  return (
    <div className="w-full h-full bg-white border-l border-gray-200 flex flex-col z-20 shadow-lg">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-[#52555F]">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-white text-base">拾い出し項目</h3>
          <span className="text-sm text-white/70 font-mono">{filteredItems.length}件</span>
        </div>
      </div>

      {/* Category Filter */}
      <div className="px-4 py-2 border-b border-gray-200 bg-gray-50">
        <div className="relative">
          <button
            onClick={() => setShowCategoryFilter(!showCategoryFilter)}
            className="w-full flex items-center justify-between px-3 py-2 bg-white rounded-lg border border-gray-200 hover:border-[#0099CB] transition-colors"
          >
            <span className="text-sm font-medium text-gray-700">{currentCategoryLabel}</span>
            <ChevronDown size={16} className={cn('text-gray-400 transition-transform', showCategoryFilter && 'rotate-180')} />
          </button>
          {showCategoryFilter && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 max-h-60 overflow-y-auto">
              {CATEGORY_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => {
                    onCategoryChange(option.id);
                    setShowCategoryFilter(false);
                  }}
                  className={cn(
                    'w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors',
                    selectedCategory === option.id
                      ? 'bg-[#E0F4FA] text-[#0088B4] font-medium'
                      : 'text-gray-700'
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Items List */}
      <div className="flex-1 overflow-y-auto overflow-x-auto">
        {Object.keys(groupedItems).length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8">
            <Package size={40} className="mb-3 text-gray-300" />
            <p className="text-sm font-medium text-gray-500 mb-1">項目がありません</p>
            <p className="text-xs text-gray-400 text-center">
              AI拾い出しまたは手動で追加してください
            </p>
          </div>
        ) : (
          Object.entries(groupedItems).map(([categoryId, categoryItems]) => {
            const category = TAKEOFF_CATEGORIES.find((c) => c.id === categoryId);
            const isExpanded = expandedCategories.has(categoryId);

            return (
              <div key={categoryId}>
                {/* Category Header */}
                <button
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-[#E0F4FA] border-b border-[#0099CB]/20 hover:bg-[#d0eef6] transition-colors"
                  onClick={() => toggleCategory(categoryId)}
                >
                  <div className="flex items-center gap-2">
                    <ChevronDown
                      size={16}
                      className={cn(
                        'text-[#0088B4] transition-transform',
                        !isExpanded && '-rotate-90'
                      )}
                    />
                    <span className="font-bold text-sm text-[#006A8E]">
                      {category?.label || categoryId}
                    </span>
                  </div>
                  <span className="bg-[#0099CB] text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[24px] text-center">
                    {categoryItems.length}
                  </span>
                </button>

                {/* Items */}
                {isExpanded && (
                  <div>
                    {categoryItems.map((item) => (
                      <div
                        key={item.id}
                        className="px-4 py-3 border-b border-gray-100 hover:bg-gray-50 group transition-colors"
                      >
                        {/* Row 1: Checkbox + Item Name + Delete */}
                        <div className="flex items-center gap-3 mb-2">
                          <input
                            type="checkbox"
                            checked={selectedItemIds.has(item.id)}
                            onChange={() => toggleItemSelection(item.id)}
                            className="w-4 h-4 rounded border-gray-300 text-[#0099CB] focus:ring-[#0099CB] flex-shrink-0"
                          />
                          <input
                            type="text"
                            defaultValue={item.itemType}
                            className="flex-1 text-sm font-bold text-gray-800 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-[#0099CB] px-0 py-0.5 transition-colors outline-none"
                          />
                          <button
                            onClick={() => deleteItem(item.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all flex-shrink-0"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>

                        {/* Specification / Model sub-text */}
                        {(item.specification || item.modelNumber) && (
                          <div className="ml-7 mb-1 flex items-center gap-2 text-xs text-gray-500">
                            {item.specification && <span className="truncate max-w-[120px]">{item.specification}</span>}
                            {item.modelNumber && <span className="text-gray-400">| {item.modelNumber}</span>}
                          </div>
                        )}

                        {/* Row 2: Quantity + Unit + Unit Price in a clean grid */}
                        <div className="ml-7 flex items-center gap-3">
                          {/* Quantity */}
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              defaultValue={item.quantity}
                              onBlur={(e) => handleQuantityChange(item.id, e.target.value)}
                              className="w-16 text-sm font-mono font-bold text-gray-800 bg-gray-100 hover:bg-white focus:bg-white border border-gray-200 focus:border-[#0099CB] rounded px-2 py-1 text-right outline-none transition-colors"
                            />
                            <select
                              defaultValue={item.unit}
                              className="text-sm text-gray-600 bg-transparent border-none focus:ring-0 cursor-pointer py-0 pl-0 pr-5"
                            >
                              <option value={item.unit}>{item.unit}</option>
                              <option value="個">個</option>
                              <option value="台">台</option>
                              <option value="m">m</option>
                              <option value="m²">m²</option>
                              <option value="本">本</option>
                              <option value="枚">枚</option>
                            </select>
                          </div>

                          <span className="text-gray-400">×</span>

                          {/* Unit Price */}
                          <div className="flex items-center gap-1">
                            <span className="text-sm text-gray-500">¥</span>
                            <input
                              type="number"
                              defaultValue={item.unitPrice || ''}
                              placeholder="単価"
                              onBlur={(e) => handleUnitPriceChange(item.id, e.target.value)}
                              className="w-20 text-sm font-mono text-gray-800 bg-gray-100 hover:bg-white focus:bg-white border border-gray-200 focus:border-[#0099CB] rounded px-2 py-1 text-right outline-none transition-colors placeholder:text-gray-400"
                            />
                          </div>

                          {/* Material Picker */}
                          <button
                            onClick={() => handleOpenMaterialPicker(item.id)}
                            className="p-1 text-gray-400 hover:text-[#0088B4] hover:bg-[#E0F4FA] rounded transition-all flex-shrink-0"
                            title="部材マスタから選択"
                          >
                            <Database size={16} />
                          </button>
                        </div>

                        {/* Row 3: Total Amount */}
                        {(item.unitPrice ?? 0) > 0 && (
                          <div className="ml-7 mt-2">
                            <span className="text-sm font-mono font-bold text-[#006A8E] bg-[#E0F4FA] px-3 py-1 rounded-full">
                              = ¥{((item.quantity || 0) * (item.unitPrice || 0)).toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 bg-white">
        {/* Total */}
        {totalAmount > 0 && (
          <div className="px-4 py-3 bg-[#0099CB]">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-white/90">合計金額</span>
              <span className="font-mono font-bold text-xl text-white">
                ¥{totalAmount.toLocaleString()}
              </span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="p-3 space-y-2">
          <div className="flex gap-2">
            <Button variant="primary" className="flex-1" icon={Eye} onClick={() => setShowSummaryModal(true)}>
              集計表を表示
            </Button>
            <Button
              variant="secondary"
              className="px-3"
              icon={Table2}
              onClick={() => useViewerStore.getState().setViewMode('table')}
              title="一覧で見る"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" icon={Plus} onClick={() => setShowAddModal(true)}>
              手動追加
            </Button>
            <Button
              variant="destructive"
              className="px-3"
              icon={Trash2}
              onClick={() => deleteSelectedItems()}
              disabled={selectedItemIds.size === 0}
            />
          </div>
          {selectedItemIds.size > 0 && (
            <p className="text-xs text-gray-500 text-center">
              {selectedItemIds.size}件選択中
            </p>
          )}
        </div>
      </div>

      {/* Material Picker Modal */}
      <MaterialPicker
        isOpen={showMaterialPicker}
        onClose={() => {
          setShowMaterialPicker(false);
          setEditingItemId(null);
        }}
        onSelect={handleMaterialSelect}
      />

      {/* Summary Table Modal */}
      <Modal
        isOpen={showSummaryModal}
        onClose={() => setShowSummaryModal(false)}
        title="拾い出し集計表"
        size="lg"
      >
        <div className="space-y-4">
          {/* Category Summary */}
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-[#52555F]">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-bold text-white">カテゴリ</th>
                  <th className="text-right px-4 py-3 text-sm font-bold text-white">件数</th>
                  <th className="text-right px-4 py-3 text-sm font-bold text-white">金額</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {TAKEOFF_CATEGORIES.map((category) => {
                  const categoryItems = items.filter((item) => item.category === category.id);
                  const categoryTotal = categoryItems.reduce((sum, item) => sum + (item.amount || item.quantity * (item.unitPrice || 0)), 0);
                  if (categoryItems.length === 0) return null;
                  return (
                    <tr key={category.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">{category.label}</td>
                      <td className="px-4 py-3 text-sm text-right font-mono text-gray-700">{categoryItems.length}</td>
                      <td className="px-4 py-3 text-sm text-right font-mono text-gray-700">¥{categoryTotal.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-[#0099CB]">
                <tr>
                  <td className="px-4 py-3 text-sm font-bold text-white">合計</td>
                  <td className="px-4 py-3 text-sm text-right font-mono font-bold text-white">{items.length}</td>
                  <td className="px-4 py-3 text-sm text-right font-mono font-bold text-white">¥{totalAmount.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Detail List */}
          <div className="border rounded-lg overflow-hidden max-h-72 overflow-y-auto">
            <table className="w-full">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2.5 text-sm font-bold text-gray-700">項目</th>
                  <th className="text-right px-4 py-2.5 text-sm font-bold text-gray-700">数量</th>
                  <th className="text-right px-4 py-2.5 text-sm font-bold text-gray-700">単価</th>
                  <th className="text-right px-4 py-2.5 text-sm font-bold text-gray-700">金額</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-sm text-gray-800">{item.itemType}</td>
                    <td className="px-4 py-2.5 text-sm text-right font-mono text-gray-700">{item.quantity} {item.unit}</td>
                    <td className="px-4 py-2.5 text-sm text-right font-mono text-gray-700">¥{(item.unitPrice || 0).toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-sm text-right font-mono font-bold text-gray-800">¥{(item.amount || item.quantity * (item.unitPrice || 0)).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => setShowSummaryModal(false)}>
              閉じる
            </Button>
          </div>
        </div>
      </Modal>

      {/* Manual Add Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="手動追加"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">カテゴリ</label>
            <select
              value={newItem.category}
              onChange={(e) => setNewItem({ ...newItem, category: e.target.value, itemType: '' })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0099CB] focus:border-[#0099CB]"
            >
              {TAKEOFF_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">項目名</label>
            <select
              value={newItem.itemType}
              onChange={(e) => setNewItem({ ...newItem, itemType: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0099CB] focus:border-[#0099CB]"
            >
              <option value="">選択してください</option>
              {(CATEGORY_ITEM_TYPES[newItem.category] || []).map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
              <option value="custom">その他（カスタム）</option>
            </select>
            {newItem.itemType === 'custom' && (
              <input
                type="text"
                placeholder="項目名を入力"
                className="mt-2 w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0099CB] focus:border-[#0099CB]"
                onChange={(e) => setNewItem({ ...newItem, itemType: e.target.value })}
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">数量</label>
              <input
                type="number"
                value={newItem.quantity}
                onChange={(e) => setNewItem({ ...newItem, quantity: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0099CB] focus:border-[#0099CB]"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">単位</label>
              <select
                value={newItem.unit}
                onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0099CB] focus:border-[#0099CB]"
              >
                <option value="個">個</option>
                <option value="台">台</option>
                <option value="m">m</option>
                <option value="m²">m²</option>
                <option value="式">式</option>
                <option value="箇所">箇所</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">単価（円）</label>
            <input
              type="number"
              value={newItem.unitPrice}
              onChange={(e) => setNewItem({ ...newItem, unitPrice: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0099CB] focus:border-[#0099CB]"
              placeholder="0"
            />
          </div>

          {newItem.quantity > 0 && newItem.unitPrice > 0 && (
            <div className="bg-[#E0F4FA] rounded-lg p-3 text-center">
              <span className="text-sm text-gray-600">金額: </span>
              <span className="font-bold text-[#006A8E]">¥{(newItem.quantity * newItem.unitPrice).toLocaleString()}</span>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="secondary" onClick={() => setShowAddModal(false)}>
              キャンセル
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (newItem.itemType && newItem.quantity > 0) {
                  addItem({
                    category: newItem.category,
                    itemType: newItem.itemType,
                    quantity: newItem.quantity,
                    unit: newItem.unit,
                    unitPrice: newItem.unitPrice,
                    amount: newItem.quantity * newItem.unitPrice,
                    confidence: 1.0,
                    source: 'manual',
                    locations: [],
                  });
                  setShowAddModal(false);
                  setNewItem({
                    category: TAKEOFF_CATEGORIES[0]?.id || '',
                    itemType: '',
                    quantity: 1,
                    unit: '個',
                    unitPrice: 0,
                  });
                }
              }}
              disabled={!newItem.itemType || newItem.quantity <= 0}
            >
              追加
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
