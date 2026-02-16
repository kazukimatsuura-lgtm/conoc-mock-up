'use client';

import { useMemo, useCallback } from 'react';
import {
  ChevronRight,
  ChevronDown,
  FolderOpen,
  Folder,
  FileText,
  Plus,
  ChevronsUpDown,
  ChevronsDownUp,
} from 'lucide-react';
import { useGroupStore } from '@/stores/group-store';
import { useTakeoffStore } from '@/stores/takeoff-store';
import { cn } from '@/lib/utils';
import type { TakeoffGroup, TakeoffItem } from '@/types';
import { TAKEOFF_CATEGORIES } from '@/types/takeoff';

// カテゴリ色マップ
const CATEGORY_COLORS: Record<string, string> = {
  electrical: '#ef4444',
  hvac: '#10b981',
  plumbing: '#3b82f6',
  fire: '#f59e0b',
  structure: '#8b5cf6',
  finish: '#ec4899',
  exterior: '#06b6d4',
  elevator: '#6366f1',
  communication: '#14b8a6',
};

interface TreeNodeData {
  type: 'group' | 'item';
  group?: TakeoffGroup;
  item?: TakeoffItem;
  children: TreeNodeData[];
  depth: number;
}

interface TreePanelProps {
  drawingId?: string;
}

