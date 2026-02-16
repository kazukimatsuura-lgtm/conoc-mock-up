export type DrawingStatus = 'pending' | 'processing' | 'completed' | 'error';

export interface ScaleConfig {
  pixelLength: number;
  realLength: number;
  unit: 'mm' | 'cm' | 'm';
  ratio: number;
  pixelPerMm: number;
}

export interface Drawing {
  id: string;
  projectId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  pageNumber?: number;
  imageData: string;
  thumbnailData: string;
  scale?: ScaleConfig;
  status: DrawingStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDrawingInput {
  projectId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  pageNumber?: number;
  imageData: string;
  thumbnailData: string;
}

export const PRESET_SCALES = [
  { label: '1:10', ratio: 10 },
  { label: '1:20', ratio: 20 },
  { label: '1:50', ratio: 50 },
  { label: '1:100', ratio: 100 },
  { label: '1:200', ratio: 200 },
  { label: '1:500', ratio: 500 },
] as const;
