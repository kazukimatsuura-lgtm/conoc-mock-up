'use client';

import { useState, ReactNode } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Check,
  Ruler,
  Square,
  Maximize2,
  Scaling,
  Grid,
  Undo2,
  Redo2,
  Download,
  Package,
  Sparkles,
  Home,
  DoorOpen,
  Wand2,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ToolType } from '@/stores/viewer-store';
import type { AiFeatureType } from './ai-features-menu';

// ツールチップコンポーネント
function Tooltip({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="relative group">
      {children}
      <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none">
        {label}
        <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-800" />
      </div>
    </div>
  );
}

interface LeftSidebarProps {
  // Tool state
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
  // Zoom
  zoomLevel: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  // Grid
  showGrid: boolean;
  toggleGrid: () => void;
  // Undo/Redo
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  // AI
  onAiFeature: (feature: AiFeatureType) => void;
  isAiProcessing: boolean;
  processingFeature?: AiFeatureType | null;
  aiDisabled: boolean;
  // AI Overlays
  hasRoomResult: boolean;
  hasOpeningResult: boolean;
  showRoomOverlay: boolean;
  showOpeningOverlay: boolean;
  onToggleRoomOverlay: () => void;
  onToggleOpeningOverlay: () => void;
  // Export
  onExport: () => void;
  onMaterials: () => void;
  // Scale
  scaleText: string;
}

const TOOLS = [
  { id: 'scale' as const, icon: Scaling, key: 'S', label: '縮尺設定' },
  { id: 'point' as const, icon: Check, key: 'P', label: '点カウント' },
  { id: 'line' as const, icon: Ruler, key: 'L', label: '線計測' },
  { id: 'area' as const, icon: Square, key: 'A', label: '面積計測' },
  { id: 'rect' as const, icon: Maximize2, key: 'R', label: '矩形選択' },
];

const AI_FEATURES: { id: AiFeatureType; icon: typeof Sparkles; label: string; description: string; color: string }[] = [
  { id: 'takeoff', icon: Wand2, label: 'AI拾い出し', description: '設備・部材を自動検出', color: 'from-purple-500 to-pink-500' },
  { id: 'room', icon: Home, label: '部屋検出', description: '部屋を自動認識', color: 'from-green-500 to-emerald-500' },
  { id: 'opening', icon: DoorOpen, label: '開口部検出', description: 'ドア・窓を検出', color: 'from-orange-500 to-amber-500' },
];

