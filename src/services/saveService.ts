import type { PlayerState, ActiveOrder } from '@/core/types';

export interface OrderSlotSnapshot {
  slotIndex: number;
  order: ActiveOrder | null;
  cooldownEndsAt: number | null;
}

export interface SaveSnapshot {
  version: 1;
  flowName: string;
  steps: Array<{ recipeId: string; repeat: number }>;
  playerState: PlayerState;
  bestStableGps?: number;
  localBestGps?: number;
  totalTechPoints?: number;
  completedOrderIds?: string[];
  unlockedRecipeIds: string[];
  purchasedBuildingIds?: string[];
  purchasedToolIds?: string[];
  toolLevels?: Record<string, number>;
  orderSlots?: OrderSlotSnapshot[];
  lastSavedAt: number;
}

const SAVE_KEY = 'automatic-idle.save.v1';
const TRANSFER_PREFIX = 'AID1';
const TRANSFER_KEY = 'AutomaticIdle.Transfer.v1';

export interface ImportSaveResult {
  ok: boolean;
  reason?: string;
  snapshot?: SaveSnapshot;
}

function computeChecksum(input: string): string {
  // 轻量完整性校验：FNV-1a 32-bit
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function xorCipher(input: string, key: string): string {
  let out = '';
  for (let i = 0; i < input.length; i += 1) {
    out += String.fromCharCode(input.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return out;
}

function encodeBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  const b64 = btoa(binary);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64Url(input: string): string {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function isValidSnapshot(parsed: Partial<SaveSnapshot>): parsed is SaveSnapshot {
  if (parsed.version !== 1) return false;
  if (!Array.isArray(parsed.steps)) return false;
  if (!parsed.playerState) return false;
  if (!Array.isArray(parsed.unlockedRecipeIds)) return false;
  if (typeof parsed.flowName !== 'string') return false;
  if (typeof parsed.lastSavedAt !== 'number') return false;
  return true;
}

export function loadSaveSnapshot(): SaveSnapshot | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<SaveSnapshot>;
    if (!isValidSnapshot(parsed)) return null;

    return parsed as SaveSnapshot;
  } catch {
    return null;
  }
}

export function exportSaveTransferString(snapshot: SaveSnapshot): string {
  const payload = JSON.stringify(snapshot);
  const checksum = computeChecksum(payload);
  const wrapped = JSON.stringify({ payload, checksum });
  const encrypted = xorCipher(wrapped, TRANSFER_KEY);
  const encoded = encodeBase64Url(encrypted);
  return `${TRANSFER_PREFIX}.${encoded}`;
}

export function parseSaveTransferString(raw: string): ImportSaveResult {
  const input = raw.trim();
  if (!input) return { ok: false, reason: '导入字符串为空。' };

  const [prefix, encoded] = input.split('.');
  if (prefix !== TRANSFER_PREFIX || !encoded) {
    return { ok: false, reason: '导入字符串格式不正确。' };
  }

  try {
    const encrypted = decodeBase64Url(encoded);
    const wrappedText = xorCipher(encrypted, TRANSFER_KEY);
    const wrapped = JSON.parse(wrappedText) as { payload?: string; checksum?: string };
    if (typeof wrapped.payload !== 'string' || typeof wrapped.checksum !== 'string') {
      return { ok: false, reason: '导入字符串内容不完整。' };
    }

    const actualChecksum = computeChecksum(wrapped.payload);
    if (actualChecksum !== wrapped.checksum) {
      return { ok: false, reason: '导入字符串校验失败（内容可能损坏或被篡改）。' };
    }

    const parsed = JSON.parse(wrapped.payload) as Partial<SaveSnapshot>;
    if (!isValidSnapshot(parsed)) {
      return { ok: false, reason: '导入字符串版本或数据结构不兼容。' };
    }

    return { ok: true, snapshot: parsed };
  } catch {
    return { ok: false, reason: '导入字符串无法解析。' };
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
