import type {
  DangerInfo,
  EntryMap,
  HandoverRecord,
  Reading,
  Resolution,
  ShiftDraft,
  SnapshotDanger,
  SnapshotTank,
  Tank,
} from "./types";

/** 危险阈值：氨氮 ≥ 0.5 mg/L，温度超出 22–30℃，pH 超出 6–8.5 */
export const AMMONIA_LIMIT = 0.5;
export const TEMP_MIN = 22;
export const TEMP_MAX = 30;
export const PH_MIN = 6;
export const PH_MAX = 8.5;

export const DANGER_RULES_TEXT =
  "危险判定：氨氮 ≥ 0.5 mg/L；温度 < 22℃ 或 > 30℃；pH < 6 或 > 8.5";

export const DEFAULT_TANKS: Tank[] = [
  { id: "tank-a", name: "草缸 A" },
  { id: "tank-b", name: "海缸 B" },
  { id: "tank-c", name: "三湖缸 C" },
  { id: "tank-d", name: "繁殖缸 D" },
];

export function blankReading(): Reading {
  return { ph: "", ammonia: "", temp: "", waterChange: "" };
}

export function blankEntry(): Reading & { handling: Record<string, never> } {
  return { ...blankReading(), handling: {} };
}

export function blankDraft(): ShiftDraft {
  return { inspector: "", entries: {} };
}

/** 该缸四项指标是否全部已登记 */
export function isMeasured(r: Reading): boolean {
  return (
    r.ph.trim() !== "" &&
    r.ammonia.trim() !== "" &&
    r.temp.trim() !== "" &&
    r.waterChange.trim() !== ""
  );
}

export function missingFields(r: Reading): string[] {
  const missing: string[] = [];
  if (r.ph.trim() === "") missing.push("pH");
  if (r.ammonia.trim() === "") missing.push("氨氮");
  if (r.temp.trim() === "") missing.push("温度");
  if (r.waterChange.trim() === "") missing.push("换水量");
  return missing;
}

/** 按阈值判定危险项 */
export function dangersOf(r: Reading): DangerInfo[] {
  const dangers: DangerInfo[] = [];
  const ph = Number(r.ph);
  if (r.ph.trim() !== "" && !Number.isNaN(ph) && (ph < PH_MIN || ph > PH_MAX)) {
    dangers.push({
      type: "ph",
      label: "pH",
      detail: `pH ${r.ph} 超出 ${PH_MIN}–${PH_MAX} 安全范围`,
      raw: r.ph,
    });
  }
  const ammonia = Number(r.ammonia);
  if (r.ammonia.trim() !== "" && !Number.isNaN(ammonia) && ammonia >= AMMONIA_LIMIT) {
    dangers.push({
      type: "ammonia",
      label: "氨氮",
      detail: `氨氮 ${r.ammonia} mg/L ≥ ${AMMONIA_LIMIT} mg/L`,
      raw: r.ammonia,
    });
  }
  const temp = Number(r.temp);
  if (r.temp.trim() !== "" && !Number.isNaN(temp) && (temp < TEMP_MIN || temp > TEMP_MAX)) {
    dangers.push({
      type: "temp",
      label: "温度",
      detail: `温度 ${r.temp}℃ 偏离 ${TEMP_MIN}–${TEMP_MAX}℃ 安全范围`,
      raw: r.temp,
    });
  }
  return dangers;
}

/** 处置已完结，且完结时的读数与当前读数一致（读数被改动则需重新处置） */
export function isResolutionEffective(d: DangerInfo, res: Resolution | undefined): boolean {
  return !!res && res.value !== "" && res.value === d.raw && res.at !== "";
}

export function resolutionMissing(res: Resolution | undefined): string[] {
  const missing: string[] = [];
  if (!res || res.handler.trim() === "") missing.push("处置人");
  if (!res || res.note.trim() === "") missing.push("处置说明");
  return missing;
}

export interface UnmeasuredItem {
  id: string;
  name: string;
  missing: string[];
}

export interface UnresolvedItem {
  id: string;
  name: string;
  danger: string;
  detail: string;
  missing: string[];
  stale: boolean;
}

export interface Validation {
  unmeasured: UnmeasuredItem[];
  unresolved: UnresolvedItem[];
}

export function validateEntries(tanks: Tank[], entries: EntryMap): Validation {
  const unmeasured: UnmeasuredItem[] = [];
  const unresolved: UnresolvedItem[] = [];
  for (const tank of tanks) {
    const entry = entries[tank.id];
    if (!entry || !isMeasured(entry)) {
      unmeasured.push({ id: tank.id, name: tank.name, missing: missingFields(entry ?? blankReading()) });
      continue;
    }
    for (const d of dangersOf(entry)) {
      const res = entry.handling[d.type];
      if (!isResolutionEffective(d, res)) {
        unresolved.push({
          id: tank.id,
          name: tank.name,
          danger: d.label,
          detail: d.detail,
          missing: resolutionMissing(res),
          stale: !!res && res.value !== "" && res.value !== d.raw,
        });
      }
    }
  }
  return { unmeasured, unresolved };
}

export function buildRecord(
  tanks: Tank[],
  entries: EntryMap,
  date: string,
  shift: string,
  inspector: string,
  closedAt: string
): HandoverRecord {
  const snapshotTanks: SnapshotTank[] = tanks.map((tank) => {
    const entry = entries[tank.id] ?? blankEntry();
    const dangers: SnapshotDanger[] = dangersOf(entry).map((d) => {
      const res = entry.handling[d.type];
      return {
        ...d,
        handler: res?.handler ?? "",
        note: res?.note ?? "",
        resolvedAt: res?.at ?? "",
      };
    });
    return { id: tank.id, name: tank.name, ...entry, dangers };
  });
  return {
    key: `${date}|${shift}`,
    date,
    shift,
    inspector,
    closedAt,
    tankCount: snapshotTanks.length,
    dangerCount: snapshotTanks.reduce((n, t) => n + t.dangers.length, 0),
    tanks: snapshotTanks,
  };
}

export function shiftKey(date: string, shift: string): string {
  return `${date}|${shift}`;
}

export function todayStr(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** 按当前时间猜测班别：6–14 早班，14–22 中班，其余晚班 */
export function defaultShift(): string {
  const h = new Date().getHours();
  if (h >= 6 && h < 14) return "早班";
  if (h >= 14 && h < 22) return "中班";
  return "晚班";
}

export function formatTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
}
