'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { ChevronDown, ChevronRight, Plus, ChevronsDown, ChevronsUp, Trash2, GripVertical, AlertTriangle, List, Layers, Home, Database } from 'lucide-react';
import { useTakeoffStore } from '@/stores/takeoff-store';
import { useGroupStore } from '@/stores/group-store';
import { useCustomColumnStore } from '@/stores/custom-column-store';
import type { TakeoffItem, TakeoffGroup, CustomColumn } from '@/types';
import type { Material } from '@/types/material';
import { TAKEOFF_UNITS } from '@/types/takeoff';
import { cn } from '@/lib/utils';
import { MaterialPicker } from './material-picker';

// ========== 確認モーダル ==========
function ConfirmDeleteModal({
  isOpen,
  message,
  onConfirm,
  onCancel,
}: {
  isOpen: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={20} className="text-red-600" />
          </div>
          <h3 className="text-base font-bold text-gray-800">削除の確認</h3>
        </div>
        <p className="text-sm text-gray-600 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
          >
            削除する
          </button>
        </div>
      </div>
    </div>
  );
}

interface TakeoffSpreadsheetProps {
  drawingId?: string;
}

// 集計ヘルパー
function calcGroupTotals(
  groupId: string,
  items: TakeoffItem[],
  groups: TakeoffGroup[]
): { amount: number; quantity: number } {
  const directItems = items.filter(i => i.groupId === groupId);
  let amount = directItems.reduce((s, i) => s + (i.amount || 0), 0);
  let quantity = directItems.reduce((s, i) => s + i.quantity, 0);

  const childGroups = groups.filter(g => g.parentId === groupId);
  for (const child of childGroups) {
    const ct = calcGroupTotals(child.id, items, groups);
    amount += ct.amount;
    quantity += ct.quantity;
  }
  return { amount, quantity };
}

function fmtNum(n: number | undefined): string {
  if (n == null || n === 0) return '0';
  return n.toLocaleString();
}

// インデント1段あたりのピクセル
const INDENT_PX = 40;

// デフォルトカラム幅定義
const DEFAULT_COL_WIDTHS: Record<string, number> = {
  master: 90,
  check: 40,
  detail: 120,
  itemType: 200,
  spec: 220,
  model: 150,
  standard: 130,
  qty: 80,
  unit: 80,
  price: 120,
  amount: 120,
  remarks: 260,
};

