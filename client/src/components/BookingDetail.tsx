import { useEffect, useState } from "react";
import { getHistory } from "../api";
import { dateTime, money, shortDate } from "../format";
import type { Booking, StatusChange } from "../types";
import { Icon, Route, StatusTag } from "./Ui";

interface Props {
  token: string;
  booking: Booking;
  version: number; // bumps after every status change so the history reloads
  onClose: () => void;
}

// One booking's details and status history. The history comes from the audit table that the
// SQL Server trigger trg_Bookings_StatusHistory fills, so it includes changes made outside the API.
export function BookingDetail({ token, booking, version, onClose }: Props) {
  const [history, setHistory] = useState<StatusChange[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false; // ignore a slow response for a booking that is no longer selected
    setHistory(null);
    setError(null);
    getHistory(token, booking.id)
      .then((rows) => !cancelled && setHistory(rows))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "Couldn't load history."));
    return () => {
      cancelled = true;
    };
  }, [token, booking.id, version]);

  return (
    <aside className="panel detail" aria-label={`Booking ${booking.id}`}>
      <div className="panel-head">
        <h2>Booking #{booking.id}</h2>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close booking details">
          <Icon name="close" />
        </button>
      </div>

      <div className="detail-route">
        <Route from={booking.origin} to={booking.destination} size="lg" />
        <StatusTag status={booking.status} />
      </div>

      <dl className="detail-facts">
        <div>
          <dt>Passenger</dt>
          <dd>{booking.passengerName}</dd>
        </div>
        <div>
          <dt>Flight</dt>
          <dd>{booking.flightNumber}</dd>
        </div>
        <div>
          <dt>Departs</dt>
          <dd>{shortDate(booking.departureDate)}</dd>
        </div>
        <div>
          <dt>Fare</dt>
          <dd>{money(booking.fareCad, "CAD")}</dd>
        </div>
      </dl>

      <h3 className="detail-subhead">Status history</h3>
      {error && <p className="notice">{error}</p>}
      {!history && !error && <p className="hint detail-pad">Loading history…</p>}
      {history && history.length === 0 && <p className="hint detail-pad">No history recorded for this booking.</p>}
      {history && history.length > 0 && (
        <ol className="timeline">
          {history.map((h, i) => (
            <li key={h.id} className={i === history.length - 1 ? "is-latest" : ""}>
              <span className="timeline-dot" aria-hidden="true" />
              <div>
                <StatusTag status={h.newStatus} />
                <span className="timeline-from">{h.oldStatus ? `from ${h.oldStatus}` : "created"}</span>
              </div>
              <p className="timeline-meta">
                <Icon name="clock" />
                <time dateTime={h.changedAt}>{dateTime(h.changedAt)}</time>
                <span title="SQL Server login that made the change (SUSER_SNAME)">{h.changedBy}</span>
              </p>
            </li>
          ))}
        </ol>
      )}
      <p className="detail-source">Recorded by the SQL Server trigger trg_Bookings_StatusHistory</p>
    </aside>
  );
}
