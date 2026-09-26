import type { DangerInfo, DangerType, Resolution, Tank, TankEntry } from "../types";
import {
  dangersOf,
  isMeasured,
  isResolutionEffective,
  missingFields,
  resolutionMissing,
} from "../logic";

interface Props {
  tank: Tank;
  entry: TankEntry;
  locked: boolean;
  onReadingChange: (tankId: string, field: "ph" | "ammonia" | "temp" | "waterChange", value: string) => void;
  onResolutionChange: (tankId: string, type: DangerType, patch: Partial<Resolution>) => void;
  onResolve: (tankId: string, danger: DangerInfo) => void;
  onReopen: (tankId: string, type: DangerType) => void;
  onRemove: (tankId: string) => void;
}

function DangerBlock({
  tank,
  danger,
  entry,
  locked,
  onResolutionChange,
  onResolve,
  onReopen,
}: {
  tank: Tank;
  danger: DangerInfo;
  entry: TankEntry;
  locked: boolean;
  onResolutionChange: Props["onResolutionChange"];
  onResolve: Props["onResolve"];
  onReopen: Props["onReopen"];
}) {
  const res = entry.handling[danger.type];
  const effective = isResolutionEffective(danger, res);
  const missing = resolutionMissing(res);
  const stale = !!res && res.value !== "" && res.value !== danger.raw;

  return (
    <div className={`danger-item ${effective ? "resolved" : ""}`}>
      <div className="danger-head">
        <span className="danger-tag">危险 · {danger.label}</span>
        <span className="danger-detail">{danger.detail}</span>
        {effective && <span className="resolved-tag">已完结</span>}
      </div>

      {stale && !effective && (
        <p className="stale-hint">读数已变更，原处置失效，请重新填写并完结。</p>
      )}

      {effective ? (
        <div className="resolution-done">
          <p>
            处置人：{res!.handler} · 完结于 {res!.at && new Date(res!.at).toLocaleString("zh-CN", { hour12: false })}
          </p>
          <p>处置说明：{res!.note}</p>
          {!locked && (
            <button type="button" className="link-btn" onClick={() => onReopen(tank.id, danger.type)}>
              重新处置
            </button>
          )}
        </div>
      ) : (
        <div className="resolution-form">
          <div className="resolution-grid">
            <label>
              <span>处置人 *</span>
              <input
                value={res?.handler ?? ""}
                disabled={locked}
                placeholder="填写处置人姓名"
                onChange={(e) => onResolutionChange(tank.id, danger.type, { handler: e.target.value })}
              />
            </label>
            <label>
              <span>处置说明 *</span>
              <input
                value={res?.note ?? ""}
                disabled={locked}
                placeholder="如：换水 1/3，停食观察"
                onChange={(e) => onResolutionChange(tank.id, danger.type, { note: e.target.value })}
              />
            </label>
          </div>
          <div className="resolution-actions">
            <button
              type="button"
              className="resolve-btn"
              disabled={locked || missing.length > 0}
              title={missing.length > 0 ? `请先填写${missing.join("、")}` : "确认完结该危险项"}
              onClick={() => onResolve(tank.id, danger)}
            >
              完结该危险项
            </button>
            {missing.length > 0 && <span className="missing-hint">缺少：{missing.join("、")}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TankCard(props: Props) {
  const { tank, entry, locked, onReadingChange, onRemove } = props;
  const measured = isMeasured(entry);
  const dangers = dangersOf(entry);
  const unresolved = dangers.filter((d) => !isResolutionEffective(d, entry.handling[d.type]));
  const missing = missingFields(entry);

  const statusClass = !measured ? "pending" : unresolved.length > 0 ? "danger" : "ok";
  const statusText = !measured
    ? "未测"
    : unresolved.length > 0
      ? `危险 ${unresolved.length} 项待处置`
      : dangers.length > 0
        ? "危险已处置"
        : "正常";

  return (
    <article className={`tank-card ${statusClass}`}>
      <header className="tank-head">
        <h3>{tank.name}</h3>
        <span className={`status-pill ${statusClass}`}>{statusText}</span>
        {!locked && (
          <button type="button" className="link-btn remove" onClick={() => onRemove(tank.id)}>
            移除
          </button>
        )}
      </header>

      <div className="reading-grid">
        <label>
          <span>pH（6–8.5）</span>
          <input
            type="number"
            step="0.1"
            value={entry.ph}
            disabled={locked}
            placeholder="如 7.2"
            onChange={(e) => onReadingChange(tank.id, "ph", e.target.value)}
          />
        </label>
        <label>
          <span>氨氮 mg/L（&lt; 0.5）</span>
          <input
            type="number"
            step="0.01"
            value={entry.ammonia}
            disabled={locked}
            placeholder="如 0.1"
            onChange={(e) => onReadingChange(tank.id, "ammonia", e.target.value)}
          />
        </label>
        <label>
          <span>温度 ℃（22–30）</span>
          <input
            type="number"
            step="0.1"
            value={entry.temp}
            disabled={locked}
            placeholder="如 26"
            onChange={(e) => onReadingChange(tank.id, "temp", e.target.value)}
          />
        </label>
        <label>
          <span>换水量</span>
          <input
            value={entry.waterChange}
            disabled={locked}
            placeholder="如 30% 或 20L"
            onChange={(e) => onReadingChange(tank.id, "waterChange", e.target.value)}
          />
        </label>
      </div>

      {!measured && <p className="missing-hint">未测：缺 {missing.join("、")}</p>}

      {dangers.length > 0 && (
        <div className="danger-list">
          {dangers.map((d) => (
            <DangerBlock
              key={d.type}
              tank={tank}
              danger={d}
              entry={entry}
              locked={locked}
              onResolutionChange={props.onResolutionChange}
              onResolve={props.onResolve}
              onReopen={props.onReopen}
            />
          ))}
        </div>
      )}
    </article>
  );
}
