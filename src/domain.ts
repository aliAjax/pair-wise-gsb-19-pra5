// 闭店巡检台：领域模型与判定规则

export type MetricKey = "ph" | "ammonia" | "temp" | "waterChange";

export type TankReadings = Record<MetricKey, number | null>;

export interface TankDef {
  id: string;
  name: string;
  species: string;
}

export interface HandlingLog {
  at: string;
  by: string;
  text: string;
}

export interface HandlingEntry {
  id: string;
  tankId: string;
  reason: string;
  handler: string;
  note: string;
  resolved: boolean;
  resolvedAt: string | null;
  logs: HandlingLog[];
}

export interface TankInspection {
  tankId: string;
  readings: TankReadings;
}

export interface ShiftRecord {
  id: string;
  date: string; // YYYY-MM-DD
  name: string; // 班次名称，如“晚班”
  inspector: string; // 巡检人
  status: "active" | "submitted";
  createdAt: string;
  submittedAt: string | null;
  handoverNote: string;
  inspections: TankInspection[];
  handling: HandlingEntry[];
}

export interface MetricDef {
  key: MetricKey;
  label: string;
  unit: string;
  step: string;
  required: boolean;
}

export const METRICS: MetricDef[] = [
  { key: "ph", label: "pH", unit: "", step: "0.1", required: true },
  { key: "ammonia", label: "氨氮", unit: "mg/L", step: "0.01", required: true },
  { key: "temp", label: "温度", unit: "℃", step: "0.1", required: true },
  { key: "waterChange", label: "换水量", unit: "%", step: "1", required: false },
];

// 危险阈值：氨氮 ≥ 0.5 mg/L；温度超出 22~30℃；pH 超出 6~8.5
export const THRESHOLDS = {
  ammoniaMax: 0.5,
  tempMin: 22,
  tempMax: 30,
  phMin: 6,
  phMax: 8.5,
} as const;

export const TANKS: TankDef[] = [
  { id: "tank-a", name: "草缸 A", species: "灯鱼 · 水草造景" },
  { id: "tank-b", name: "海缸 B", species: "小丑鱼 · 珊瑚" },
  { id: "tank-c", name: "三湖缸 C", species: "慈鲷" },
  { id: "tank-d", name: "繁殖缸 D", species: "孔雀鱼鱼苗" },
];

export const STORE_KEY = "aqua-closing-inspection/v1";

export interface StoreShape {
  shifts: ShiftRecord[];
  activeId: string | null;
}

export function emptyReadings(): TankReadings {
  return { ph: null, ammonia: null, temp: null, waterChange: null };
}

export function dangerReasons(r: TankReadings): string[] {
  const reasons: string[] = [];
  if (r.ammonia !== null && r.ammonia >= THRESHOLDS.ammoniaMax) {
    reasons.push(`氨氮 ${r.ammonia} mg/L ≥ ${THRESHOLDS.ammoniaMax}`);
  }
  if (r.temp !== null && (r.temp < THRESHOLDS.tempMin || r.temp > THRESHOLDS.tempMax)) {
    reasons.push(
      `温度 ${r.temp}℃ 超出 ${THRESHOLDS.tempMin}~${THRESHOLDS.tempMax}℃`
    );
  }
  if (r.ph !== null && (r.ph < THRESHOLDS.phMin || r.ph > THRESHOLDS.phMax)) {
    reasons.push(`pH ${r.ph} 超出 ${THRESHOLDS.phMin}~${THRESHOLDS.phMax}`);
  }
  return reasons;
}

export function missingFields(r: TankReadings): string[] {
  return METRICS.filter((m) => m.required && r[m.key] === null).map((m) => m.label);
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 8) + Date.now().toString(36);
}

export function nowText(): string {
  return new Date().toLocaleString("zh-CN", { hour12: false });
}

export function todayText(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function newShift(date: string, name: string, inspector: string): ShiftRecord {
  return {
    id: uid(),
    date,
    name,
    inspector,
    status: "active",
    createdAt: nowText(),
    submittedAt: null,
    handoverNote: "",
    inspections: TANKS.map((t) => ({ tankId: t.id, readings: emptyReadings() })),
    handling: [],
  };
}

export function loadStore(): StoreShape {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoreShape;
      if (Array.isArray(parsed.shifts)) {
        return { shifts: parsed.shifts, activeId: parsed.activeId ?? null };
      }
    }
  } catch {
    // 数据损坏时回退到空库
  }
  return { shifts: [], activeId: null };
}

export function saveStore(store: StoreShape): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    // 存储不可用时静默失败，页面内状态仍可用
  }
}

export function tankName(tankId: string): string {
  return TANKS.find((t) => t.id === tankId)?.name ?? tankId;
}

export function shiftLabel(shift: ShiftRecord): string {
  return `${shift.date} ${shift.name}`;
}
