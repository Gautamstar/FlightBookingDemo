import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, getActivity, getTables } from "../api";
import { dateTime, money } from "../format";
import type { ActivityEntry, DbTables } from "../types";
import { Icon } from "./Ui";

interface Props {
  token: string;
  onClose: () => void;
}

type Tab = "activity" | "database";

const POLL_MS = 1500;

// The audit trigger runs inside SQL Server, so EF Core never sees it. Point it out next to the
// statement that fires it, so the feed tells the whole story.
const firesTrigger = (sql: string) => /\b(INSERT\s+INTO|UPDATE)\s+\[?Bookings\]?/i.test(sql);

const statusClass = (status: number) => (status >= 500 ? "is-5xx" : status >= 400 ? "is-4xx" : "is-2xx");

// A demo-only window into the backend: each API request with the SQL EF Core ran for it and any
// calls to the exchange-rate supplier, plus what is now stored in the two main tables. The API
// only exposes this in Development.
export function BackstagePanel({ token, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("activity");
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [tables, setTables] = useState<DbTables | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastSeq = useRef(0);

  const loadTables = useCallback(() => {
    getTables(token)
      .then(setTables)
      .catch((err) => setError(describe(err)));
  }, [token]);

  useEffect(() => {
    let stopped = false;
    async function poll() {
      try {
        const fresh = await getActivity(token, lastSeq.current);
        if (stopped || fresh.length === 0) return;
        lastSeq.current = fresh[fresh.length - 1].seq;
        setEntries((current) => [...fresh.reverse(), ...current].slice(0, 60));
        setError(null);
        if (fresh.some((e) => e.method !== "GET")) loadTables(); // something changed in the database
      } catch (err) {
        if (!stopped) setError(describe(err));
      }
    }
    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [token, loadTables]);

  useEffect(loadTables, [loadTables]);

  return (
    <aside className="backstage" aria-label="Behind the scenes">
      <div className="backstage-head">
        <div>
          <h2>Behind the scenes</h2>
          <p>What the API and SQL Server are doing right now</p>
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close panel">
          <Icon name="close" />
        </button>
      </div>

      <div className="backstage-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "activity"} onClick={() => setTab("activity")}>
          API activity
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "database"}
          onClick={() => {
            setTab("database");
            loadTables();
          }}
        >
          Database
        </button>
      </div>

      {error && <p className="notice backstage-notice">{error}</p>}

      <div className="backstage-body">
        {tab === "activity" ? (
          entries.length === 0 ? (
            <p className="backstage-empty">
              Use the app on the left. Each API call appears here with the SQL it ran and any calls to the
              exchange-rate supplier.
            </p>
          ) : (
            <>
              <button type="button" className="quiet backstage-clear" onClick={() => setEntries([])}>
                Clear
              </button>
              <ol className="feed">
                {entries.map((e) => (
                  <li key={e.seq} className="feed-item">
                    <div className="feed-line">
                      <span className={`verb verb-${e.method.toLowerCase()}`}>{e.method}</span>
                      <code className="feed-path">{e.path}</code>
                      <span className={`code-chip ${statusClass(e.status)}`}>{e.status}</span>
                    </div>
                    <p className="feed-meta">
                      {Math.round(e.durationMs)} ms · {e.user ?? "anonymous"} · {e.sql.length}{" "}
                      {e.sql.length === 1 ? "SQL statement" : "SQL statements"}
                    </p>
                    {e.sql.map((q, i) => (
                      <div key={i} className="feed-sql">
                        <div className="feed-sql-head">
                          <span>SQL Server</span>
                          <span>{q.durationMs.toFixed(1)} ms</span>
                        </div>
                        <pre>{q.text.trim()}</pre>
                        {firesTrigger(q.text) && (
                          <p className="feed-note">
                            Trigger <code>trg_Bookings_StatusHistory</code> also ran inside SQL Server and wrote to{" "}
                            <code>BookingStatusChanges</code>.
                          </p>
                        )}
                      </div>
                    ))}
                    {e.external.map((x, i) => (
                      <div key={`x${i}`} className="feed-external">
                        <span>Supplier API</span>
                        <code>
                          {x.method} {x.url}
                        </code>
                        <span>
                          {x.status ?? "failed"} · {Math.round(x.durationMs)} ms
                        </span>
                      </div>
                    ))}
                    {e.path.includes("/fare") && e.external.length === 0 && e.status < 400 && (
                      <p className="feed-note">Rates came from the 10-minute cache, so no supplier call was made.</p>
                    )}
                  </li>
                ))}
              </ol>
            </>
          )
        ) : !tables ? (
          <p className="backstage-empty">Loading tables…</p>
        ) : (
          <>
            <h3 className="db-title">
              dbo.Bookings <span>{tables.bookings.total} rows</span>
            </h3>
            <div className="db-wrap">
              <table className="db-table">
                <thead>
                  <tr>
                    <th>Id</th>
                    <th>Passenger</th>
                    <th>Flight</th>
                    <th>Route</th>
                    <th className="num">FareCad</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tables.bookings.rows.map((b) => (
                    <tr key={b.id}>
                      <td>{b.id}</td>
                      <td>{b.passengerName}</td>
                      <td>{b.flightNumber}</td>
                      <td>
                        {b.origin}-{b.destination}
                      </td>
                      <td className="num">{money(b.fareCad, "CAD")}</td>
                      <td>{b.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className="db-title">
              dbo.BookingStatusChanges <span>{tables.statusChanges.total} rows</span>
            </h3>
            <p className="db-hint">Written only by the trigger, never by the API.</p>
            <div className="db-wrap">
              <table className="db-table">
                <thead>
                  <tr>
                    <th>Id</th>
                    <th>Booking</th>
                    <th>Change</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {tables.statusChanges.rows.map((c) => (
                    <tr key={c.id}>
                      <td>{c.id}</td>
                      <td>#{c.bookingId}</td>
                      <td>
                        {c.oldStatus ?? "(new)"} → {c.newStatus}
                      </td>
                      <td>{dateTime(c.changedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="db-hint">Showing the latest 15 rows of each table.</p>
          </>
        )}
      </div>
    </aside>
  );
}

function describe(err: unknown) {
  if (err instanceof ApiError && err.status === 404) {
    return "The activity feed is only available when the API runs in Development.";
  }
  return err instanceof Error ? err.message : "Couldn't reach the API.";
}
