import { useEffect, useMemo, useState } from "react";
import "./styles.css";
import {
  METRICS,
  TANKS,
  dangerReasons,
  loadStore,
  missingFields,
  newShift,
  nowText,
  saveStore,
  shiftLabel,
  tankName,
  todayText,
  uid,
} from "./domain";
import type {
  HandlingEntry,
  MetricKey,
  ShiftRecord,
  StoreShape,
  TankReadings,
} from "./domain";

type Tab = "inspect" | "history";

function parseNum(raw: string): number | null {
  if (raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function inputVal(v: number | null): string {
  return v === null ? "" : String(v);
}

// ---------- 主组件 ----------

function App() {
  const [store, setStore] = useState<StoreShape>(() => loadStore());
  const [tab, setTab] = useState<Tab>("inspect");
  const [historyFocusId, setHistoryFocusId] = useState<string | null>(null);

  useEffect(() => {
    saveStore(store);
  }, [store]);

  const activeShift =
    store.shifts.find((s) => s.id === store.activeId && s.status === "active") ?? null;

  const updateShift = (id: string, fn: (s: ShiftRecord) => ShiftRecord) => {
    setStore((prev) => ({
      ...prev,
      shifts: prev.shifts.map((s) => (s.id === id ? fn(s) : s)),
    }));
  };

  const startShift = (date: string, name: string, inspector: string) => {
    const shift = newShift(date, name, inspector);
    setStore((prev) => ({ shifts: [...prev.shifts, shift], activeId: shift.id }));
    setTab("inspect");
  };

  const openDraft = (id: string) => {
    setStore((prev) => ({ ...prev, activeId: id }));
    setTab("inspect");
  };

  const submitShift = (id: string) => {
    updateShift(id, (s) => ({ ...s, status: "submitted", submittedAt: nowText() }));
    setStore((prev) => ({ ...prev, activeId: null }));
    setHistoryFocusId(id);
    setTab("history");
  };

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">hxwl-05 · 水族养护 · 打烊前必办</p>
          <h1>闭店巡检台</h1>
          <p className="subtitle">
            打烊前逐缸登记 pH、氨氮、温度和换水量。氨氮 ≥ 0.5 mg/L、温度超出 22~30℃
            或 pH 超出 6~8.5 即判危险；危险项须填写处置人和处置说明并完结，全部鱼缸测完、
            危险项全部完结后才能提交闭店。
          </p>
        </div>
        <div className="shift-card">
          {activeShift ? (
            <>
              <span className="shift-card-label">当前班次</span>
              <strong>{shiftLabel(activeShift)}</strong>
              <span className="shift-card-meta">
                巡检人 {activeShift.inspector || "未填写"} · 开班 {activeShift.createdAt}
              </span>
              <span className="shift-card-meta">
                数据实时保存在本机，关页面不丢失
              </span>
            </>
          ) : (
            <>
              <span className="shift-card-label">当前没有进行中的班次</span>
              <strong>请先开班再巡检</strong>
              <span className="shift-card-meta">
                已提交的交班记录可在「交班记录」按班次查看
              </span>
            </>
          )}
          <nav className="tabs">
            <button
              className={tab === "inspect" ? "tab active" : "tab"}
              onClick={() => setTab("inspect")}
            >
              闭店巡检
            </button>
            <button
              className={tab === "history" ? "tab active" : "tab"}
              onClick={() => setTab("history")}
            >
              交班记录
            </button>
          </nav>
        </div>
      </header>

      {tab === "inspect" ? (
        activeShift ? (
          <InspectView
            shift={activeShift}
            updateShift={updateShift}
            onSubmit={submitShift}
          />
        ) : (
          <StartShift
            drafts={store.shifts.filter((s) => s.status === "active")}
            onStart={startShift}
            onOpenDraft={openDraft}
          />
        )
      ) : (
        <HistoryView
          shifts={store.shifts}
          focusId={historyFocusId}
          onConsumeFocus={() => setHistoryFocusId(null)}
        />
      )}
    </main>
  );
}

// ---------- 开班 ----------

function StartShift({
  drafts,
  onStart,
  onOpenDraft,
}: {
  drafts: ShiftRecord[];
  onStart: (date: string, name: string, inspector: string) => void;
  onOpenDraft: (id: string) => void;
}) {
  const [date, setDate] = useState(todayText());
  const [name, setName] = useState("晚班");
  const [inspector, setInspector] = useState("");

  return (
    <section className="panel start-panel">
      <div className="section-heading">
        <div>
          <p>开班</p>
          <h2>开始新的闭店巡检</h2>
        </div>
      </div>
      <div className="start-grid">
        <label>
          <span>日期</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label>
          <span>班次</span>
          <input
            value={name}
            placeholder="如：晚班"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          <span>巡检人</span>
          <input
            value={inspector}
            placeholder="填写姓名"
            onChange={(e) => setInspector(e.target.value)}
          />
        </label>
        <button
          className="primary-action start-btn"
          disabled={!date || !name.trim() || !inspector.trim()}
          onClick={() => onStart(date, name.trim(), inspector.trim())}
        >
          开班并开始巡检
        </button>
      </div>
      {drafts.length > 0 && (
        <div className="draft-list">
          <h3>未完成的班次</h3>
          {drafts.map((d) => (
            <div key={d.id} className="draft-row">
              <span>
                {shiftLabel(d)} · 巡检人 {d.inspector || "未填写"}
              </span>
              <button onClick={() => onOpenDraft(d.id)}>继续巡检</button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ---------- 巡检台 ----------

function InspectView({
  shift,
  updateShift,
  onSubmit,
}: {
  shift: ShiftRecord;
  updateShift: (id: string, fn: (s: ShiftRecord) => ShiftRecord) => void;
  onSubmit: (id: string) => void;
}) {
  const setReading = (tankId: string, key: MetricKey, value: number | null) => {
    updateShift(shift.id, (s) => {
      const inspections = s.inspections.map((insp) =>
        insp.tankId === tankId
          ? { ...insp, readings: { ...insp.readings, [key]: value } }
          : insp
      );
      const readings = inspections.find((i) => i.tankId === tankId)!.readings;
      const reasons = dangerReasons(readings);
      // 危险项与当前读数保持同步：新出现的危险自动建档，消失的危险移除未完结记录
      let handling = s.handling.filter(
        (h) => !(h.tankId === tankId && !h.resolved && !reasons.includes(h.reason))
      );
      for (const reason of reasons) {
        if (!handling.some((h) => h.tankId === tankId && h.reason === reason)) {
          handling = [
            ...handling,
            {
              id: uid(),
              tankId,
              reason,
              handler: "",
              note: "",
              resolved: false,
              resolvedAt: null,
              logs: [{ at: nowText(), by: "系统", text: "巡检发现危险项，待处置" }],
            },
          ];
        }
      }
      return { ...s, inspections, handling };
    });
  };

  const setHandlingField = (
    entryId: string,
    field: "handler" | "note",
    value: string
  ) => {
    updateShift(shift.id, (s) => ({
      ...s,
      handling: s.handling.map((h) =>
        h.id === entryId ? { ...h, [field]: value } : h
      ),
    }));
  };

  const resolveHandling = (entryId: string) => {
    updateShift(shift.id, (s) => ({
      ...s,
      handling: s.handling.map((h) =>
        h.id === entryId
          ? {
              ...h,
              resolved: true,
              resolvedAt: nowText(),
              logs: [
                ...h.logs,
                {
                  at: nowText(),
                  by: h.handler.trim() || "未署名",
                  text: `完结处置：${h.note.trim()}`,
                },
              ],
            }
          : h
      ),
    }));
  };

  const reopenHandling = (entryId: string) => {
    updateShift(shift.id, (s) => ({
      ...s,
      handling: s.handling.map((h) =>
        h.id === entryId
          ? {
              ...h,
              resolved: false,
              resolvedAt: null,
              logs: [...h.logs, { at: nowText(), by: "系统", text: "重新打开，继续处置" }],
            }
          : h
      ),
    }));
  };

  const setMeta = (field: "inspector" | "handoverNote", value: string) => {
    updateShift(shift.id, (s) => ({ ...s, [field]: value }));
  };

  // 汇总与提交前检查
  const untested = TANKS.filter((t) => {
    const insp = shift.inspections.find((i) => i.tankId === t.id)!;
    return missingFields(insp.readings).length > 0;
  });
  const openHandling = shift.handling.filter((h) => !h.resolved);
  const resolvedCount = shift.handling.length - openHandling.length;
  const testedCount = TANKS.length - untested.length;
  const canSubmit =
    untested.length === 0 && openHandling.length === 0 && shift.inspector.trim() !== "";

  const trySubmit = () => {
    if (!canSubmit) return;
    if (window.confirm("确认提交闭店结果？提交后本班次将转为只读交班记录。")) {
      onSubmit(shift.id);
    }
  };

  return (
    <>
      <section className="metrics-grid">
        <article className="metric-card">
          <span>已测鱼缸</span>
          <strong>
            {testedCount}
            <em>/ {TANKS.length}</em>
          </strong>
          <i className={testedCount === TANKS.length ? "status-ok" : "status-watch"} />
        </article>
        <article className="metric-card">
          <span>未完结危险项</span>
          <strong>{openHandling.length}</strong>
          <i className={openHandling.length === 0 ? "status-ok" : "status-danger"} />
        </article>
        <article className="metric-card">
          <span>已完结处置</span>
          <strong>{resolvedCount}</strong>
          <i className="status-ok" />
        </article>
        <article className="metric-card">
          <span>闭店提交</span>
          <strong className="metric-text">{canSubmit ? "可提交" : "未就绪"}</strong>
          <i className={canSubmit ? "status-ok" : "status-watch"} />
        </article>
      </section>

      <section className="tank-grid">
        {TANKS.map((tank) => {
          const insp = shift.inspections.find((i) => i.tankId === tank.id)!;
          const tankHandling = shift.handling.filter((h) => h.tankId === tank.id);
          return (
            <TankCard
              key={tank.id}
              tankId={tank.id}
              readings={insp.readings}
              handling={tankHandling}
              onReading={setReading}
              onHandlingField={setHandlingField}
              onResolve={resolveHandling}
              onReopen={reopenHandling}
            />
          );
        })}
      </section>

      <section className="panel submit-panel">
        <div className="section-heading">
          <div>
            <p>交班</p>
            <h2>闭店提交</h2>
          </div>
          <button
            className="primary-action"
            disabled={!canSubmit}
            onClick={trySubmit}
            title={canSubmit ? "提交闭店结果" : "仍有未测鱼缸或未完结危险项"}
          >
            提交闭店结果
          </button>
        </div>

        <div className="handover-grid">
          <label>
            <span>巡检人（必填）</span>
            <input
              value={shift.inspector}
              placeholder="填写交班人姓名"
              onChange={(e) => setMeta("inspector", e.target.value)}
            />
          </label>
          <label>
            <span>交班备注（整体情况、给下一班的留言）</span>
            <textarea
              value={shift.handoverNote}
              placeholder="如：海缸 B 已下硝化细菌，明早复测氨氮"
              onChange={(e) => setMeta("handoverNote", e.target.value)}
            />
          </label>
        </div>

        {!canSubmit && (
          <div className="blocker-list">
            <h3>还不能提交，请补齐：</h3>
            <ul>
              {untested.map((t) => {
                const insp = shift.inspections.find((i) => i.tankId === t.id)!;
                return (
                  <li key={t.id}>
                    <strong>{t.name}</strong>：未测 {missingFields(insp.readings).join("、")}
                  </li>
                );
              })}
              {openHandling.map((h) => {
                const missing: string[] = [];
                if (!h.handler.trim()) missing.push("处置人");
                if (!h.note.trim()) missing.push("处置说明");
                if (missing.length > 0) missing.push("完结确认");
                else missing.push("点击「完结此项」");
                return (
                  <li key={h.id}>
                    <strong>{tankName(h.tankId)}</strong>：危险项「{h.reason}」缺{" "}
                    {missing.join("、")}
                  </li>
                );
              })}
              {shift.inspector.trim() === "" && (
                <li>
                  <strong>交班信息</strong>：未填写巡检人
                </li>
              )}
            </ul>
          </div>
        )}
      </section>
    </>
  );
}

// ---------- 单缸卡片 ----------

function TankCard({
  tankId,
  readings,
  handling,
  onReading,
  onHandlingField,
  onResolve,
  onReopen,
}: {
  tankId: string;
  readings: TankReadings;
  handling: HandlingEntry[];
  onReading: (tankId: string, key: MetricKey, value: number | null) => void;
  onHandlingField: (entryId: string, field: "handler" | "note", value: string) => void;
  onResolve: (entryId: string) => void;
  onReopen: (entryId: string) => void;
}) {
  const tank = TANKS.find((t) => t.id === tankId)!;
  const missing = missingFields(readings);
  const dangers = dangerReasons(readings);
  const openCount = handling.filter((h) => !h.resolved).length;

  const badge =
    openCount > 0 ? (
      <span className="badge danger">危险 {openCount} 项待处置</span>
    ) : dangers.length > 0 ? (
      <span className="badge danger">危险（已处置）</span>
    ) : missing.length > 0 ? (
      <span className="badge pending">未测完</span>
    ) : (
      <span className="badge ok">正常</span>
    );

  return (
    <article className={`panel tank-card ${openCount > 0 ? "tank-danger" : ""}`}>
      <div className="tank-head">
        <div>
          <h3>{tank.name}</h3>
          <p className="tank-species">{tank.species}</p>
        </div>
        {badge}
      </div>

      <div className="reading-grid">
        {METRICS.map((m) => {
          const value = readings[m.key];
          const isDanger =
            value !== null &&
            ((m.key === "ammonia" && value >= 0.5) ||
              (m.key === "temp" && (value < 22 || value > 30)) ||
              (m.key === "ph" && (value < 6 || value > 8.5)));
          return (
            <label key={m.key} className={isDanger ? "field danger-field" : "field"}>
              <span>
                {m.label}
                {m.unit ? `（${m.unit}）` : ""}
                {m.required ? " *" : ""}
              </span>
              <input
                type="number"
                step={m.step}
                inputMode="decimal"
                value={inputVal(value)}
                placeholder="未测"
                onChange={(e) => onReading(tankId, m.key, parseNum(e.target.value))}
              />
            </label>
          );
        })}
      </div>

      {missing.length > 0 && (
        <p className="tank-hint">未测：{missing.join("、")}</p>
      )}

      {handling.length > 0 && (
        <div className="handling-list">
          {handling.map((h) => (
            <div
              key={h.id}
              className={h.resolved ? "handling-item resolved" : "handling-item"}
            >
              <div className="handling-head">
                <strong>⚠ {h.reason}</strong>
                {h.resolved && <span className="badge ok">已完结</span>}
              </div>
              {!h.resolved ? (
                <div className="handling-form">
                  <label>
                    <span>处置人 *</span>
                    <input
                      value={h.handler}
                      placeholder="谁在处理"
                      onChange={(e) => onHandlingField(h.id, "handler", e.target.value)}
                    />
                  </label>
                  <label>
                    <span>处置说明 *</span>
                    <textarea
                      value={h.note}
                      placeholder="采取了什么措施，如：换水 30%、停食、下硝化细菌"
                      onChange={(e) => onHandlingField(h.id, "note", e.target.value)}
                    />
                  </label>
                  <button
                    className="primary-action"
                    disabled={!h.handler.trim() || !h.note.trim()}
                    onClick={() => onResolve(h.id)}
                  >
                    完结此项
                  </button>
                </div>
              ) : (
                <div className="handling-done">
                  <p>
                    处置人 {h.handler} · 完结于 {h.resolvedAt}
                  </p>
                  <p>{h.note}</p>
                  <button onClick={() => onReopen(h.id)}>重新打开</button>
                </div>
              )}
              {h.logs.length > 0 && (
                <ul className="handling-logs">
                  {h.logs.map((log, i) => (
                    <li key={i}>
                      <span>{log.at}</span> {log.by}：{log.text}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

// ---------- 交班记录 ----------

function HistoryView({
  shifts,
  focusId,
  onConsumeFocus,
}: {
  shifts: ShiftRecord[];
  focusId: string | null;
  onConsumeFocus: () => void;
}) {
  const sorted = useMemo(
    () =>
      [...shifts].sort((a, b) =>
        `${b.date} ${b.createdAt}`.localeCompare(`${a.date} ${a.createdAt}`)
      ),
    [shifts]
  );
  const [selectedId, setSelectedId] = useState<string | null>(focusId);

  useEffect(() => {
    if (focusId) {
      setSelectedId(focusId);
      onConsumeFocus();
    }
  }, [focusId, onConsumeFocus]);

  const selected = sorted.find((s) => s.id === selectedId) ?? null;

  const byDate = useMemo(() => {
    const map = new Map<string, ShiftRecord[]>();
    for (const s of sorted) {
      const list = map.get(s.date) ?? [];
      list.push(s);
      map.set(s.date, list);
    }
    return [...map.entries()];
  }, [sorted]);

  return (
    <section className="history-layout">
      <aside className="panel narrow history-list">
        <h2>按班次查看</h2>
        {sorted.length === 0 && <p className="tank-hint">还没有任何班次记录。</p>}
        {byDate.map(([date, list]) => (
          <div key={date} className="history-group">
            <p className="history-date">{date}</p>
            {list.map((s) => (
              <button
                key={s.id}
                className={
                  s.id === selectedId ? "history-item selected" : "history-item"
                }
                onClick={() => setSelectedId(s.id)}
              >
                <span>
                  {s.name} · {s.inspector || "未署名"}
                </span>
                <span className={s.status === "submitted" ? "badge ok" : "badge pending"}>
                  {s.status === "submitted" ? "已交班" : "进行中"}
                </span>
              </button>
            ))}
          </div>
        ))}
      </aside>

      <div className="history-detail">
        {selected ? (
          <ShiftDetail shift={selected} />
        ) : (
          <section className="panel">
            <p className="tank-hint">从左侧选择一个班次，查看交班记录和处置过程。</p>
          </section>
        )}
      </div>
    </section>
  );
}

function ShiftDetail({ shift }: { shift: ShiftRecord }) {
  const openCount = shift.handling.filter((h) => !h.resolved).length;
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p>交班记录</p>
          <h2>{shiftLabel(shift)}</h2>
        </div>
        <span className={shift.status === "submitted" ? "badge ok" : "badge pending"}>
          {shift.status === "submitted" ? "已交班" : "进行中"}
        </span>
      </div>

      <dl className="detail-meta">
        <div>
          <dt>巡检人</dt>
          <dd>{shift.inspector || "未填写"}</dd>
        </div>
        <div>
          <dt>开班时间</dt>
          <dd>{shift.createdAt}</dd>
        </div>
        <div>
          <dt>提交时间</dt>
          <dd>{shift.submittedAt ?? "未提交"}</dd>
        </div>
        <div>
          <dt>危险项</dt>
          <dd>
            共 {shift.handling.length} 项
            {shift.status !== "submitted" && openCount > 0
              ? `，其中 ${openCount} 项未完结`
              : "，均已完结"}
          </dd>
        </div>
      </dl>

      <h3 className="detail-subhead">各缸检测</h3>
      <div className="detail-table-wrap">
        <table className="detail-table">
          <thead>
            <tr>
              <th>鱼缸</th>
              <th>pH</th>
              <th>氨氮 (mg/L)</th>
              <th>温度 (℃)</th>
              <th>换水量 (%)</th>
              <th>结论</th>
            </tr>
          </thead>
          <tbody>
            {TANKS.map((t) => {
              const insp = shift.inspections.find((i) => i.tankId === t.id);
              const r = insp?.readings ?? {
                ph: null,
                ammonia: null,
                temp: null,
                waterChange: null,
              };
              const dangers = dangerReasons(r);
              const missing = missingFields(r);
              return (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td className={r.ph !== null && (r.ph < 6 || r.ph > 8.5) ? "cell-danger" : ""}>
                    {inputVal(r.ph) || "—"}
                  </td>
                  <td className={r.ammonia !== null && r.ammonia >= 0.5 ? "cell-danger" : ""}>
                    {inputVal(r.ammonia) || "—"}
                  </td>
                  <td
                    className={
                      r.temp !== null && (r.temp < 22 || r.temp > 30) ? "cell-danger" : ""
                    }
                  >
                    {inputVal(r.temp) || "—"}
                  </td>
                  <td>{inputVal(r.waterChange) || "—"}</td>
                  <td>
                    {dangers.length > 0 ? (
                      <span className="badge danger">危险</span>
                    ) : missing.length > 0 ? (
                      <span className="badge pending">未测完</span>
                    ) : (
                      <span className="badge ok">正常</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h3 className="detail-subhead">危险项处置过程</h3>
      {shift.handling.length === 0 ? (
        <p className="tank-hint">本班次没有出现危险项。</p>
      ) : (
        <div className="handling-list">
          {shift.handling.map((h) => (
            <div
              key={h.id}
              className={h.resolved ? "handling-item resolved" : "handling-item"}
            >
              <div className="handling-head">
                <strong>
                  {tankName(h.tankId)} · {h.reason}
                </strong>
                <span className={h.resolved ? "badge ok" : "badge danger"}>
                  {h.resolved ? "已完结" : "未完结"}
                </span>
              </div>
              <p className="handling-summary">
                处置人：{h.handler || "—"} · 完结时间：{h.resolvedAt ?? "—"}
              </p>
              <p className="handling-summary">处置说明:{h.note || "—"}</p>
              <ul className="handling-logs">
                {h.logs.map((log, i) => (
                  <li key={i}>
                    <span>{log.at}</span> {log.by}：{log.text}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <h3 className="detail-subhead">交班备注</h3>
      <p className="handover-note">{shift.handoverNote.trim() || "（无备注）"}</p>
    </section>
  );
}

export default App;
