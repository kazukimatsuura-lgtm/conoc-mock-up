'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Square,
  AlertCircle,
  CheckCircle2,
  Home,
  DoorOpen,
  ChevronLeft,
  ChevronRight,
  X,
  Info,
  Sparkles,
  Image as ImageIcon,
} from 'lucide-react';
import { Button, Modal } from '@/components/ui';
import { Header } from '@/components/layout';
import { useProjectStore } from '@/stores/project-store';
import { useDrawingStore } from '@/stores/drawing-store';
import { useViewerStore, useTakeoffStore, useGroupStore, useCustomColumnStore } from '@/stores';
import { cn } from '@/lib/utils';
import { DrawingThumbnailList } from '@/components/viewer/drawing-thumbnail-list';
import { DrawingCanvas } from '@/components/viewer/drawing-canvas';
import { TakeoffResultsPanel } from '@/components/viewer/takeoff-results-panel';
import { ToolSettingsPanel } from '@/components/viewer/tool-settings-panel';
import { ExportPanel } from '@/components/viewer/export-panel';
import { LeftSidebar } from '@/components/viewer/left-sidebar';
import { ViewModeToggle } from '@/components/viewer/view-mode-toggle';
import { TakeoffSpreadsheet } from '@/components/viewer/takeoff-spreadsheet';
import { ResizeHandle } from '@/components/viewer/resize-handle';
import { TreePanel } from '@/components/viewer/tree-panel';
import { DrawingPreviewModal } from '@/components/viewer/drawing-preview-modal';
import type { AiFeatureType } from '@/components/viewer/ai-features-menu';
import {
  analyzeDrawingWithAi,
  detectRooms,
  detectOpenings,
  type RoomDetectionResult,
  type OpeningDetectionResult,
} from '@/lib/ai-takeoff';
import { TAKEOFF_CATEGORIES, CATEGORY_ITEM_TYPES } from '@/types/takeoff';

const TOOL_KEYS: Record<string, string> = {
  scale: 'S',
  point: 'P',
  line: 'L',
  area: 'A',
  rect: 'R',
};

// AI処理経過時間表示コンポーネント
function AiProcessingTimer({ startTime }: { startTime: number }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  return (
    <div className="text-sm text-gray-400 mb-4">
      経過時間: <span className="font-mono">{minutes}:{seconds.toString().padStart(2, '0')}</span>
    </div>
  );
}

// AI分析結果のプレビュー用インターフェース
interface AiResultPreview {
  items: Array<{
    itemType: string;
    category: string;
    quantity: number;
    unit: string;
    confidence: number;
    specification?: string;
    modelNumber?: string;
    standard?: string;
    remarks?: string;
    locations: Array<{ x: number; y: number; label?: string }>;
  }>;
  summary?: string;
  processingTime: number;
}

