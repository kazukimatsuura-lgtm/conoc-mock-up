import Dexie, { type Table } from 'dexie';
import type { Project, Drawing, TakeoffItem, TakeoffGroup, CustomColumn } from '@/types';

export class SekisanOCRDatabase extends Dexie {
  projects!: Table<Project>;
  drawings!: Table<Drawing>;
  takeoffItems!: Table<TakeoffItem>;
  takeoffGroups!: Table<TakeoffGroup>;
  customColumns!: Table<CustomColumn>;

  constructor() {
    super('sekisan-ocr-db');
    this.version(1).stores({
      projects: 'id, name, status, createdAt, updatedAt',
      drawings: 'id, projectId, fileName, status, createdAt, updatedAt',
      takeoffItems: 'id, drawingId, category, itemType, source, createdAt',
    });
    this.version(2).stores({
      projects: 'id, name, status, createdAt, updatedAt',
      drawings: 'id, projectId, fileName, status, createdAt, updatedAt',
      takeoffItems: 'id, drawingId, category, itemType, source, createdAt',
      takeoffGroups: 'id, drawingId, parentId',
    });
    this.version(3).stores({
      projects: 'id, name, status, createdAt, updatedAt',
      drawings: 'id, projectId, fileName, status, createdAt, updatedAt',
      takeoffItems: 'id, drawingId, category, itemType, source, createdAt',
      takeoffGroups: 'id, drawingId, parentId',
      customColumns: 'id, drawingId, order',
    });
  }
}

export const db = new SekisanOCRDatabase();

// Project operations
export async function createProject(project: Project): Promise<string> {
  return await db.projects.add(project);
}

export async function getProject(id: string): Promise<Project | undefined> {
  return await db.projects.get(id);
}

export async function getAllProjects(): Promise<Project[]> {
  return await db.projects.orderBy('updatedAt').reverse().toArray();
}

