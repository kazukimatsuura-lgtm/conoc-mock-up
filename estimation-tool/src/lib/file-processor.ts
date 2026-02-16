// ファイル処理設定
export const FILE_PROCESSING_CONFIG = {
  maxPdfPages: 20,           // PDFの最大ページ数
  maxImageSizeMB: 10,        // 最大画像サイズ（MB）
  compressionQuality: 0.8,   // JPEG圧縮品質（0-1）
  thumbnailMaxSize: 200,     // サムネイル最大サイズ（px）
  maxImageDimension: 4096,   // 最大画像寸法（px）
};

interface ProcessedFile {
  fileName: string;
  fileSize: number;
  mimeType: string;
  pageNumber?: number;
  imageData: string;
  thumbnailData: string;
}

export interface ProcessingProgress {
  current: number;
  total: number;
  fileName: string;
  status: 'processing' | 'compressing' | 'done';
}

// ファイルサイズチェック
export function validateFileSize(file: File): { valid: boolean; error?: string } {
  const maxBytes = FILE_PROCESSING_CONFIG.maxImageSizeMB * 1024 * 1024;
  if (file.size > maxBytes) {
    return {
      valid: false,
      error: `ファイルサイズが${FILE_PROCESSING_CONFIG.maxImageSizeMB}MBを超えています（${(file.size / 1024 / 1024).toFixed(1)}MB）`,
    };
  }
  return { valid: true };
}

// 画像を圧縮
async function compressImage(
  imageData: string,
  maxDimension: number = FILE_PROCESSING_CONFIG.maxImageDimension,
  quality: number = FILE_PROCESSING_CONFIG.compressionQuality
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;

      // リサイズが必要かチェック
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        const scale = Math.min(maxDimension / width, maxDimension / height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      // JPEG形式で圧縮（透明度がない場合）
      // PNG形式の場合はそのまま（透明度保持）
      const isPng = imageData.startsWith('data:image/png');
      if (isPng && hasTransparency(ctx, width, height)) {
        resolve(canvas.toDataURL('image/png'));
      } else {
        resolve(canvas.toDataURL('image/jpeg', quality));
      }
    };
    img.onerror = () => resolve(imageData); // エラー時は元データを返す
    img.src = imageData;
  });
}

// 透明度をチェック
function hasTransparency(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  try {
    const imageData = ctx.getImageData(0, 0, Math.min(width, 100), Math.min(height, 100));
    const data = imageData.data;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 255) return true;
    }
  } catch {
    // getImageData がセキュリティエラーになる場合
  }
  return false;
}

// Generate thumbnail from image
async function generateThumbnail(
  imageData: string,
  maxSize: number = FILE_PROCESSING_CONFIG.thumbnailMaxSize
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;

      const scale = Math.min(maxSize / img.width, maxSize / img.height);
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => resolve(imageData);
    img.src = imageData;
  });
}

// Convert image file to base64
async function imageToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Process PDF file - convert pages to images
async function processPdf(
  file: File,
  onProgress?: (progress: ProcessingProgress) => void
): Promise<ProcessedFile[]> {
  const results: ProcessedFile[] = [];

  // Dynamically import pdfjs-dist
  const pdfjsLib = await import('pdfjs-dist');

  // Set worker source
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  // ページ数制限
  const pageCount = Math.min(pdf.numPages, FILE_PROCESSING_CONFIG.maxPdfPages);

  if (pdf.numPages > FILE_PROCESSING_CONFIG.maxPdfPages) {
    console.warn(`PDF has ${pdf.numPages} pages, processing only first ${FILE_PROCESSING_CONFIG.maxPdfPages} pages`);
  }

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    onProgress?.({
      current: pageNum,
      total: pageCount,
      fileName: file.name,
      status: 'processing',
    });

    const page = await pdf.getPage(pageNum);
    const scale = 2; // Higher resolution
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({
      canvasContext: context,
      viewport: viewport,
    }).promise;

    // 圧縮
    onProgress?.({
      current: pageNum,
      total: pageCount,
      fileName: file.name,
      status: 'compressing',
    });

    let imageData = canvas.toDataURL('image/png');
    imageData = await compressImage(imageData);
    const thumbnailData = await generateThumbnail(imageData);

    results.push({
      fileName: file.name,
      fileSize: file.size,
      mimeType: 'image/jpeg', // 圧縮後はJPEG
      pageNumber: pageNum,
      imageData,
      thumbnailData,
    });

    // メモリ解放
    canvas.width = 0;
    canvas.height = 0;
  }

  return results;
}

// Process image file
async function processImage(
  file: File,
  onProgress?: (progress: ProcessingProgress) => void
): Promise<ProcessedFile> {
  onProgress?.({
    current: 1,
    total: 1,
    fileName: file.name,
    status: 'processing',
  });

  let imageData = await imageToBase64(file);

  onProgress?.({
    current: 1,
    total: 1,
    fileName: file.name,
    status: 'compressing',
  });

  // 圧縮
  imageData = await compressImage(imageData);
  const thumbnailData = await generateThumbnail(imageData);

  return {
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type.startsWith('image/') ? 'image/jpeg' : file.type,
    imageData,
    thumbnailData,
  };
}

// Main process function
export async function processFiles(
  files: File[],
  onProgress?: (progress: ProcessingProgress) => void
): Promise<{ results: ProcessedFile[]; errors: string[] }> {
  const results: ProcessedFile[] = [];
  const errors: string[] = [];

  for (const file of files) {
    // ファイルサイズチェック
    const sizeCheck = validateFileSize(file);
    if (!sizeCheck.valid) {
      errors.push(`${file.name}: ${sizeCheck.error}`);
      continue;
    }

    try {
      if (file.type === 'application/pdf') {
        const pdfResults = await processPdf(file, onProgress);
        results.push(...pdfResults);
      } else if (file.type.startsWith('image/')) {
        const imageResult = await processImage(file, onProgress);
        results.push(imageResult);
      }
    } catch (error) {
      errors.push(`${file.name}: 処理中にエラーが発生しました`);
      console.error(`Error processing ${file.name}:`, error);
    }
  }

  return { results, errors };
}

// Calculate file processing progress
export function createProgressTracker(
  totalFiles: number,
  onProgress: (progress: number) => void
) {
  let processedFiles = 0;

  return {
    increment: () => {
      processedFiles++;
      onProgress(Math.round((processedFiles / totalFiles) * 100));
    },
    reset: () => {
      processedFiles = 0;
    },
  };
}
