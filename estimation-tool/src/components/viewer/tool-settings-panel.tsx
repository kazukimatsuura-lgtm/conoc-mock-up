'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Plus, Check, X, ChevronUp, Settings2, GripVertical } from 'lucide-react';
import { useViewerStore } from '@/stores/viewer-store';
import { cn } from '@/lib/utils';

const CATEGORIES = [
  { id: 'electrical', name: '電気設備', color: '#ef4444' },
  { id: 'plumbing', name: '給排水設備', color: '#3b82f6' },
  { id: 'hvac', name: '空調設備', color: '#10b981' },
  { id: 'fire', name: '消防設備', color: '#f59e0b' },
  { id: 'structure', name: '構造', color: '#8b5cf6' },
  { id: 'architecture', name: '建築', color: '#ec4899' },
  { id: 'other', name: 'その他', color: '#6b7280' },
];

const ITEM_TYPES: Record<string, string[]> = {
  electrical: ['コンセント', '照明器具', 'スイッチ', '分電盤', '配線', 'ケーブルラック'],
  plumbing: ['給水管', '排水管', '衛生器具', 'バルブ', 'ポンプ', '貯水槽'],
  hvac: ['エアコン', 'ダクト', '換気扇', '室外機', 'FCU', 'VAV'],
  fire: ['スプリンクラー', '消火器', '感知器', '非常灯', '誘導灯', '消火栓'],
  structure: ['柱', '梁', '壁', '基礎', 'スラブ', '階段'],
  architecture: ['床面積', '壁面積', '天井面積', '開口部', '建具', '仕上げ'],
  other: ['新規アイテム'],
};

interface ToolSettingsPanelProps {
  initialPosition?: { x: number; y: number };
}

