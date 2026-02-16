'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  RotateCcw,
  Image as ImageIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Drawing } from '@/types';

interface DrawingPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  drawings: Drawing[];
  currentDrawing: Drawing | null;
  onSelectDrawing: (drawing: Drawing) => void;
}

export function DrawingPreviewModal({
  isOpen,
  onClose,
  drawings,
  currentDrawing,
  onSelectDrawing,
}: DrawingPreviewModalProps) {
  const [zoom, setZoom] = useState(100);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  // ドラッグ移動
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // パン（画像移動）
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  const modalRef = useRef<HTMLDivElement>(null);

  // モーダルを開くたびにリセット
  useEffect(() => {
    if (isOpen) {
      setZoom(100);
      setPanOffset({ x: 0, y: 0 });
    }
  }, [isOpen, currentDrawing?.id]);

  // 現在の図面のインデックス
  const currentIndex = drawings.findIndex(d => d.id === currentDrawing?.id);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      onSelectDrawing(drawings[currentIndex - 1]);
      setPanOffset({ x: 0, y: 0 });
      setZoom(100);
    }
  }, [currentIndex, drawings, onSelectDrawing]);

  const handleNext = useCallback(() => {
    if (currentIndex < drawings.length - 1) {
      onSelectDrawing(drawings[currentIndex + 1]);
      setPanOffset({ x: 0, y: 0 });
      setZoom(100);
    }
  }, [currentIndex, drawings, onSelectDrawing]);

  const handleZoomIn = () => setZoom(z => Math.min(400, z + 25));
  const handleZoomOut = () => setZoom(z => Math.max(25, z - 25));
  const handleZoomReset = () => { setZoom(100); setPanOffset({ x: 0, y: 0 }); };

  // ホイールズーム
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -10 : 10;
      setZoom(z => Math.min(400, Math.max(25, z + delta)));
    }
  }, []);

  // ヘッダードラッグ（モーダル移動）
  const handleHeaderMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX - position.x, y: e.clientY - position.y };

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current) return;
      setPosition({
        x: ev.clientX - dragStartRef.current.x,
        y: ev.clientY - dragStartRef.current.y,
      });
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
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
  }, [position.x, position.y]);

  // 画像パン（中クリック or 右クリック+ドラッグ）
  const handleImageMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || e.button === 2) {
      e.preventDefault();
      isPanningRef.current = true;
      panStartRef.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };

      const handleMouseMove = (ev: MouseEvent) => {
        if (!isPanningRef.current) return;
        setPanOffset({
          x: ev.clientX - panStartRef.current.x,
          y: ev.clientY - panStartRef.current.y,
        });
      };
      const handleMouseUp = () => {
        isPanningRef.current = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
      };
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'grabbing';
    }
  }, [panOffset.x, panOffset.y]);

  // キーボードナビゲーション
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === '+' || e.key === '=') handleZoomIn();
      if (e.key === '-') handleZoomOut();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, handlePrev, handleNext]);

  if (!isOpen || !currentDrawing) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* 半透明背景（クリックで閉じない - モーダルの外をクリックしても閉じない方が作業しやすい） */}
      <div
        ref={modalRef}
        className="pointer-events-auto absolute shadow-2xl rounded-lg border border-gray-300 bg-white flex flex-col overflow-hidden"
        style={{
          width: '640px',
          height: '480px',
          left: `calc(50% - 320px + ${position.x}px)`,
          top: `calc(50% - 240px + ${position.y}px)`,
          resize: 'both',
          minWidth: '400px',
          minHeight: '300px',
        }}
      >
        {/* Header - ドラッグハンドル */}
        <div
          className="flex items-center justify-between px-3 py-2 bg-[#52555F] text-white cursor-grab active:cursor-grabbing flex-shrink-0"
          onMouseDown={handleHeaderMouseDown}
        >
          <div className="flex items-center gap-2 text-sm">
            <GripVertical size={14} className="text-gray-400" />
            <ImageIcon size={14} />
            <span className="font-medium truncate max-w-[300px]">
              {currentDrawing.fileName}
            </span>
            {drawings.length > 1 && (
              <span className="text-xs text-gray-300">
                ({currentIndex + 1} / {drawings.length})
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            onMouseDown={e => e.stopPropagation()}
            className="p-1 hover:bg-white/20 rounded transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-gray-100 border-b border-gray-200 flex-shrink-0">
          {/* 図面切替 */}
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrev}
              disabled={currentIndex <= 0}
              onMouseDown={e => e.stopPropagation()}
              className={cn(
                'p-1.5 rounded transition-colors',
                currentIndex > 0
                  ? 'hover:bg-gray-200 text-gray-700'
                  : 'text-gray-300 cursor-not-allowed'
              )}
              title="前の図面"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={handleNext}
              disabled={currentIndex >= drawings.length - 1}
              onMouseDown={e => e.stopPropagation()}
              className={cn(
                'p-1.5 rounded transition-colors',
                currentIndex < drawings.length - 1
                  ? 'hover:bg-gray-200 text-gray-700'
                  : 'text-gray-300 cursor-not-allowed'
              )}
              title="次の図面"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* ズーム */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleZoomOut}
              onMouseDown={e => e.stopPropagation()}
              className="p-1.5 hover:bg-gray-200 rounded transition-colors text-gray-700"
              title="縮小"
            >
              <ZoomOut size={15} />
            </button>
            <span className="text-xs font-mono text-gray-600 w-10 text-center">{zoom}%</span>
            <button
              onClick={handleZoomIn}
              onMouseDown={e => e.stopPropagation()}
              className="p-1.5 hover:bg-gray-200 rounded transition-colors text-gray-700"
              title="拡大"
            >
              <ZoomIn size={15} />
            </button>
            <button
              onClick={handleZoomReset}
              onMouseDown={e => e.stopPropagation()}
              className="p-1.5 hover:bg-gray-200 rounded transition-colors text-gray-500 ml-1"
              title="リセット"
            >
              <RotateCcw size={14} />
            </button>
          </div>
        </div>

        {/* Image View */}
        <div
          className="flex-1 overflow-hidden bg-[#2a2a2a] relative"
          onWheel={handleWheel}
          onMouseDown={handleImageMouseDown}
          onContextMenu={e => e.preventDefault()}
        >
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom / 100})`,
              transformOrigin: 'center center',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentDrawing.imageData}
              alt={currentDrawing.fileName}
              className="max-w-none pointer-events-none select-none"
              draggable={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
