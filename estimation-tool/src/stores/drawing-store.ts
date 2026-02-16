import { create } from 'zustand';
import type { Drawing, ScaleConfig } from '@/types';
import {
  getDrawingsByProject,
  createDrawing as dbCreateDrawing,
  updateDrawing as dbUpdateDrawing,
  deleteDrawing as dbDeleteDrawing,
} from '@/lib/db';
import { generateId } from '@/lib/utils';

interface DrawingState {
  drawings: Drawing[];
  currentDrawing: Drawing | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadDrawings: (projectId: string) => Promise<void>;
  addDrawing: (input: {
    projectId: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    pageNumber?: number;
    imageData: string;
    thumbnailData: string;
  }) => Promise<Drawing>;
  updateDrawingScale: (id: string, scale: ScaleConfig) => Promise<void>;
  deleteDrawing: (id: string) => Promise<void>;
  setCurrentDrawing: (drawing: Drawing | null) => void;
  reorderDrawings: (fromIndex: number, toIndex: number) => void;
}

export const useDrawingStore = create<DrawingState>((set, get) => ({
  drawings: [],
  currentDrawing: null,
  isLoading: false,
  error: null,

  loadDrawings: async (projectId: string) => {
    set({ isLoading: true, error: null });
    try {
      const drawings = await getDrawingsByProject(projectId);
      set({ drawings, isLoading: false });
      if (drawings.length > 0 && !get().currentDrawing) {
        set({ currentDrawing: drawings[0] });
      }
    } catch (error) {
      set({ error: '図面の読み込みに失敗しました', isLoading: false });
    }
  },

  addDrawing: async (input) => {
    const now = new Date().toISOString();
    const drawing: Drawing = {
      id: generateId(),
      projectId: input.projectId,
      fileName: input.fileName,
      fileSize: input.fileSize,
      mimeType: input.mimeType,
      pageNumber: input.pageNumber,
      imageData: input.imageData,
      thumbnailData: input.thumbnailData,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    await dbCreateDrawing(drawing);
    set((state) => ({ drawings: [...state.drawings, drawing] }));
    return drawing;
  },

  updateDrawingScale: async (id: string, scale: ScaleConfig) => {
    await dbUpdateDrawing(id, { scale });
    set((state) => ({
      drawings: state.drawings.map((d) =>
        d.id === id ? { ...d, scale, updatedAt: new Date().toISOString() } : d
      ),
      currentDrawing:
        state.currentDrawing?.id === id
          ? { ...state.currentDrawing, scale, updatedAt: new Date().toISOString() }
          : state.currentDrawing,
    }));
  },

  deleteDrawing: async (id: string) => {
    await dbDeleteDrawing(id);
    set((state) => {
      const drawings = state.drawings.filter((d) => d.id !== id);
      return {
        drawings,
        currentDrawing:
          state.currentDrawing?.id === id
            ? drawings[0] || null
            : state.currentDrawing,
      };
    });
  },

  setCurrentDrawing: (drawing: Drawing | null) => {
    set({ currentDrawing: drawing });
  },

  reorderDrawings: (fromIndex: number, toIndex: number) => {
    set((state) => {
      const drawings = [...state.drawings];
      const [removed] = drawings.splice(fromIndex, 1);
      drawings.splice(toIndex, 0, removed);
      return { drawings };
    });
  },
}));
