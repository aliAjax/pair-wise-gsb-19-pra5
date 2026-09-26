export interface Tank {
  id: string;
  name: string;
}

export type DangerType = "ph" | "ammonia" | "temp";

export interface Reading {
  /** pH 值 */
  ph: string;
  /** 氨氮 mg/L */
  ammonia: string;
  /** 温度 ℃ */
  temp: string;
  /** 换水量，如 30% 或 20L */
  waterChange: string;
}

export interface DangerInfo {
  type: DangerType;
  label: string;
  /** 危险原因描述 */
  detail: string;
  /** 触发时的原始读数，用于判断处置是否仍对应当前读数 */
  raw: string;
}

/**
 * 处置信息。
 * value/at 为空表示处置人、说明已填写但还没点「完结」；
 * 完结时快照对应读数 raw，读数再被改动则处置需重新完结。
 */
export interface Resolution {
  handler: string;
  note: string;
  value: string;
  at: string;
}

export type HandlingMap = Partial<Record<DangerType, Resolution>>;

export interface TankEntry extends Reading {
  handling: HandlingMap;
}

export type EntryMap = Record<string, TankEntry>;

export interface ShiftDraft {
  inspector: string;
  entries: EntryMap;
}

export type DraftMap = Record<string, ShiftDraft>;

export interface SnapshotDanger extends DangerInfo {
  handler: string;
  note: string;
  resolvedAt: string;
}

export interface SnapshotTank extends Reading {
  id: string;
  name: string;
  dangers: SnapshotDanger[];
}

export interface HandoverRecord {
  /** 班次唯一键：日期 + 班别 */
  key: string;
  date: string;
  shift: string;
  inspector: string;
  closedAt: string;
  tankCount: number;
  dangerCount: number;
  tanks: SnapshotTank[];
}

export const SHIFTS = ["早班", "中班", "晚班"] as const;

export const FIELD_LABELS: { key: keyof Reading; label: string; unit: string; step: string }[] = [
  { key: "ph", label: "pH", unit: "", step: "0.1" },
  { key: "ammonia", label: "氨氮", unit: "mg/L", step: "0.01" },
  { key: "temp", label: "温度", unit: "℃", step: "0.1" },
  { key: "waterChange", label: "换水量", unit: "", step: "0.1" },
];
