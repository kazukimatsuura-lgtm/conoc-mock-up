'use client';

import { useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';

interface ResizeHandleProps {
  side: 'left' | 'right';
  onResize: (delta: number) => void;
}

export function ResizeHandle({ side, onResize }: ResizeHandleProps) {
  const startXRef = useRef(0);
  const isDraggingRef = useRef(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startXRef.current = e.clientX;
    isDraggingRef.current = true;

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const delta = ev.clientX - startXRef.current;
      startXRef.current = ev.clientX;
      // left panel: drag right = wider (+delta)
      // right panel: drag left = wider (-delta)
      onResize(side === 'left' ? delta : -delta);
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [onResize, side]);

  return (
    <div
      onMouseDown={handleMouseDown}
      className={cn(
        'absolute top-0 bottom-0 w-1.5 z-30 cursor-col-resize group',
        side === 'left' ? 'right-0' : 'left-0'
      )}
    >
      <div className={cn(
        'absolute inset-y-0 w-0.5 bg-transparent group-hover:bg-[#0099CB] group-active:bg-[#0099CB] transition-colors',
        side === 'left' ? 'right-0' : 'left-0'
      )} />
    </div>
  );
}
