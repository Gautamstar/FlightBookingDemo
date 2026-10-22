import { useCallback, useEffect, useState, type FormEvent } from "react";
import { expireUnpaid, getRouteSummary, getUnticketed } from "../api";
import { money, shortDate } from "../format";
import type { Booking, RouteSummary } from "../types";
import { ButtonLabel, Route, StatusTag } from "./Ui";

interface Props {
  token: string;
  isAdmin: boolean;
}

const isoDay = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

const daysUntil = (iso: string) =>
  Math.round((new Date(`${iso}T00:00:00`).getTime() - new Date(new Date().toDateString()).getTime()) / 86_400_000);

// Back-office reports. Each panel names the SQL Server object behind it.
export function OperationsView({ token, isAdmin }: Props) {
  const [range, setRange] = useState({ from: isoDay(0), to: isoDay(60) });
  const [routes, setRoutes] = useState<RouteSummary[] | null>(null);
  const [days, setDays] = useState(30);
  const [unticketed, setUnticketed] = useState<Booking[] | null>(null);
  const [hours, setHours] = useState(24);
  const [expired, setExpired] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const fail = (err: unknown) => setError(err instanceof Error ? err.message : "Request failed.");

  const loadRoutes = useCallback(() => {
    getRouteSummary(token, range.from, range.to).then(setRoutes).catch(fail);
  }, [token, range]);

  const loadUnticketed = useCallback(() => {
    getUnticketed(token, days).then(setUnticketed).catch(fail);
  }, [token, days]);

  useEffect(loadRoutes, [loadRoutes]);
  useEffect(loadUnticketed, [loadUnticketed]);

  async function runExpire(e: FormEvent) {
    e.preventDefault();
    setRunning(true);
    setError(null);
    try {
      const result = await expireUnpaid(token, hours);
      setExpired(result.expiredCount);
      loadRoutes();
      loadUnticketed();
    } catch (err) {
      fail(err);
    } finally {
      setRunning(false);
    }
  }

  const totalRevenue = routes?.reduce((sum, r) => sum + r.revenueCad, 0) ?? 0;

  return (
    <div className="operations">
      {error && (
        <p className="notice ops-notice" role="alert">
          {error}
        </p>
      )}

      <section className="panel ops-routes">
        <div className="panel-head">
          <h2>Route revenue</h2>
          <span className="panel-source">View: dbo.vw_RouteSummary</span>
        </div>
        <form className="toolbar" onSubmit={(e) => e.preventDefault()}>
          <label className="field compact">
            <span className="field-label">From</span>
            <input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
          </label>
          <label className="field compact">
            <span className="field-label">To</span>
            <input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
          </label>
          {routes && (
            <p className="toolbar-total">
              <span className="field-label">Revenue in range</span>
              <span>{money(totalRevenue, "CAD")}</span>
            </p>
          )}
        </form>
        {routes && routes.length === 0 && <p className="empty">No departures in this date range.</p>}
        {routes && routes.length > 0 && (
          <table className="register compact-table">
            <thead>
              <tr>
                <th scope="col">Route</th>
                <th scope="col">Departs</th>
                <th scope="col" className="num">
                  Active
                </th>
                <th scope="col" className="num">
                  Ticketed
                </th>
                <th scope="col" className="num">
                  Revenue
                </th>
              </tr>
            </thead>
            <tbody>
              {routes.map((r) => (
                <tr key={`${r.origin}-${r.destination}-${r.departureDate}`}>
                  <td>
                    <Route from={r.origin} to={r.destination} />
                  </td>
                  <td className="date">{shortDate(r.departureDate)}</td>
                  <td className="num">{r.activeBookings}</td>
                  <td className="num">{r.ticketedBookings}</td>
                  <td className="num strong">{money(r.revenueCad, "CAD")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel ops-unticketed">
        <div className="panel-head">
          <h2>Not yet ticketed</h2>
          <span className="panel-source">Function: dbo.fn_UnticketedDepartures</span>
        </div>
        <form className="toolbar" onSubmit={(e) => e.preventDefault()}>
          <label className="field compact">
            <span className="field-label">Departing within (days)</span>
            <input
              className="num"
              type="number"
              min={1}
              max={365}
              value={days}
              onChange={(e) => setDays(Math.min(365, Math.max(1, Number(e.target.value) || 1)))}
            />
          </label>
        </form>
        {unticketed && unticketed.length === 0 && <p className="empty">Every booking in this window is ticketed.</p>}
        {unticketed && unticketed.length > 0 && (
          <ul className="due-list">
            {unticketed.map((b) => {
              const d = daysUntil(b.departureDate);
              return (
                <li key={b.id}>
                  <span className={`due${d <= 7 ? " is-soon" : ""}`}>
                    <span className="due-days">{d}</span>
                    <span className="due-unit">{d === 1 ? "day" : "days"}</span>
                  </span>
                  <span className="due-who">
                    <strong>{b.passengerName}</strong>
                    <span>
                      {b.flightNumber} · {shortDate(b.departureDate)}
                    </span>
                  </span>
                  <Route from={b.origin} to={b.destination} />
                  <StatusTag status={b.status} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="panel ops-expire">
        <div className="panel-head">
          <h2>Expire unpaid bookings</h2>
          <span className="panel-source">Procedure: dbo.usp_ExpireUnpaidBookings</span>
        </div>
        <p className="prose">
          Cancels every Pending booking older than the cut-off in one set-based update, and returns the count through
          an <code>OUTPUT</code> parameter. The audit trigger records each change.
        </p>
        {isAdmin ? (
          <form className="toolbar toolbar-last" onSubmit={runExpire}>
            <label className="field compact">
              <span className="field-label">Pending for more than (hours)</span>
              <input
                className="num"
                type="number"
                min={0}
                max={720}
                value={hours}
                onChange={(e) => setHours(Math.min(720, Math.max(0, Number(e.target.value) || 0)))}
              />
            </label>
            <button type="submit" className="btn-primary" disabled={running}>
              <ButtonLabel>{running ? "Running…" : "Run procedure"}</ButtonLabel>
            </button>
            {expired !== null && (
              <p className="result" role="status">
                <strong>{expired}</strong> {expired === 1 ? "booking" : "bookings"} expired
              </p>
            )}
          </form>
        ) : (
          <p className="hint prose-pad">
            Admin only. The API answers <code>403 Forbidden</code> if an agent calls it, so the control is hidden here.
          </p>
        )}
      </section>
    </div>
  );
}
