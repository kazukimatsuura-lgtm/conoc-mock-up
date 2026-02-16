'use client';

import { useState, useRef } from 'react';
import { Plus, Image as ImageIcon, Upload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui';
import type { Drawing } from '@/types';
import { useDrawingStore } from '@/stores/drawing-store';
import { processFiles } from '@/lib/file-processor';
import { cn } from '@/lib/utils';

interface DrawingThumbnailListProps {
  drawings: Drawing[];
  currentDrawingId?: string;
  onSelect: (drawing: Drawing | null) => void;
  projectId: string;
}

export function DrawingThumbnailList({
  drawings,
  currentDrawingId,
  onSelect,
  projectId,
}: DrawingThumbnailListProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addDrawing } = useDrawingStore();
  const [isUploading, setIsUploading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const maxDrawings = Infinity;
  const canUploadMore = drawings.length < maxDrawings;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const files = Array.from(e.target.files);
    const remainingSlots = maxDrawings - drawings.length;

    if (files.length > remainingSlots) {
      alert(`残り${remainingSlots}枚まで追加できます`);
      return;
    }

    setIsUploading(true);
    try {
      const { results: processed, errors: processingErrors } = await processFiles(files);

      // エラーがあれば警告表示
      if (processingErrors.length > 0) {
        console.warn('File processing errors:', processingErrors);
        if (processed.length === 0) {
          alert(processingErrors.join('\n'));
          return;
        }
      }

      for (const file of processed) {
        const drawing = await addDrawing({
          projectId,
          fileName: file.fileName,
          fileSize: file.fileSize,
          mimeType: file.mimeType,
          pageNumber: file.pageNumber,
          imageData: file.imageData,
          thumbnailData: file.thumbnailData,
        });
        // Select the first uploaded drawing
        if (processed.indexOf(file) === 0) {
          onSelect(drawing);
        }
      }
    } catch (error) {
      console.error('Upload failed:', error);
      alert('アップロードに失敗しました');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(drawings.map((d) => d.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="w-[200px] bg-white border-r border-gray-200 flex flex-col z-20 shadow-sm">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 flex justify-between items-center bg-gray-50">
        <button
          className="p-1.5 rounded-full border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => fileInputRef.current?.click()}
          disabled={!canUploadMore || isUploading}
          title={canUploadMore ? '図面を追加' : '上限に達しました'}
        >
          {isUploading ? (
            <Loader2 size={16} className="animate-spin text-gray-600" />
          ) : (
            <Plus size={16} className="text-gray-600" />
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.tiff"
          className="hidden"
          onChange={handleFileSelect}
        />
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">全選択</span>
          <input
            type="checkbox"
            className="rounded border-gray-300 text-[#0099CB] focus:ring-[#0099CB]"
            checked={selectedIds.size === drawings.length && drawings.length > 0}
            onChange={(e) => handleSelectAll(e.target.checked)}
          />
        </div>
      </div>

      {/* Thumbnail List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {drawings.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center h-full text-gray-400 cursor-pointer hover:bg-gray-50 rounded-lg p-4"
            onClick={() => canUploadMore && fileInputRef.current?.click()}
          >
            <Upload size={24} className="mb-2" />
            <p className="text-xs text-center">
              図面をアップロード
              <br />
              してください
            </p>
          </div>
        ) : (
          drawings.map((drawing, index) => {
            const isSelected = drawing.id === currentDrawingId;
            const isChecked = selectedIds.has(drawing.id);
            const pageLabel = drawing.pageNumber
              ? `P${drawing.pageNumber}`
              : `A-${101 + index}`;

            return (
              <div
                key={drawing.id}
                className={cn(
                  'group relative p-2 rounded-lg border-2 transition-all cursor-pointer hover:shadow-md',
                  isSelected
                    ? 'border-[#0099CB] bg-[#E0F4FA]'
                    : 'border-transparent hover:border-gray-200 bg-gray-50'
                )}
                onClick={() => onSelect(drawing)}
              >
                {/* Checkbox */}
                <div
                  className="absolute top-1 left-1 z-10"
                  onClick={(e) => toggleSelect(drawing.id, e)}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}}
                    className="rounded border-gray-300 text-[#0099CB] focus:ring-[#0099CB]"
                  />
                </div>

                {/* Thumbnail */}
                <div className="aspect-[3/4] bg-white border border-gray-100 mb-2 flex items-center justify-center overflow-hidden rounded">
                  {drawing.thumbnailData ? (
                    <img
                      src={drawing.thumbnailData}
                      alt={drawing.fileName}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <ImageIcon size={32} className="text-gray-200" />
                  )}
                </div>

                {/* Info */}
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-xs font-bold text-gray-700">{pageLabel}</div>
                    <div className="text-[10px] text-gray-500 truncate w-24">
                      {drawing.fileName}
                    </div>
                  </div>
                  {drawing.status === 'completed' && (
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                  )}
                </div>

                {/* Scale Badge */}
                {drawing.scale && (
                  <div className="mt-1 flex gap-1">
                    <span className="text-[10px] bg-gray-200 px-1 rounded text-gray-600">
                      1:{drawing.scale.ratio}
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-gray-200 bg-gray-50">
        <div className="text-xs text-gray-500 text-center">
          {drawings.length} / {maxDrawings === Infinity ? '∞' : maxDrawings} 図面
        </div>
      </div>
    </div>
  );
}
