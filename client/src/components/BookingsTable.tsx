import { useState } from "react";
import { changeStatus, getFare, type StatusAction } from "../api";
import type { Booking, FareQuote } from "../types";

interface Props {
  token: string;
  isAdmin: boolean;
  bookings: Booking[];
  onChanged: () => void;
  onError: (message: string) => void;
}

const CURRENCIES = ["CNY", "HKD", "TWD", "JPY", "KRW", "USD"];

// Which buttons make sense for each status. This mirrors the API's state machine for the UI;
// the API still enforces the real rules.
const ACTIONS: Record<Booking["status"], StatusAction[]> = {
  Pending: ["confirm", "cancel"],
  Confirmed: ["ticket", "cancel"],
  Ticketed: ["cancel"],
  Cancelled: [],
};

const money = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(amount);

export function BookingsTable({ token, isAdmin, bookings, onChanged, onError }: Props) {
  const [currency, setCurrency] = useState("CNY");
  const [quotes, setQuotes] = useState<Record<number, FareQuote>>({});
  const [busyId, setBusyId] = useState<number | null>(null);

  async function runAction(id: number, action: StatusAction) {
    setBusyId(id);
    try {
      await changeStatus(token, id, action);
      onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function convert(id: number) {
    setBusyId(id);
    try {
      const quote = await getFare(token, id, currency);
      setQuotes((q) => ({ ...q, [id]: quote }));
    } catch (err) {
      onError(err instanceof Error ? err.message : "Conversion failed.");
    } finally {
      setBusyId(null);
    }
  }

  if (bookings.length === 0) {
    return <p className="hint">No bookings match these filters.</p>;
  }

  return (
    <div className="table-wrap">
      <label className="inline">
        Convert fares to
        <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
          {CURRENCIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Passenger</th>
            <th>Flight</th>
            <th>Route</th>
            <th>Departs</th>
            <th>Fare</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((b) => (
            // key lets React match rows between renders, so it only updates the rows that changed
            <tr key={b.id}>
              <td>{b.id}</td>
              <td>{b.passengerName}</td>
              <td>{b.flightNumber}</td>
              <td>
                {b.origin} → {b.destination}
              </td>
              <td>{b.departureDate}</td>
              <td>
                {money(b.fareCad, "CAD")}
                {quotes[b.id] && (
                  <div className="hint">
                    ≈ {money(quotes[b.id].convertedFare, quotes[b.id].currency)}
                  </div>
                )}
              </td>
              <td>
                <span className={`status ${b.status.toLowerCase()}`}>{b.status}</span>
              </td>
              <td className="actions">
                {ACTIONS[b.status]
                  .filter((a) => a !== "ticket" || isAdmin) // agents never see a button the API would refuse
                  .map((a) => (
                    <button key={a} className={a} disabled={busyId === b.id} onClick={() => runAction(b.id, a)}>
                      {a}
                    </button>
                  ))}
                <button className="secondary" disabled={busyId === b.id} onClick={() => convert(b.id)}>
                  {currency}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