export function ToolSettingsPanel({ initialPosition }: ToolSettingsPanelProps) {
  const {
    activeTool,
    currentCategory,
    setCurrentCategory,
    currentItemType,
    setCurrentItemType,
  } = useViewerStore();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [customType, setCustomType] = useState('');
  const [isAddingCustom, setIsAddingCustom] = useState(false);

  // ドラッグ移動用state
  const [position, setPosition] = useState(initialPosition ?? { x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const panelRef = useRef<HTMLDivElement>(null);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const typeDropdownRef = useRef<HTMLDivElement>(null);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
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

  const currentCategoryData = CATEGORIES.find((c) => c.id === currentCategory) || CATEGORIES[0];
  const availableTypes = ITEM_TYPES[currentCategory] || ITEM_TYPES.other;

  // クリック外で閉じる
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // カテゴリドロップダウン
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target as Node)) {
        setShowCategoryDropdown(false);
      }
      // タイプドロップダウン
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(e.target as Node)) {
        setShowTypeDropdown(false);
        setIsAddingCustom(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCategorySelect = (categoryId: string) => {
    setCurrentCategory(categoryId);
    setShowCategoryDropdown(false);
    // Reset item type when category changes
    const types = ITEM_TYPES[categoryId] || ITEM_TYPES.other;
    setCurrentItemType(types[0] || '');
  };

  const handleTypeSelect = (type: string) => {
    setCurrentItemType(type);
    setShowTypeDropdown(false);
    setIsAddingCustom(false);
  };

  const handleAddCustomType = () => {
    if (customType.trim()) {
      setCurrentItemType(customType.trim());
      setCustomType('');
      setIsAddingCustom(false);
      setShowTypeDropdown(false);
    }
  };

  const getToolLabel = () => {
    switch (activeTool) {
      case 'point':
        return '点カウント';
      case 'line':
        return '線計測';
      case 'area':
        return '面積計測';
      case 'rect':
        return '矩形選択';
      case 'scale':
        return '縮尺設定';
      default:
        return '';
    }
  };

  // 縮尺ツールの場合は簡略表示
  if (activeTool === 'scale') {
    return (
      <div ref={panelRef} className="bg-white/95 backdrop-blur shadow-lg rounded-lg border border-gray-200 overflow-hidden" style={{ transform: `translate(${position.x}px, ${position.y}px)` }}>
        <div
          className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200 cursor-grab active:cursor-grabbing"
          onMouseDown={handleDragStart}
        >
          <div className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
            <GripVertical size={12} className="text-gray-400" />
            <Settings2 size={14} />
            {getToolLabel()}
          </div>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>
        {!isCollapsed && (
          <div className="p-3">
            <p className="text-xs text-gray-600">
              図面上の既知の寸法線の両端を2点クリックしてください。
              その後、実際の長さ（mm単位）を入力します。
            </p>
          </div>
        )}
      </div>
    );
  }

  // 折りたたみ時のコンパクト表示
  if (isCollapsed) {
    return (
      <div ref={panelRef} className="bg-white/95 backdrop-blur shadow-lg rounded-lg border border-gray-200" style={{ transform: `translate(${position.x}px, ${position.y}px)` }}>
        <div className="flex items-center">
          <div
            className="px-1.5 py-2 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
            onMouseDown={handleDragStart}
          >
            <GripVertical size={12} />
          </div>
          <button
            onClick={() => setIsCollapsed(false)}
            className="flex items-center gap-2 px-2 py-2 hover:bg-gray-50 transition-colors flex-1"
          >
            <Settings2 size={14} className="text-gray-500" />
            <span className="text-xs font-medium text-gray-700">{getToolLabel()}</span>
            <div
              className="w-2.5 h-2.5 rounded-full ml-1"
              style={{ backgroundColor: currentCategoryData.color }}
            />
            <span className="text-xs text-gray-500 truncate max-w-[80px]">
              {currentItemType || availableTypes[0]}
            </span>
            <ChevronDown size={14} className="text-gray-400 ml-auto" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={panelRef} className="bg-white/95 backdrop-blur shadow-lg rounded-lg border border-gray-200 w-64 overflow-hidden" style={{ transform: `translate(${position.x}px, ${position.y}px)` }}>
      {/* Header (drag handle) */}
      <div
        className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200 cursor-grab active:cursor-grabbing"
        onMouseDown={handleDragStart}
      >
        <div className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
          <GripVertical size={12} className="text-gray-400" />
          <Settings2 size={14} />
          {getToolLabel()}設定
        </div>
        <button
          onClick={() => setIsCollapsed(true)}
          className="p-1 hover:bg-gray-200 rounded transition-colors"
          title="折りたたむ"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <ChevronUp size={14} />
        </button>
      </div>

      <div className="p-3 space-y-3">
        {/* Category Selector */}
        <div ref={categoryDropdownRef}>
          <label className="text-xs text-gray-500 mb-1 block">カテゴリ</label>
          <div className="relative">
            <button
              onClick={() => {
                setShowCategoryDropdown(!showCategoryDropdown);
                setShowTypeDropdown(false);
              }}
              className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-md border border-gray-200 transition-colors"
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: currentCategoryData.color }}
                />
                <span className="text-sm">{currentCategoryData.name}</span>
              </div>
              <ChevronDown size={14} className={cn("text-gray-400 transition-transform", showCategoryDropdown && "rotate-180")} />
            </button>

            {showCategoryDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 py-1">
                {CATEGORIES.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => handleCategorySelect(category.id)}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors',
                      currentCategory === category.id && 'bg-[#E0F4FA]'
                    )}
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: category.color }}
                    />
                    {category.name}
                    {currentCategory === category.id && (
                      <Check size={14} className="ml-auto text-[#0088B4]" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Item Type Selector */}
        <div ref={typeDropdownRef}>
          <label className="text-xs text-gray-500 mb-1 block">アイテム種別</label>
          <div className="relative">
            <button
              onClick={() => {
                setShowTypeDropdown(!showTypeDropdown);
                setShowCategoryDropdown(false);
              }}
              className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-md border border-gray-200 transition-colors"
            >
              <span className="text-sm truncate">
                {currentItemType || availableTypes[0] || '選択してください'}
              </span>
              <ChevronDown size={14} className={cn("text-gray-400 transition-transform", showTypeDropdown && "rotate-180")} />
            </button>

            {showTypeDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 py-1 max-h-48 overflow-y-auto">
                {availableTypes.map((type) => (
                  <button
                    key={type}
                    onClick={() => handleTypeSelect(type)}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 transition-colors text-left',
                      currentItemType === type && 'bg-[#E0F4FA]'
                    )}
                  >
                    {type}
                    {currentItemType === type && (
                      <Check size={14} className="text-[#0088B4]" />
                    )}
                  </button>
                ))}

                {/* Add Custom Type */}
                {isAddingCustom ? (
                  <div className="px-2 py-2 border-t border-gray-100">
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={customType}
                        onChange={(e) => setCustomType(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddCustomType();
                          if (e.key === 'Escape') {
                            setIsAddingCustom(false);
                            setCustomType('');
                          }
                        }}
                        placeholder="新しい種別名"
                        className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-[#0099CB]"
                        autoFocus
                      />
                      <button
                        onClick={handleAddCustomType}
                        className="px-2 py-1 bg-[#0099CB] text-white text-xs rounded hover:bg-[#0088B4]"
                      >
                        追加
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsAddingCustom(true)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#0088B4] hover:bg-[#E0F4FA] border-t border-gray-100 transition-colors"
                  >
                    <Plus size={14} />
                    カスタム種別を追加
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Quick tip */}
        <div className="pt-2 border-t border-gray-100">
          <p className="text-xs text-gray-400">
            {activeTool === 'point' && 'クリックで点を追加'}
            {activeTool === 'line' && '2点クリックで線を描画'}
            {activeTool === 'area' && 'クリックで頂点追加、ダブルクリックで確定'}
            {activeTool === 'rect' && 'ドラッグで矩形を描画'}
          </p>
        </div>
      </div>
    </div>
  );
}
