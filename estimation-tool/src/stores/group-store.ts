import { create } from 'zustand';
import type { TakeoffGroup } from '@/types';
import {
  getTakeoffGroupsByDrawing,
  createTakeoffGroup as dbCreateGroup,
  createTakeoffGroupsBatch as dbCreateGroupsBatch,
  updateTakeoffGroup as dbUpdateGroup,
  deleteTakeoffGroup as dbDeleteGroup,
  deleteTakeoffGroupsBatch as dbDeleteGroupsBatch,
} from '@/lib/db';
import { generateId } from '@/lib/utils';
import { TAKEOFF_CATEGORIES } from '@/types/takeoff';

interface GroupState {
  groups: TakeoffGroup[];
  expandedGroupIds: Set<string>;
  isLoading: boolean;

  loadGroups: (drawingId: string) => Promise<void>;
  addGroup: (drawingId: string, name: string, parentId: string | null, level: number) => Promise<TakeoffGroup>;
  updateGroup: (id: string, updates: Partial<TakeoffGroup>) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;
  toggleExpand: (id: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  reorderGroups: (parentId: string | null, orderedIds: string[]) => Promise<void>;
  ensureGroupsForCategory: (drawingId: string, category: string) => Promise<TakeoffGroup>;
}

export const useGroupStore = create<GroupState>((set, get) => ({
  groups: [],
  expandedGroupIds: new Set(),
  isLoading: false,

  loadGroups: async (drawingId: string) => {
    set({ isLoading: true });
    try {
      const groups = await getTakeoffGroupsByDrawing(drawingId);
      set({ groups, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  addGroup: async (drawingId, name, parentId, level) => {
    const { groups } = get();
    const siblings = groups.filter(g => g.parentId === parentId && g.drawingId === drawingId);
    const now = new Date().toISOString();

    const group: TakeoffGroup = {
      id: generateId(),
      drawingId,
      parentId,
      name,
      level,
      order: siblings.length,
      hasDetail: true,
      createdAt: now,
      updatedAt: now,
    };

    await dbCreateGroup(group);
    set((state) => ({ groups: [...state.groups, group] }));
    return group;
  },

  updateGroup: async (id, updates) => {
    await dbUpdateGroup(id, updates);
    set((state) => ({
      groups: state.groups.map(g =>
        g.id === id ? { ...g, ...updates, updatedAt: new Date().toISOString() } : g
      ),
    }));
  },

  deleteGroup: async (id) => {
    const { groups } = get();
    // 子グループも再帰的に削除
    const getDescendantIds = (parentId: string): string[] => {
      const children = groups.filter(g => g.parentId === parentId);
      return children.flatMap(c => [c.id, ...getDescendantIds(c.id)]);
    };
    const idsToDelete = [id, ...getDescendantIds(id)];

    await dbDeleteGroupsBatch(idsToDelete);
    set((state) => ({
      groups: state.groups.filter(g => !idsToDelete.includes(g.id)),
    }));
  },

  toggleExpand: (id) => {
    set((state) => {
      const next = new Set(state.expandedGroupIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { expandedGroupIds: next };
    });
  },

  expandAll: () => {
    set((state) => ({
      expandedGroupIds: new Set(state.groups.map(g => g.id)),
    }));
  },

  collapseAll: () => {
    set({ expandedGroupIds: new Set() });
  },

  reorderGroups: async (parentId, orderedIds) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await dbUpdateGroup(orderedIds[i], { order: i });
    }
    set((state) => ({
      groups: state.groups.map(g => {
        const idx = orderedIds.indexOf(g.id);
        return idx >= 0 ? { ...g, order: idx } : g;
      }),
    }));
  },

  ensureGroupsForCategory: async (drawingId, category) => {
    const { groups } = get();
    const categoryLabel = TAKEOFF_CATEGORIES.find(c => c.id === category)?.label || category;

    // 既存のルートグループを探す
    const existing = groups.find(
      g => g.drawingId === drawingId && g.parentId === null && g.name === categoryLabel
    );
    if (existing) return existing;

    // 新しいルートグループを作成
    const now = new Date().toISOString();
    const rootGroup: TakeoffGroup = {
      id: generateId(),
      drawingId,
      parentId: null,
      name: categoryLabel,
      level: 1,
      order: groups.filter(g => g.drawingId === drawingId && g.parentId === null).length,
      hasDetail: true,
      createdAt: now,
      updatedAt: now,
    };

    await dbCreateGroup(rootGroup);
    set((state) => ({
      groups: [...state.groups, rootGroup],
      expandedGroupIds: new Set([...state.expandedGroupIds, rootGroup.id]),
    }));
    return rootGroup;
  },
}));