export function LeftSidebar({
  activeTool,
  setActiveTool,
  zoomLevel,
  onZoomIn,
  onZoomOut,
  showGrid,
  toggleGrid,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onAiFeature,
  isAiProcessing,
  processingFeature,
  aiDisabled,
  hasRoomResult,
  hasOpeningResult,
  showRoomOverlay,
  showOpeningOverlay,
  onToggleRoomOverlay,
  onToggleOpeningOverlay,
  onExport,
  onMaterials,
  scaleText,
}: LeftSidebarProps) {
  const [showAiMenu, setShowAiMenu] = useState(false);

  return (
    <div className="w-full bg-gray-50 border-r border-gray-200 flex flex-col flex-shrink-0">
      {/* Tools Section */}
      <div className="p-2 border-b border-gray-200">
        <div className="text-xs font-medium text-gray-500 mb-2 px-1">ツール</div>
        <div className="grid grid-cols-4 gap-1">
          {/* Undo/Redo */}
          <Tooltip label="元に戻す (Ctrl+Z)">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className={cn(
                'p-2 rounded transition-colors flex items-center justify-center w-full',
                canUndo ? 'text-gray-600 hover:bg-gray-200' : 'text-gray-300 cursor-not-allowed'
              )}
            >
              <Undo2 size={18} />
            </button>
          </Tooltip>
          <Tooltip label="やり直し (Ctrl+Shift+Z)">
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className={cn(
                'p-2 rounded transition-colors flex items-center justify-center w-full',
                canRedo ? 'text-gray-600 hover:bg-gray-200' : 'text-gray-300 cursor-not-allowed'
              )}
            >
              <Redo2 size={18} />
            </button>
          </Tooltip>
          {/* Grid */}
          <Tooltip label="グリッド表示 (G)">
            <button
              onClick={toggleGrid}
              className={cn(
                'p-2 rounded transition-colors flex items-center justify-center w-full',
                showGrid ? 'bg-[#0099CB] text-white' : 'text-gray-600 hover:bg-gray-200'
              )}
            >
              <Grid size={18} />
            </button>
          </Tooltip>
          <div /> {/* spacer */}

          {/* Drawing Tools */}
          {TOOLS.map((tool) => (
            <Tooltip key={tool.id} label={`${tool.label} (${tool.key})`}>
              <button
                onClick={() => setActiveTool(tool.id)}
                className={cn(
                  'p-2 rounded transition-colors flex items-center justify-center w-full',
                  activeTool === tool.id
                    ? 'bg-[#0099CB] text-white'
                    : 'text-gray-600 hover:bg-gray-200'
                )}
              >
                <tool.icon size={18} />
              </button>
            </Tooltip>
          ))}
        </div>
      </div>

      {/* Zoom Section */}
      <div className="p-2 border-b border-gray-200">
        <div className="text-xs font-medium text-gray-500 mb-2 px-1">表示</div>
        <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 px-2 py-1">
          <Tooltip label="縮小 (-)">
            <button
              onClick={onZoomOut}
              className="p-1 hover:bg-gray-100 rounded text-gray-600"
            >
              <ZoomOut size={16} />
            </button>
          </Tooltip>
          <span className="text-xs font-mono">{zoomLevel}%</span>
          <Tooltip label="拡大 (+)">
            <button
              onClick={onZoomIn}
              className="p-1 hover:bg-gray-100 rounded text-gray-600"
            >
              <ZoomIn size={16} />
            </button>
          </Tooltip>
        </div>
        <div className="mt-2 text-xs text-gray-500 text-center">
          縮尺: <span className="font-medium text-gray-700">{scaleText}</span>
        </div>
      </div>

      {/* AI Section - 強調デザイン・アコーディオン */}
      <div className="p-2 border-b border-gray-200">
        {/* AI機能ヘッダー - クリックで開閉 */}
        <button
          onClick={() => setShowAiMenu(!showAiMenu)}
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg p-2 mb-2 hover:from-purple-700 hover:to-pink-700 transition-all"
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
              <Sparkles size={18} className="text-white" />
            </div>
            <div className="flex-1 text-left">
              <div className="text-white font-bold text-sm">AI機能</div>
              <div className="text-white/80 text-[10px]">図面を自動解析</div>
            </div>
            <div className="text-white/80">
              {showAiMenu ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </div>
          </div>
        </button>

        {/* AI機能ボタン - アコーディオン */}
        {showAiMenu && (
        <div className="space-y-1.5">
          {AI_FEATURES.map((feature) => {
            const isProcessing = isAiProcessing && processingFeature === feature.id;
            const isDisabled = (isAiProcessing && processingFeature !== feature.id) || aiDisabled;

            return (
              <button
                key={feature.id}
                onClick={() => onAiFeature(feature.id)}
                disabled={isAiProcessing || aiDisabled}
                className={cn(
                  'w-full flex items-center gap-2 p-2 rounded-lg text-sm transition-all text-left group relative overflow-hidden',
                  isProcessing
                    ? 'bg-gradient-to-r from-purple-100 to-pink-100 border-2 border-purple-300'
                    : isDisabled
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white border border-gray-200 hover:border-purple-300 hover:shadow-md hover:scale-[1.02]'
                )}
              >
                {/* アイコン */}
                <div className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                  isProcessing
                    ? 'bg-gradient-to-r ' + feature.color
                    : isDisabled
                    ? 'bg-gray-200'
                    : 'bg-gradient-to-r ' + feature.color
                )}>
                  {isProcessing ? (
                    <Loader2 size={16} className="text-white animate-spin" />
                  ) : (
                    <feature.icon size={16} className={isDisabled ? 'text-gray-400' : 'text-white'} />
                  )}
                </div>

                {/* ラベル */}
                <div className="flex-1 min-w-0">
                  <div className={cn(
                    'font-medium truncate',
                    isDisabled ? 'text-gray-400' : 'text-gray-800'
                  )}>
                    {feature.label}
                  </div>
                  <div className={cn(
                    'text-[10px] truncate',
                    isDisabled ? 'text-gray-300' : 'text-gray-500'
                  )}>
                    {isProcessing ? '解析中...' : feature.description}
                  </div>
                </div>

                {/* 処理中インジケーター */}
                {isProcessing && (
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-pink-500/10 animate-pulse" />
                )}
              </button>
            );
          })}

          {/* AI無効時のメッセージ */}
          {aiDisabled && (
            <div className="mt-2 text-[10px] text-gray-400 text-center bg-gray-50 rounded p-1.5">
              図面を選択してください
            </div>
          )}
        </div>
        )}

        {/* AI Overlay Toggles */}
        {(hasRoomResult || hasOpeningResult) && (
          <div className="mt-2 pt-2 border-t border-gray-100">
            <div className="text-xs text-gray-500 mb-1 px-1">オーバーレイ表示</div>
            <div className="flex gap-1">
              {hasRoomResult && (
                <Tooltip label="部屋オーバーレイ">
                  <button
                    onClick={onToggleRoomOverlay}
                    className={cn(
                      'flex-1 p-1.5 rounded text-xs transition-colors',
                      showRoomOverlay ? 'bg-[#0099CB] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    )}
                  >
                    <Home size={14} className="mx-auto" />
                  </button>
                </Tooltip>
              )}
              {hasOpeningResult && (
                <Tooltip label="開口部オーバーレイ">
                  <button
                    onClick={onToggleOpeningOverlay}
                    className={cn(
                      'flex-1 p-1.5 rounded text-xs transition-colors',
                      showOpeningOverlay ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    )}
                  >
                    <DoorOpen size={14} className="mx-auto" />
                  </button>
                </Tooltip>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-2 border-b border-gray-200">
        <div className="space-y-1">
          <button
            onClick={onMaterials}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-gray-700 hover:bg-gray-200 transition-colors"
          >
            <Package size={16} />
            部材マスタ
          </button>
          <button
            onClick={onExport}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-gray-700 hover:bg-gray-200 transition-colors"
          >
            <Download size={16} />
            出力
          </button>
        </div>
      </div>

    </div>
  );
}
