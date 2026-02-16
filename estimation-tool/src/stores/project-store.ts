import { create } from 'zustand';
import type { Project, Drawing } from '@/types';
import {
  getAllProjects,
  getProject,
  createProject as dbCreateProject,
  updateProject as dbUpdateProject,
  deleteProject as dbDeleteProject,
  getDrawingsByProject,
} from '@/lib/db';
import { generateId } from '@/lib/utils';

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  currentDrawings: Drawing[];
  isLoading: boolean;
  error: string | null;

  // Actions
  loadProjects: () => Promise<void>;
  loadProject: (id: string) => Promise<void>;
  createProject: (name: string, description?: string) => Promise<Project>;
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  setCurrentProject: (project: Project | null) => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProject: null,
  currentDrawings: [],
  isLoading: false,
  error: null,

  loadProjects: async () => {
    set({ isLoading: true, error: null });
    try {
      const projects = await getAllProjects();
      set({ projects, isLoading: false });
    } catch (error) {
      set({ error: 'プロジェクトの読み込みに失敗しました', isLoading: false });
    }
  },

  loadProject: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const project = await getProject(id);
      if (project) {
        const drawings = await getDrawingsByProject(id);
        set({ currentProject: project, currentDrawings: drawings, isLoading: false });
      } else {
        set({ error: 'プロジェクトが見つかりません', isLoading: false });
      }
    } catch (error) {
      set({ error: 'プロジェクトの読み込みに失敗しました', isLoading: false });
    }
  },

  createProject: async (name: string, description?: string) => {
    const now = new Date().toISOString();
    const project: Project = {
      id: generateId(),
      name,
      description,
      createdAt: now,
      updatedAt: now,
      status: 'draft',
      drawingIds: [],
    };

    await dbCreateProject(project);
    set((state) => ({ projects: [project, ...state.projects] }));
    return project;
  },

  updateProject: async (id: string, updates: Partial<Project>) => {
    await dbUpdateProject(id, updates);
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
      ),
      currentProject:
        state.currentProject?.id === id
          ? { ...state.currentProject, ...updates, updatedAt: new Date().toISOString() }
          : state.currentProject,
    }));
  },

  deleteProject: async (id: string) => {
    await dbDeleteProject(id);
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      currentProject: state.currentProject?.id === id ? null : state.currentProject,
    }));
  },

  setCurrentProject: (project: Project | null) => {
    set({ currentProject: project });
  },
}));
