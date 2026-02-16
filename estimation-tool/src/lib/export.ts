import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import type { Project, Drawing, TakeoffItem } from '@/types';
import { TAKEOFF_CATEGORIES, CATEGORY_ITEM_TYPES } from '@/types/takeoff';

// カテゴリ名を取得
function getCategoryLabel(categoryId: string): string {
  const category = TAKEOFF_CATEGORIES.find(c => c.id === categoryId);
  return category?.label || categoryId;
}

// アイテムタイプ名を取得
function getItemTypeLabel(categoryId: string, itemTypeId: string): string {
  const items = CATEGORY_ITEM_TYPES[categoryId] || [];
  const item = items.find(i => i.id === itemTypeId);
  return item?.label || itemTypeId;
}

// 集計データの型
interface TakeoffSummary {
  category: string;
  categoryLabel: string;
  itemType: string;
  itemTypeLabel: string;
  unit: string;
  totalQuantity: number;
  itemCount: number;
  avgConfidence: number;
  sources: { manual: number; ai: number };
}

// 拾い出しデータを集計
function summarizeTakeoffItems(items: TakeoffItem[]): TakeoffSummary[] {
  const summaryMap = new Map<string, TakeoffSummary>();

  for (const item of items) {
    const key = `${item.category}:${item.itemType}`;
    const existing = summaryMap.get(key);

    if (existing) {
      existing.totalQuantity += item.quantity;
      existing.itemCount += 1;
      existing.avgConfidence =
        (existing.avgConfidence * (existing.itemCount - 1) + item.confidence) / existing.itemCount;
      if (item.source === 'manual') {
        existing.sources.manual += 1;
      } else {
        existing.sources.ai += 1;
      }
    } else {
      summaryMap.set(key, {
        category: item.category,
        categoryLabel: getCategoryLabel(item.category),
        itemType: item.itemType,
        itemTypeLabel: getItemTypeLabel(item.category, item.itemType),
        unit: item.unit,
        totalQuantity: item.quantity,
        itemCount: 1,
        avgConfidence: item.confidence,
        sources: {
          manual: item.source === 'manual' ? 1 : 0,
          ai: item.source === 'ai' ? 1 : 0,
        },
      });
    }
  }

  // カテゴリ順、アイテムタイプ順でソート
  return Array.from(summaryMap.values()).sort((a, b) => {
    if (a.category !== b.category) {
      return a.category.localeCompare(b.category);
    }
    return a.itemType.localeCompare(b.itemType);
  });
}

