import { useState, type FormEvent } from "react";
import { ApiError, createBooking } from "../api";
import type { Booking, CreateBookingRequest } from "../types";
import { ButtonLabel } from "./Ui";

interface Props {
  token: string;
  onCreated: (booking: Booking) => void;
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
      const created = await createBooking(token, form);
      setForm(empty);
      onCreated(created);
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

  // Field-level errors show under their field; anything else (a 409 duplicate, a 503) shows as a notice.
  const hasFieldErrors = Object.keys(fieldErrors).length > 0;

  const field = (name: keyof CreateBookingRequest, label: string, input: React.ReactNode, className = "") => (
    <label className={`field ${className}${errorFor(name) ? " has-error" : ""}`}>
      <span className="field-label">{label}</span>
      {input}
      {errorFor(name) && <small className="field-error">{errorFor(name)}</small>}
    </label>
  );

  return (
    <form className="panel issue" onSubmit={handleSubmit}>
      <div className="issue-grid">
        {field(
          "passengerName",
          "Passenger name",
          <input
            value={form.passengerName}
            placeholder="As on passport"
            onChange={(e) => update("passengerName", e.target.value)}
            required
          />,
          "wide",
        )}
        {field(
          "flightNumber",
          "Flight",
          <input
            className="code"
            value={form.flightNumber}
            placeholder="AC25"
            onChange={(e) => update("flightNumber", e.target.value.toUpperCase())}
            required
          />,
        )}
        {field(
          "origin",
          "From",
          <input
            className="code"
            value={form.origin}
            placeholder="YYZ"
            maxLength={3}
            onChange={(e) => update("origin", e.target.value.toUpperCase())}
            required
          />,
        )}
        {field(
          "destination",
          "To",
          <input
            className="code"
            value={form.destination}
            placeholder="YVR"
            maxLength={3}
            onChange={(e) => update("destination", e.target.value.toUpperCase())}
            required
          />,
        )}
        {field(
          "departureDate",
          "Departure",
          <input type="date" value={form.departureDate} onChange={(e) => update("departureDate", e.target.value)} required />,
        )}
        {field(
          "fareCad",
          "Fare (CAD)",
          <input
            className="num"
            type="number"
            min="0.01"
            step="0.01"
            value={form.fareCad || ""}
            onChange={(e) => update("fareCad", Number(e.target.value))}
            required
          />,
        )}
        <button type="submit" className="btn-primary issue-submit" disabled={busy}>
          <ButtonLabel>{busy ? "Saving…" : "Create booking"}</ButtonLabel>
        </button>
      </div>
      {error && !hasFieldErrors && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
