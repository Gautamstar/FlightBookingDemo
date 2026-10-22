import { useState, type FormEvent } from "react";
import { ApiError, createBooking } from "../api";
import type { CreateBookingRequest } from "../types";

interface Props {
  token: string;
  onCreated: () => void;
}

const empty: CreateBookingRequest = {
  passengerName: "",
  flightNumber: "",
  origin: "",
  destination: "",
  departureDate: "",
  fareCad: 0,
};

export function CreateBookingForm({ token, onCreated }: Props) {
  const [form, setForm] = useState(empty);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);

  // One change handler for every field. Codes are upper-cased because the API expects "YYZ", not "yyz".
  function update<K extends keyof CreateBookingRequest>(field: K, value: CreateBookingRequest[K]) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      await createBooking(token, form);
      setForm(empty);
      onCreated();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.fieldErrors); // 400 validation errors, keyed by field name
      } else {
        setError("Something went wrong.");
      }
    } finally {
      setBusy(false);
    }
  }

  // The API's field names are PascalCase ("Origin"); look them up case-insensitively.
  const errorFor = (field: string) =>
    Object.entries(fieldErrors).find(([key]) => key.toLowerCase() === field.toLowerCase())?.[1]?.[0];

  return (
    <form className="card" onSubmit={handleSubmit}>
      <h2>New booking</h2>
      <div className="grid">
        <label>
          Passenger
          <input value={form.passengerName} onChange={(e) => update("passengerName", e.target.value)} required />
          <small className="error">{errorFor("passengerName")}</small>
        </label>
        <label>
          Flight
          <input
            value={form.flightNumber}
            placeholder="AC25"
            onChange={(e) => update("flightNumber", e.target.value.toUpperCase())}
            required
          />
          <small className="error">{errorFor("flightNumber")}</small>
        </label>
        <label>
          From
          <input
            value={form.origin}
            placeholder="YYZ"
            maxLength={3}
            onChange={(e) => update("origin", e.target.value.toUpperCase())}
            required
          />
          <small className="error">{errorFor("origin")}</small>
        </label>
        <label>
          To
          <input
            value={form.destination}
            placeholder="PVG"
            maxLength={3}
            onChange={(e) => update("destination", e.target.value.toUpperCase())}
            required
          />
          <small className="error">{errorFor("destination")}</small>
        </label>
        <label>
          Departure
          <input
            type="date"
            value={form.departureDate}
            onChange={(e) => update("departureDate", e.target.value)}
            required
          />
        </label>
        <label>
          Fare (CAD)
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={form.fareCad || ""}
            onChange={(e) => update("fareCad", Number(e.target.value))}
            required
          />
          <small className="error">{errorFor("fareCad")}</small>
        </label>
      </div>
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={busy}>
        {busy ? "Saving..." : "Create booking"}
      </button>
    </form>
  );
}