export async function updateProject(id: string, updates: Partial<Project>): Promise<number> {
  return await db.projects.update(id, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteProject(id: string): Promise<void> {
  await db.transaction('rw', [db.projects, db.drawings, db.takeoffItems, db.takeoffGroups, db.customColumns], async () => {
    const drawings = await db.drawings.where('projectId').equals(id).toArray();
    const drawingIds = drawings.map((d) => d.id);

    await db.takeoffItems.where('drawingId').anyOf(drawingIds).delete();
    await db.takeoffGroups.where('drawingId').anyOf(drawingIds).delete();
    await db.customColumns.where('drawingId').anyOf(drawingIds).delete();
    await db.drawings.where('projectId').equals(id).delete();
    await db.projects.delete(id);
  });
}

// Drawing operations
export async function createDrawing(drawing: Drawing): Promise<string> {
  return await db.drawings.add(drawing);
}

export async function getDrawing(id: string): Promise<Drawing | undefined> {
  return await db.drawings.get(id);
}

export async function getDrawingsByProject(projectId: string): Promise<Drawing[]> {
  return await db.drawings.where('projectId').equals(projectId).toArray();
}

export async function updateDrawing(id: string, updates: Partial<Drawing>): Promise<number> {
  return await db.drawings.update(id, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteDrawing(id: string): Promise<void> {
  await db.transaction('rw', db.drawings, db.takeoffItems, db.takeoffGroups, db.customColumns, async () => {
    await db.takeoffItems.where('drawingId').equals(id).delete();
    await db.takeoffGroups.where('drawingId').equals(id).delete();
    await db.customColumns.where('drawingId').equals(id).delete();
    await db.drawings.delete(id);
  });
}

// TakeoffItem operations
export async function createTakeoffItem(item: TakeoffItem): Promise<string> {
  return await db.takeoffItems.add(item);
}

// バッチ追加（パフォーマンス改善）
export async function createTakeoffItemsBatch(items: TakeoffItem[]): Promise<string[]> {
  return await db.transaction('rw', db.takeoffItems, async () => {
    await db.takeoffItems.bulkAdd(items);
    return items.map(item => item.id);
  });
}

// バッチ削除
export async function deleteTakeoffItemsBatch(ids: string[]): Promise<void> {
  await db.transaction('rw', db.takeoffItems, async () => {
    await db.takeoffItems.bulkDelete(ids);
  });
}

export async function getTakeoffItemsByDrawing(drawingId: string): Promise<TakeoffItem[]> {
  return await db.takeoffItems.where('drawingId').equals(drawingId).toArray();
}

export async function updateTakeoffItem(id: string, updates: Partial<TakeoffItem>): Promise<number> {
  return await db.takeoffItems.update(id, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteTakeoffItem(id: string): Promise<void> {
  await db.takeoffItems.delete(id);
}

// TakeoffGroup operations
export async function createTakeoffGroup(group: TakeoffGroup): Promise<string> {
  return await db.takeoffGroups.add(group);
}

export async function createTakeoffGroupsBatch(groups: TakeoffGroup[]): Promise<string[]> {
  return await db.transaction('rw', db.takeoffGroups, async () => {
    await db.takeoffGroups.bulkAdd(groups);
    return groups.map(g => g.id);
  });
}

export async function getTakeoffGroupsByDrawing(drawingId: string): Promise<TakeoffGroup[]> {
  return await db.takeoffGroups.where('drawingId').equals(drawingId).toArray();
}

export async function updateTakeoffGroup(id: string, updates: Partial<TakeoffGroup>): Promise<number> {
  return await db.takeoffGroups.update(id, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteTakeoffGroup(id: string): Promise<void> {
  await db.takeoffGroups.delete(id);
}

export async function deleteTakeoffGroupsBatch(ids: string[]): Promise<void> {
  await db.transaction('rw', db.takeoffGroups, async () => {
    await db.takeoffGroups.bulkDelete(ids);
  });
}

// CustomColumn operations
export async function createCustomColumn(col: CustomColumn): Promise<string> {
  return await db.customColumns.add(col);
}

export async function getCustomColumnsByDrawing(drawingId: string): Promise<CustomColumn[]> {
  return await db.customColumns.where('drawingId').equals(drawingId).sortBy('order');
}

export async function updateCustomColumn(id: string, updates: Partial<CustomColumn>): Promise<number> {
  return await db.customColumns.update(id, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteCustomColumn(id: string): Promise<void> {
  await db.customColumns.delete(id);
}

// Storage usage
export async function getStorageUsage(): Promise<{ used: number; quota: number }> {
  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate();
    return {
      used: estimate.usage || 0,
      quota: estimate.quota || 0,
    };
  }
  return { used: 0, quota: 0 };
}

// Export/Import
export async function exportAllData(): Promise<string> {
  const projects = await db.projects.toArray();
  const drawings = await db.drawings.toArray();
  const takeoffItems = await db.takeoffItems.toArray();
  const takeoffGroups = await db.takeoffGroups.toArray();
  const customColumns = await db.customColumns.toArray();

  const exportData = {
    toolId: 'sekisan-ocr',
    toolVersion: '3.0',
    exportedAt: new Date().toISOString(),
    data: {
      projects,
      drawings,
      takeoffItems,
      takeoffGroups,
      customColumns,
    },
  };

  return JSON.stringify(exportData, null, 2);
}

export type ImportMode = 'overwrite' | 'merge';

export interface ImportResult {
  projects: { added: number; updated: number; skipped: number };
  drawings: { added: number; updated: number; skipped: number };
  takeoffItems: { added: number; updated: number; skipped: number };
  takeoffGroups: { added: number; updated: number; skipped: number };
}

export interface ImportValidationError {
  field: string;
  message: string;
}

// インポートデータ検証
function validateImportData(data: unknown): { valid: boolean; errors: ImportValidationError[] } {
  const errors: ImportValidationError[] = [];

  if (typeof data !== 'object' || data === null) {
    errors.push({ field: 'root', message: 'データがオブジェクト形式ではありません' });
    return { valid: false, errors };
  }

  const d = data as Record<string, unknown>;

  // 必須フィールドチェック
  if (d.toolId !== 'sekisan-ocr') {
    errors.push({ field: 'toolId', message: '積算OCRのバックアップファイルではありません' });
  }

  if (!d.data || typeof d.data !== 'object') {
    errors.push({ field: 'data', message: 'データフィールドが不正です' });
    return { valid: false, errors };
  }

  const dataObj = d.data as Record<string, unknown>;

  // プロジェクト検証
  if (dataObj.projects) {
    if (!Array.isArray(dataObj.projects)) {
      errors.push({ field: 'data.projects', message: 'プロジェクトデータが配列ではありません' });
    } else {
      dataObj.projects.forEach((project: unknown, index: number) => {
        const p = project as Record<string, unknown>;
        if (!p.id || typeof p.id !== 'string') {
          errors.push({ field: `data.projects[${index}].id`, message: 'プロジェクトIDが不正です' });
        }
        if (!p.name || typeof p.name !== 'string') {
          errors.push({ field: `data.projects[${index}].name`, message: 'プロジェクト名が不正です' });
        }
      });
    }
  }

  // 図面検証
  if (dataObj.drawings) {
    if (!Array.isArray(dataObj.drawings)) {
      errors.push({ field: 'data.drawings', message: '図面データが配列ではありません' });
    } else {
      dataObj.drawings.forEach((drawing: unknown, index: number) => {
        const d = drawing as Record<string, unknown>;
        if (!d.id || typeof d.id !== 'string') {
          errors.push({ field: `data.drawings[${index}].id`, message: '図面IDが不正です' });
        }
        if (!d.projectId || typeof d.projectId !== 'string') {
          errors.push({ field: `data.drawings[${index}].projectId`, message: 'プロジェクトIDが不正です' });
        }
      });
    }
  }

  // 拾い出しアイテム検証
  if (dataObj.takeoffItems) {
    if (!Array.isArray(dataObj.takeoffItems)) {
      errors.push({ field: 'data.takeoffItems', message: '拾い出しデータが配列ではありません' });
    } else {
      dataObj.takeoffItems.forEach((item: unknown, index: number) => {
        const i = item as Record<string, unknown>;
        if (!i.id || typeof i.id !== 'string') {
          errors.push({ field: `data.takeoffItems[${index}].id`, message: 'アイテムIDが不正です' });
        }
        if (!i.drawingId || typeof i.drawingId !== 'string') {
          errors.push({ field: `data.takeoffItems[${index}].drawingId`, message: '図面IDが不正です' });
        }
        if (typeof i.quantity !== 'number' || i.quantity < 0) {
          errors.push({ field: `data.takeoffItems[${index}].quantity`, message: '数量が不正です' });
        }
      });
    }
  }

  // 最大件数チェック（DoS対策）
  const maxItems = 10000;
  if (Array.isArray(dataObj.projects) && dataObj.projects.length > maxItems) {
    errors.push({ field: 'data.projects', message: `プロジェクト数が上限(${maxItems})を超えています` });
  }
  if (Array.isArray(dataObj.drawings) && dataObj.drawings.length > maxItems) {
    errors.push({ field: 'data.drawings', message: `図面数が上限(${maxItems})を超えています` });
  }
  if (Array.isArray(dataObj.takeoffItems) && dataObj.takeoffItems.length > maxItems * 10) {
    errors.push({ field: 'data.takeoffItems', message: `アイテム数が上限(${maxItems * 10})を超えています` });
  }

  return { valid: errors.length === 0, errors };
}

export async function importData(jsonString: string, mode: ImportMode = 'overwrite'): Promise<ImportResult> {
  // JSONパース
  let data: unknown;
  try {
    data = JSON.parse(jsonString);
  } catch {
    throw new Error('JSONの形式が不正です');
  }

  // 検証
  const validation = validateImportData(data);
  if (!validation.valid) {
    const errorMessages = validation.errors.map(e => `${e.field}: ${e.message}`).join('\n');
    throw new Error(`インポートデータの検証に失敗しました:\n${errorMessages}`);
  }

  const d = data as { data: { projects?: Project[]; drawings?: Drawing[]; takeoffItems?: TakeoffItem[]; takeoffGroups?: TakeoffGroup[]; customColumns?: CustomColumn[] } };

  const result: ImportResult = {
    projects: { added: 0, updated: 0, skipped: 0 },
    drawings: { added: 0, updated: 0, skipped: 0 },
    takeoffItems: { added: 0, updated: 0, skipped: 0 },
    takeoffGroups: { added: 0, updated: 0, skipped: 0 },
  };

  await db.transaction('rw', [db.projects, db.drawings, db.takeoffItems, db.takeoffGroups, db.customColumns], async () => {
    // Projects - バッチ処理
    if (d.data.projects && d.data.projects.length > 0) {
      if (mode === 'overwrite') {
        await db.projects.bulkPut(d.data.projects);
        result.projects.added = d.data.projects.length;
      } else {
        for (const project of d.data.projects) {
          const existing = await db.projects.get(project.id);
          if (!existing) {
            await db.projects.add(project);
            result.projects.added++;
          } else {
            result.projects.skipped++;
          }
        }
      }
    }

    // Drawings - バッチ処理
    if (d.data.drawings && d.data.drawings.length > 0) {
      if (mode === 'overwrite') {
        await db.drawings.bulkPut(d.data.drawings);
        result.drawings.added = d.data.drawings.length;
      } else {
        for (const drawing of d.data.drawings) {
          const existing = await db.drawings.get(drawing.id);
          if (!existing) {
            await db.drawings.add(drawing);
            result.drawings.added++;
          } else {
            result.drawings.skipped++;
          }
        }
      }
    }

    // TakeoffItems - バッチ処理
    if (d.data.takeoffItems && d.data.takeoffItems.length > 0) {
      if (mode === 'overwrite') {
        await db.takeoffItems.bulkPut(d.data.takeoffItems);
        result.takeoffItems.added = d.data.takeoffItems.length;
      } else {
        for (const item of d.data.takeoffItems) {
          const existing = await db.takeoffItems.get(item.id);
          if (!existing) {
            await db.takeoffItems.add(item);
            result.takeoffItems.added++;
          } else {
            result.takeoffItems.skipped++;
          }
        }
      }
    }

    // TakeoffGroups - バッチ処理
    if (d.data.takeoffGroups && d.data.takeoffGroups.length > 0) {
      if (mode === 'overwrite') {
        await db.takeoffGroups.bulkPut(d.data.takeoffGroups);
        result.takeoffGroups.added = d.data.takeoffGroups.length;
      } else {
        for (const group of d.data.takeoffGroups) {
          const existing = await db.takeoffGroups.get(group.id);
          if (!existing) {
            await db.takeoffGroups.add(group);
            result.takeoffGroups.added++;
          } else {
            result.takeoffGroups.skipped++;
          }
        }
      }
    }

    // CustomColumns - バッチ処理
    if (d.data.customColumns && d.data.customColumns.length > 0) {
      if (mode === 'overwrite') {
        await db.customColumns.bulkPut(d.data.customColumns);
      } else {
        for (const col of d.data.customColumns) {
          const existing = await db.customColumns.get(col.id);
          if (!existing) {
            await db.customColumns.add(col);
          }
        }
      }
    }
  });

  return result;
}

export async function clearAllData(): Promise<void> {
  await db.transaction('rw', [db.projects, db.drawings, db.takeoffItems, db.takeoffGroups, db.customColumns], async () => {
    await db.projects.clear();
    await db.drawings.clear();
    await db.takeoffItems.clear();
    await db.takeoffGroups.clear();
    await db.customColumns.clear();
  });
}
