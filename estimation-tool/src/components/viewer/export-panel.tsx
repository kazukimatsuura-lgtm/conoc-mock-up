'use client';

import { useState } from 'react';
import {
  FileSpreadsheet,
  FileText,
  FileDown,
  Download,
  Loader2,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { Button, Modal } from '@/components/ui';
import type { Project, Drawing, TakeoffItem } from '@/types';
import {
  exportToExcel,
  exportToCSV,
  exportToPDF,
  downloadBlob,
  downloadText,
} from '@/lib/export';

interface ExportPanelProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  drawings: Drawing[];
  items: TakeoffItem[];
}

type ExportFormat = 'excel' | 'csv' | 'pdf';

interface ExportOption {
  id: ExportFormat;
  label: string;
  description: string;
  icon: typeof FileSpreadsheet;
  extension: string;
}

const EXPORT_OPTIONS: ExportOption[] = [
  {
    id: 'excel',
    label: 'Excel集計表',
    description: 'カテゴリ別集計・図面別シート付き',
    icon: FileSpreadsheet,
    extension: '.xlsx',
  },
  {
    id: 'csv',
    label: 'CSVデータ',
    description: '他システムへのインポート用',
    icon: FileText,
    extension: '.csv',
  },
  {
    id: 'pdf',
    label: 'PDFレポート',
    description: '印刷・共有用の集計レポート',
    icon: FileDown,
    extension: '.pdf',
  },
];

export function ExportPanel({
  isOpen,
  onClose,
  project,
  drawings,
  items,
}: ExportPanelProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('excel');
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setExportError(null);
    setExportSuccess(false);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const baseFilename = `${project.name}_${timestamp}`;

    try {
      switch (selectedFormat) {
        case 'excel': {
          const blob = await exportToExcel(project, drawings, items);
          downloadBlob(blob, `${baseFilename}.xlsx`);
          break;
        }
        case 'csv': {
          const csvContent = exportToCSV(project, drawings, items);
          downloadText(csvContent, `${baseFilename}.csv`, 'text/csv;charset=utf-8');
          break;
        }
        case 'pdf': {
          const blob = await exportToPDF(project, drawings, items);
          downloadBlob(blob, `${baseFilename}.pdf`);
          break;
        }
      }

      setExportSuccess(true);
      setTimeout(() => {
        setExportSuccess(false);
      }, 3000);
    } catch (error) {
      console.error('Export error:', error);
      setExportError(error instanceof Error ? error.message : 'エクスポートに失敗しました');
    } finally {
      setIsExporting(false);
    }
  };

  const itemCount = items.length;
  const drawingCount = drawings.length;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="データエクスポート" size="md">
      <div className="space-y-6">
        {/* Summary */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-sm text-gray-600">
            <p className="font-medium text-gray-800">{project.name}</p>
            <p className="mt-1">
              図面 {drawingCount}枚 / 拾い出し {itemCount}件
            </p>
          </div>
        </div>

        {/* Format Selection */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            出力形式を選択
          </label>
          <div className="space-y-2">
            {EXPORT_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isSelected = selectedFormat === option.id;

              return (
                <button
                  key={option.id}
                  onClick={() => setSelectedFormat(option.id)}
                  className={`w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-colors text-left ${
                    isSelected
                      ? 'border-[#0099CB] bg-[#E0F4FA]'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div
                    className={`p-2 rounded-lg ${
                      isSelected ? 'bg-[#0099CB] text-white' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    <Icon size={20} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-800">{option.label}</span>
                      <span className="text-xs text-gray-400">{option.extension}</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">{option.description}</p>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      isSelected ? 'border-[#0099CB] bg-[#0099CB]' : 'border-gray-300'
                    }`}
                  >
                    {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Success Message */}
        {exportSuccess && (
          <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-lg">
            <CheckCircle size={18} />
            <span className="text-sm">ダウンロードを開始しました</span>
          </div>
        )}

        {/* Error Message */}
        {exportError && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
            <AlertCircle size={18} />
            <span className="text-sm">{exportError}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="secondary" onClick={onClose} disabled={isExporting}>
            キャンセル
          </Button>
          <Button
            variant="primary"
            icon={isExporting ? Loader2 : Download}
            onClick={handleExport}
            disabled={isExporting || itemCount === 0}
            className={isExporting ? '[&>svg]:animate-spin' : ''}
          >
            {isExporting ? 'エクスポート中...' : 'エクスポート'}
          </Button>
        </div>

        {itemCount === 0 && (
          <p className="text-sm text-gray-500 text-center">
            拾い出しデータがありません。先にデータを追加してください。
          </p>
        )}
      </div>
    </Modal>
  );
}
