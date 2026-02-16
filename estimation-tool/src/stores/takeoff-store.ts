import { create } from 'zustand';
import type { TakeoffItem, ItemLocation, AiDetectedItem } from '@/types';
import {
  getTakeoffItemsByDrawing,
  createTakeoffItem as dbCreateTakeoffItem,
  createTakeoffItemsBatch as dbCreateTakeoffItemsBatch,
  updateTakeoffItem as dbUpdateTakeoffItem,
  deleteTakeoffItem as dbDeleteTakeoffItem,
  deleteTakeoffItemsBatch as dbDeleteTakeoffItemsBatch,
} from '@/lib/db';
import { generateId } from '@/lib/utils';

// History action types for undo/redo
type HistoryAction =
  | { type: 'add'; item: TakeoffItem }
  | { type: 'delete'; item: TakeoffItem }
  | { type: 'update'; oldItem: TakeoffItem; newItem: TakeoffItem }
  | { type: 'addMultiple'; items: TakeoffItem[] };

const MAX_HISTORY = 50;

interface AddItemInput {
  category: string;
  itemType: string;
  quantity: number;
  unit: string;
  unitPrice?: number;
  amount?: number;
  confidence?: number;
  source?: 'manual' | 'ai';
  locations?: ItemLocation[];
  groupId?: string;
  specification?: string;
  modelNumber?: string;
  standard?: string;
  remarks?: string;
  internalMemo?: string;
  costQuantity?: number;
  costUnit?: string;
  costUnitPrice?: number;
  costAmount?: number;
}

// 粗利自動計算ヘルパー
function calcGrossProfit(amount?: number, costAmount?: number): { grossProfit?: number; grossProfitRate?: number } {
  if (amount == null || costAmount == null) return {};
  const grossProfit = amount - costAmount;
  const grossProfitRate = amount > 0 ? Math.round((grossProfit / amount) * 10000) / 100 : 0;
  return { grossProfit, grossProfitRate };
}

interface TakeoffState {
  items: TakeoffItem[];
  selectedItemIds: Set<string>;
  isLoading: boolean;
  error: string | null;
  currentDrawingId: string | null;

  // History for undo/redo
  history: HistoryAction[];
  historyIndex: number;
  canUndo: boolean;
  canRedo: boolean;

