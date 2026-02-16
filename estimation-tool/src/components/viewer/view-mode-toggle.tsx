'use client';

import { FileImage, Table2 } from 'lucide-react';
import { useViewerStore } from '@/stores/viewer-store';
import type { ViewMode } from '@/stores/viewer-store';
import { cn } from '@/lib/utils';

export function ViewModeToggle() {
  const { viewMode, setViewMode } = useViewerStore();

  const modes: { id: ViewMode; label: string; icon: typeof FileImage }[] = [
    { id: 'drawing', label: '図面', icon: FileImage },
    { id: 'table', label: '一覧', icon: Table2 },
  ];

  return (
    <div className="inline-flex bg-gray-200 rounded-lg p-0.5">
      {modes.map((mode) => {
        const Icon = mode.icon;
        const isActive = viewMode === mode.id;
        return (
          <button
            key={mode.id}
            onClick={() => setViewMode(mode.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all',
              isActive
                ? 'bg-[#0099CB] text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
            )}
          >
            <Icon size={14} />
            <span>{mode.label}</span>
          </button>
        );
      })}
    </div>
  );
}
