import { useState } from "react";
import { changeStatus, type StatusAction } from "../api";
import type { Booking } from "../types";
import { money, shortDate } from "../format";
import { Route, StatusTag } from "./Ui";

interface Props {
  token: string;
  isAdmin: boolean;
  bookings: Booking[];
  selectedId: number | null;
  pressedId: number | null;
  onSelect: (id: number) => void;
  onChanged: (id: number) => void;
  onError: (message: string) => void;
}

// Which buttons make sense for each status. This mirrors the API's state machine for the UI;
// the API still enforces the real rules.
const ACTIONS: Record<Booking["status"], StatusAction[]> = {
  Pending: ["confirm", "cancel"],
  Confirmed: ["ticket", "cancel"],
  Ticketed: ["cancel"],
  Cancelled: [],
};

const LABELS: Record<StatusAction, string> = { confirm: "Confirm", ticket: "Ticket", cancel: "Cancel" };

export function BookingsTable({
  token,
  isAdmin,
  bookings,
  selectedId,
  pressedId,
  onSelect,
  onChanged,
  onError,
}: Props) {
  const [busyId, setBusyId] = useState<number | null>(null);

  async function runAction(id: number, action: StatusAction) {
    setBusyId(id);
    try {
      await changeStatus(token, id, action);
      onChanged(id);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusyId(null);
    }
  }

  if (bookings.length === 0) {
    return <p className="empty">No bookings match these filters. Clear a filter or create one above.</p>;
  }

  return (
    <table className="register">
      <thead>
        <tr>
          <th scope="col">No.</th>
          <th scope="col">Passenger</th>
          <th scope="col">Route</th>
          <th scope="col">Flight</th>
          <th scope="col">Departs</th>
          <th scope="col" className="num">
            Fare
          </th>
          <th scope="col">Status</th>
          <th scope="col">
            <span className="visually-hidden">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {bookings.map((b) => {
          return (
            // key lets React match rows between renders, so it only updates the rows that changed
            <tr
              key={b.id}
              className={`${b.status === "Cancelled" ? "is-void" : ""}${selectedId === b.id ? " is-selected" : ""}`}
              onClick={() => onSelect(b.id)}
            >
              <td className="mono dim" data-label="No.">
                #{b.id}
              </td>
              <td data-label="Passenger">
                <button
                  type="button"
                  className="row-open"
                  aria-pressed={selectedId === b.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(b.id);
                  }}
                >
                  {b.passengerName}
                </button>
              </td>
              <td data-label="Route">
                <Route from={b.origin} to={b.destination} />
                <span className="route-flight">{b.flightNumber}</span>
              </td>
              <td className="mono" data-label="Flight">
                {b.flightNumber}
              </td>
              <td className="date" data-label="Departs">
                {shortDate(b.departureDate)}
              </td>
              <td className="num" data-label="Fare">
                {money(b.fareCad, "CAD")}
              </td>
              <td data-label="Status">
                <StatusTag status={b.status} fresh={pressedId === b.id} />
              </td>
              <td className="actions" onClick={(e) => e.stopPropagation()}>
                {ACTIONS[b.status]
                  .filter((a) => a !== "ticket" || isAdmin) // agents never see a button the API would refuse
                  .map((a) => (
                    <button
                      key={a}
                      type="button"
                      className={a === "cancel" ? "quiet danger" : "outline"}
                      disabled={busyId === b.id}
                      onClick={() => runAction(b.id, a)}
                    >
                      {LABELS[a]}
                    </button>
                  ))}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
