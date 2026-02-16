'use client';

import { useState, useRef, useEffect } from 'react';
import {
  BrainCircuit,
  Home,
  DoorOpen,
  Sparkles,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';

export type AiFeatureType = 'takeoff' | 'room' | 'opening';

interface AiFeatureOption {
  id: AiFeatureType;
  label: string;
  description: string;
  icon: typeof BrainCircuit;
}

const AI_FEATURES: AiFeatureOption[] = [
  {
    id: 'takeoff',
    label: 'AI拾い出し',
    description: '設備・部材を自動検出',
    icon: Sparkles,
  },
  {
    id: 'room',
    label: '部屋検出',
    description: '部屋の境界・面積を検出',
    icon: Home,
  },
  {
    id: 'opening',
    label: '開口部検出',
    description: 'ドア・窓を自動検出',
    icon: DoorOpen,
  },
];

interface AiFeaturesMenuProps {
  onSelect: (feature: AiFeatureType) => void;
  isProcessing: boolean;
  processingFeature?: AiFeatureType | null;
  disabled?: boolean;
}

export function AiFeaturesMenu({
  onSelect,
  isProcessing,
  processingFeature,
  disabled,
}: AiFeaturesMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // クリック外で閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (feature: AiFeatureType) => {
    setIsOpen(false);
    onSelect(feature);
  };

  const getCurrentIcon = () => {
    if (isProcessing && processingFeature) {
      return Loader2;
    }
    return BrainCircuit;
  };

  const getCurrentLabel = () => {
    if (isProcessing && processingFeature) {
      const feature = AI_FEATURES.find(f => f.id === processingFeature);
      return `${feature?.label || 'AI'}処理中...`;
    }
    return 'AI機能';
  };

  const Icon = getCurrentIcon();

  return (
    <div className="relative" ref={menuRef}>
      <Button
        variant="primary"
        className={cn(
          "shadow-lg shadow-cyan-900/20 bg-gradient-to-r from-[#0099CB] to-[#007BA3] border-none",
          isProcessing && "[&>svg:first-child]:animate-spin"
        )}
        disabled={disabled || isProcessing}
        onClick={() => setIsOpen(!isOpen)}
      >
        <Icon size={18} className="mr-2" />
        {getCurrentLabel()}
        <ChevronDown size={16} className={cn("ml-2 transition-transform", isOpen && "rotate-180")} />
      </Button>

      {isOpen && (
        <div className="absolute top-full mt-2 right-0 w-64 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50">
          {AI_FEATURES.map((feature) => {
            const FeatureIcon = feature.icon;
            const isCurrentProcessing = isProcessing && processingFeature === feature.id;

            return (
              <button
                key={feature.id}
                onClick={() => handleSelect(feature.id)}
                disabled={isProcessing}
                className={cn(
                  "w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left",
                  isProcessing && "opacity-50 cursor-not-allowed"
                )}
              >
                <div className={cn(
                  "p-2 rounded-lg",
                  isCurrentProcessing
                    ? "bg-cyan-100 text-[#0088B4]"
                    : "bg-gray-100 text-gray-600"
                )}>
                  {isCurrentProcessing ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <FeatureIcon size={18} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-800">{feature.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{feature.description}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
