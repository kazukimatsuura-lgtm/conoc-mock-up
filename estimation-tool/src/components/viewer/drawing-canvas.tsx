'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import type { Drawing, TakeoffItem } from '@/types';
import { useViewerStore, useTakeoffStore } from '@/stores';
import { cn } from '@/lib/utils';
import type { RoomDetectionResult, OpeningDetectionResult, DimensionOcrResult } from '@/lib/ai-takeoff';
import { TakeoffHighlightOverlay } from './takeoff-highlight-overlay';

// AI検出結果の型
interface AiOverlayData {
  rooms?: RoomDetectionResult['rooms'];
  openings?: OpeningDetectionResult['openings'];
  dimensions?: DimensionOcrResult['dimensions'];
  showRooms?: boolean;
  showOpenings?: boolean;
  showDimensions?: boolean;
}

interface DrawingCanvasProps {
  drawing: Drawing | null;
  aiOverlay?: AiOverlayData;
  highlightItems?: TakeoffItem[];
  onScaleLineComplete?: (pixelLength: number) => void;
}

interface Point {
  x: number;
  y: number;
}

export function DrawingCanvas({ drawing, aiOverlay, highlightItems, onScaleLineComplete }: DrawingCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Point>({ x: 0, y: 0 });

  const {
    activeTool,
    zoomLevel,
    setZoomLevel,
    panOffset,
    setPanOffset,
    isDrawing,
    setIsDrawing,
    drawingPoints,
    addDrawingPoint,
    clearDrawingPoints,
    setMousePosition,
    showGrid,
    currentCategory,
    currentItemType,
    viewInitializedDrawingId,
    setViewInitializedDrawingId,
  } = useViewerStore();

  const { items, addPointItem, addLineItem, addAreaItem, addRectItem } = useTakeoffStore();

  // Load image dimensions
  useEffect(() => {
    if (drawing?.imageData) {
      const img = new Image();
      img.onload = () => {
        setImageSize({ width: img.width, height: img.height });
      };
      img.src = drawing.imageData;
    }
  }, [drawing?.imageData]);

  // Fit the drawing to the viewport on first load (skip if returning from table mode)
  useEffect(() => {
    if (containerRef.current && imageSize.width > 0 && drawing) {
      // Already initialized for this drawing — preserve user's pan/zoom
      if (viewInitializedDrawingId === drawing.id) return;

      const container = containerRef.current;
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;

      // Fit to width, position at top
      const fitScale = (containerWidth / imageSize.width) * 0.95;
      const fitZoom = Math.max(10, Math.min(Math.round(fitScale * 100), 200));
      const actualScale = fitZoom / 100;
      setZoomLevel(fitZoom);

      const scaledWidth = imageSize.width * actualScale;
      setPanOffset({
        x: (containerWidth - scaledWidth) / 2,
        y: 10,  // top-aligned with small padding
      });

      setViewInitializedDrawingId(drawing.id);
    }
  }, [imageSize, drawing?.id]);

  // Handle wheel zoom (only with Ctrl/Cmd key)
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      // Ctrl/Cmd + ホイールでのみズーム
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -10 : 10;
        setZoomLevel(zoomLevel + delta);
      }
    },
    [zoomLevel, setZoomLevel]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => container.removeEventListener('wheel', handleWheel);
    }
  }, [handleWheel]);

  // Convert screen coordinates to image coordinates
  const screenToImage = useCallback(
    (screenX: number, screenY: number): Point => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };

      const scale = zoomLevel / 100;
      const x = (screenX - rect.left - panOffset.x) / scale;
      const y = (screenY - rect.top - panOffset.y) / scale;
      return { x: Math.round(x), y: Math.round(y) };
    },
    [zoomLevel, panOffset]
  );

  // Convert pixel distance to real-world measurement (mm)
  const pixelToReal = useCallback(
    (pixelDistance: number): number => {
      if (!drawing?.scale) return pixelDistance;
      return pixelDistance / drawing.scale.pixelPerMm;
    },
    [drawing?.scale]
  );

  // Calculate distance between two points in pixels
  const calculateDistance = (p1: Point, p2: Point): number => {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  };

  // Calculate polygon area using Shoelace formula
  const calculatePolygonArea = (points: Point[]): number => {
    if (points.length < 3) return 0;
    let area = 0;
    const n = points.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += points[i].x * points[j].y;
      area -= points[j].x * points[i].y;
    }
    return Math.abs(area) / 2;
  };

  // Handle mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    const imagePoint = screenToImage(e.clientX, e.clientY);

    console.log('[DrawingCanvas] Mouse down:', {
      activeTool,
      drawing: drawing ? { id: drawing.id, fileName: drawing.fileName } : null,
      imagePoint,
      currentCategory,
      currentItemType,
    });

    // Middle button or right button for panning
    if (e.button === 1 || e.button === 2) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
      return;
    }

    // Point tool
    if (activeTool === 'point' && drawing) {
      const itemType = currentItemType || '新規アイテム';
      console.log('[DrawingCanvas] Adding point:', { itemType, currentCategory, imagePoint });
      addPointItem(
        drawing.id,
        { x: imagePoint.x, y: imagePoint.y },
        itemType,
        currentCategory
      );
      return;
    }

    // Scale tool
    if (activeTool === 'scale') {
      if (!isDrawing) {
        setIsDrawing(true);
        addDrawingPoint(imagePoint);
      } else {
        // Complete the scale line
        const start = drawingPoints[0];
        const end = imagePoint;
        const pixelLength = calculateDistance(start, end);

        // Call the callback with the pixel length
        if (onScaleLineComplete && pixelLength > 0) {
          onScaleLineComplete(pixelLength);
        }
        clearDrawingPoints();
      }
      return;
    }

    // Line tool
    if (activeTool === 'line') {
      if (!isDrawing) {
        setIsDrawing(true);
        addDrawingPoint(imagePoint);
      } else {
        // Complete the line
        const start = drawingPoints[0];
        const end = imagePoint;
        const pixelLength = calculateDistance(start, end);
        const realLength = pixelToReal(pixelLength) / 1000; // Convert to meters

        if (drawing) {
          const itemType = currentItemType || '配管';
          addLineItem(
            drawing.id,
            { x: start.x, y: start.y },
            { x: end.x, y: end.y },
            Math.round(realLength * 100) / 100,
            itemType,
            currentCategory
          );
        }
        clearDrawingPoints();
      }
      return;
    }

    // Area tool
    if (activeTool === 'area') {
      if (!isDrawing) {
        setIsDrawing(true);
      }
      addDrawingPoint(imagePoint);
      return;
    }

    // Rect tool
    if (activeTool === 'rect') {
      if (!isDrawing) {
        setIsDrawing(true);
        addDrawingPoint(imagePoint);
      }
      return;
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const imagePoint = screenToImage(e.clientX, e.clientY);
    setMousePosition(imagePoint);

    if (isPanning) {
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (isPanning) {
      setIsPanning(false);
    }

    // Complete rect on mouse up
    if (activeTool === 'rect' && isDrawing && drawingPoints.length > 0 && drawing) {
      const imagePoint = screenToImage(e.clientX, e.clientY);
      const start = drawingPoints[0];
      const width = Math.abs(imagePoint.x - start.x);
      const height = Math.abs(imagePoint.y - start.y);
      const pixelArea = width * height;

      const realWidth = pixelToReal(width) / 1000; // meters
      const realHeight = pixelToReal(height) / 1000; // meters
      const realArea = realWidth * realHeight;

      const itemType = currentItemType || '床面積';
      addRectItem(
        drawing.id,
        { x: Math.min(start.x, imagePoint.x), y: Math.min(start.y, imagePoint.y) },
        Math.round(realWidth * 100) / 100,
        Math.round(realHeight * 100) / 100,
        Math.round(realArea * 100) / 100,
        itemType,
        currentCategory
      );
      clearDrawingPoints();
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    // Complete area polygon on double click
    if (activeTool === 'area' && isDrawing && drawingPoints.length >= 3 && drawing) {
      const pixelArea = calculatePolygonArea(drawingPoints);
      const pixelPerMm = drawing.scale?.pixelPerMm || 1;
      const realArea = pixelArea / (pixelPerMm * pixelPerMm) / 1000000; // Convert to m²

      const itemType = currentItemType || '床面積';
      addAreaItem(
        drawing.id,
        drawingPoints.map((p) => ({ x: p.x, y: p.y })),
        Math.round(realArea * 100) / 100,
        itemType,
        currentCategory
      );
      clearDrawingPoints();
    }
  };

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clearDrawingPoints();
      }
    },
    [clearDrawingPoints]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Get cursor based on active tool
  const getCursor = () => {
    // Show grabbing cursor when panning (including right-click pan)
    if (isPanning) return 'grabbing';

    switch (activeTool) {
      case 'point':
      case 'line':
      case 'area':
      case 'rect':
      case 'scale':
        return 'crosshair';
      default:
        return 'default';
    }
  };

  const { mousePosition } = useViewerStore();

  if (!drawing) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#1a1a1a]">
        <div className="text-center text-gray-500">
          <ImageIcon size={48} className="mx-auto mb-4 opacity-50" />
          <p>図面を選択してください</p>
        </div>
      </div>
    );
  }

  const scale = zoomLevel / 100;

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-hidden relative"
      style={{ cursor: getCursor() }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => setIsPanning(false)}
      onDoubleClick={handleDoubleClick}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Grid Background */}
      {showGrid && (
        <div
          className="absolute inset-0 pointer-events-none opacity-10"
          style={{
            backgroundImage:
              'linear-gradient(to right, #444 1px, transparent 1px), linear-gradient(to bottom, #444 1px, transparent 1px)',
            backgroundSize: `${20 * scale}px ${20 * scale}px`,
          }}
        />
      )}

      {/* Drawing Image & Overlays */}
      <div
        className="absolute origin-top-left"
        style={{
          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${scale})`,
        }}
      >
        {/* Image */}
        <img
          src={drawing.imageData}
          alt={drawing.fileName}
          className="max-w-none"
          draggable={false}
        />

        {/* SVG Overlay for annotations */}
        <svg
          className="absolute inset-0 pointer-events-none"
          style={{ width: imageSize.width, height: imageSize.height }}
        >
          {/* AI検出: 部屋オーバーレイ */}
          {aiOverlay?.showRooms && aiOverlay.rooms?.map((room, i) => (
            <RoomOverlay
              key={room.id || i}
              room={room}
              imageWidth={imageSize.width}
              imageHeight={imageSize.height}
              scale={scale}
            />
          ))}

          {/* AI検出: 開口部オーバーレイ */}
          {aiOverlay?.showOpenings && aiOverlay.openings?.map((opening, i) => (
            <OpeningOverlay
              key={opening.id || i}
              opening={opening}
              imageWidth={imageSize.width}
              imageHeight={imageSize.height}
              scale={scale}
            />
          ))}

          {/* AI検出: 寸法オーバーレイ */}
          {aiOverlay?.showDimensions && aiOverlay.dimensions?.map((dim, i) => (
            <DimensionOverlay
              key={i}
              dimension={dim}
              imageWidth={imageSize.width}
              imageHeight={imageSize.height}
              scale={scale}
            />
          ))}

          {/* Render existing takeoff items */}
          {items.map((item) => (
            <TakeoffItemOverlay key={item.id} item={item} />
          ))}

          {/* Highlight selected items */}
          {highlightItems && highlightItems.length > 0 && (
            <TakeoffHighlightOverlay
              items={highlightItems}
              imageWidth={imageSize.width}
              imageHeight={imageSize.height}
              scale={scale}
            />
          )}

          {/* Current drawing preview */}
          {isDrawing && activeTool === 'line' && drawingPoints.length > 0 && (
            <line
              x1={drawingPoints[0].x}
              y1={drawingPoints[0].y}
              x2={mousePosition.x}
              y2={mousePosition.y}
              stroke="#3b82f6"
              strokeWidth={2 / scale}
              strokeDasharray={`${4 / scale},${4 / scale}`}
            />
          )}

          {isDrawing && activeTool === 'area' && drawingPoints.length > 0 && (
            <>
              <polygon
                points={[...drawingPoints, mousePosition]
                  .map((p) => `${p.x},${p.y}`)
                  .join(' ')}
                fill="rgba(59, 130, 246, 0.2)"
                stroke="#3b82f6"
                strokeWidth={2 / scale}
                strokeDasharray={`${4 / scale},${4 / scale}`}
              />
              {drawingPoints.map((point, i) => (
                <circle
                  key={i}
                  cx={point.x}
                  cy={point.y}
                  r={4 / scale}
                  fill="#3b82f6"
                />
              ))}
            </>
          )}

          {isDrawing && activeTool === 'rect' && drawingPoints.length > 0 && (
            <rect
              x={Math.min(drawingPoints[0].x, mousePosition.x)}
              y={Math.min(drawingPoints[0].y, mousePosition.y)}
              width={Math.abs(mousePosition.x - drawingPoints[0].x)}
              height={Math.abs(mousePosition.y - drawingPoints[0].y)}
              fill="rgba(59, 130, 246, 0.2)"
              stroke="#3b82f6"
              strokeWidth={2 / scale}
              strokeDasharray={`${4 / scale},${4 / scale}`}
            />
          )}

          {/* Scale tool line preview */}
          {isDrawing && activeTool === 'scale' && drawingPoints.length > 0 && (
            <>
              <line
                x1={drawingPoints[0].x}
                y1={drawingPoints[0].y}
                x2={mousePosition.x}
                y2={mousePosition.y}
                stroke="#f97316"
                strokeWidth={3 / scale}
                strokeDasharray={`${6 / scale},${4 / scale}`}
              />
              {/* Start point marker */}
              <circle
                cx={drawingPoints[0].x}
                cy={drawingPoints[0].y}
                r={6 / scale}
                fill="#f97316"
                stroke="#ffffff"
                strokeWidth={2 / scale}
              />
              {/* End point marker */}
              <circle
                cx={mousePosition.x}
                cy={mousePosition.y}
                r={6 / scale}
                fill="#f97316"
                stroke="#ffffff"
                strokeWidth={2 / scale}
              />
            </>
          )}
        </svg>
      </div>
    </div>
  );
}

// Component to render individual takeoff items
function TakeoffItemOverlay({ item }: { item: TakeoffItem }) {
  const { zoomLevel } = useViewerStore();
  const scale = zoomLevel / 100;

  if (item.locations.length === 0) return null;

  // Point item (single location)
  if (item.locations.length === 1 && !item.dimensions?.area && !item.dimensions?.length) {
    const loc = item.locations[0];
    return (
      <g>
        <circle
          cx={loc.x}
          cy={loc.y}
          r={12 / scale}
          fill="rgba(239, 68, 68, 0.3)"
          stroke="#ef4444"
          strokeWidth={2 / scale}
        />
        <text
          x={loc.x}
          y={loc.y + 4 / scale}
          textAnchor="middle"
          fill="#ef4444"
          fontSize={10 / scale}
          fontWeight="bold"
        >
          {item.quantity}
        </text>
      </g>
    );
  }

  // Line item (two locations)
  if (item.locations.length === 2 && item.dimensions?.length) {
    const [start, end] = item.locations;
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;

    return (
      <g>
        <line
          x1={start.x}
          y1={start.y}
          x2={end.x}
          y2={end.y}
          stroke="#10b981"
          strokeWidth={3 / scale}
        />
        <circle cx={start.x} cy={start.y} r={4 / scale} fill="#10b981" />
        <circle cx={end.x} cy={end.y} r={4 / scale} fill="#10b981" />
        <rect
          x={midX - 30 / scale}
          y={midY - 10 / scale}
          width={60 / scale}
          height={20 / scale}
          fill="white"
          stroke="#10b981"
          strokeWidth={1 / scale}
          rx={4 / scale}
        />
        <text
          x={midX}
          y={midY + 4 / scale}
          textAnchor="middle"
          fill="#10b981"
          fontSize={10 / scale}
          fontWeight="bold"
        >
          {item.quantity}m
        </text>
      </g>
    );
  }

  // Area item (polygon)
  if (item.locations.length >= 3 || item.dimensions?.area) {
    const points = item.locations.map((p) => `${p.x},${p.y}`).join(' ');
    const centroid = item.locations.reduce(
      (acc, loc) => ({ x: acc.x + loc.x / item.locations.length, y: acc.y + loc.y / item.locations.length }),
      { x: 0, y: 0 }
    );

    return (
      <g>
        <polygon
          points={points}
          fill="rgba(59, 130, 246, 0.2)"
          stroke="#3b82f6"
          strokeWidth={2 / scale}
        />
        <rect
          x={centroid.x - 35 / scale}
          y={centroid.y - 12 / scale}
          width={70 / scale}
          height={24 / scale}
          fill="white"
          stroke="#3b82f6"
          strokeWidth={1 / scale}
          rx={4 / scale}
        />
        <text
          x={centroid.x}
          y={centroid.y + 5 / scale}
          textAnchor="middle"
          fill="#3b82f6"
          fontSize={12 / scale}
          fontWeight="bold"
        >
          {item.quantity}m²
        </text>
      </g>
    );
  }

  return null;
}

// 部屋オーバーレイコンポーネント
interface RoomOverlayProps {
  room: RoomDetectionResult['rooms'][0];
  imageWidth: number;
  imageHeight: number;
  scale: number;
}

function RoomOverlay({ room, imageWidth, imageHeight, scale }: RoomOverlayProps) {
  // 部屋タイプによる色分け
  const getColorByType = (type: string) => {
    const colors: Record<string, { fill: string; stroke: string }> = {
      living: { fill: 'rgba(59, 130, 246, 0.15)', stroke: '#3b82f6' },
      bedroom: { fill: 'rgba(147, 51, 234, 0.15)', stroke: '#9333ea' },
      kitchen: { fill: 'rgba(249, 115, 22, 0.15)', stroke: '#f97316' },
      bathroom: { fill: 'rgba(14, 165, 233, 0.15)', stroke: '#0ea5e9' },
      toilet: { fill: 'rgba(34, 197, 94, 0.15)', stroke: '#22c55e' },
      storage: { fill: 'rgba(161, 161, 170, 0.15)', stroke: '#a1a1aa' },
      corridor: { fill: 'rgba(251, 191, 36, 0.15)', stroke: '#fbbf24' },
      entrance: { fill: 'rgba(236, 72, 153, 0.15)', stroke: '#ec4899' },
      balcony: { fill: 'rgba(139, 92, 246, 0.15)', stroke: '#8b5cf6' },
    };
    return colors[type] || { fill: 'rgba(107, 114, 128, 0.15)', stroke: '#6b7280' };
  };

  const color = getColorByType(room.type);

  // 境界線がある場合はポリゴンを描画
  const hasBoundary = room.boundary && room.boundary.length >= 3;

  let centerX: number;
  let centerY: number;
  let points: string | undefined;

  if (hasBoundary) {
    // 相対座標を絶対座標に変換
    points = room.boundary
      .map(p => `${p.x * imageWidth},${p.y * imageHeight}`)
      .join(' ');

    const center = room.center || {
      x: room.boundary.reduce((sum, p) => sum + p.x, 0) / room.boundary.length,
      y: room.boundary.reduce((sum, p) => sum + p.y, 0) / room.boundary.length,
    };
    centerX = center.x * imageWidth;
    centerY = center.y * imageHeight;
  } else if (room.center) {
    // 中心点のみの場合
    centerX = room.center.x * imageWidth;
    centerY = room.center.y * imageHeight;
  } else {
    // データがない場合は表示しない
    return null;
  }

  return (
    <g className="room-overlay">
      {/* 境界線がある場合はポリゴンを描画 */}
      {hasBoundary && points && (
        <polygon
          points={points}
          fill={color.fill}
          stroke={color.stroke}
          strokeWidth={2 / scale}
          strokeDasharray={`${6 / scale},${3 / scale}`}
        />
      )}

      {/* 境界線がない場合は円形マーカーを描画 */}
      {!hasBoundary && (
        <circle
          cx={centerX}
          cy={centerY}
          r={40 / scale}
          fill={color.fill}
          stroke={color.stroke}
          strokeWidth={2 / scale}
          strokeDasharray={`${6 / scale},${3 / scale}`}
        />
      )}

      {/* 部屋名ラベル */}
      <rect
        x={centerX - 50 / scale}
        y={centerY - 14 / scale}
        width={100 / scale}
        height={28 / scale}
        fill="white"
        stroke={color.stroke}
        strokeWidth={1 / scale}
        rx={4 / scale}
        opacity={0.95}
      />
      <text
        x={centerX}
        y={centerY - 2 / scale}
        textAnchor="middle"
        fill={color.stroke}
        fontSize={11 / scale}
        fontWeight="bold"
      >
        {room.name}
      </text>
      {room.area && (
        <text
          x={centerX}
          y={centerY + 10 / scale}
          textAnchor="middle"
          fill="#666"
          fontSize={9 / scale}
        >
          {room.area.toFixed(1)}m²
        </text>
      )}
    </g>
  );
}

// 開口部オーバーレイコンポーネント
interface OpeningOverlayProps {
  opening: OpeningDetectionResult['openings'][0];
  imageWidth: number;
  imageHeight: number;
  scale: number;
}

function OpeningOverlay({ opening, imageWidth, imageHeight, scale }: OpeningOverlayProps) {
  const x = opening.location.x * imageWidth;
  const y = opening.location.y * imageHeight;

  // 開口部タイプによる色・形状
  const isDoor = opening.type === 'door';
  const isWindow = opening.type === 'window';

  const color = isDoor ? '#ef4444' : isWindow ? '#0ea5e9' : '#f97316';
  const size = isDoor ? 20 : 16;

  return (
    <g className="opening-overlay">
      {isDoor ? (
        // ドア: 扇形アイコン
        <>
          <path
            d={`M ${x} ${y} L ${x + size / scale} ${y} A ${size / scale} ${size / scale} 0 0 1 ${x} ${y + size / scale} Z`}
            fill={`${color}30`}
            stroke={color}
            strokeWidth={2 / scale}
          />
          <circle
            cx={x}
            cy={y}
            r={3 / scale}
            fill={color}
          />
        </>
      ) : isWindow ? (
        // 窓: 四角形アイコン
        <>
          <rect
            x={x - size / 2 / scale}
            y={y - size / 4 / scale}
            width={size / scale}
            height={size / 2 / scale}
            fill={`${color}30`}
            stroke={color}
            strokeWidth={2 / scale}
          />
          <line
            x1={x}
            y1={y - size / 4 / scale}
            x2={x}
            y2={y + size / 4 / scale}
            stroke={color}
            strokeWidth={1.5 / scale}
          />
        </>
      ) : (
        // その他: 円形アイコン
        <circle
          cx={x}
          cy={y}
          r={size / 2 / scale}
          fill={`${color}30`}
          stroke={color}
          strokeWidth={2 / scale}
        />
      )}

      {/* ラベル */}
      {opening.label && (
        <>
          <rect
            x={x - 20 / scale}
            y={y + size / scale + 2 / scale}
            width={40 / scale}
            height={14 / scale}
            fill="white"
            stroke={color}
            strokeWidth={0.5 / scale}
            rx={2 / scale}
          />
          <text
            x={x}
            y={y + size / scale + 12 / scale}
            textAnchor="middle"
            fill={color}
            fontSize={8 / scale}
            fontWeight="bold"
          >
            {opening.label}
          </text>
        </>
      )}
    </g>
  );
}

// 寸法オーバーレイコンポーネント
interface DimensionOverlayProps {
  dimension: DimensionOcrResult['dimensions'][0];
  imageWidth: number;
  imageHeight: number;
  scale: number;
}

function DimensionOverlay({ dimension, imageWidth, imageHeight, scale }: DimensionOverlayProps) {
  const x = dimension.location.x * imageWidth;
  const y = dimension.location.y * imageHeight;

  // 寸法タイプによる色分け
  const getColor = (type: string) => {
    switch (type) {
      case 'length': return '#10b981';
      case 'area': return '#3b82f6';
      case 'height': return '#f97316';
      case 'scale': return '#8b5cf6';
      default: return '#6b7280';
    }
  };

  const color = getColor(dimension.type);

  return (
    <g className="dimension-overlay">
      {/* マーカー */}
      <circle
        cx={x}
        cy={y}
        r={8 / scale}
        fill={`${color}40`}
        stroke={color}
        strokeWidth={2 / scale}
      />
      <circle
        cx={x}
        cy={y}
        r={3 / scale}
        fill={color}
      />

      {/* 寸法ラベル */}
      <rect
        x={x + 10 / scale}
        y={y - 10 / scale}
        width={Math.max(50, dimension.text.length * 7) / scale}
        height={20 / scale}
        fill="white"
        stroke={color}
        strokeWidth={1 / scale}
        rx={3 / scale}
        opacity={0.95}
      />
      <text
        x={x + 15 / scale}
        y={y + 4 / scale}
        fill={color}
        fontSize={10 / scale}
        fontWeight="bold"
      >
        {dimension.text}
      </text>
    </g>
  );
}