// Excel出力
export async function exportToExcel(
  project: Project,
  drawings: Drawing[],
  items: TakeoffItem[]
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CONOC 積算OCR';
  workbook.created = new Date();

  // 集計シート
  const summarySheet = workbook.addWorksheet('集計表');

  // ヘッダー情報
  summarySheet.mergeCells('A1:F1');
  summarySheet.getCell('A1').value = `積算集計表 - ${project.name}`;
  summarySheet.getCell('A1').font = { bold: true, size: 16 };
  summarySheet.getCell('A1').alignment = { horizontal: 'center' };

  summarySheet.mergeCells('A2:F2');
  summarySheet.getCell('A2').value = `出力日時: ${new Date().toLocaleString('ja-JP')}`;
  summarySheet.getCell('A2').alignment = { horizontal: 'center' };

  // 集計テーブル
  const summaryData = summarizeTakeoffItems(items);

  summarySheet.getRow(5).values = ['カテゴリ', 'アイテム', '数量', '単位', '件数', '平均信頼度'];
  summarySheet.getRow(5).font = { bold: true };
  summarySheet.getRow(5).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE8F4FD' },
  };

  let rowIndex = 6;
  let currentCategory = '';

  for (const summary of summaryData) {
    const row = summarySheet.getRow(rowIndex);

    // カテゴリが変わったら境界線を追加
    if (summary.category !== currentCategory) {
      currentCategory = summary.category;
      if (rowIndex > 6) {
        summarySheet.getRow(rowIndex - 1).eachCell((cell) => {
          cell.border = {
            ...cell.border,
            bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          };
        });
      }
    }

    row.values = [
      summary.categoryLabel,
      summary.itemTypeLabel,
      summary.totalQuantity,
      summary.unit,
      summary.itemCount,
      `${Math.round(summary.avgConfidence * 100)}%`,
    ];

    rowIndex++;
  }

  // 列幅設定
  summarySheet.columns = [
    { width: 15 },
    { width: 20 },
    { width: 12 },
    { width: 8 },
    { width: 8 },
    { width: 12 },
  ];

  // 詳細シート
  const detailSheet = workbook.addWorksheet('詳細データ');

  detailSheet.getRow(1).values = [
    'ID',
    '図面',
    'カテゴリ',
    'アイテム',
    '数量',
    '単位',
    '信頼度',
    'ソース',
    '作成日時',
  ];
  detailSheet.getRow(1).font = { bold: true };
  detailSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE8F4FD' },
  };

  rowIndex = 2;
  for (const item of items) {
    const drawing = drawings.find(d => d.id === item.drawingId);
    detailSheet.getRow(rowIndex).values = [
      item.id.substring(0, 8),
      drawing?.fileName || '-',
      getCategoryLabel(item.category),
      getItemTypeLabel(item.category, item.itemType),
      item.quantity,
      item.unit,
      `${Math.round(item.confidence * 100)}%`,
      item.source === 'manual' ? '手動' : 'AI',
      new Date(item.createdAt).toLocaleString('ja-JP'),
    ];
    rowIndex++;
  }

  detailSheet.columns = [
    { width: 10 },
    { width: 25 },
    { width: 15 },
    { width: 20 },
    { width: 10 },
    { width: 8 },
    { width: 10 },
    { width: 8 },
    { width: 18 },
  ];

  // 図面別シート
  for (const drawing of drawings) {
    const drawingItems = items.filter(i => i.drawingId === drawing.id);
    if (drawingItems.length === 0) continue;

    const sheetName = drawing.fileName.substring(0, 31).replace(/[\\/*?[\]]/g, '_');
    const drawingSheet = workbook.addWorksheet(sheetName);

    drawingSheet.mergeCells('A1:E1');
    drawingSheet.getCell('A1').value = drawing.fileName;
    drawingSheet.getCell('A1').font = { bold: true, size: 14 };

    const drawingSummary = summarizeTakeoffItems(drawingItems);

    drawingSheet.getRow(3).values = ['カテゴリ', 'アイテム', '数量', '単位', '信頼度'];
    drawingSheet.getRow(3).font = { bold: true };
    drawingSheet.getRow(3).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF0F0F0' },
    };

    rowIndex = 4;
    for (const summary of drawingSummary) {
      drawingSheet.getRow(rowIndex).values = [
        summary.categoryLabel,
        summary.itemTypeLabel,
        summary.totalQuantity,
        summary.unit,
        `${Math.round(summary.avgConfidence * 100)}%`,
      ];
      rowIndex++;
    }

    drawingSheet.columns = [
      { width: 15 },
      { width: 20 },
      { width: 12 },
      { width: 8 },
      { width: 10 },
    ];
  }

  // Blobとして出力
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

// CSV出力
export function exportToCSV(
  project: Project,
  drawings: Drawing[],
  items: TakeoffItem[]
): string {
  const headers = [
    'プロジェクト名',
    '図面',
    'カテゴリ',
    'アイテム',
    '数量',
    '単位',
    '信頼度',
    'ソース',
    '作成日時',
  ];

  const rows = items.map(item => {
    const drawing = drawings.find(d => d.id === item.drawingId);
    return [
      project.name,
      drawing?.fileName || '-',
      getCategoryLabel(item.category),
      getItemTypeLabel(item.category, item.itemType),
      item.quantity.toString(),
      item.unit,
      `${Math.round(item.confidence * 100)}%`,
      item.source === 'manual' ? '手動' : 'AI',
      new Date(item.createdAt).toLocaleString('ja-JP'),
    ];
  });

  // BOM付きUTF-8でCSV生成
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  return '\uFEFF' + csvContent;
}

// PDF出力（日本語対応のためHTMLからCanvas経由でPDF生成）
export async function exportToPDF(
  project: Project,
  drawings: Drawing[],
  items: TakeoffItem[]
): Promise<Blob> {
  const summaryData = summarizeTakeoffItems(items);

  // HTMLテンプレートを作成
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: "Hiragino Kaku Gothic ProN", "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif;
          padding: 20mm;
          font-size: 12px;
          color: #333;
        }
        h1 { font-size: 24px; text-align: center; margin-bottom: 10px; }
        .meta { text-align: center; color: #666; margin-bottom: 20px; font-size: 11px; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th { background: #e8f4fd; padding: 8px; text-align: left; font-weight: bold; border: 1px solid #ccc; }
        td { padding: 6px 8px; border: 1px solid #ddd; }
        tr:nth-child(even) { background: #f9f9f9; }
        .number { text-align: right; font-family: monospace; }
        .watermark {
          position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg);
          font-size: 80px; color: rgba(200,200,200,0.3); pointer-events: none; z-index: 1000;
        }
        .footer { margin-top: 30px; text-align: center; color: #999; font-size: 10px; }
      </style>
    </head>
    <body>
      <h1>積算集計表</h1>
      <div class="meta">
        <div>プロジェクト: ${escapeHtml(project.name)}</div>
        <div>出力日時: ${new Date().toLocaleString('ja-JP')}</div>
      </div>
      <table>
        <thead>
          <tr>
            <th>カテゴリ</th>
            <th>アイテム</th>
            <th class="number">数量</th>
            <th>単位</th>
            <th class="number">件数</th>
            <th class="number">信頼度</th>
          </tr>
        </thead>
        <tbody>
          ${summaryData.map(s => `
            <tr>
              <td>${escapeHtml(s.categoryLabel)}</td>
              <td>${escapeHtml(s.itemTypeLabel)}</td>
              <td class="number">${s.totalQuantity}</td>
              <td>${escapeHtml(s.unit)}</td>
              <td class="number">${s.itemCount}</td>
              <td class="number">${Math.round(s.avgConfidence * 100)}%</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="footer">CONOC 積算OCR - Generated Report</div>
    </body>
    </html>
  `;

  // 非表示のiframeでHTMLをレンダリング
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;left:-9999px;width:210mm;height:297mm;';
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    document.body.removeChild(iframe);
    throw new Error('Failed to create iframe document');
  }

  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();

  // フォントの読み込みを待つ
  await new Promise(resolve => setTimeout(resolve, 100));

  // html2canvasでキャプチャしてPDF生成
  const { default: html2canvas } = await import('html2canvas');

  const canvas = await html2canvas(iframeDoc.body, {
    scale: 2,
    useCORS: true,
    logging: false,
  });

  document.body.removeChild(iframe);

  // A4サイズでPDF生成
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Canvasの画像をPDFに追加
  const imgData = canvas.toDataURL('image/png');
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  // 複数ページに分割
  let heightLeft = imgHeight;
  let position = 0;
  let page = 1;

  doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = -pageHeight * page;
    doc.addPage();
    doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    page++;
  }

  return doc.output('blob');
}

// HTMLエスケープヘルパー
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ファイルダウンロードヘルパー
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadText(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  downloadBlob(blob, filename);
}
