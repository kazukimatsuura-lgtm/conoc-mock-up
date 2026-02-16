'use client';

import { useState, useEffect, useRef } from 'react';
import { Modal, ModalFooter, Button } from '@/components/ui';
import { useDrawingStore } from '@/stores/drawing-store';
import type { Drawing, ScaleConfig } from '@/types';
import { PRESET_SCALES } from '@/types/drawing';
import { detectDimensions, type DimensionOcrResult } from '@/lib/ai-takeoff';
import { Sparkles, Loader2, Target, Ruler, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScaleSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  drawing: Drawing | null;
}

type ScaleStep = 'select' | 'measure' | 'confirm';

interface DetectedDimension {
  value: number;
  unit: string;
  text: string;
  type: 'length' | 'area' | 'height' | 'scale';
  confidence: number;
  location: { x: number; y: number };
  context?: string;
}

export function ScaleSettingsModal({
  isOpen,
  onClose,
  drawing,
}: ScaleSettingsModalProps) {
  const { updateDrawingScale } = useDrawingStore();

  const [step, setStep] = useState<ScaleStep>('select');
  const [pixelLength, setPixelLength] = useState(245);
  const [realLength, setRealLength] = useState(5000);
  const [unit, setUnit] = useState<'mm' | 'cm' | 'm'>('mm');
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // OCR関連
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState<DimensionOcrResult | null>(null);
  const [selectedDimension, setSelectedDimension] = useState<DetectedDimension | null>(null);

  // 線の描画関連
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lineStart, setLineStart] = useState<{ x: number; y: number } | null>(null);
  const [lineEnd, setLineEnd] = useState<{ x: number; y: number } | null>(null);

  // Initialize from existing scale
  useEffect(() => {
    if (drawing?.scale) {
      setPixelLength(drawing.scale.pixelLength);
      setRealLength(drawing.scale.realLength);
      setUnit(drawing.scale.unit);
    }
  }, [drawing?.scale, isOpen]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setStep('select');
      setOcrResult(null);
      setSelectedDimension(null);
      setLineStart(null);
      setLineEnd(null);
    }
  }, [isOpen]);

  // Calculate pixel length from drawn line
  useEffect(() => {
    if (lineStart && lineEnd) {
      const dx = lineEnd.x - lineStart.x;
      const dy = lineEnd.y - lineStart.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      setPixelLength(Math.round(length));
    }
  }, [lineStart, lineEnd]);

  // Calculate scale ratio
  const calculateRatio = () => {
    if (pixelLength <= 0 || realLength <= 0) return null;

    let realMm = realLength;
    if (unit === 'cm') realMm = realLength * 10;
    if (unit === 'm') realMm = realLength * 1000;

    const pixelPerMm = pixelLength / realMm;
    const ratio = Math.round(realMm / pixelLength);

    return { ratio, pixelPerMm };
  };

  const calculated = calculateRatio();

  // AI OCR実行
  const handleOcrDetect = async () => {
    if (!drawing?.imageData) return;

    setIsOcrLoading(true);
    try {
      const result = await detectDimensions(drawing.imageData);
      setOcrResult(result);

      // 縮尺が検出された場合は自動で選択
      if (result.scale?.detected && result.scale.ratio) {
        const ratioMatch = result.scale.ratio.match(/1\s*:\s*(\d+)/);
        if (ratioMatch) {
          const ratio = parseInt(ratioMatch[1]);
          setSelectedPreset(ratio);
          const realMm = pixelLength * ratio;
          setRealLength(realMm);
          setUnit('mm');
        }
      }
    } catch (error) {
      console.error('OCR error:', error);
    } finally {
      setIsOcrLoading(false);
    }
  };

  // 寸法選択時の処理
  const handleDimensionSelect = (dim: DetectedDimension) => {
    setSelectedDimension(dim);

    // 単位を変換
    let value = dim.value;
    let newUnit: 'mm' | 'cm' | 'm' = 'mm';

    if (dim.unit === 'm' || dim.unit === 'メートル') {
      newUnit = 'm';
      value = dim.value;
    } else if (dim.unit === 'cm' || dim.unit === 'センチ') {
      newUnit = 'cm';
      value = dim.value;
    } else if (dim.unit === 'mm' || dim.unit === 'ミリ') {
      newUnit = 'mm';
      value = dim.value;
    } else {
      // 単位なしの場合、値の大きさで推測
      if (dim.value > 10000) {
        newUnit = 'mm';
      } else if (dim.value > 100) {
        newUnit = 'mm';
      } else {
        newUnit = 'm';
      }
    }

    setRealLength(value);
    setUnit(newUnit);
    setSelectedPreset(null);
    setStep('measure');
  };

  const handlePresetSelect = (ratio: number) => {
    setSelectedPreset(ratio);
    const realMm = pixelLength * ratio;
    if (unit === 'm') {
      setRealLength(realMm / 1000);
    } else if (unit === 'cm') {
      setRealLength(realMm / 10);
    } else {
      setRealLength(realMm);
    }
  };

  // キャンバスのマウスイベント
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (!lineStart || (lineStart && lineEnd)) {
      setLineStart({ x, y });
      setLineEnd(null);
      setIsDrawing(true);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !lineStart) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setLineEnd({ x, y });
  };

  const handleCanvasMouseUp = () => {
    setIsDrawing(false);
  };

  // キャンバス描画
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 線の描画
    if (lineStart) {
      const end = lineEnd || lineStart;

      // 線
      ctx.beginPath();
      ctx.moveTo(lineStart.x, lineStart.y);
      ctx.lineTo(end.x, end.y);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 始点
      ctx.beginPath();
      ctx.arc(lineStart.x, lineStart.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 終点
      if (lineEnd) {
        ctx.beginPath();
        ctx.arc(lineEnd.x, lineEnd.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 距離ラベル
        const midX = (lineStart.x + lineEnd.x) / 2;
        const midY = (lineStart.y + lineEnd.y) / 2;
        const dx = lineEnd.x - lineStart.x;
        const dy = lineEnd.y - lineStart.y;
        const dist = Math.round(Math.sqrt(dx * dx + dy * dy));

        ctx.font = 'bold 12px sans-serif';
        ctx.fillStyle = '#000';
        ctx.textAlign = 'center';
        ctx.fillRect(midX - 30, midY - 20, 60, 20);
        ctx.fillStyle = '#fff';
        ctx.fillText(`${dist}px`, midX, midY - 6);
      }
    }

    // 検出された寸法のマーカー
    if (ocrResult?.dimensions && step === 'select') {
      ocrResult.dimensions.forEach((dim, i) => {
        const x = dim.location.x * canvas.width;
        const y = dim.location.y * canvas.height;
        const isSelected = selectedDimension === dim;

        ctx.beginPath();
        ctx.arc(x, y, isSelected ? 12 : 8, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? '#3b82f6' : 'rgba(59, 130, 246, 0.7)';
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), x, y);
      });
    }
  }, [lineStart, lineEnd, ocrResult, selectedDimension, step]);

  const handleSave = async () => {
    if (!drawing || !calculated) return;

    setIsSaving(true);
    try {
      let realMm = realLength;
      if (unit === 'cm') realMm = realLength * 10;
      if (unit === 'm') realMm = realLength * 1000;

      const scale: ScaleConfig = {
        pixelLength,
        realLength: realMm,
        unit,
        ratio: calculated.ratio,
        pixelPerMm: calculated.pixelPerMm,
      };

      await updateDrawingScale(drawing.id, scale);
      onClose();
    } catch (error) {
      console.error('Failed to save scale:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setStep('select');
    setOcrResult(null);
    setSelectedDimension(null);
    onClose();
  };

  if (!drawing) return null;

  // 長さ寸法のみフィルタ
  const lengthDimensions = ocrResult?.dimensions?.filter(d => d.type === 'length') || [];

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="縮尺設定" size="xl">
      <div className="space-y-4">
        {/* ステップインジケーター */}
        <div className="flex items-center gap-2 text-sm">
          <div className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors',
            step === 'select' ? 'bg-cyan-100 text-cyan-700' : 'bg-gray-100 text-gray-500'
          )}>
            <Sparkles size={14} />
            <span>1. 寸法を選択</span>
          </div>
          <div className="h-px w-4 bg-gray-300" />
          <div className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors',
            step === 'measure' ? 'bg-cyan-100 text-cyan-700' : 'bg-gray-100 text-gray-500'
          )}>
            <Ruler size={14} />
            <span>2. 基準線を引く</span>
          </div>
          <div className="h-px w-4 bg-gray-300" />
          <div className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors',
            step === 'confirm' ? 'bg-cyan-100 text-cyan-700' : 'bg-gray-100 text-gray-500'
          )}>
            <CheckCircle2 size={14} />
            <span>3. 確認</span>
          </div>
        </div>

        {/* メインコンテンツ */}
        <div className="grid grid-cols-3 gap-4">
          {/* 左側: 図面プレビュー + 線描画 */}
          <div className="col-span-2 space-y-3">
            <div className="relative aspect-[4/3] bg-gray-100 rounded-lg border border-gray-300 overflow-hidden">
              {drawing.thumbnailData && (
                <img
                  src={drawing.thumbnailData}
                  alt=""
                  className="absolute inset-0 w-full h-full object-contain"
                />
              )}
              <canvas
                ref={canvasRef}
                width={600}
                height={450}
                className="absolute inset-0 w-full h-full cursor-crosshair"
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
              />

              {/* ガイドテキスト */}
              {step === 'measure' && !lineStart && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs px-3 py-1.5 rounded-full">
                  図面上の既知の寸法線の始点をクリック
                </div>
              )}
              {step === 'measure' && lineStart && !lineEnd && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs px-3 py-1.5 rounded-full">
                  終点をクリック（またはドラッグ）
                </div>
              )}
            </div>

            {/* AI OCRボタン */}
            <Button
              variant="secondary"
              className="w-full"
              icon={isOcrLoading ? Loader2 : Sparkles}
              onClick={handleOcrDetect}
              disabled={isOcrLoading || !drawing.imageData}
            >
              {isOcrLoading ? 'AI読み取り中...' : 'AIで寸法を自動読み取り'}
            </Button>
          </div>

          {/* 右側: 設定パネル */}
          <div className="space-y-4">
            {/* 検出された寸法リスト */}
            {ocrResult && lengthDimensions.length > 0 && step === 'select' && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700 flex items-center gap-1">
                  <Target size={12} />
                  検出された寸法（クリックで選択）
                </label>
                <div className="max-h-40 overflow-y-auto space-y-1 border rounded-lg p-2 bg-gray-50">
                  {lengthDimensions.map((dim, i) => (
                    <button
                      key={i}
                      onClick={() => handleDimensionSelect(dim)}
                      className={cn(
                        'w-full flex items-center justify-between px-2 py-1.5 rounded text-sm transition-colors',
                        selectedDimension === dim
                          ? 'bg-cyan-100 text-[#006A8E]'
                          : 'hover:bg-white'
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-[#0099CB] text-white text-xs flex items-center justify-center">
                          {i + 1}
                        </span>
                        <span className="font-mono">{dim.text}</span>
                      </span>
                      <span className="text-xs text-gray-500">
                        {Math.round(dim.confidence * 100)}%
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* スケール表記が検出された場合 */}
            {ocrResult?.scale?.detected && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-xs text-green-700 font-bold mb-1">縮尺を検出しました</p>
                <p className="text-sm text-green-800 font-mono">{ocrResult.scale.ratio}</p>
              </div>
            )}

            {/* プリセット縮尺 */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-700">プリセット縮尺</label>
              <div className="grid grid-cols-2 gap-1">
                {PRESET_SCALES.map((preset) => (
                  <button
                    key={preset.ratio}
                    onClick={() => handlePresetSelect(preset.ratio)}
                    className={cn(
                      'px-2 py-1.5 rounded border text-xs transition-colors',
                      selectedPreset === preset.ratio
                        ? 'bg-[#E0F4FA] border-[#0099CB] text-cyan-700'
                        : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 手動入力 */}
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">画面上の長さ (px)</label>
                <input
                  type="number"
                  value={pixelLength}
                  onChange={(e) => {
                    setPixelLength(Number(e.target.value));
                    setSelectedPreset(null);
                  }}
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#0099CB] outline-none text-right text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">実寸法</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={realLength}
                    onChange={(e) => {
                      setRealLength(Number(e.target.value));
                      setSelectedPreset(null);
                    }}
                    className="flex-1 p-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#0099CB] outline-none text-right text-sm"
                  />
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as 'mm' | 'cm' | 'm')}
                    className="p-2 border border-gray-300 rounded bg-white text-sm"
                  >
                    <option value="mm">mm</option>
                    <option value="cm">cm</option>
                    <option value="m">m</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 計算結果 */}
            {calculated && (
              <div className="bg-gradient-to-r from-[#E0F4FA] to-cyan-50 rounded-lg p-3 border border-[#0099CB]">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-600">計算縮尺</span>
                  <span className="font-bold text-lg text-[#006A8E]">1 : {calculated.ratio}</span>
                </div>
                <div className="flex justify-between items-center mt-1 text-xs text-gray-500">
                  <span>1ピクセル</span>
                  <span className="font-mono">{(1 / calculated.pixelPerMm).toFixed(2)}mm</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* フッター */}
        <ModalFooter>
          <Button variant="secondary" onClick={handleClose} disabled={isSaving}>
            キャンセル
          </Button>
          {step === 'select' && selectedDimension && (
            <Button variant="primary" onClick={() => setStep('measure')}>
              次へ: 基準線を引く
            </Button>
          )}
          {(step === 'measure' || step === 'confirm' || !selectedDimension) && (
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={!calculated || isSaving}
            >
              {isSaving ? '保存中...' : '縮尺を適用'}
            </Button>
          )}
        </ModalFooter>
      </div>
    </Modal>
  );
}