// カラムリサイズフック
function useColumnResize(customColumns: CustomColumn[]) {
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => ({ ...DEFAULT_COL_WIDTHS }));
  const resizing = useRef<{ key: string; startX: number; startW: number } | null>(null);

  // カスタムカラムの初期幅を同期
  useEffect(() => {
    setColWidths(prev => {
      const next = { ...prev };
      for (const c of customColumns) {
        if (!(c.id in next)) next[c.id] = c.width || 150;
      }
      return next;
    });
  }, [customColumns]);

  const onResizeStart = useCallback((key: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizing.current = { key, startX: e.clientX, startW: colWidths[key] || 100 };
    const onMove = (ev: MouseEvent) => {
      if (!resizing.current) return;
      const diff = ev.clientX - resizing.current.startX;
      const newW = Math.max(40, resizing.current.startW + diff);
      setColWidths(prev => ({ ...prev, [resizing.current!.key]: newW }));
    };
    const onUp = () => {
      resizing.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [colWidths]);

  const getW = useCallback((key: string) => colWidths[key] || DEFAULT_COL_WIDTHS[key] || 150, [colWidths]);

  return { getW, onResizeStart };
}

// リサイズハンドル付きヘッダーセル
function ResizableTh({
  colKey,
  getW,
  onResizeStart,
  align = 'left',
  children,
}: {
  colKey: string;
  getW: (key: string) => number;
  onResizeStart: (key: string, e: React.MouseEvent) => void;
  align?: 'left' | 'center' | 'right';
  children: React.ReactNode;
}) {
  return (
    <th
      className={cn('px-2 py-2 border-r border-white/30 relative select-none', {
        'text-left': align === 'left',
        'text-center': align === 'center',
        'text-right': align === 'right',
      })}
      style={{ width: getW(colKey) }}
    >
      {children}
      <div
        className="absolute top-0 right-0 w-[5px] h-full cursor-col-resize hover:bg-white/40 transition-colors"
        onMouseDown={(e) => onResizeStart(colKey, e)}
      />
    </th>
  );
}

type ListMode = 'overview' | 'detail';

export function TakeoffSpreadsheet({ drawingId }: TakeoffSpreadsheetProps) {
  const { items, selectedItemIds, toggleItemSelection, updateItem, deleteItem, reorderItems } = useTakeoffStore();
  const { groups, expandedGroupIds, toggleExpand, expandAll, collapseAll, addGroup, updateGroup, deleteGroup, reorderGroups } = useGroupStore();
  const { columns: customColumns, addColumn, updateColumn, deleteColumn } = useCustomColumnStore();

  const { getW, onResizeStart } = useColumnResize(customColumns);

  const drawingItems = items.filter(i => !drawingId || i.drawingId === drawingId);
  const drawingGroups = groups.filter(g => !drawingId || g.drawingId === drawingId);

  const sortByOrder = (a: TakeoffItem, b: TakeoffItem) => (a.order ?? 0) - (b.order ?? 0);

  const rootGroups = useMemo(
    () => drawingGroups.filter(g => g.parentId === null).sort((a, b) => a.order - b.order),
    [drawingGroups]
  );

  const ungroupedItems = useMemo(
    () => drawingItems.filter(i => !i.groupId).sort(sortByOrder),
    [drawingItems]
  );

  const totals = useMemo(() => {
    const amount = drawingItems.reduce((s, i) => s + (i.amount || 0), 0);
    return { amount };
  }, [drawingItems]);

  // 動的カラム数: 固定12 (master+check+detail+itemType+spec+model+standard+qty+unit+price+amount+remarks) + customColumns + 1（＋ボタン）
  const COL_COUNT = 12 + customColumns.length + 1;

  // ── 全体/明細モード ──
  const [listMode, setListMode] = useState<ListMode>('overview');
  const [focusedGroupId, setFocusedGroupId] = useState<string | null>(null);

  // パンくず用の経路を計算
  const breadcrumbPath = useMemo(() => {
    if (focusedGroupId === null) return [];
    const path: TakeoffGroup[] = [];
    let current = drawingGroups.find(g => g.id === focusedGroupId);
    while (current) {
      path.unshift(current);
      current = current.parentId ? drawingGroups.find(g => g.id === current!.parentId) : undefined;
    }
    return path;
  }, [focusedGroupId, drawingGroups]);

  // 明細モード: 現在の階層の子グループ・アイテム
  const detailGroups = useMemo(() => {
    if (listMode !== 'detail') return [];
    return drawingGroups
      .filter(g => g.parentId === focusedGroupId)
      .sort((a, b) => a.order - b.order);
  }, [listMode, focusedGroupId, drawingGroups]);

  const detailItems = useMemo(() => {
    if (listMode !== 'detail') return [];
    if (focusedGroupId === null) {
      return drawingItems.filter(i => !i.groupId);
    }
    return drawingItems.filter(i => i.groupId === focusedGroupId);
  }, [listMode, focusedGroupId, drawingItems]);

  // 明細モードの合計
  const detailTotals = useMemo(() => {
    if (listMode !== 'detail') return { amount: 0 };
    const itemsAmount = detailItems.reduce((s, i) => s + (i.amount || 0), 0);
    const groupsAmount = detailGroups.reduce((s, g) => s + calcGroupTotals(g.id, drawingItems, drawingGroups).amount, 0);
    const amount = itemsAmount + groupsAmount;
    return { amount };
  }, [listMode, detailItems, detailGroups, drawingItems, drawingGroups]);

  const handleNavigateInto = useCallback((groupId: string) => {
    setFocusedGroupId(groupId);
  }, []);

  // ── マスタ選択 state ──
  const [materialPickerTargetId, setMaterialPickerTargetId] = useState<string | null>(null);

  const handleOpenMaterialPicker = useCallback((itemId: string) => {
    setMaterialPickerTargetId(itemId);
  }, []);

  const handleMaterialSelect = useCallback(async (material: Material) => {
    if (!materialPickerTargetId) return;
    const targetItem = drawingItems.find(i => i.id === materialPickerTargetId);
    const quantity = targetItem?.quantity || 0;
    const unitPrice = material.unitPrice || 0;
    await updateItem(materialPickerTargetId, {
      itemType: material.name,
      specification: material.specifications || undefined,
      modelNumber: material.productNumber || undefined,
      unit: material.unit,
      unitPrice,
      amount: quantity * unitPrice,
    });
    setMaterialPickerTargetId(null);
  }, [materialPickerTargetId, updateItem, drawingItems]);

  // ── グループ選択 state ──
  const [checkedGroupIds, setCheckedGroupIds] = useState<Set<string>>(new Set());

  const toggleGroupCheck = useCallback((groupId: string) => {
    setCheckedGroupIds(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  // 全選択 / 全解除
  const allItemIds = useMemo(() => drawingItems.map(i => i.id), [drawingItems]);
  const allGroupIds = useMemo(() => drawingGroups.map(g => g.id), [drawingGroups]);
  const isAllChecked = allItemIds.length > 0 && allItemIds.every(id => selectedItemIds.has(id)) && allGroupIds.every(id => checkedGroupIds.has(id));
  const hasSomeChecked = selectedItemIds.size > 0 || checkedGroupIds.size > 0;

  const handleToggleAll = useCallback(() => {
    if (isAllChecked) {
      const { deselectAll } = useTakeoffStore.getState();
      deselectAll();
      setCheckedGroupIds(new Set());
    } else {
      useTakeoffStore.setState({ selectedItemIds: new Set(allItemIds) });
      setCheckedGroupIds(new Set(allGroupIds));
    }
  }, [isAllChecked, allItemIds, allGroupIds]);

  // ── 確認モーダル state ──
  const [confirmModal, setConfirmModal] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const requestConfirm = useCallback((message: string, onConfirm: () => void) => {
    setConfirmModal({ message, onConfirm });
  }, []);

  // 一括削除
  const handleBulkDelete = useCallback(() => {
    const itemCount = selectedItemIds.size;
    const groupCount = checkedGroupIds.size;
    if (itemCount === 0 && groupCount === 0) return;

    const parts: string[] = [];
    if (groupCount > 0) parts.push(`${groupCount}件のグループ（子要素含む）`);
    if (itemCount > 0) parts.push(`${itemCount}件の項目`);

    setConfirmModal({
      message: `${parts.join('と')}を削除しますか？この操作は取り消せません。`,
      onConfirm: async () => {
        for (const gid of checkedGroupIds) {
          await deleteGroup(gid);
        }
        const { deleteSelectedItems } = useTakeoffStore.getState();
        await deleteSelectedItems();
        setCheckedGroupIds(new Set());
        setConfirmModal(null);
      },
    });
  }, [selectedItemIds.size, checkedGroupIds, deleteGroup]);

  // ── ドラッグ&ドロップ state ──
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragItemIds = useRef<string[]>([]);
  // 行並び替え
  const dragSourceType = useRef<'item' | 'group' | null>(null);
  const dragSourceId = useRef<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; pos: 'before' | 'after'; type: 'item' | 'group' } | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, itemId: string, sourceType: 'item' | 'group' = 'item') => {
    dragSourceType.current = sourceType;
    dragSourceId.current = itemId;
    if (sourceType === 'item') {
      const ids = selectedItemIds.has(itemId) ? Array.from(selectedItemIds) : [itemId];
      dragItemIds.current = ids;
    } else {
      dragItemIds.current = [];
    }
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', itemId);
    setIsDragging(true);
  }, [selectedItemIds]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    setDragOverGroupId(null);
    setDropTarget(null);
    dragItemIds.current = [];
    dragSourceType.current = null;
    dragSourceId.current = null;
  }, []);

  // 行の上半分/下半分で before/after を判定
  const handleRowDragOver = useCallback((e: React.DragEvent, targetId: string, targetType: 'item' | 'group') => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const pos = (e.clientY - rect.top) < rect.height / 2 ? 'before' : 'after';
    setDropTarget({ id: targetId, pos, type: targetType });
  }, []);

  const handleRowDragLeave = useCallback(() => {
    setDropTarget(null);
  }, []);

  // 行ドロップ → 並び替え
  const handleRowDrop = useCallback(async (e: React.DragEvent, targetId: string, targetType: 'item' | 'group', parentGroupId: string | undefined) => {
    e.preventDefault();
    e.stopPropagation();
    const srcType = dragSourceType.current;
    const srcId = dragSourceId.current;
    if (!srcId) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const pos = (e.clientY - rect.top) < rect.height / 2 ? 'before' : 'after';

    // 同じタイプの並び替え
    if (srcType === 'item' && targetType === 'item') {
      const siblings = drawingItems.filter(i => i.groupId === (parentGroupId || undefined)).sort(sortByOrder);
      const ordered = siblings.map(i => i.id);
      // srcIdを一旦除去してtargetの前/後に挿入
      const filtered = ordered.filter(id => id !== srcId);
      const tIdx = filtered.indexOf(targetId);
      const insertIdx = pos === 'before' ? tIdx : tIdx + 1;
      filtered.splice(insertIdx, 0, srcId);
      await reorderItems(parentGroupId, filtered);
    } else if (srcType === 'group' && targetType === 'group') {
      const srcGroup = drawingGroups.find(g => g.id === srcId);
      const tgtGroup = drawingGroups.find(g => g.id === targetId);
      if (!srcGroup || !tgtGroup || srcGroup.parentId !== tgtGroup.parentId) return;
      const siblings = drawingGroups.filter(g => g.parentId === srcGroup.parentId).sort((a, b) => a.order - b.order);
      const ordered = siblings.map(g => g.id);
      const filtered = ordered.filter(id => id !== srcId);
      const tIdx = filtered.indexOf(targetId);
      const insertIdx = pos === 'before' ? tIdx : tIdx + 1;
      filtered.splice(insertIdx, 0, srcId);
      await reorderGroups(srcGroup.parentId, filtered);
    }

    setDropTarget(null);
    setIsDragging(false);
    dragSourceType.current = null;
    dragSourceId.current = null;
    dragItemIds.current = [];
  }, [drawingItems, drawingGroups, reorderItems, reorderGroups, sortByOrder]);

  const handleDragOverGroup = useCallback((e: React.DragEvent, groupId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverGroupId(groupId);
  }, []);

  const handleDragLeaveGroup = useCallback(() => {
    setDragOverGroupId(null);
  }, []);

  const handleDropOnGroup = useCallback(async (e: React.DragEvent, groupId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverGroupId(null);
    setIsDragging(false);
    const ids = [...dragItemIds.current];
    dragItemIds.current = [];
    dragSourceType.current = null;
    dragSourceId.current = null;
    for (const id of ids) {
      await updateItem(id, { groupId });
    }
  }, [updateItem]);

  const handleDropOnRoot = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverGroupId(null);
    setIsDragging(false);
    const ids = [...dragItemIds.current];
    dragItemIds.current = [];
    dragSourceType.current = null;
    dragSourceId.current = null;
    for (const id of ids) {
      await updateItem(id, { groupId: undefined });
    }
  }, [updateItem]);

  const handleAddRootGroup = useCallback(async () => {
    if (!drawingId) return;
    if (listMode === 'detail' && focusedGroupId) {
      const parent = drawingGroups.find(g => g.id === focusedGroupId);
      const level = parent ? parent.level + 1 : 1;
      if (level > 5) return;
      await addGroup(drawingId, '新規項目', focusedGroupId, level);
    } else {
      await addGroup(drawingId, '新規大項目', null, 1);
    }
  }, [drawingId, addGroup, listMode, focusedGroupId, drawingGroups]);

  const handleAddItem = useCallback(async () => {
    const { addItem } = useTakeoffStore.getState();
    if (!drawingId) return;
    await addItem({
      category: 'electrical',
      itemType: '新規項目',
      quantity: 1,
      unit: '個',
      source: 'manual',
      locations: [],
      groupId: listMode === 'detail' ? (focusedGroupId ?? undefined) : undefined,
    });
  }, [drawingId, listMode, focusedGroupId]);

  // カスタムカラム追加
  const handleAddCustomColumn = useCallback(async () => {
    if (!drawingId) return;
    await addColumn(drawingId);
  }, [drawingId, addColumn]);

  // 共通props
  const sharedGroupRowProps = {
    allGroups: drawingGroups,
    allItems: drawingItems,
    selectedItemIds,
    expandedGroupIds,
    checkedGroupIds,
    onToggleItemSelection: toggleItemSelection,
    onToggleGroupCheck: toggleGroupCheck,
    onUpdateItem: updateItem,
    onDeleteItem: deleteItem,
    onUpdateGroup: updateGroup,
    onDeleteGroup: deleteGroup,
    onAddGroup: addGroup,
    onRequestConfirm: requestConfirm,
    drawingId,
    dragOverGroupId,
    isDragging,
    onDragStart: handleDragStart,
    onDragEnd: handleDragEnd,
    onDragOverGroup: handleDragOverGroup,
    onDragLeaveGroup: handleDragLeaveGroup,
    onDropOnGroup: handleDropOnGroup,
    customColumns,
    dropTarget,
    onRowDragOver: handleRowDragOver,
    onRowDragLeave: handleRowDragLeave,
    onRowDrop: handleRowDrop,
    getW,
    onOpenMaterialPicker: handleOpenMaterialPicker,
  };

  const displayTotals = listMode === 'detail' ? detailTotals : totals;

  return (
    <div className="flex flex-col h-full bg-white relative">
      {/* 確認モーダル */}
      <ConfirmDeleteModal
        isOpen={!!confirmModal}
        message={confirmModal?.message || ''}
        onConfirm={() => { confirmModal?.onConfirm(); setConfirmModal(null); }}
        onCancel={() => setConfirmModal(null)}
      />

      {/* マスタ選択モーダル */}
      <MaterialPicker
        isOpen={!!materialPickerTargetId}
        onClose={() => setMaterialPickerTargetId(null)}
        onSelect={handleMaterialSelect}
      />

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 bg-gray-50">
        {/* 全体/明細 モード切替 */}
        <div className="flex items-center bg-white border border-gray-300 rounded overflow-hidden">
          <button
            onClick={() => { setListMode('overview'); setFocusedGroupId(null); }}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1 text-xs transition-colors',
              listMode === 'overview' ? 'bg-[#0099CB] text-white' : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            <Layers size={12} />
            全体
          </button>
          <button
            onClick={() => setListMode('detail')}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1 text-xs transition-colors',
              listMode === 'detail' ? 'bg-[#0099CB] text-white' : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            <List size={12} />
            明細
          </button>
        </div>

        <div className="w-px h-5 bg-gray-300" />

        {listMode === 'overview' && (
          <>
            <button onClick={expandAll} className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 rounded transition-colors">
              <ChevronsDown size={14} />全展開
            </button>
            <button onClick={collapseAll} className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 rounded transition-colors">
              <ChevronsUp size={14} />全折りたたみ
            </button>
          </>
        )}
        {isDragging && (
          <span className="text-xs text-[#0099CB] font-medium ml-2">
            {dragItemIds.current.length}件を移動中 — グループにドロップ
          </span>
        )}
        <div className="flex-1" />
        {hasSomeChecked && (
          <button
            onClick={handleBulkDelete}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
          >
            <Trash2 size={12} />
            選択を削除 ({selectedItemIds.size + checkedGroupIds.size})
          </button>
        )}
        <button
          onClick={handleAddRootGroup}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-[#52555F] hover:bg-[#3d4049] rounded transition-colors"
        >
          <Plus size={12} />
          {listMode === 'detail' && focusedGroupId ? '項目グループ追加' : '大項目追加'}
        </button>
        <button
          onClick={handleAddItem}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-[#0099CB] hover:bg-[#0088B4] rounded transition-colors"
        >
          <Plus size={12} />項目追加
        </button>
      </div>

      {/* パンくずバー（明細モード時） */}
      {listMode === 'detail' && (
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-gray-200 bg-gray-50/50 text-xs">
          <button
            onClick={() => setFocusedGroupId(null)}
            className={cn(
              'flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors',
              focusedGroupId === null ? 'text-[#0099CB] font-bold' : 'text-gray-500 hover:text-[#0099CB] hover:bg-gray-100'
            )}
          >
            <Home size={12} />ルート
          </button>
          {breadcrumbPath.map((g) => (
            <span key={g.id} className="flex items-center gap-1">
              <ChevronRight size={12} className="text-gray-400" />
              <button
                onClick={() => setFocusedGroupId(g.id)}
                className={cn(
                  'px-1.5 py-0.5 rounded transition-colors',
                  g.id === focusedGroupId ? 'text-[#0099CB] font-bold' : 'text-gray-500 hover:text-[#0099CB] hover:bg-gray-100'
                )}
              >
                {g.name}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="border-collapse" style={{ tableLayout: 'fixed', minWidth: 1200 }}>
          <colgroup>
            <col style={{ width: getW('master') }} />
            <col style={{ width: getW('check') }} />
            <col style={{ width: getW('detail') }} />
            <col style={{ width: getW('itemType') }} />
            <col style={{ width: getW('spec') }} />
            <col style={{ width: getW('model') }} />
            <col style={{ width: getW('standard') }} />
            <col style={{ width: getW('qty') }} />
            <col style={{ width: getW('unit') }} />
            <col style={{ width: getW('price') }} />
            <col style={{ width: getW('amount') }} />
            <col style={{ width: getW('remarks') }} />
            {customColumns.map(col => <col key={col.id} style={{ width: getW(col.id) }} />)}
            <col style={{ width: 40 }} />
          </colgroup>
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#0099CB] text-white text-xs">
              <th className="px-1 py-2 text-center whitespace-nowrap" style={{ width: getW('master') }}>
                マスタ
              </th>
              <ResizableTh colKey="check" getW={getW} onResizeStart={onResizeStart} align="center">
                <input
                  type="checkbox"
                  checked={isAllChecked}
                  onChange={handleToggleAll}
                  className="rounded border-white/50"
                  ref={(el) => { if (el) el.indeterminate = !isAllChecked && hasSomeChecked; }}
                />
              </ResizableTh>
              <ResizableTh colKey="detail" getW={getW} onResizeStart={onResizeStart}>明細</ResizableTh>
              <ResizableTh colKey="itemType" getW={getW} onResizeStart={onResizeStart}>大項目</ResizableTh>
              <ResizableTh colKey="spec" getW={getW} onResizeStart={onResizeStart}>仕様</ResizableTh>
              <ResizableTh colKey="model" getW={getW} onResizeStart={onResizeStart}>型番</ResizableTh>
              <ResizableTh colKey="standard" getW={getW} onResizeStart={onResizeStart}>規格</ResizableTh>
              <ResizableTh colKey="qty" getW={getW} onResizeStart={onResizeStart} align="center">数量</ResizableTh>
              <ResizableTh colKey="unit" getW={getW} onResizeStart={onResizeStart} align="center">単位</ResizableTh>
              <ResizableTh colKey="price" getW={getW} onResizeStart={onResizeStart} align="right">単価</ResizableTh>
              <ResizableTh colKey="amount" getW={getW} onResizeStart={onResizeStart} align="right">金額</ResizableTh>
              <ResizableTh colKey="remarks" getW={getW} onResizeStart={onResizeStart}>備考</ResizableTh>
              {/* カスタムカラム */}
              {customColumns.map(col => (
                <ResizableTh key={col.id} colKey={col.id} getW={getW} onResizeStart={onResizeStart}>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      defaultValue={col.name}
                      onBlur={(e) => updateColumn(col.id, { name: e.target.value })}
                      className="w-full bg-transparent text-white text-xs border-b border-transparent hover:border-white/50 focus:border-white outline-none"
                    />
                    <button
                      onClick={() => deleteColumn(col.id)}
                      className="opacity-0 hover:opacity-100 p-0.5 text-white/60 hover:text-red-300 transition-all flex-shrink-0"
                      title="カラム削除"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                </ResizableTh>
              ))}
              {/* ＋ボタンカラム */}
              <th className="px-1 py-2 text-center" style={{ width: 40 }}>
                <button
                  onClick={handleAddCustomColumn}
                  className="p-1 hover:bg-white/20 rounded transition-colors text-white/80 hover:text-white"
                  title="カラム追加"
                >
                  <Plus size={14} />
                </button>
              </th>
            </tr>
          </thead>

          <tbody>
            {listMode === 'overview' ? (
              <>
                {rootGroups.map((group) => (
                  <GroupRow
                    key={group.id}
                    group={group}
                    {...sharedGroupRowProps}
                    onToggleExpand={toggleExpand}
                    mode="overview"
                    colCount={COL_COUNT}
                  />
                ))}
                {ungroupedItems.length > 0 && isDragging && (
                  <tr
                    className="border-b border-dashed border-blue-300 bg-blue-50/30"
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                    onDrop={handleDropOnRoot}
                  >
                    <td colSpan={COL_COUNT} className="px-4 py-2 text-xs text-blue-400 text-center">
                      ここにドロップでグループ解除
                    </td>
                  </tr>
                )}
                {ungroupedItems.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    depth={0}
                    selected={selectedItemIds.has(item.id)}
                    onToggleSelection={toggleItemSelection}
                    onUpdate={updateItem}
                    onDelete={deleteItem}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    drawingId={drawingId}
                    onAddGroup={addGroup}
                    onRequestConfirm={requestConfirm}
                    customColumns={customColumns}
                    dropTarget={dropTarget}
                    onRowDragOver={handleRowDragOver}
                    onRowDragLeave={handleRowDragLeave}
                    onRowDrop={handleRowDrop}
                    onOpenMaterialPicker={handleOpenMaterialPicker}
                  />
                ))}
              </>
            ) : (
              <>
                {detailGroups.map((group) => (
                  <GroupRow
                    key={group.id}
                    group={group}
                    {...sharedGroupRowProps}
                    onToggleExpand={toggleExpand}
                    mode="detail"
                    onNavigateInto={handleNavigateInto}
                    colCount={COL_COUNT}
                  />
                ))}
                {detailItems.length > 0 && isDragging && focusedGroupId === null && (
                  <tr
                    className="border-b border-dashed border-blue-300 bg-blue-50/30"
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                    onDrop={handleDropOnRoot}
                  >
                    <td colSpan={COL_COUNT} className="px-4 py-2 text-xs text-blue-400 text-center">
                      ここにドロップでグループ解除
                    </td>
                  </tr>
                )}
                {detailItems.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    depth={0}
                    selected={selectedItemIds.has(item.id)}
                    onToggleSelection={toggleItemSelection}
                    onUpdate={updateItem}
                    onDelete={deleteItem}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    drawingId={drawingId}
                    onAddGroup={addGroup}
                    onRequestConfirm={requestConfirm}
                    customColumns={customColumns}
                    dropTarget={dropTarget}
                    onRowDragOver={handleRowDragOver}
                    onRowDragLeave={handleRowDragLeave}
                    onRowDrop={handleRowDrop}
                    onOpenMaterialPicker={handleOpenMaterialPicker}
                  />
                ))}
                {detailGroups.length === 0 && detailItems.length === 0 && (
                  <tr>
                    <td colSpan={COL_COUNT} className="px-4 py-8 text-center text-sm text-gray-400">
                      この階層にはまだ項目がありません
                    </td>
                  </tr>
                )}
              </>
            )}
          </tbody>

          <tfoot>
            <tr className="bg-[#0099CB] text-white text-sm font-bold">
              <td className="px-1 py-2.5" />
              <td className="px-1 py-2.5" />
              <td className="px-2 py-2.5" />
              <td className="px-2 py-2.5">
                {listMode === 'detail' && focusedGroupId ? '小計' : '合計'}
              </td>
              <td className="px-2 py-2.5" />
              <td className="px-2 py-2.5" />
              <td className="px-2 py-2.5" />
              <td className="px-2 py-2.5" />
              <td className="px-2 py-2.5" />
              <td className="px-2 py-2.5" />
              <td className="px-2 py-2.5 text-right font-mono">¥{fmtNum(displayTotals.amount)}</td>
              <td className="px-2 py-2.5" />
              {customColumns.map(col => <td key={col.id} className="px-2 py-2.5" />)}
              <td className="px-1 py-2.5" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ========== GroupRow ==========
interface GroupRowProps {
  group: TakeoffGroup;
  allGroups: TakeoffGroup[];
  allItems: TakeoffItem[];
  selectedItemIds: Set<string>;
  expandedGroupIds: Set<string>;
  checkedGroupIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onToggleItemSelection: (id: string) => void;
  onToggleGroupCheck: (id: string) => void;
  onUpdateItem: (id: string, updates: Partial<TakeoffItem>) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
  onUpdateGroup: (id: string, updates: Partial<TakeoffGroup>) => Promise<void>;
  onDeleteGroup: (id: string) => Promise<void>;
  onAddGroup: (drawingId: string, name: string, parentId: string | null, level: number) => Promise<TakeoffGroup>;
  onRequestConfirm: (message: string, onConfirm: () => void) => void;
  drawingId?: string;
  dragOverGroupId: string | null;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent, itemId: string, sourceType?: 'item' | 'group') => void;
  onDragEnd: () => void;
  onDragOverGroup: (e: React.DragEvent, groupId: string) => void;
  onDragLeaveGroup: () => void;
  onDropOnGroup: (e: React.DragEvent, groupId: string) => Promise<void>;
  mode: ListMode;
  onNavigateInto?: (groupId: string) => void;
  customColumns: CustomColumn[];
  colCount: number;
  dropTarget: { id: string; pos: 'before' | 'after'; type: 'item' | 'group' } | null;
  onRowDragOver: (e: React.DragEvent, targetId: string, targetType: 'item' | 'group') => void;
  onRowDragLeave: () => void;
  onRowDrop: (e: React.DragEvent, targetId: string, targetType: 'item' | 'group', parentGroupId: string | undefined) => Promise<void>;
  getW: (key: string) => number;
  onOpenMaterialPicker: (itemId: string) => void;
}

function GroupRow({
  group,
  allGroups,
  allItems,
  selectedItemIds,
  expandedGroupIds,
  checkedGroupIds,
  onToggleExpand,
  onToggleItemSelection,
  onToggleGroupCheck,
  onUpdateItem,
  onDeleteItem,
  onUpdateGroup,
  onDeleteGroup,
  onAddGroup,
  onRequestConfirm,
  drawingId,
  dragOverGroupId,
  isDragging,
  onDragStart,
  onDragEnd,
  onDragOverGroup,
  onDragLeaveGroup,
  onDropOnGroup,
  mode,
  onNavigateInto,
  customColumns,
  colCount,
  dropTarget,
  onRowDragOver,
  onRowDragLeave,
  onRowDrop,
  getW,
  onOpenMaterialPicker,
}: GroupRowProps) {
  const isExpanded = expandedGroupIds.has(group.id);
  const childGroups = allGroups.filter(g => g.parentId === group.id).sort((a, b) => a.order - b.order);
  const directItems = allItems.filter(i => i.groupId === group.id);
  const totals = calcGroupTotals(group.id, allItems, allGroups);

  const depth = mode === 'overview' ? group.level - 1 : 0;
  const isDropTarget = dragOverGroupId === group.id;

  const handleAddChildGroup = async () => {
    if (!drawingId || group.level >= 5) return;
    await onAddGroup(drawingId, '新規項目', group.id, group.level + 1);
    if (mode === 'overview' && !isExpanded) onToggleExpand(group.id);
  };

  const handleDetailClick = () => {
    if (mode === 'detail' && onNavigateInto) {
      onNavigateInto(group.id);
    } else {
      onToggleExpand(group.id);
    }
  };

  const childCount = childGroups.length + directItems.length;

  const isReorderTarget = dropTarget?.id === group.id && dropTarget?.type === 'group';

  return (
    <>
      {isReorderTarget && dropTarget.pos === 'before' && (
        <tr><td colSpan={colCount} className="h-[2px] bg-[#0099CB] p-0" /></tr>
      )}
      <tr
        className={cn(
          'border-b border-gray-200 hover:bg-gray-50 group/row transition-colors',
          isDropTarget && 'bg-[#E0F4FA] ring-2 ring-inset ring-[#0099CB]'
        )}
        draggable
        onDragStart={(e) => onDragStart(e, group.id, 'group')}
        onDragEnd={onDragEnd}
        onDragOver={isDragging ? (e) => { onDragOverGroup(e, group.id); onRowDragOver(e, group.id, 'group'); } : undefined}
        onDragLeave={isDragging ? () => { onDragLeaveGroup(); onRowDragLeave(); } : undefined}
        onDrop={isDragging ? (e) => onRowDrop(e, group.id, 'group', group.parentId ?? undefined) : undefined}
      >
        {/* マスタ参照（グループは空） */}
        <td className="px-1 py-1.5 border-r border-gray-100" />

        {/* Checkbox */}
        <td className="py-1.5 text-center border-r border-gray-100" style={{ paddingLeft: depth * INDENT_PX + 4, paddingRight: 4 }}>
          <input
            type="checkbox"
            checked={checkedGroupIds.has(group.id)}
            onChange={() => onToggleGroupCheck(group.id)}
            className="rounded border-gray-300 text-[#0099CB]"
          />
        </td>

        {/* 明細 */}
        <td className="px-2 py-1.5 border-r border-gray-100">
          <div className="flex items-center gap-1">
            <select
              value={group.hasDetail ? 'yes' : 'no'}
              onChange={(e) => onUpdateGroup(group.id, { hasDetail: e.target.value === 'yes' })}
              className="text-[10px] bg-gray-100 border border-gray-200 rounded px-1 py-0.5"
            >
              <option value="yes">明細あり</option>
              <option value="no">明細なし</option>
            </select>
            <button
              onClick={handleDetailClick}
              className={cn(
                'px-1.5 py-0.5 text-white text-[10px] rounded transition-colors flex items-center gap-0.5',
                mode === 'detail' ? 'bg-[#0099CB] hover:bg-[#0088B4]' : 'bg-[#52555F] hover:bg-[#3d4049]'
              )}
            >
              {mode === 'overview' ? (
                <>{isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}明細</>
              ) : (
                <><ChevronRight size={10} />明細 ({childCount})</>
              )}
            </button>
          </div>
        </td>

        {/* 大項目 */}
        <td className="px-2 py-1.5 border-r border-gray-100">
          <div className="flex items-center gap-1">
            <input
              type="text"
              defaultValue={group.name}
              onBlur={(e) => onUpdateGroup(group.id, { name: e.target.value })}
              className="w-full text-sm font-bold text-gray-800 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-[#0099CB] outline-none"
            />
            {group.level < 5 && (
              <button onClick={handleAddChildGroup} className="opacity-0 group-hover/row:opacity-100 p-0.5 text-gray-400 hover:text-[#0099CB] transition-all" title="子項目追加">
                <Plus size={12} />
              </button>
            )}
            <button
              onClick={() => onRequestConfirm(`「${group.name}」グループと、その中の子要素をすべて削除しますか？`, () => onDeleteGroup(group.id))}
              className="opacity-0 group-hover/row:opacity-100 p-0.5 text-gray-400 hover:text-red-500 transition-all"
              title="グループ削除"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </td>

        <td className="px-2 py-1.5 border-r border-gray-100 text-xs text-gray-400">-</td>
        <td className="px-2 py-1.5 border-r border-gray-100 text-xs text-gray-400">-</td>
        <td className="px-2 py-1.5 border-r border-gray-100 text-xs text-gray-400">-</td>

        {/* 数量 */}
        <td className="px-2 py-1.5 border-r border-gray-100 text-center text-sm font-mono">
          {fmtNum(totals.quantity)}
        </td>

        {/* 単位 */}
        <td className="px-2 py-1.5 border-r border-gray-100 text-center text-sm">式</td>

        {/* 単価 */}
        <td className="px-2 py-1.5 border-r border-gray-100 text-right text-sm font-mono">
          {fmtNum(totals.amount)}
        </td>

        {/* 金額 */}
        <td className="px-2 py-1.5 border-r border-gray-100 text-right text-sm font-mono font-bold">
          {fmtNum(totals.amount)}
        </td>

        {/* 備考 */}
        <td className="px-2 py-1.5 border-r border-gray-100 text-xs text-gray-400">-</td>

        {/* カスタムカラム */}
        {customColumns.map(col => (
          <td key={col.id} className="px-2 py-1.5 border-r border-gray-100 text-xs text-gray-400">-</td>
        ))}
        {/* ＋ボタン列 */}
        <td className="px-1 py-1.5" />
      </tr>
      {isReorderTarget && dropTarget.pos === 'after' && (
        <tr><td colSpan={colCount} className="h-[2px] bg-[#0099CB] p-0" /></tr>
      )}

      {/* Expanded children（全体モードのみ） */}
      {mode === 'overview' && isExpanded && (
        <>
          {childGroups.map((childGroup) => (
            <GroupRow
              key={childGroup.id}
              group={childGroup}
              allGroups={allGroups}
              allItems={allItems}
              selectedItemIds={selectedItemIds}
              expandedGroupIds={expandedGroupIds}
              checkedGroupIds={checkedGroupIds}
              onToggleExpand={onToggleExpand}
              onToggleItemSelection={onToggleItemSelection}
              onToggleGroupCheck={onToggleGroupCheck}
              onUpdateItem={onUpdateItem}
              onDeleteItem={onDeleteItem}
              onUpdateGroup={onUpdateGroup}
              onDeleteGroup={onDeleteGroup}
              onAddGroup={onAddGroup}
              onRequestConfirm={onRequestConfirm}
              drawingId={drawingId}
              dragOverGroupId={dragOverGroupId}
              isDragging={isDragging}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragOverGroup={onDragOverGroup}
              onDragLeaveGroup={onDragLeaveGroup}
              onDropOnGroup={onDropOnGroup}
              mode="overview"
              customColumns={customColumns}
              colCount={colCount}
              dropTarget={dropTarget}
              onRowDragOver={onRowDragOver}
              onRowDragLeave={onRowDragLeave}
              onRowDrop={onRowDrop}
              getW={getW}
              onOpenMaterialPicker={onOpenMaterialPicker}
            />
          ))}
          {directItems.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              depth={group.level}
              selected={selectedItemIds.has(item.id)}
              onToggleSelection={onToggleItemSelection}
              onUpdate={onUpdateItem}
              onDelete={onDeleteItem}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              drawingId={drawingId}
              onAddGroup={onAddGroup}
              onRequestConfirm={onRequestConfirm}
              customColumns={customColumns}
              dropTarget={dropTarget}
              onRowDragOver={onRowDragOver}
              onRowDragLeave={onRowDragLeave}
              onRowDrop={onRowDrop}
              onOpenMaterialPicker={onOpenMaterialPicker}
            />
          ))}
        </>
      )}
    </>
  );
}

// ========== ItemRow ==========
interface ItemRowProps {
  item: TakeoffItem;
  depth: number;
  selected: boolean;
  onToggleSelection: (id: string) => void;
  onUpdate: (id: string, updates: Partial<TakeoffItem>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onDragStart: (e: React.DragEvent, itemId: string, sourceType?: 'item' | 'group') => void;
  onDragEnd: () => void;
  drawingId?: string;
  onAddGroup: (drawingId: string, name: string, parentId: string | null, level: number) => Promise<TakeoffGroup>;
  onRequestConfirm: (message: string, onConfirm: () => void) => void;
  customColumns: CustomColumn[];
  dropTarget: { id: string; pos: 'before' | 'after'; type: 'item' | 'group' } | null;
  onRowDragOver: (e: React.DragEvent, targetId: string, targetType: 'item' | 'group') => void;
  onRowDragLeave: () => void;
  onRowDrop: (e: React.DragEvent, targetId: string, targetType: 'item' | 'group', parentGroupId: string | undefined) => Promise<void>;
  onOpenMaterialPicker: (itemId: string) => void;
}

function ItemRow({ item, depth, selected, onToggleSelection, onUpdate, onDelete, onDragStart, onDragEnd, drawingId, onAddGroup, onRequestConfirm, customColumns, dropTarget, onRowDragOver, onRowDragLeave, onRowDrop, onOpenMaterialPicker }: ItemRowProps) {
  const handleConvertToGroup = useCallback(async () => {
    if (!drawingId) return;
    const parentId = item.groupId || null;
    const level = depth + 1;
    await onAddGroup(drawingId, item.itemType, parentId, level);
    await onDelete(item.id);
  }, [drawingId, item.groupId, item.itemType, item.id, depth, onAddGroup, onDelete]);

  const isReorderTarget = dropTarget?.id === item.id && dropTarget?.type === 'item';

  return (
    <>
    {isReorderTarget && dropTarget.pos === 'before' && (
      <tr><td colSpan={99} className="h-[2px] bg-[#0099CB] p-0" /></tr>
    )}
    <tr
      className={cn(
        'border-b border-gray-100 hover:bg-blue-50/30 group/item transition-colors',
        selected && 'bg-blue-50'
      )}
      draggable
      onDragStart={(e) => onDragStart(e, item.id, 'item')}
      onDragEnd={onDragEnd}
      onDragOver={(e) => onRowDragOver(e, item.id, 'item')}
      onDragLeave={onRowDragLeave}
      onDrop={(e) => onRowDrop(e, item.id, 'item', item.groupId)}
    >
      {/* マスタ参照ボタン */}
      <td className="px-1 py-1.5 border-r border-gray-100 text-center">
        <button
          onClick={() => onOpenMaterialPicker(item.id)}
          className="inline-flex items-center gap-0.5 px-1.5 py-1 text-[10px] font-medium text-white bg-[#0099CB] hover:bg-[#0088B4] rounded transition-colors whitespace-nowrap"
          title="部材マスタから選択"
        >
          <Database size={10} />
          マスタ参照
        </button>
      </td>

      {/* Checkbox + drag handle */}
      <td className="py-1.5 text-center border-r border-gray-100" style={{ paddingLeft: depth * INDENT_PX + 4, paddingRight: 4 }}>
        <div className="flex items-center justify-center gap-0.5">
          <GripVertical size={10} className="text-gray-300 cursor-grab flex-shrink-0" />
          <input type="checkbox" checked={selected} onChange={() => onToggleSelection(item.id)} className="rounded border-gray-300 text-[#0099CB]" />
        </div>
      </td>

      {/* 明細 */}
      <td className="px-2 py-1.5 border-r border-gray-100">
        <select
          value="no"
          onChange={(e) => { if (e.target.value === 'yes') handleConvertToGroup(); }}
          className="text-[10px] bg-gray-100 border border-gray-200 rounded px-1 py-0.5"
        >
          <option value="yes">明細あり</option>
          <option value="no">明細なし</option>
        </select>
      </td>

      {/* 大項目 */}
      <td className="px-2 py-1.5 border-r border-gray-100">
        <div className="flex items-center gap-1">
          <input
            type="text"
            defaultValue={item.itemType}
            onBlur={(e) => onUpdate(item.id, { itemType: e.target.value })}
            className="w-full text-sm text-gray-800 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-[#0099CB] outline-none"
          />
          <button
            onClick={() => onRequestConfirm(`「${item.itemType}」を削除しますか？`, () => onDelete(item.id))}
            className="opacity-0 group-hover/item:opacity-100 p-0.5 text-gray-400 hover:text-red-500 transition-all flex-shrink-0"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </td>

      {/* 仕様 */}
      <td className="px-2 py-1.5 border-r border-gray-100">
        <textarea
          defaultValue={item.specification || ''}
          onBlur={(e) => onUpdate(item.id, { specification: e.target.value })}
          rows={2}
          maxLength={40}
          placeholder="仕様"
          className="w-full text-xs text-gray-700 bg-transparent border border-transparent hover:border-gray-200 focus:border-[#0099CB] rounded px-1 py-0.5 resize-none outline-none"
        />
      </td>

      {/* 型番 */}
      <td className="px-2 py-1.5 border-r border-gray-100">
        <input
          type="text"
          defaultValue={item.modelNumber || ''}
          onBlur={(e) => onUpdate(item.id, { modelNumber: e.target.value })}
          placeholder="型番"
          className="w-full text-xs text-gray-700 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-[#0099CB] outline-none"
        />
      </td>

      {/* 規格 */}
      <td className="px-2 py-1.5 border-r border-gray-100">
        <input
          type="text"
          defaultValue={item.standard || ''}
          onBlur={(e) => onUpdate(item.id, { standard: e.target.value })}
          placeholder="規格"
          className="w-full text-xs text-gray-700 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-[#0099CB] outline-none"
        />
      </td>

      {/* 数量 */}
      <td className="px-2 py-1.5 border-r border-gray-100 text-center">
        <input
          type="number"
          defaultValue={item.quantity}
          onBlur={(e) => {
            const q = parseFloat(e.target.value) || 0;
            onUpdate(item.id, { quantity: q });
          }}
          className="w-full text-sm font-mono text-center bg-transparent border-b border-transparent hover:border-gray-300 focus:border-[#0099CB] outline-none"
        />
      </td>

      {/* 単位 */}
      <td className="px-1 py-1.5 border-r border-gray-100 text-center">
        <select
          defaultValue={item.unit}
          onChange={(e) => onUpdate(item.id, { unit: e.target.value })}
          className="w-full text-xs bg-transparent border-none outline-none cursor-pointer text-center"
        >
          {TAKEOFF_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
      </td>

      {/* 単価 */}
      <td className="px-2 py-1.5 border-r border-gray-100 text-right">
        <input
          type="number"
          defaultValue={item.unitPrice || ''}
          onBlur={(e) => {
            const up = parseFloat(e.target.value) || 0;
            onUpdate(item.id, { unitPrice: up });
          }}
          placeholder="0"
          className="w-full text-sm font-mono text-right bg-transparent border-b border-transparent hover:border-gray-300 focus:border-[#0099CB] outline-none"
        />
      </td>

      {/* 金額 */}
      <td className="px-2 py-1.5 border-r border-gray-100 text-right text-sm font-mono font-bold">
        {fmtNum(item.amount)}
      </td>

      {/* 備考 */}
      <td className="px-2 py-1.5 border-r border-gray-100">
        <textarea
          defaultValue={item.remarks || ''}
          onBlur={(e) => onUpdate(item.id, { remarks: e.target.value })}
          rows={2}
          maxLength={40}
          placeholder="備考"
          className="w-full text-xs text-gray-700 bg-transparent border border-transparent hover:border-gray-200 focus:border-[#0099CB] rounded px-1 py-0.5 resize-none outline-none"
        />
      </td>

      {/* カスタムカラム */}
      {customColumns.map(col => (
        <td key={col.id} className="px-2 py-1.5 border-r border-gray-100">
          <input
            type={col.type === 'number' ? 'number' : 'text'}
            defaultValue={item.customFields?.[col.id] || ''}
            onBlur={(e) => {
              onUpdate(item.id, {
                customFields: { ...item.customFields, [col.id]: e.target.value },
              });
            }}
            className="w-full text-xs text-gray-700 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-[#0099CB] outline-none"
          />
        </td>
      ))}
      {/* ＋ボタン列 */}
      <td className="px-1 py-1.5" />
    </tr>
    {isReorderTarget && dropTarget.pos === 'after' && (
      <tr><td colSpan={99} className="h-[2px] bg-[#0099CB] p-0" /></tr>
    )}
    </>
  );
}