  // Actions
  loadItems: (drawingId: string) => Promise<void>;
  addItem: (input: AddItemInput) => Promise<TakeoffItem | null>;
  addPointItem: (drawingId: string, location: ItemLocation, itemType: string, category: string) => Promise<TakeoffItem>;
  addLineItem: (drawingId: string, start: ItemLocation, end: ItemLocation, length: number, itemType: string, category: string) => Promise<TakeoffItem>;
  addAreaItem: (drawingId: string, points: ItemLocation[], area: number, itemType: string, category: string) => Promise<TakeoffItem>;
  addRectItem: (drawingId: string, topLeft: ItemLocation, width: number, height: number, area: number, itemType: string, category: string) => Promise<TakeoffItem>;
  addAiItems: (drawingId: string, aiItems: AiDetectedItem[], groupIdMap?: Record<string, string>) => Promise<TakeoffItem[]>;
  updateItem: (id: string, updates: Partial<TakeoffItem>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  deleteSelectedItems: () => Promise<void>;
  selectItem: (id: string, multi?: boolean) => void;
  deselectAll: () => void;
  toggleItemSelection: (id: string) => void;

  // Reorder
  reorderItems: (groupId: string | undefined, orderedIds: string[]) => Promise<void>;

  // Undo/Redo
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  clearHistory: () => void;
}

export const useTakeoffStore = create<TakeoffState>((set, get) => ({
  items: [],
  selectedItemIds: new Set(),
  isLoading: false,
  error: null,
  currentDrawingId: null,

  // History state
  history: [],
  historyIndex: -1,
  canUndo: false,
  canRedo: false,

  loadItems: async (drawingId: string) => {
    set({ isLoading: true, error: null, currentDrawingId: drawingId });
    try {
      const items = await getTakeoffItemsByDrawing(drawingId);
      set({ items, isLoading: false, history: [], historyIndex: -1, canUndo: false, canRedo: false });
    } catch (error) {
      set({ error: '拾い出しデータの読み込みに失敗しました', isLoading: false });
    }
  },

  addItem: async (input: AddItemInput) => {
    const { currentDrawingId } = get();
    if (!currentDrawingId) {
      console.error('[TakeoffStore] No current drawing ID');
      return null;
    }

    const now = new Date().toISOString();
    const amount = input.amount || (input.quantity * (input.unitPrice || 0));
    const costAmount = input.costAmount || ((input.costQuantity || 0) * (input.costUnitPrice || 0)) || undefined;
    const profit = calcGrossProfit(amount, costAmount);

    const item: TakeoffItem = {
      id: generateId(),
      drawingId: currentDrawingId,
      groupId: input.groupId,
      itemType: input.itemType,
      category: input.category,
      specification: input.specification,
      modelNumber: input.modelNumber,
      standard: input.standard,
      quantity: input.quantity,
      unit: input.unit,
      unitPrice: input.unitPrice,
      amount,
      costQuantity: input.costQuantity,
      costUnit: input.costUnit,
      costUnitPrice: input.costUnitPrice,
      costAmount,
      grossProfit: profit.grossProfit,
      grossProfitRate: profit.grossProfitRate,
      remarks: input.remarks,
      internalMemo: input.internalMemo,
      locations: input.locations || [],
      confidence: input.confidence ?? 1,
      source: input.source || 'manual',
      createdAt: now,
      updatedAt: now,
    };

    try {
      await dbCreateTakeoffItem(item);
      console.log('[TakeoffStore] Manual item saved:', item.id);
    } catch (err) {
      console.error('[TakeoffStore] Failed to save manual item:', err);
      return null;
    }

    set((state) => {
      const newHistory = [...state.history.slice(0, state.historyIndex + 1), { type: 'add' as const, item }];
      if (newHistory.length > MAX_HISTORY) newHistory.shift();
      return {
        items: [...state.items, item],
        history: newHistory,
        historyIndex: newHistory.length - 1,
        canUndo: true,
        canRedo: false,
      };
    });

    return item;
  },

  addPointItem: async (drawingId, location, itemType, category) => {
    console.log('[TakeoffStore] addPointItem called:', { drawingId, location, itemType, category });
    const now = new Date().toISOString();
    const item: TakeoffItem = {
      id: generateId(),
      drawingId,
      itemType,
      category,
      quantity: 1,
      unit: '個',
      locations: [location],
      confidence: 1,
      source: 'manual',
      createdAt: now,
      updatedAt: now,
    };

    try {
      await dbCreateTakeoffItem(item);
      console.log('[TakeoffStore] Item saved to DB:', item.id);
    } catch (err) {
      console.error('[TakeoffStore] Failed to save item:', err);
    }

    set((state) => {
      const newHistory = [...state.history.slice(0, state.historyIndex + 1), { type: 'add' as const, item }];
      if (newHistory.length > MAX_HISTORY) newHistory.shift();
      return {
        items: [...state.items, item],
        history: newHistory,
        historyIndex: newHistory.length - 1,
        canUndo: true,
        canRedo: false,
      };
    });
    console.log('[TakeoffStore] Item added to state');
    return item;
  },

  addLineItem: async (drawingId, start, end, length, itemType, category) => {
    const now = new Date().toISOString();
    const item: TakeoffItem = {
      id: generateId(),
      drawingId,
      itemType,
      category,
      quantity: length,
      unit: 'm',
      locations: [start, end],
      dimensions: { length },
      confidence: 1,
      source: 'manual',
      createdAt: now,
      updatedAt: now,
    };

    await dbCreateTakeoffItem(item);
    set((state) => {
      const newHistory = [...state.history.slice(0, state.historyIndex + 1), { type: 'add' as const, item }];
      if (newHistory.length > MAX_HISTORY) newHistory.shift();
      return {
        items: [...state.items, item],
        history: newHistory,
        historyIndex: newHistory.length - 1,
        canUndo: true,
        canRedo: false,
      };
    });
    return item;
  },

  addAreaItem: async (drawingId, points, area, itemType, category) => {
    const now = new Date().toISOString();
    const item: TakeoffItem = {
      id: generateId(),
      drawingId,
      itemType,
      category,
      quantity: area,
      unit: 'm²',
      locations: points,
      dimensions: { area },
      confidence: 1,
      source: 'manual',
      createdAt: now,
      updatedAt: now,
    };

    await dbCreateTakeoffItem(item);
    set((state) => {
      const newHistory = [...state.history.slice(0, state.historyIndex + 1), { type: 'add' as const, item }];
      if (newHistory.length > MAX_HISTORY) newHistory.shift();
      return {
        items: [...state.items, item],
        history: newHistory,
        historyIndex: newHistory.length - 1,
        canUndo: true,
        canRedo: false,
      };
    });
    return item;
  },

  addRectItem: async (drawingId, topLeft, width, height, area, itemType, category) => {
    const now = new Date().toISOString();
    const item: TakeoffItem = {
      id: generateId(),
      drawingId,
      itemType,
      category,
      quantity: area,
      unit: 'm²',
      locations: [topLeft],
      dimensions: { width, height, area },
      confidence: 1,
      source: 'manual',
      createdAt: now,
      updatedAt: now,
    };

    await dbCreateTakeoffItem(item);
    set((state) => {
      const newHistory = [...state.history.slice(0, state.historyIndex + 1), { type: 'add' as const, item }];
      if (newHistory.length > MAX_HISTORY) newHistory.shift();
      return {
        items: [...state.items, item],
        history: newHistory,
        historyIndex: newHistory.length - 1,
        canUndo: true,
        canRedo: false,
      };
    });
    return item;
  },

  addAiItems: async (drawingId, aiItems, groupIdMap) => {
    const now = new Date().toISOString();

    // 全アイテムを一括で作成
    const newItems: TakeoffItem[] = aiItems.map(aiItem => ({
      id: generateId(),
      drawingId,
      groupId: groupIdMap?.[aiItem.category],
      itemType: aiItem.itemType,
      category: aiItem.category,
      specification: aiItem.specification,
      modelNumber: aiItem.modelNumber,
      standard: aiItem.standard,
      remarks: aiItem.remarks,
      quantity: aiItem.quantity,
      unit: aiItem.unit,
      locations: aiItem.locations.map(loc => ({
        x: loc.x,
        y: loc.y,
        roomName: loc.label,
      })),
      confidence: aiItem.confidence,
      source: 'ai' as const,
      createdAt: now,
      updatedAt: now,
    }));

    // バッチ保存（パフォーマンス改善）
    try {
      await dbCreateTakeoffItemsBatch(newItems);
      console.log(`[TakeoffStore] Batch saved ${newItems.length} AI items`);
    } catch (err) {
      console.error('[TakeoffStore] Failed to batch save AI items:', err);
      return [];
    }

    set((state) => {
      const newHistory = [...state.history.slice(0, state.historyIndex + 1), { type: 'addMultiple' as const, items: newItems }];
      if (newHistory.length > MAX_HISTORY) newHistory.shift();
      return {
        items: [...state.items, ...newItems],
        history: newHistory,
        historyIndex: newHistory.length - 1,
        canUndo: true,
        canRedo: false,
      };
    });
    return newItems;
  },

  updateItem: async (id, updates) => {
    const { items } = get();
    const oldItem = items.find(item => item.id === id);
    if (!oldItem) return;

    // 粗利自動計算
    const newAmount = updates.amount ?? oldItem.amount;
    const newCostAmount = updates.costAmount ?? oldItem.costAmount;
    // costQuantity/costUnitPriceが変更された場合、costAmountも再計算
    let computedCostAmount = newCostAmount;
    if (updates.costQuantity != null || updates.costUnitPrice != null) {
      const cq = updates.costQuantity ?? oldItem.costQuantity ?? 0;
      const cup = updates.costUnitPrice ?? oldItem.costUnitPrice ?? 0;
      computedCostAmount = cq * cup;
      updates.costAmount = computedCostAmount;
    }
    // quantity/unitPriceが変更された場合、amountも再計算
    if (updates.quantity != null || updates.unitPrice != null) {
      const q = updates.quantity ?? oldItem.quantity;
      const up = updates.unitPrice ?? oldItem.unitPrice ?? 0;
      updates.amount = q * up;
    }

    const finalAmount = updates.amount ?? newAmount;
    const finalCostAmount = updates.costAmount ?? computedCostAmount;
    const profit = calcGrossProfit(finalAmount, finalCostAmount);
    if (profit.grossProfit != null) {
      updates.grossProfit = profit.grossProfit;
      updates.grossProfitRate = profit.grossProfitRate;
    }

    const newItem = { ...oldItem, ...updates, updatedAt: new Date().toISOString() };

    await dbUpdateTakeoffItem(id, updates);
    set((state) => {
      const newHistory = [...state.history.slice(0, state.historyIndex + 1), { type: 'update' as const, oldItem, newItem }];
      if (newHistory.length > MAX_HISTORY) newHistory.shift();
      return {
        items: state.items.map((item) => item.id === id ? newItem : item),
        history: newHistory,
        historyIndex: newHistory.length - 1,
        canUndo: true,
        canRedo: false,
      };
    });
  },

  deleteItem: async (id) => {
    const { items } = get();
    const deletedItem = items.find(item => item.id === id);
    if (!deletedItem) return;

    await dbDeleteTakeoffItem(id);
    set((state) => {
      const newHistory = [...state.history.slice(0, state.historyIndex + 1), { type: 'delete' as const, item: deletedItem }];
      if (newHistory.length > MAX_HISTORY) newHistory.shift();
      return {
        items: state.items.filter((item) => item.id !== id),
        selectedItemIds: new Set([...state.selectedItemIds].filter((i) => i !== id)),
        history: newHistory,
        historyIndex: newHistory.length - 1,
        canUndo: true,
        canRedo: false,
      };
    });
  },

  deleteSelectedItems: async () => {
    const { selectedItemIds, items } = get();
    const deletedItems = items.filter(item => selectedItemIds.has(item.id));
    const idsToDelete = Array.from(selectedItemIds);

    // バッチ削除（パフォーマンス改善）
    await dbDeleteTakeoffItemsBatch(idsToDelete);

    set((state) => {
      // Add each deletion as a separate action (for proper undo)
      const newHistory = [...state.history.slice(0, state.historyIndex + 1)];
      for (const item of deletedItems) {
        newHistory.push({ type: 'delete' as const, item });
      }
      if (newHistory.length > MAX_HISTORY) {
        newHistory.splice(0, newHistory.length - MAX_HISTORY);
      }
      return {
        items: state.items.filter((item) => !selectedItemIds.has(item.id)),
        selectedItemIds: new Set(),
        history: newHistory,
        historyIndex: newHistory.length - 1,
        canUndo: true,
        canRedo: false,
      };
    });
  },

  selectItem: (id, multi = false) => {
    set((state) => {
      if (multi) {
        const newSet = new Set(state.selectedItemIds);
        newSet.add(id);
        return { selectedItemIds: newSet };
      }
      return { selectedItemIds: new Set([id]) };
    });
  },

  deselectAll: () => {
    set({ selectedItemIds: new Set() });
  },

  toggleItemSelection: (id) => {
    set((state) => {
      const newSet = new Set(state.selectedItemIds);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return { selectedItemIds: newSet };
    });
  },

  // Undo action
  undo: async () => {
    const { history, historyIndex } = get();
    if (historyIndex < 0) return;

    const action = history[historyIndex];

    switch (action.type) {
      case 'add':
        // Undo add = delete
        await dbDeleteTakeoffItem(action.item.id);
        set((state) => ({
          items: state.items.filter(item => item.id !== action.item.id),
          historyIndex: state.historyIndex - 1,
          canUndo: state.historyIndex - 1 >= 0,
          canRedo: true,
        }));
        break;

      case 'addMultiple':
        // Undo addMultiple = delete all (バッチ処理)
        await dbDeleteTakeoffItemsBatch(action.items.map(item => item.id));
        set((state) => ({
          items: state.items.filter(item => !action.items.some(ai => ai.id === item.id)),
          historyIndex: state.historyIndex - 1,
          canUndo: state.historyIndex - 1 >= 0,
          canRedo: true,
        }));
        break;

      case 'delete':
        // Undo delete = add back
        await dbCreateTakeoffItem(action.item);
        set((state) => ({
          items: [...state.items, action.item],
          historyIndex: state.historyIndex - 1,
          canUndo: state.historyIndex - 1 >= 0,
          canRedo: true,
        }));
        break;

      case 'update':
        // Undo update = restore old item
        await dbUpdateTakeoffItem(action.oldItem.id, action.oldItem);
        set((state) => ({
          items: state.items.map(item => item.id === action.oldItem.id ? action.oldItem : item),
          historyIndex: state.historyIndex - 1,
          canUndo: state.historyIndex - 1 >= 0,
          canRedo: true,
        }));
        break;
    }
  },

  // Redo action
  redo: async () => {
    const { history, historyIndex } = get();
    if (historyIndex >= history.length - 1) return;

    const action = history[historyIndex + 1];

    switch (action.type) {
      case 'add':
        // Redo add = add
        await dbCreateTakeoffItem(action.item);
        set((state) => ({
          items: [...state.items, action.item],
          historyIndex: state.historyIndex + 1,
          canUndo: true,
          canRedo: state.historyIndex + 1 < state.history.length - 1,
        }));
        break;

      case 'addMultiple':
        // Redo addMultiple = add all (バッチ処理)
        await dbCreateTakeoffItemsBatch(action.items);
        set((state) => ({
          items: [...state.items, ...action.items],
          historyIndex: state.historyIndex + 1,
          canUndo: true,
          canRedo: state.historyIndex + 1 < state.history.length - 1,
        }));
        break;

      case 'delete':
        // Redo delete = delete
        await dbDeleteTakeoffItem(action.item.id);
        set((state) => ({
          items: state.items.filter(item => item.id !== action.item.id),
          historyIndex: state.historyIndex + 1,
          canUndo: true,
          canRedo: state.historyIndex + 1 < state.history.length - 1,
        }));
        break;

      case 'update':
        // Redo update = apply new item
        await dbUpdateTakeoffItem(action.newItem.id, action.newItem);
        set((state) => ({
          items: state.items.map(item => item.id === action.newItem.id ? action.newItem : item),
          historyIndex: state.historyIndex + 1,
          canUndo: true,
          canRedo: state.historyIndex + 1 < state.history.length - 1,
        }));
        break;
    }
  },

  reorderItems: async (groupId, orderedIds) => {
    const updates = orderedIds.map((id, idx) => ({ id, order: idx }));
    for (const u of updates) {
      await dbUpdateTakeoffItem(u.id, { order: u.order });
    }
    set((state) => ({
      items: state.items.map(item => {
        const u = updates.find(x => x.id === item.id);
        return u ? { ...item, order: u.order } : item;
      }),
    }));
  },

  clearHistory: () => {
    set({ history: [], historyIndex: -1, canUndo: false, canRedo: false });
  },
}));
