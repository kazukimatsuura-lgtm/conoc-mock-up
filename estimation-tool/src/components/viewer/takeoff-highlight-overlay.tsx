'use client';

import type { TakeoffItem } from '@/types';

interface TakeoffHighlightOverlayProps {
  items: TakeoffItem[];
  imageWidth: number;
  imageHeight: number;
  scale: number;
}

export function TakeoffHighlightOverlay({ items, imageWidth, imageHeight, scale }: TakeoffHighlightOverlayProps) {
  if (items.length === 0) return null;

  // 全選択アイテムの位置を番号付きで収集
  let counter = 0;
  const markers: { x: number; y: number; label: number; itemType: string }[] = [];

  for (const item of items) {
    for (const loc of item.locations) {
      counter++;
      // AI検出の場合は0-1正規化座標、手動の場合はピクセル座標
      const isNormalized = loc.x >= 0 && loc.x <= 1 && loc.y >= 0 && loc.y <= 1 &&
                           item.source === 'ai';
      const x = isNormalized ? loc.x * imageWidth : loc.x;
      const y = isNormalized ? loc.y * imageHeight : loc.y;
      markers.push({ x, y, label: counter, itemType: item.itemType });
    }
  }

  const r = 14 / scale;
  const fontSize = 10 / scale;
  const pulseR = 20 / scale;

  return (
    <g className="takeoff-highlight-overlay">
      {/* CSS animation defined inline via style */}
      <defs>
        <style>{`
          @keyframes highlight-pulse {
            0% { opacity: 0.6; r: ${pulseR}; }
            50% { opacity: 0; r: ${pulseR * 1.8}; }
            100% { opacity: 0.6; r: ${pulseR}; }
          }
          .highlight-pulse {
            animation: highlight-pulse 2s ease-in-out infinite;
          }
        `}</style>
      </defs>
      {markers.map((marker, i) => (
        <g key={i}>
          {/* Pulse animation ring */}
          <circle
            cx={marker.x}
            cy={marker.y}
            r={pulseR}
            fill="none"
            stroke="#ef4444"
            strokeWidth={2 / scale}
            className="highlight-pulse"
            style={{ animationDelay: `${i * 0.2}s` }}
          />
          {/* Red dot */}
          <circle
            cx={marker.x}
            cy={marker.y}
            r={r}
            fill="#ef4444"
            stroke="#ffffff"
            strokeWidth={2 / scale}
          />
          {/* Number label */}
          <text
            x={marker.x}
            y={marker.y + fontSize * 0.35}
            textAnchor="middle"
            fill="#ffffff"
            fontSize={fontSize}
            fontWeight="bold"
            style={{ pointerEvents: 'none' }}
          >
            {marker.label}
          </text>
        </g>
      ))}
    </g>
  );
}
