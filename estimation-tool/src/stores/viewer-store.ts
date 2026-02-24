import { create } from 'zustand';

export type ToolType = 'point' | 'line' | 'area' | 'rect' | 'scale';
export type ViewMode = 'drawing' | 'table';

interface Point {
  x: number;
  y: number;
}

interface ViewerState {
  // Tool state
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;

  // View mode
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  // Zoom & Pan
  zoomLevel: number;
  setZoomLevel: (level: number) => void;
  panOffset: Point;
  setPanOffset: (offset: Point) => void;

  // View initialization tracking (prevents reset on mode switch)
  viewInitializedDrawingId: string | null;
  setViewInitializedDrawingId: (id: string | null) => void;

  // Drawing state (for tools in progress)
  isDrawing: boolean;
  setIsDrawing: (drawing: boolean) => void;
  drawingPoints: Point[];
  addDrawingPoint: (point: Point) => void;
  clearDrawingPoints: () => void;

  // Current item settings
  currentCategory: string;
  setCurrentCategory: (category: string) => void;
  currentItemType: string;
  setCurrentItemType: (type: string) => void;

  // Mouse position
  mousePosition: Point;
  setMousePosition: (pos: Point) => void;

  // Grid
  showGrid: boolean;
  toggleGrid: () => void;

  // Reset
  resetViewer: () => void;
}

export const useViewerStore = create<ViewerState>((set) => ({
  // Tool state
  activeTool: 'point',
  setActiveTool: (tool) => set({ activeTool: tool, isDrawing: false, drawingPoints: [] }),

  // View mode
  viewMode: 'drawing',
  setViewMode: (mode) => set({ viewMode: mode }),

  // Zoom & Pan
  zoomLevel: 50,
  setZoomLevel: (level) => set({ zoomLevel: Math.min(200, Math.max(10, level)) }),
  panOffset: { x: 0, y: 0 },
  setPanOffset: (offset) => set({ panOffset: offset }),

  // View initialization tracking
  viewInitializedDrawingId: null,
  setViewInitializedDrawingId: (id) => set({ viewInitializedDrawingId: id }),

  // Drawing state
  isDrawing: false,
  setIsDrawing: (drawing) => set({ isDrawing: drawing }),
  drawingPoints: [],
  addDrawingPoint: (point) => set((state) => ({ drawingPoints: [...state.drawingPoints, point] })),
  clearDrawingPoints: () => set({ drawingPoints: [], isDrawing: false }),

  // Current item settings
  currentCategory: 'electrical',
  setCurrentCategory: (category) => set({ currentCategory: category }),
  currentItemType: '',
  setCurrentItemType: (type) => set({ currentItemType: type }),

  // Mouse position
  mousePosition: { x: 0, y: 0 },
  setMousePosition: (pos) => set({ mousePosition: pos }),

  // Grid
  showGrid: true,
  toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),

  // Reset
  resetViewer: () => set({
    activeTool: 'point',
    viewMode: 'drawing',
    zoomLevel: 50,
    panOffset: { x: 0, y: 0 },
    isDrawing: false,
    drawingPoints: [],
    mousePosition: { x: 0, y: 0 },
    viewInitializedDrawingId: null,
  }),
}));
