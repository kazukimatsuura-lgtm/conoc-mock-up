'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Material, MaterialCategory } from '@/types/material';
import { v4 as uuidv4 } from 'uuid';

interface MaterialState {
  materials: Material[];
  isLoading: boolean;
  error: string | null;
}

interface MaterialActions {
  // CRUD operations
  addMaterial: (material: Omit<Material, 'id' | 'createdAt' | 'updatedAt'>) => Material;
  addMaterials: (materials: Omit<Material, 'id' | 'createdAt' | 'updatedAt'>[]) => Material[];
  updateMaterial: (id: string, updates: Partial<Material>) => void;
  deleteMaterial: (id: string) => void;
  clearAllMaterials: () => void;

  // Query operations
  getMaterialsByCategory: (category: MaterialCategory) => Material[];
  searchMaterials: (query: string) => Material[];
  getMaterialById: (id: string) => Material | undefined;

  // State management
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

type MaterialStore = MaterialState & MaterialActions;

export const useMaterialStore = create<MaterialStore>()(
  persist(
    (set, get) => ({
      // State
      materials: [],
      isLoading: false,
      error: null,

      // CRUD operations
      addMaterial: (materialData) => {
        const now = new Date().toISOString();
        const newMaterial: Material = {
          ...materialData,
          id: uuidv4(),
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          materials: [...state.materials, newMaterial],
        }));

        return newMaterial;
      },

      addMaterials: (materialsData) => {
        const now = new Date().toISOString();
        const newMaterials: Material[] = materialsData.map((data) => ({
          ...data,
          id: uuidv4(),
          createdAt: now,
          updatedAt: now,
        }));

        set((state) => ({
          materials: [...state.materials, ...newMaterials],
        }));

        return newMaterials;
      },

      updateMaterial: (id, updates) => {
        set((state) => ({
          materials: state.materials.map((material) =>
            material.id === id
              ? { ...material, ...updates, updatedAt: new Date().toISOString() }
              : material
          ),
        }));
      },

      deleteMaterial: (id) => {
        set((state) => ({
          materials: state.materials.filter((material) => material.id !== id),
        }));
      },

      clearAllMaterials: () => {
        set({ materials: [] });
      },

      // Query operations
      getMaterialsByCategory: (category) => {
        return get().materials.filter((m) => m.category === category);
      },

      searchMaterials: (query) => {
        const lowerQuery = query.toLowerCase();
        return get().materials.filter(
          (m) =>
            m.name.toLowerCase().includes(lowerQuery) ||
            m.productNumber.toLowerCase().includes(lowerQuery) ||
            m.manufacturer.toLowerCase().includes(lowerQuery) ||
            m.specifications.toLowerCase().includes(lowerQuery)
        );
      },

      getMaterialById: (id) => {
        return get().materials.find((m) => m.id === id);
      },

      // State management
      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),
    }),
    {
      name: 'conoc-material-store',
      version: 1,
    }
  )
);