export default function ViewerPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  const { currentProject, loadProject, isLoading: projectLoading } = useProjectStore();
  const { drawings, currentDrawing, loadDrawings, setCurrentDrawing, updateDrawingScale } = useDrawingStore();
  const { loadItems, addAiItems, undo, redo, canUndo, canRedo, items, selectedItemIds } = useTakeoffStore();
  const { loadGroups, ensureGroupsForCategory } = useGroupStore();
  const { loadColumns } = useCustomColumnStore();

  const {
    activeTool,
    setActiveTool,
    zoomLevel,
    setZoomLevel,
    showGrid,
    toggleGrid,
    mousePosition,
    viewMode,
    resetViewer,
  } = useViewerStore();

  const [selectedCategory, setSelectedCategory] = useState('全て');

  // パネル開閉状態 + リサイズ幅
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const [leftPanelWidth, setLeftPanelWidth] = useState(200);
  const [rightPanelWidth, setRightPanelWidth] = useState(320);

  const LEFT_MIN = 150;
  const LEFT_MAX = 500;
  const RIGHT_MIN = 250;
  const RIGHT_MAX = 600;

  const handleLeftResize = useCallback((delta: number) => {
    setLeftPanelWidth(w => Math.min(LEFT_MAX, Math.max(LEFT_MIN, w + delta)));
  }, []);

  const handleRightResize = useCallback((delta: number) => {
    setRightPanelWidth(w => Math.min(RIGHT_MAX, Math.max(RIGHT_MIN, w + delta)));
  }, []);

  // 操作ガイドバー表示
  const [showHelpBar, setShowHelpBar] = useState(true);

  // 縮尺設定（図面上で直接）
  const [scaleLinePixels, setScaleLinePixels] = useState<number | null>(null);
  const [showScaleInput, setShowScaleInput] = useState(false);
  const [scaleInputValue, setScaleInputValue] = useState('');
  const [scaleInputUnit, setScaleInputUnit] = useState<'mm' | 'm'>('mm');

  // AI拾い出し関連のstate
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [processingFeature, setProcessingFeature] = useState<AiFeatureType | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<AiResultPreview | null>(null);
  const [showAiResultModal, setShowAiResultModal] = useState(false);
  const [processingStartTime, setProcessingStartTime] = useState<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // AI部屋検出結果
  const [roomResult, setRoomResult] = useState<RoomDetectionResult | null>(null);
  const [showRoomModal, setShowRoomModal] = useState(false);

  // AI開口部検出結果
  const [openingResult, setOpeningResult] = useState<OpeningDetectionResult | null>(null);
  const [showOpeningModal, setShowOpeningModal] = useState(false);

  // AIオーバーレイ表示状態
  const [showRoomOverlay, setShowRoomOverlay] = useState(false);
  const [showOpeningOverlay, setShowOpeningOverlay] = useState(false);

  // エクスポート関連のstate
  const [showExportPanel, setShowExportPanel] = useState(false);

  // 図面プレビューモーダル（一覧モード用）
  const [showDrawingPreview, setShowDrawingPreview] = useState(false);

  // 選択アイテムのハイライト用
  const highlightItems = items.filter(item => selectedItemIds.has(item.id));

  // Load project and drawings on mount
  useEffect(() => {
    loadProject(projectId);
    loadDrawings(projectId);
    return () => resetViewer();
  }, [projectId, loadProject, loadDrawings, resetViewer]);

  // Load takeoff items, groups, and custom columns when drawing changes
  useEffect(() => {
    if (currentDrawing?.id) {
      loadItems(currentDrawing.id);
      loadGroups(currentDrawing.id);
      loadColumns(currentDrawing.id);
    }
  }, [currentDrawing?.id, loadItems, loadGroups, loadColumns]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }

      // Undo/Redo shortcuts
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }

      // Redo with Ctrl+Y
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo();
        return;
      }

      const key = e.key.toUpperCase();
      const toolId = Object.entries(TOOL_KEYS).find(([, k]) => k === key)?.[0];
      if (toolId) {
        setActiveTool(toolId as Parameters<typeof setActiveTool>[0]);
      }

      // Zoom shortcuts
      if (e.key === '+' || e.key === '=') {
        setZoomLevel(zoomLevel + 25);
      } else if (e.key === '-') {
        setZoomLevel(zoomLevel - 25);
      } else if (e.key === '0') {
        setZoomLevel(100);
      } else if (e.key === 'g' || e.key === 'G') {
        toggleGrid();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveTool, setZoomLevel, zoomLevel, toggleGrid, undo, redo]);

  const handleZoomIn = () => setZoomLevel(zoomLevel + 25);
  const handleZoomOut = () => setZoomLevel(zoomLevel - 25);

  // 縮尺線描画完了時のコールバック
  const handleScaleLineComplete = useCallback((pixelLength: number) => {
    setScaleLinePixels(pixelLength);
    setShowScaleInput(true);
    setScaleInputValue('');
  }, []);

  // 縮尺を適用
  const handleApplyScale = useCallback(async () => {
    if (!currentDrawing || !scaleLinePixels || !scaleInputValue) return;

    const realValue = parseFloat(scaleInputValue);
    if (isNaN(realValue) || realValue <= 0) return;

    // mmに変換
    const realMm = scaleInputUnit === 'm' ? realValue * 1000 : realValue;
    const pixelPerMm = scaleLinePixels / realMm;
    const ratio = Math.round(realMm / scaleLinePixels);

    const scale = {
      pixelLength: scaleLinePixels,
      realLength: realMm,
      unit: scaleInputUnit,
      ratio,
      pixelPerMm,
    };

    await updateDrawingScale(currentDrawing.id, scale);
    setShowScaleInput(false);
    setScaleLinePixels(null);
    setActiveTool('point');
  }, [currentDrawing, scaleLinePixels, scaleInputValue, scaleInputUnit, updateDrawingScale, setActiveTool]);

  // AI処理キャンセル
  const handleCancelAiProcessing = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsAiProcessing(false);
    setProcessingFeature(null);
    setAiError('処理がキャンセルされました');
  }, []);

  // AI機能実行ハンドラー
  const handleAiFeature = useCallback(async (feature: AiFeatureType) => {
    if (!currentDrawing?.imageData) {
      setAiError('図面が選択されていません');
      return;
    }

    // 既存の処理をキャンセル
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // 新しいAbortControllerを作成
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setIsAiProcessing(true);
    setProcessingFeature(feature);
    setProcessingStartTime(Date.now());
    setAiError(null);

    try {
      switch (feature) {
        case 'takeoff': {
          setAiResult(null);
          const result = await analyzeDrawingWithAi(currentDrawing.imageData, signal);
          if (signal.aborted) return;
          if (!result.success) {
            setAiError(result.error || 'AI分析に失敗しました');
            return;
          }
          if (result.items.length === 0) {
            setAiError('図面から設備・部材を検出できませんでした。');
            return;
          }
          setAiResult({
            items: result.items,
            summary: result.summary,
            processingTime: result.processingTime,
          });
          setShowAiResultModal(true);
          break;
        }

        case 'room': {
          setRoomResult(null);
          const result = await detectRooms(currentDrawing.imageData, signal);
          if (signal.aborted) return;
          if (!result.success) {
            setAiError(result.error || '部屋検出に失敗しました');
            return;
          }
          if (result.rooms.length === 0) {
            setAiError('図面から部屋を検出できませんでした。');
            return;
          }
          setRoomResult(result);
          setShowRoomOverlay(true);
          setShowRoomModal(true);
          break;
        }

        case 'opening': {
          setOpeningResult(null);
          const result = await detectOpenings(currentDrawing.imageData, signal);
          if (signal.aborted) return;
          if (!result.success) {
            setAiError(result.error || '開口部検出に失敗しました');
            return;
          }
          if (result.openings.length === 0) {
            setAiError('図面から開口部を検出できませんでした。');
            return;
          }
          setOpeningResult(result);
          setShowOpeningOverlay(true);
          setShowOpeningModal(true);
          break;
        }
      }
    } catch (err) {
      if (signal.aborted) return;
      setAiError(err instanceof Error ? err.message : 'AI処理中にエラーが発生しました');
    } finally {
      if (!signal.aborted) {
        setIsAiProcessing(false);
        setProcessingFeature(null);
      }
      abortControllerRef.current = null;
    }
  }, [currentDrawing]);

  // AI結果を拾い出しに追加（グループ自動作成連携）
  const handleApplyAiResults = useCallback(async () => {
    if (!aiResult || !currentDrawing) return;

    try {
      // カテゴリごとにグループを自動作成
      const categories = [...new Set(aiResult.items.map(i => i.category))];
      const groupIdMap: Record<string, string> = {};
      for (const cat of categories) {
        const group = await ensureGroupsForCategory(currentDrawing.id, cat);
        groupIdMap[cat] = group.id;
      }

      await addAiItems(currentDrawing.id, aiResult.items, groupIdMap);
      setShowAiResultModal(false);
      setAiResult(null);
    } catch (err) {
      console.error('Failed to apply AI results:', err);
    }
  }, [aiResult, currentDrawing, addAiItems, ensureGroupsForCategory]);

  // カテゴリ名を取得
  const getCategoryLabel = (categoryId: string) => {
    const category = TAKEOFF_CATEGORIES.find(c => c.id === categoryId);
    return category?.label || categoryId;
  };

  // アイテムタイプ名を取得
  const getItemTypeLabel = (categoryId: string, itemTypeId: string) => {
    const items = CATEGORY_ITEM_TYPES[categoryId] || [];
    const item = items.find(i => i.id === itemTypeId);
    return item?.label || itemTypeId;
  };

  if (projectLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#0099CB] border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!currentProject) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">プロジェクトが見つかりません</p>
          <Button variant="secondary" onClick={() => router.push('/materials')}>
            戻る
          </Button>
        </div>
      </div>
    );
  }

  const scaleText = currentDrawing?.scale
    ? `1:${currentDrawing.scale.ratio}`
    : '未設定';

  const isDrawingTool = ['point', 'line', 'area', 'rect', 'scale'].includes(activeTool);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col overflow-hidden">
      <Header projectName={currentProject.name} />

      {/* 操作ガイドバー */}
      {showHelpBar && (
        <div className="flex-shrink-0 bg-[#E0F4FA] border-b border-[#0099CB] px-4 py-2 z-30">
          <div className="flex items-center justify-between max-w-full">
            <div className="flex items-center gap-6 text-sm text-[#006A8E]">
              <div className="flex items-center gap-1.5">
                <Info size={16} className="text-[#0088B4]" />
                <span className="font-medium">操作方法:</span>
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                <span>
                  <span className="font-medium">図面移動:</span> 右クリック+ドラッグ または 中クリック+ドラッグ
                </span>
                <span className="text-[#0099CB]">|</span>
                <span>
                  <span className="font-medium">ズーム:</span> Ctrl/Cmd + マウスホイール
                </span>
                <span className="text-[#0099CB]">|</span>
                <span>
                  <span className="font-medium">パネルサイズ変更:</span> パネル境界をドラッグ&ドロップで幅を調整
                </span>
              </div>
            </div>
            <button
              onClick={() => setShowHelpBar(false)}
              className="p-1 hover:bg-[#E0F4FA] rounded transition-colors text-[#0088B4]"
              title="閉じる"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel: Sidebar + Thumbnails */}
        <div
          className={cn(
            "relative flex-shrink-0 flex flex-col overflow-hidden",
            !isLeftPanelOpen && "w-0"
          )}
          style={isLeftPanelOpen ? { width: leftPanelWidth } : undefined}
        >
          {isLeftPanelOpen && (
            <>
              {/* View Mode Toggle - 左パネル最上部（両モード共通） */}
              <div className="px-3 py-2 border-b border-gray-200 bg-white flex-shrink-0">
                <ViewModeToggle />
              </div>

              {viewMode === 'drawing' ? (
                <>
                  {/* Left Sidebar - Tools, Zoom, AI */}
                  <div className="overflow-x-auto overflow-y-auto flex-shrink-0">
                    <LeftSidebar
                      activeTool={activeTool}
                      setActiveTool={setActiveTool}
                      zoomLevel={zoomLevel}
                      onZoomIn={handleZoomIn}
                      onZoomOut={handleZoomOut}
                      showGrid={showGrid}
                      toggleGrid={toggleGrid}
                      canUndo={canUndo}
                      canRedo={canRedo}
                      onUndo={undo}
                      onRedo={redo}
                      onAiFeature={handleAiFeature}
                      isAiProcessing={isAiProcessing}
                      processingFeature={processingFeature}
                      aiDisabled={!currentDrawing}
                      hasRoomResult={!!roomResult}
                      hasOpeningResult={!!openingResult}
                      showRoomOverlay={showRoomOverlay}
                      showOpeningOverlay={showOpeningOverlay}
                      onToggleRoomOverlay={() => setShowRoomOverlay(!showRoomOverlay)}
                      onToggleOpeningOverlay={() => setShowOpeningOverlay(!showOpeningOverlay)}
                      onExport={() => setShowExportPanel(true)}
                      onMaterials={() => window.location.href = '/materials'}
                      scaleText={scaleText}
                    />
                  </div>
                  {/* Drawing Thumbnails */}
                  <div className="flex-1 min-h-0 overflow-hidden">
                    <DrawingThumbnailList
                      drawings={drawings}
                      currentDrawingId={currentDrawing?.id}
                      onSelect={setCurrentDrawing}
                      projectId={projectId}
                    />
                  </div>
                </>
              ) : (
                <>
                  {/* Tree Panel - 一覧モード時のツリー表示 */}
                  <div className="flex-1 min-h-0 overflow-hidden">
                    <TreePanel drawingId={currentDrawing?.id} />
                  </div>
                </>
              )}
              {/* Resize handle */}
              <ResizeHandle side="left" onResize={handleLeftResize} />
            </>
          )}
          {/* Left Panel Toggle Button */}
          <button
            onClick={() => setIsLeftPanelOpen(!isLeftPanelOpen)}
            className={cn(
              "absolute top-1/2 -translate-y-1/2 z-40 bg-white border border-gray-300 rounded-r-lg p-1 shadow-md hover:bg-gray-50 transition-colors",
              isLeftPanelOpen ? "right-0 translate-x-full" : "left-0"
            )}
            title={isLeftPanelOpen ? "パネルを閉じる" : "パネルを開く"}
          >
            {isLeftPanelOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>

        {/* Center: Canvas Area or Spreadsheet */}
        {viewMode === 'drawing' ? (
          <div className="flex-1 bg-[#1a1a1a] relative flex flex-col overflow-hidden">

            {/* AI Processing Overlay */}
            {isAiProcessing && processingFeature && (
              <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 text-center">
                  {/* アニメーションアイコン */}
                  <div className="relative w-24 h-24 mx-auto mb-6">
                    <div className="absolute inset-0 rounded-full border-4 border-purple-200 animate-ping" />
                    <div className="absolute inset-0 rounded-full border-4 border-t-purple-600 border-r-purple-600 border-b-transparent border-l-transparent animate-spin" />
                    <div className="absolute inset-3 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                      <Sparkles size={32} className="text-white animate-pulse" />
                    </div>
                  </div>

                  <h3 className="text-xl font-bold text-gray-800 mb-2">
                    {processingFeature === 'takeoff' && 'AI拾い出し中...'}
                    {processingFeature === 'room' && '部屋を検出中...'}
                    {processingFeature === 'opening' && '開口部を検出中...'}
                  </h3>
                  <p className="text-gray-500 mb-6">
                    図面をAIで解析しています。しばらくお待ちください。
                  </p>

                  <AiProcessingTimer startTime={processingStartTime} />

                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-6">
                    <div className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 rounded-full animate-shimmer"
                         style={{
                           width: '100%',
                           backgroundSize: '200% 100%',
                           animation: 'shimmer 2s linear infinite'
                         }}
                    />
                  </div>

                  <button
                    onClick={handleCancelAiProcessing}
                    className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            )}

            {/* AI Error Toast */}
            {aiError && (
              <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3 shadow-lg max-w-md">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-red-700">{aiError}</p>
                  </div>
                  <button
                    onClick={() => setAiError(null)}
                    className="text-red-400 hover:text-red-600"
                  >
                    ×
                  </button>
                </div>
              </div>
            )}

            {/* Tool Settings Panel (for drawing tools) */}
            {isDrawingTool && (
              <div className="absolute top-20 left-4 z-20 pointer-events-auto">
                <ToolSettingsPanel />
              </div>
            )}

            {/* Canvas */}
            <DrawingCanvas
              drawing={currentDrawing}
              aiOverlay={{
                rooms: roomResult?.rooms,
                openings: openingResult?.openings,
                showRooms: showRoomOverlay,
                showOpenings: showOpeningOverlay,
              }}
              highlightItems={highlightItems}
              onScaleLineComplete={handleScaleLineComplete}
            />

            {/* 縮尺入力ポップアップ */}
            {showScaleInput && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-auto">
                <div className="bg-white rounded-xl shadow-2xl p-6 min-w-[320px] border border-gray-200">
                  <h3 className="font-bold text-gray-800 mb-4 text-center">縮尺設定</h3>
                  <div className="space-y-4">
                    <div className="text-center text-sm text-gray-500">
                      描画した線の長さ: <span className="font-mono font-bold text-[#0088B4]">{scaleLinePixels?.toFixed(0)} px</span>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        実際の長さを入力
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={scaleInputValue}
                          onChange={(e) => setScaleInputValue(e.target.value)}
                          placeholder="例: 5000"
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0099CB] focus:border-[#0099CB] text-right font-mono"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleApplyScale();
                            if (e.key === 'Escape') {
                              setShowScaleInput(false);
                              setScaleLinePixels(null);
                            }
                          }}
                        />
                        <select
                          value={scaleInputUnit}
                          onChange={(e) => setScaleInputUnit(e.target.value as 'mm' | 'm')}
                          className="px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-[#0099CB]"
                        >
                          <option value="mm">mm</option>
                          <option value="m">m</option>
                        </select>
                      </div>
                    </div>
                    {scaleInputValue && scaleLinePixels && (
                      <div className="bg-[#E0F4FA] rounded-lg p-3 text-center">
                        <span className="text-sm text-gray-600">計算縮尺: </span>
                        <span className="font-bold text-[#006A8E]">
                          1 : {Math.round((scaleInputUnit === 'm' ? parseFloat(scaleInputValue) * 1000 : parseFloat(scaleInputValue)) / scaleLinePixels)}
                        </span>
                      </div>
                    )}
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setShowScaleInput(false);
                          setScaleLinePixels(null);
                        }}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        キャンセル
                      </button>
                      <button
                        onClick={handleApplyScale}
                        disabled={!scaleInputValue || parseFloat(scaleInputValue) <= 0}
                        className="flex-1 px-4 py-2 bg-[#0099CB] text-white rounded-lg hover:bg-[#0088B4] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                      >
                        適用
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Status Bar */}
            <div className="h-8 bg-[#2a2a2a] text-gray-400 text-xs flex items-center justify-between px-4 border-t border-[#333]">
              <div className="w-32 font-mono">
                X: {mousePosition.x}, Y: {mousePosition.y}
              </div>
              <div>
                {activeTool === 'point' && 'クリックして点を追加'}
                {activeTool === 'line' && '2点をクリックして線を描画'}
                {activeTool === 'area' && 'クリックで頂点を追加、ダブルクリックで確定'}
                {activeTool === 'rect' && 'ドラッグで矩形を描画'}
                {activeTool === 'scale' && '図面上の既知の寸法線を引いてください（2点をクリック）'}
                {!['point', 'line', 'area', 'rect', 'scale'].includes(activeTool) && '右ドラッグで移動 / Ctrl+ホイールでズーム'}
              </div>
              <div className="w-40 text-right">縮尺: {scaleText}</div>
            </div>
          </div>
        ) : (
          /* Table Mode: Spreadsheet */
          <div className="flex-1 bg-white relative flex flex-col overflow-hidden">
            {/* AI Processing Overlay (also in table mode) */}
            {isAiProcessing && processingFeature && (
              <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 text-center">
                  <div className="relative w-24 h-24 mx-auto mb-6">
                    <div className="absolute inset-0 rounded-full border-4 border-purple-200 animate-ping" />
                    <div className="absolute inset-0 rounded-full border-4 border-t-purple-600 border-r-purple-600 border-b-transparent border-l-transparent animate-spin" />
                    <div className="absolute inset-3 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                      <Sparkles size={32} className="text-white animate-pulse" />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">
                    {processingFeature === 'takeoff' && 'AI拾い出し中...'}
                    {processingFeature === 'room' && '部屋を検出中...'}
                    {processingFeature === 'opening' && '開口部を検出中...'}
                  </h3>
                  <p className="text-gray-500 mb-6">図面をAIで解析しています。</p>
                  <AiProcessingTimer startTime={processingStartTime} />
                  <button
                    onClick={handleCancelAiProcessing}
                    className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            )}

            {/* AI Error Toast */}
            {aiError && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3 shadow-lg max-w-md">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-red-700">{aiError}</p>
                  </div>
                  <button onClick={() => setAiError(null)} className="text-red-400 hover:text-red-600">×</button>
                </div>
              </div>
            )}

            <TakeoffSpreadsheet drawingId={currentDrawing?.id} />
          </div>
        )}

        {/* Right Panel: Results (only in drawing mode) */}
        {viewMode === 'drawing' && (
          <div
            className={cn(
              "relative flex-shrink-0 overflow-hidden",
              !isRightPanelOpen && "w-0"
            )}
            style={isRightPanelOpen ? { width: rightPanelWidth } : undefined}
          >
            {/* Right Panel Toggle Button */}
            <button
              onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}
              className={cn(
                "absolute top-1/2 -translate-y-1/2 z-40 bg-white border border-gray-300 rounded-l-lg p-1 shadow-md hover:bg-gray-50 transition-colors",
                isRightPanelOpen ? "left-0 -translate-x-full" : "right-0"
              )}
              title={isRightPanelOpen ? "拾い出し結果を閉じる" : "拾い出し結果を開く"}
            >
              {isRightPanelOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
            {isRightPanelOpen && (
              <>
                <ResizeHandle side="right" onResize={handleRightResize} />
                <TakeoffResultsPanel
                  drawingId={currentDrawing?.id}
                  selectedCategory={selectedCategory}
                  onCategoryChange={setSelectedCategory}
                />
              </>
            )}
          </div>
        )}
      </div>

      {/* AI Result Modal */}
      <Modal
        isOpen={showAiResultModal}
        onClose={() => setShowAiResultModal(false)}
        title="AI拾い出し結果"
        size="lg"
      >
        <div className="space-y-4">
          {/* Summary */}
          {aiResult?.summary && (
            <div className="bg-[#E0F4FA] border border-[#0099CB] rounded-lg p-4">
              <p className="text-sm text-[#006A8E]">{aiResult.summary}</p>
            </div>
          )}

          {/* Stats */}
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <CheckCircle2 size={16} className="text-green-500" />
              {aiResult?.items.length || 0} 件検出
            </span>
            <span>処理時間: {((aiResult?.processingTime || 0) / 1000).toFixed(1)}秒</span>
          </div>

          {/* Items List */}
          <div className="max-h-96 overflow-y-auto border rounded-lg divide-y">
            {aiResult?.items.map((item, idx) => (
              <div key={idx} className="p-3 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">
                      {getItemTypeLabel(item.category, item.itemType)}
                    </span>
                    <span className="ml-2 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                      {getCategoryLabel(item.category)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-medium">
                      {item.quantity} {item.unit}
                    </span>
                  </div>
                </div>
                {/* 新フィールド表示 */}
                {(item.specification || item.modelNumber || item.standard) && (
                  <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                    {item.specification && <span>仕様: {item.specification}</span>}
                    {item.modelNumber && <span>型番: {item.modelNumber}</span>}
                    {item.standard && <span>規格: {item.standard}</span>}
                  </div>
                )}
                <div className="mt-1 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        item.confidence >= 0.8 ? "bg-green-500" :
                        item.confidence >= 0.5 ? "bg-yellow-500" : "bg-red-500"
                      )}
                      style={{ width: `${item.confidence * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 w-12 text-right">
                    {Math.round(item.confidence * 100)}%
                  </span>
                </div>
                {item.locations.length > 0 && item.locations[0].label && (
                  <p className="mt-1 text-xs text-gray-500">
                    位置: {item.locations.map(l => l.label).filter(Boolean).join(', ')}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="secondary"
              onClick={() => setShowAiResultModal(false)}
            >
              キャンセル
            </Button>
            <Button
              variant="primary"
              onClick={handleApplyAiResults}
            >
              拾い出しに追加
            </Button>
          </div>
        </div>
      </Modal>

      {/* Room Detection Result Modal */}
      <Modal
        isOpen={showRoomModal}
        onClose={() => setShowRoomModal(false)}
        title="部屋検出結果"
        size="lg"
      >
        <div className="space-y-4">
          {roomResult?.summary && (
            <div className="bg-[#E0F4FA] border border-[#0099CB] rounded-lg p-4">
              <p className="text-sm text-[#006A8E]">{roomResult.summary}</p>
            </div>
          )}

          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <Home size={16} className="text-green-500" />
              {roomResult?.roomCount || 0} 部屋検出
            </span>
            {roomResult?.totalArea && (
              <span>合計面積: {roomResult.totalArea.toFixed(2)} m²</span>
            )}
            <span>処理時間: {((roomResult?.processingTime || 0) / 1000).toFixed(1)}秒</span>
          </div>

          <div className="max-h-96 overflow-y-auto border rounded-lg divide-y">
            {roomResult?.rooms.map((room, idx) => (
              <div key={idx} className="p-3 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">{room.name}</span>
                    <span className="ml-2 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                      {room.type}
                    </span>
                  </div>
                  <div className="text-right">
                    {room.area && (
                      <span className="font-mono font-medium">{room.area.toFixed(2)} m²</span>
                    )}
                  </div>
                </div>
                {room.perimeter && (
                  <p className="text-sm text-gray-500 mt-1">周長: {room.perimeter.toFixed(2)} m</p>
                )}
                <div className="mt-1 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        room.confidence >= 0.8 ? "bg-green-500" :
                        room.confidence >= 0.5 ? "bg-yellow-500" : "bg-red-500"
                      )}
                      style={{ width: `${room.confidence * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 w-12 text-right">
                    {Math.round(room.confidence * 100)}%
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center pt-4 border-t">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showRoomOverlay}
                onChange={(e) => setShowRoomOverlay(e.target.checked)}
                className="rounded border-gray-300 text-[#0099CB] focus:ring-[#0099CB]"
              />
              <span className="text-sm text-gray-700">図面に表示</span>
            </label>
            <Button variant="secondary" onClick={() => setShowRoomModal(false)}>
              閉じる
            </Button>
          </div>
        </div>
      </Modal>

      {/* Opening Detection Result Modal */}
      <Modal
        isOpen={showOpeningModal}
        onClose={() => setShowOpeningModal(false)}
        title="開口部検出結果"
        size="lg"
      >
        <div className="space-y-4">
          {openingResult?.notes && (
            <div className="bg-[#E0F4FA] border border-[#0099CB] rounded-lg p-4">
              <p className="text-sm text-[#006A8E]">{openingResult.notes}</p>
            </div>
          )}

          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <DoorOpen size={16} className="text-[#0099CB]" />
              ドア: {openingResult?.summary.totalDoors || 0}
            </span>
            <span>窓: {openingResult?.summary.totalWindows || 0}</span>
            <span>合計: {openingResult?.summary.totalOpenings || 0}</span>
            <span>処理時間: {((openingResult?.processingTime || 0) / 1000).toFixed(1)}秒</span>
          </div>

          <div className="max-h-96 overflow-y-auto border rounded-lg divide-y">
            {openingResult?.openings.map((opening, idx) => (
              <div key={idx} className="p-3 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {opening.type === 'door' ? (
                      <DoorOpen className="w-5 h-5 text-[#0099CB]" />
                    ) : (
                      <Square className="w-5 h-5 text-green-500" />
                    )}
                    <span className="font-medium">
                      {opening.type === 'door' ? 'ドア' :
                       opening.type === 'window' ? '窓' :
                       opening.type === 'shutter' ? 'シャッター' : '開口'}
                    </span>
                    <span className="text-xs text-gray-500">({opening.subtype})</span>
                    {opening.label && (
                      <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{opening.label}</span>
                    )}
                  </div>
                  <div className="text-right text-sm text-gray-600">
                    {opening.width && opening.height && (
                      <span>{opening.width} x {opening.height} mm</span>
                    )}
                  </div>
                </div>
                {opening.roomName && (
                  <p className="text-sm text-gray-500 mt-1">部屋: {opening.roomName}</p>
                )}
                <div className="mt-1 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        opening.confidence >= 0.8 ? "bg-green-500" :
                        opening.confidence >= 0.5 ? "bg-yellow-500" : "bg-red-500"
                      )}
                      style={{ width: `${opening.confidence * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 w-12 text-right">
                    {Math.round(opening.confidence * 100)}%
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center pt-4 border-t">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showOpeningOverlay}
                onChange={(e) => setShowOpeningOverlay(e.target.checked)}
                className="rounded border-gray-300 text-[#0099CB] focus:ring-[#0099CB]"
              />
              <span className="text-sm text-gray-700">図面に表示</span>
            </label>
            <Button variant="secondary" onClick={() => setShowOpeningModal(false)}>
              閉じる
            </Button>
          </div>
        </div>
      </Modal>

      {/* Export Panel */}
      {currentProject && (
        <ExportPanel
          isOpen={showExportPanel}
          onClose={() => setShowExportPanel(false)}
          project={currentProject}
          drawings={drawings}
          items={useTakeoffStore.getState().items}
        />
      )}

      {/* Drawing Preview Modal (一覧モード用) */}
      <DrawingPreviewModal
        isOpen={showDrawingPreview}
        onClose={() => setShowDrawingPreview(false)}
        drawings={drawings}
        currentDrawing={currentDrawing}
        onSelectDrawing={setCurrentDrawing}
      />
    </div>
  );
}
