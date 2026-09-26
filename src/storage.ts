import type { DraftMap, HandoverRecord, Tank } from "./types";
import { DEFAULT_TANKS } from "./logic";

const TANKS_KEY = "aqua.tanks.v1";
const DRAFTS_KEY = "aqua.drafts.v1";
const RECORDS_KEY = "aqua.records.v1";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 存储不可用时静默失败，不影响页面使用
  }
}

export function loadTanks(): Tank[] {
  const tanks = read<Tank[]>(TANKS_KEY, []);
  if (tanks.length > 0) return tanks;
  write(TANKS_KEY, DEFAULT_TANKS);
  return DEFAULT_TANKS;
}

export function saveTanks(tanks: Tank[]): void {
  write(TANKS_KEY, tanks);
}

export function loadDrafts(): DraftMap {
  return read<DraftMap>(DRAFTS_KEY, {});
}

export function saveDrafts(drafts: DraftMap): void {
  write(DRAFTS_KEY, drafts);
}

export function loadRecords(): HandoverRecord[] {
  return read<HandoverRecord[]>(RECORDS_KEY, []);
}

export function saveRecords(records: HandoverRecord[]): void {
  write(RECORDS_KEY, records);
}
