import { create } from 'zustand';
import type { CustomColumn } from '@/types';
import {
  getCustomColumnsByDrawing,
  createCustomColumn as dbCreateColumn,
  updateCustomColumn as dbUpdateColumn,
  deleteCustomColumn as dbDeleteColumn,
} from '@/lib/db';
import { generateId } from '@/lib/utils';

interface CustomColumnState {
  columns: CustomColumn[];
  isLoading: boolean;
  loadColumns: (drawingId: string) => Promise<void>;
  addColumn: (drawingId: string, name?: string, type?: 'text' | 'number') => Promise<CustomColumn>;
  updateColumn: (id: string, updates: Partial<CustomColumn>) => Promise<void>;
  deleteColumn: (id: string) => Promise<void>;
  reorderColumns: (orderedIds: string[]) => Promise<void>;
}

export const useCustomColumnStore = create<CustomColumnState>((set, get) => ({
  columns: [],
  isLoading: false,

  loadColumns: async (drawingId: string) => {
    set({ isLoading: true });
    try {
      const columns = await getCustomColumnsByDrawing(drawingId);
      set({ columns, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  addColumn: async (drawingId: string, name = '新規項目', type: 'text' | 'number' = 'text') => {
    const { columns } = get();
    const now = new Date().toISOString();

    const column: CustomColumn = {
      id: generateId(),
      drawingId,
      name,
      type,
      width: 150,
      order: columns.length,
      createdAt: now,
      updatedAt: now,
    };

    await dbCreateColumn(column);
    set((state) => ({ columns: [...state.columns, column] }));
    return column;
  },

  updateColumn: async (id: string, updates: Partial<CustomColumn>) => {
    await dbUpdateColumn(id, updates);
    set((state) => ({
      columns: state.columns.map((col) =>
        col.id === id ? { ...col, ...updates, updatedAt: new Date().toISOString() } : col
      ),
    }));
  },

  deleteColumn: async (id: string) => {
    await dbDeleteColumn(id);
    set((state) => ({
      columns: state.columns.filter((col) => col.id !== id),
    }));
  },

  reorderColumns: async (orderedIds: string[]) => {
    const { columns } = get();

    const updated = columns.map((col) => {
      const newOrder = orderedIds.indexOf(col.id);
      if (newOrder !== -1 && newOrder !== col.order) {
        return { ...col, order: newOrder, updatedAt: new Date().toISOString() };
      }
      return col;
    });

    // Sort by new order
    updated.sort((a, b) => a.order - b.order);
    set({ columns: updated });

    // Persist each changed order to DB
    const updates = updated.filter((col) => {
      const original = columns.find((c) => c.id === col.id);
      return original && original.order !== col.order;
    });

    await Promise.all(
      updates.map((col) => dbUpdateColumn(col.id, { order: col.order }))
    );
  },
}));
