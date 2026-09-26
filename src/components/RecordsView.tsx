import type { HandoverRecord } from "../types";
import { formatTime } from "../logic";

function RecordCard({ record }: { record: HandoverRecord }) {
  return (
    <article className="record-card">
      <header className="record-head">
        <div>
          <h3>
            {record.date} · {record.shift}
          </h3>
          <p className="record-meta">
            巡检人：{record.inspector} · 闭店提交于 {formatTime(record.closedAt)} · 共 {record.tankCount} 缸 ·
            危险 {record.dangerCount} 项（均已完结）
          </p>
        </div>
      </header>
      <div className="record-tanks">
        {record.tanks.map((tank) => (
          <div key={tank.id} className={`record-tank ${tank.dangers.length > 0 ? "had-danger" : ""}`}>
            <div className="record-tank-head">
              <strong>{tank.name}</strong>
              <span className="record-values">
                pH {tank.ph} · 氨氮 {tank.ammonia} mg/L · {tank.temp}℃ · 换水 {tank.waterChange}
              </span>
            </div>
            {tank.dangers.length > 0 ? (
              <ul className="record-dangers">
                {tank.dangers.map((d) => (
                  <li key={d.type}>
                    <span className="danger-tag small">危险 · {d.label}</span>
                    <span>{d.detail}</span>
                    <span className="record-resolution">
                      处置人 {d.handler}（{formatTime(d.resolvedAt)} 完结）：{d.note}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="record-ok">指标正常，无危险项</p>
            )}
          </div>
        ))}
      </div>
    </article>
  );
}

export default function RecordsView({ records }: { records: HandoverRecord[] }) {
  const sorted = [...records].sort((a, b) => b.closedAt.localeCompare(a.closedAt));
  const byDate = new Map<string, HandoverRecord[]>();
  for (const r of sorted) {
    const list = byDate.get(r.date) ?? [];
    list.push(r);
    byDate.set(r.date, list);
  }

  if (sorted.length === 0) {
    return (
      <section className="panel">
        <h2>交班记录</h2>
        <p className="empty-hint">暂无交班记录。完成当班巡检并提交闭店结果后，可在这里按班次查看。</p>
      </section>
    );
  }

  return (
    <section className="records-view">
      {[...byDate.entries()].map(([date, list]) => (
        <div key={date} className="record-group">
          <h2 className="record-date">{date}</h2>
          {list.map((r) => (
            <RecordCard key={r.key} record={r} />
          ))}
        </div>
      ))}
    </section>
  );
}
