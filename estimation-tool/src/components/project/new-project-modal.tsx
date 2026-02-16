'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Loader2, X, FileText } from 'lucide-react';
import { Button, Modal, ModalFooter, Input, Textarea } from '@/components/ui';
import { useProjectStore } from '@/stores/project-store';
import { useDrawingStore } from '@/stores/drawing-store';
import { processFiles } from '@/lib/file-processor';
import { formatFileSize } from '@/lib/utils';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface UploadedFile {
  file: File;
  preview?: string;
}

export function NewProjectModal({ isOpen, onClose }: NewProjectModalProps) {
  const router = useRouter();
  const { createProject } = useProjectStore();
  const { addDrawing } = useDrawingStore();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const maxDrawings = Infinity;

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const droppedFiles = Array.from(e.dataTransfer.files);
      addFiles(droppedFiles);
    },
    [files, maxDrawings]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      addFiles(selectedFiles);
    }
  };

  const addFiles = (newFiles: File[]) => {
    const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/tiff'];
    const validFiles = newFiles.filter((file) => {
      if (!validTypes.includes(file.type)) {
        setError(`${file.name} は対応していないファイル形式です`);
        return false;
      }
      if (file.size > 50 * 1024 * 1024) {
        setError(`${file.name} は50MBを超えています`);
        return false;
      }
      return true;
    });

    const totalFiles = files.length + validFiles.length;
    if (totalFiles > maxDrawings) {
      setError(`図面は${maxDrawings}枚までアップロードできます`);
      return;
    }

    const newUploadedFiles = validFiles.map((file) => ({
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    }));

    setFiles((prev) => [...prev, ...newUploadedFiles]);
    setError(null);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => {
      const newFiles = [...prev];
      if (newFiles[index].preview) {
        URL.revokeObjectURL(newFiles[index].preview!);
      }
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('プロジェクト名を入力してください');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Create project
      const project = await createProject(name.trim(), description.trim() || undefined);

      // Process and add drawings
      if (files.length > 0) {
        const { results: processedFiles, errors: processingErrors } = await processFiles(files.map((f) => f.file));

        // エラーがあればログに出力
        if (processingErrors.length > 0) {
          console.warn('File processing errors:', processingErrors);
        }

        for (const processed of processedFiles) {
          await addDrawing({
            projectId: project.id,
            fileName: processed.fileName,
            fileSize: processed.fileSize,
            mimeType: processed.mimeType,
            pageNumber: processed.pageNumber,
            imageData: processed.imageData,
            thumbnailData: processed.thumbnailData,
          });
        }
      }

      // Clean up previews
      files.forEach((f) => {
        if (f.preview) URL.revokeObjectURL(f.preview);
      });

      // Reset form and close
      setName('');
      setDescription('');
      setFiles([]);
      onClose();

      // Navigate to viewer
      router.push(`/viewer/${project.id}`);
    } catch (err) {
      setError('プロジェクトの作成に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      files.forEach((f) => {
        if (f.preview) URL.revokeObjectURL(f.preview);
      });
      setName('');
      setDescription('');
      setFiles([]);
      setError(null);
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="新規プロジェクト作成">
      <div className="space-y-6">
        {/* Project Name */}
        <Input
          label="プロジェクト名"
          placeholder="例：○○ビル新築工事"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          disabled={isSubmitting}
        />

        {/* Description */}
        <Textarea
          label="説明"
          placeholder="プロジェクトの概要..."
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={isSubmitting}
        />

        {/* File Drop Zone */}
        <div
          className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-colors cursor-pointer ${
            isDragging
              ? 'border-[#0099CB] bg-[#E0F4FA]'
              : 'border-gray-300 bg-gray-50 hover:bg-[#E0F4FA] hover:border-[#0099CB]'
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById('file-input')?.click()}
        >
          <Upload
            className={`mb-2 ${isDragging ? 'text-[#0099CB]' : 'text-gray-400'}`}
            size={32}
          />
          <p className="text-sm text-gray-600 font-medium">
            図面をドラッグ＆ドロップ
          </p>
          <p className="text-xs text-gray-400 mt-1">
            または クリックして選択 (PDF, PNG, JPG)
          </p>
          <p className="text-xs text-gray-400 mt-2">
            最大{maxDrawings === Infinity ? '無制限' : `${maxDrawings}枚`}
          </p>
          <input
            id="file-input"
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.tiff"
            className="hidden"
            onChange={handleFileSelect}
            disabled={isSubmitting}
          />
        </div>

        {/* File List */}
        {files.length > 0 && (
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {files.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg border border-gray-200"
              >
                <div className="w-10 h-10 bg-white border border-gray-200 rounded flex items-center justify-center flex-shrink-0">
                  {file.preview ? (
                    <img
                      src={file.preview}
                      alt=""
                      className="w-full h-full object-cover rounded"
                    />
                  ) : (
                    <FileText size={20} className="text-gray-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">
                    {file.file.name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatFileSize(file.file.size)}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(index);
                  }}
                  className="p-1 text-gray-400 hover:text-red-500 rounded"
                  disabled={isSubmitting}
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-sm text-red-500 bg-red-50 p-3 rounded-lg">{error}</p>
        )}

        {/* Footer */}
        <ModalFooter>
          <Button variant="secondary" onClick={handleClose} disabled={isSubmitting}>
            キャンセル
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={isSubmitting || !name.trim()}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                作成中...
              </>
            ) : (
              '作成'
            )}
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  );
}
