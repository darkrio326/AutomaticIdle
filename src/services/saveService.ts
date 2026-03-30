import type { PlayerState } from '@/core/types';

export interface SaveSnapshot {
  version: 1;
  flowName: string;
  steps: Array<{ recipeId: string; repeat: number }>;
  playerState: PlayerState;
  completedOrderIds: string[];
  unlockedRecipeIds: string[];
  purchasedBuildingIds?: string[];
  purchasedToolIds?: string[];
  lastSavedAt: number;
}

const SAVE_KEY = 'automatic-idle.save.v1';

export function loadSaveSnapshot(): SaveSnapshot | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<SaveSnapshot>;
    if (parsed.version !== 1) return null;
    if (!Array.isArray(parsed.steps)) return null;
    if (!parsed.playerState) return null;

    return parsed as SaveSnapshot;
  } catch {
    return null;
  }
}

export function saveSnapshot(snapshot: SaveSnapshot): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot));
  } catch {
    // 忽略存档异常，避免影响主流程
  }
}

export function clearSaveSnapshot(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // 忽略清理异常
  }
}
