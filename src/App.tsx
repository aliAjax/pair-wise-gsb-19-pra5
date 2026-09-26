import { useEffect, useMemo, useState } from "react";
import "./styles.css";
import type { DangerInfo, DangerType, DraftMap, EntryMap, HandoverRecord, Resolution, Tank } from "./types";
import {
  DANGER_RULES_TEXT,
  blankDraft,
  blankEntry,
  buildRecord,
  defaultShift,
  shiftKey,
  todayStr,
  validateEntries,
} from "./logic";
import { loadDrafts, loadRecords, loadTanks, saveDrafts, saveRecords, saveTanks } from "./storage";
import TankCard from "./components/TankCard";
import RecordsView from "./components/RecordsView";

type View = "inspect" | "records";
type Filter = "all" | "unmeasured" | "danger";

function App() {
  const [view, setView] = useState<View>("inspect");
  const [tanks, setTanks] = useState<Tank[]>(loadTanks);
  const [drafts, setDrafts] = useState<DraftMap>(loadDrafts);
  const [records, setRecords] = useState<HandoverRecord[]>(loadRecords);
  const [date, setDate] = useState(todayStr);
  const [shift, setShift] = useState(defaultShift);
  const [filter, setFilter] = useState<Filter>("all");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [newTankName, setNewTankName] = useState("");

  const key = shiftKey(date, shift);
  const draft = drafts[key] ?? blankDraft();
  const entries: EntryMap = draft.entries;
  const locked = records.some((r) => r.key === key);

  const validation = useMemo(() => validateEntries(tanks, entries), [tanks, entries]);
  const unmeasuredIds = useMemo(() => new Set(validation.unmeasured.map((u) => u.id)), [validation]);
  const dangerIds = useMemo(() => new Set(validation.unresolved.map((u) => u.id)), [validation]);
  const measuredCount = tanks.length - validation.unmeasured.length;
  const canSubmit = validation.unmeasured.length === 0 && validation.unresolved.length === 0;

  useEffect(() => saveTanks(tanks), [tanks]);
  useEffect(() => saveDrafts(drafts), [drafts]);
  useEffect(() => saveRecords(records), [records]);

  function updateDraft(mutate: (d: { inspector: string; entries: EntryMap }) => { inspector: string; entries: EntryMap }) {
    setDrafts((prev) => ({ ...prev, [key]: mutate(prev[key] ?? blankDraft()) }));
  }

  function changeShift(nextDate: string, nextShift: string) {
    setDate(nextDate);
    setShift(nextShift);
    setSubmitAttempted(false);
  }

  function handleReadingChange(tankId: string, field: "ph" | "ammonia" | "temp" | "waterChange", value: string) {
    updateDraft((d) => ({
      ...d,
      entries: {
        ...d.entries,
        [tankId]: { ...(d.entries[tankId] ?? blankEntry()), [field]: value },
      },
    }));
  }

  function handleResolutionChange(tankId: string, type: DangerType, patch: Partial<Resolution>) {
    updateDraft((d) => {
      const entry = d.entries[tankId] ?? blankEntry();
      const prev: Resolution = entry.handling[type] ?? { handler: "", note: "", value: "", at: "" };
      return {
        ...d,
        entries: {
          ...d.entries,
          [tankId]: { ...entry, handling: { ...entry.handling, [type]: { ...prev, ...patch } } },
        },
      };
    });
  }

  function handleResolve(tankId: string, danger: DangerInfo) {
    updateDraft((d) => {
      const entry = d.entries[tankId] ?? blankEntry();
      const prev: Resolution = entry.handling[danger.type] ?? { handler: "", note: "", value: "", at: "" };
      return {
        ...d,
        entries: {
          ...d.entries,
          [tankId]: {
            ...entry,
            handling: {
              ...entry.handling,
              [danger.type]: { ...prev, value: danger.raw, at: new Date().toISOString() },
            },
          },
        },
      };
    });
  }

  function handleReopen(tankId: string, type: DangerType) {
    updateDraft((d) => {
      const entry = d.entries[tankId] ?? blankEntry();
      const prev = entry.handling[type];
      if (!prev) return d;
      return {
        ...d,
        entries: {
          ...d.entries,
          [tankId]: { ...entry, handling: { ...entry.handling, [type]: { ...prev, value: "", at: "" } } },
        },
      };
    });
  }

  function handleAddTank() {
    const name = newTankName.trim();
    if (!name) return;
    setTanks((prev) => [...prev, { id: `tank-${Date.now()}`, name }]);
    setNewTankName("");
  }

  function handleRemoveTank(tankId: string) {
    const tank = tanks.find((t) => t.id === tankId);
    if (!tank) return;
    if (!window.confirm(`确定移除「${tank.name}」？该缸未提交的当班登记也会一并删除。`)) return;
    setTanks((prev) => prev.filter((t) => t.id !== tankId));
    updateDraft((d) => {
      const next = { ...d.entries };
      delete next[tankId];
      return { ...d, entries: next };
    });
  }

  function handleSubmit() {
    setSubmitAttempted(true);
    if (!canSubmit) return;
    const record = buildRecord(tanks, entries, date, shift, draft.inspector.trim() || "未署名", new Date().toISOString());
    setRecords((prev) => [...prev.filter((r) => r.key !== key), record]);
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setSubmitAttempted(false);
    setView("records");
  }

  const visibleTanks = tanks.filter((t) => {
    if (filter === "unmeasured") return unmeasuredIds.has(t.id);
    if (filter === "danger") return dangerIds.has(t.id);
    return true;
  });

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">水族店 · 闭店巡检台</p>
          <h1>闭店巡检台</h1>
          <p className="subtitle">
            打烊前逐缸登记 pH、氨氮、温度和换水量。{DANGER_RULES_TEXT}。危险项须填写处置人与处置说明并完结后，才能提交闭店结果。
          </p>
        </div>
        <nav className="tabs">
          <button className={view === "inspect" ? "tab active" : "tab"} onClick={() => setView("inspect")}>
            当班巡检
          </button>
          <button className={view === "records" ? "tab active" : "tab"} onClick={() => setView("records")}>
            交班记录（{records.length}）
          </button>
        </nav>
      </header>

      {view === "records" ? (
        <RecordsView records={records} />
      ) : (
        <>
          <section className="panel shift-bar">
            <div className="shift-fields">
              <label>
                <span>巡检日期</span>
                <input type="date" value={date} onChange={(e) => changeShift(e.target.value, shift)} />
              </label>
              <div className="shift-picker">
                <span>班别</span>
                <div className="chips">
                  {["早班", "中班", "晚班"].map((s) => (
                    <button
                      key={s}
                      className={s === shift ? "chip active" : "chip"}
                      onClick={() => changeShift(date, s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <label>
                <span>巡检人</span>
                <input
                  value={draft.inspector}
                  disabled={locked}
                  placeholder="填写当班巡检人"
                  onChange={(e) => updateDraft((d) => ({ ...d, inspector: e.target.value }))}
                />
              </label>
              <label>
                <span>新增鱼缸</span>
                <div className="add-tank">
                  <input
                    value={newTankName}
                    placeholder="鱼缸名称"
                    onChange={(e) => setNewTankName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddTank()}
                  />
                  <button type="button" onClick={handleAddTank}>
                    添加
                  </button>
                </div>
              </label>
            </div>
            {locked && (
              <p className="locked-banner">
                该班次已提交闭店结果，内容已锁定。可到「交班记录」按班次查看，或切换其他日期 / 班别继续巡检。
              </p>
            )}
          </section>

          <section className="stats-grid">
            <article className="stat">
              <span>鱼缸总数</span>
              <strong>{tanks.length}</strong>
            </article>
            <article className="stat ok">
              <span>已测</span>
              <strong>{measuredCount}</strong>
            </article>
            <article className={`stat ${validation.unmeasured.length > 0 ? "warn" : ""}`}>
              <span>未测</span>
              <strong>{validation.unmeasured.length}</strong>
            </article>
            <article className={`stat ${validation.unresolved.length > 0 ? "danger" : ""}`}>
              <span>待处置危险项</span>
              <strong>{validation.unresolved.length}</strong>
            </article>
          </section>

          <div className="filter-row">
            <div className="chips">
              <button className={filter === "all" ? "chip active" : "chip"} onClick={() => setFilter("all")}>
                全部（{tanks.length}）
              </button>
              <button
                className={filter === "unmeasured" ? "chip active" : "chip"}
                onClick={() => setFilter("unmeasured")}
              >
                只看未测（{validation.unmeasured.length}）
              </button>
              <button className={filter === "danger" ? "chip active" : "chip"} onClick={() => setFilter("danger")}>
                只看危险（{dangerIds.size}）
              </button>
            </div>
          </div>

          <section className="tank-grid">
            {visibleTanks.length === 0 && <p className="empty-hint">当前筛选下没有鱼缸。</p>}
            {visibleTanks.map((tank) => (
              <TankCard
                key={tank.id}
                tank={tank}
                entry={entries[tank.id] ?? blankEntry()}
                locked={locked}
                onReadingChange={handleReadingChange}
                onResolutionChange={handleResolutionChange}
                onResolve={handleResolve}
                onReopen={handleReopen}
                onRemove={handleRemoveTank}
              />
            ))}
          </section>

          <section className="panel submit-panel">
            <div className="submit-head">
              <div>
                <h2>闭店结果</h2>
                <p className="submit-hint">
                  所有鱼缸完成检测、且危险项全部完结后才能提交。提交后可在「交班记录」按班次查看。
                </p>
              </div>
              <button
                type="button"
                className="primary-action"
                disabled={locked}
                onClick={handleSubmit}
              >
                提交闭店结果
              </button>
            </div>

            {submitAttempted && !canSubmit && (
              <div className="block-panel">
                <h3>无法提交，请先处理以下事项：</h3>
                {validation.unmeasured.length > 0 && (
                  <div className="block-group">
                    <h4>未测鱼缸（{validation.unmeasured.length}）</h4>
                    <ul>
                      {validation.unmeasured.map((u) => (
                        <li key={u.id}>
                          <strong>{u.name}</strong>
                          <span>缺：{u.missing.join("、")}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {validation.unresolved.length > 0 && (
                  <div className="block-group">
                    <h4>未完结危险项（{validation.unresolved.length}）</h4>
                    <ul>
                      {validation.unresolved.map((u, i) => (
                        <li key={`${u.id}-${u.danger}-${i}`}>
                          <strong>
                            {u.name} · {u.danger}
                          </strong>
                          <span>{u.detail}</span>
                          <span className="missing-hint">
                            {u.stale ? "读数已变更，需重新完结；" : ""}
                            {u.missing.length > 0 ? `缺：${u.missing.join("、")}；` : ""}
                            未完结
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </section>
        </>
      )}

      <footer className="footer-note">巡检草稿与交班记录保存在本机浏览器，关掉页面后重新打开仍可查看。</footer>
    </main>
  );
}

export default App;