export function TreePanel({ drawingId }: TreePanelProps) {
  const { groups, expandedGroupIds, toggleExpand, expandAll, collapseAll, addGroup } = useGroupStore();
  const { items, selectedItemIds, selectItem, toggleItemSelection } = useTakeoffStore();

  // 現在の図面のグループ・アイテムをフィルタ
  const drawingGroups = useMemo(
    () => groups.filter(g => g.drawingId === drawingId).sort((a, b) => a.order - b.order),
    [groups, drawingId]
  );
  const drawingItems = useMemo(
    () => items.filter(i => i.drawingId === drawingId),
    [items, drawingId]
  );

  // ツリー構造を組み立て
  const tree = useMemo(() => {
    const buildChildren = (parentId: string | null, depth: number): TreeNodeData[] => {
      const childGroups = drawingGroups
        .filter(g => g.parentId === parentId)
        .sort((a, b) => a.order - b.order);

      const nodes: TreeNodeData[] = [];

      for (const group of childGroups) {
        const groupChildren = buildChildren(group.id, depth + 1);
        // このグループに直接属するアイテム
        const groupItems = drawingItems
          .filter(i => i.groupId === group.id)
          .map(item => ({
            type: 'item' as const,
            item,
            children: [],
            depth: depth + 1,
          }));
        nodes.push({
          type: 'group',
          group,
          children: [...groupChildren, ...groupItems],
          depth,
        });
      }

      return nodes;
    };

    const rootNodes = buildChildren(null, 0);

    // グループに属さないアイテム（ルート直下）
    const ungroupedItems = drawingItems
      .filter(i => !i.groupId)
      .map(item => ({
        type: 'item' as const,
        item,
        children: [],
        depth: 0,
      }));

    return [...rootNodes, ...ungroupedItems];
  }, [drawingGroups, drawingItems]);

  const handleAddRootGroup = useCallback(async () => {
    if (!drawingId) return;
    await addGroup(drawingId, '新規グループ', null, 1);
  }, [drawingId, addGroup]);

  const totalItems = drawingItems.length;
  const totalGroups = drawingGroups.length;

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <FolderOpen size={14} className="text-[#0088B4]" />
          <span className="text-xs font-medium text-gray-700">ツリー</span>
          <span className="text-[10px] text-gray-400 ml-1">
            {totalGroups}グループ / {totalItems}項目
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={expandAll}
            className="p-1 hover:bg-gray-200 rounded transition-colors text-gray-500"
            title="全展開"
          >
            <ChevronsUpDown size={13} />
          </button>
          <button
            onClick={collapseAll}
            className="p-1 hover:bg-gray-200 rounded transition-colors text-gray-500"
            title="全折りたたみ"
          >
            <ChevronsDownUp size={13} />
          </button>
          <button
            onClick={handleAddRootGroup}
            className="p-1 hover:bg-gray-200 rounded transition-colors text-gray-500"
            title="グループ追加"
          >
            <Plus size={13} />
          </button>
        </div>
      </div>

      {/* Tree Body */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-1 text-[13px]">
        {tree.length === 0 ? (
          <div className="px-3 py-8 text-center text-xs text-gray-400">
            <FolderOpen size={24} className="mx-auto mb-2 text-gray-300" />
            <p>項目がありません</p>
            <p className="mt-1">AI拾い出しまたは手動で追加してください</p>
          </div>
        ) : (
          tree.map((node, idx) => (
            <TreeNode
              key={node.type === 'group' ? node.group!.id : node.item!.id}
              node={node}
              expandedGroupIds={expandedGroupIds}
              toggleExpand={toggleExpand}
              selectedItemIds={selectedItemIds}
              selectItem={selectItem}
              toggleItemSelection={toggleItemSelection}
              drawingId={drawingId}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── 再帰ツリーノード ──

interface TreeNodeProps {
  node: TreeNodeData;
  expandedGroupIds: Set<string>;
  toggleExpand: (id: string) => void;
  selectedItemIds: Set<string>;
  selectItem: (id: string, multi?: boolean) => void;
  toggleItemSelection: (id: string) => void;
  drawingId?: string;
}

function TreeNode({
  node,
  expandedGroupIds,
  toggleExpand,
  selectedItemIds,
  selectItem,
  toggleItemSelection,
  drawingId,
}: TreeNodeProps) {
  if (node.type === 'group' && node.group) {
    return (
      <GroupNode
        node={node}
        expandedGroupIds={expandedGroupIds}
        toggleExpand={toggleExpand}
        selectedItemIds={selectedItemIds}
        selectItem={selectItem}
        toggleItemSelection={toggleItemSelection}
        drawingId={drawingId}
      />
    );
  }

  if (node.type === 'item' && node.item) {
    return (
      <ItemNode
        node={node}
        selectedItemIds={selectedItemIds}
        selectItem={selectItem}
        toggleItemSelection={toggleItemSelection}
      />
    );
  }

  return null;
}

// ── グループノード ──

function GroupNode({
  node,
  expandedGroupIds,
  toggleExpand,
  selectedItemIds,
  selectItem,
  toggleItemSelection,
  drawingId,
}: TreeNodeProps) {
  const group = node.group!;
  const isExpanded = expandedGroupIds.has(group.id);
  const hasChildren = node.children.length > 0;
  const categoryColor = CATEGORY_COLORS[group.name.toLowerCase()] || getCategoryColorByLabel(group.name);

  // 子アイテム数を再帰カウント
  const childItemCount = useMemo(() => {
    const count = (n: TreeNodeData): number => {
      let c = 0;
      for (const child of n.children) {
        if (child.type === 'item') c++;
        else c += count(child);
      }
      return c;
    };
    return count(node);
  }, [node]);

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-0.5 py-[3px] pr-2 cursor-pointer hover:bg-[#E8F4FD] select-none',
        )}
        style={{ paddingLeft: `${node.depth * 16 + 4}px` }}
        onClick={() => {
          if (hasChildren) toggleExpand(group.id);
        }}
      >
        {/* 展開/折りたたみ矢印 */}
        <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown size={13} className="text-gray-500" />
            ) : (
              <ChevronRight size={13} className="text-gray-500" />
            )
          ) : (
            <span className="w-3" />
          )}
        </span>

        {/* フォルダアイコン */}
        {isExpanded ? (
          <FolderOpen size={15} className="flex-shrink-0" style={{ color: categoryColor }} />
        ) : (
          <Folder size={15} className="flex-shrink-0" style={{ color: categoryColor }} />
        )}

        {/* グループ名 */}
        <span className="ml-1 truncate text-gray-800 font-medium">
          {group.name}
        </span>

        {/* 子アイテム数バッジ */}
        {childItemCount > 0 && (
          <span className="ml-auto text-[10px] text-gray-400 flex-shrink-0 bg-gray-100 px-1.5 rounded-full">
            {childItemCount}
          </span>
        )}
      </div>

      {/* 子ノード */}
      {isExpanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.type === 'group' ? child.group!.id : child.item!.id}
              node={child}
              expandedGroupIds={expandedGroupIds}
              toggleExpand={toggleExpand}
              selectedItemIds={selectedItemIds}
              selectItem={selectItem}
              toggleItemSelection={toggleItemSelection}
              drawingId={drawingId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── アイテムノード（葉） ──

function ItemNode({
  node,
  selectedItemIds,
  selectItem,
  toggleItemSelection,
}: {
  node: TreeNodeData;
  selectedItemIds: Set<string>;
  selectItem: (id: string, multi?: boolean) => void;
  toggleItemSelection: (id: string) => void;
}) {
  const item = node.item!;
  const isSelected = selectedItemIds.has(item.id);
  const categoryColor = CATEGORY_COLORS[item.category] || '#6b7280';

  return (
    <div
      className={cn(
        'flex items-center gap-0.5 py-[3px] pr-2 cursor-pointer select-none',
        isSelected
          ? 'bg-[#0099CB]/15 text-[#006A8E]'
          : 'hover:bg-[#E8F4FD] text-gray-700'
      )}
      style={{ paddingLeft: `${node.depth * 16 + 4}px` }}
      onClick={(e) => {
        if (e.ctrlKey || e.metaKey) {
          toggleItemSelection(item.id);
        } else {
          selectItem(item.id);
        }
      }}
    >
      {/* 矢印のスペーサー */}
      <span className="w-4 h-4 flex-shrink-0" />

      {/* アイテムアイコン */}
      <FileText size={14} className="flex-shrink-0" style={{ color: categoryColor }} />

      {/* アイテム名 */}
      <span className="ml-1 truncate">
        {item.itemType}
      </span>

      {/* 数量 */}
      <span className="ml-auto text-[10px] text-gray-400 flex-shrink-0 font-mono">
        {item.quantity}{item.unit}
      </span>
    </div>
  );
}

// ── ヘルパー ──

function getCategoryColorByLabel(name: string): string {
  const cat = TAKEOFF_CATEGORIES.find(c => c.label === name);
  if (cat) return CATEGORY_COLORS[cat.id] || '#6b7280';
  return '#6b7280';
}
