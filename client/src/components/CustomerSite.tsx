import { useState, type FormEvent } from "react";
import { ApiError, lookupTrip } from "../api";
import { dateTime, shortDate } from "../format";
import type { BookingStatus, Trip } from "../types";
import { ButtonLabel, Icon, Route, StatusTag, Wordmark } from "./Ui";

// What each status means to a traveller, in their words rather than the back office's.
const MEANING: Record<BookingStatus, { title: string; body: string }> = {
  Pending: {
    title: "Booking received",
    body: "Your agent has your request and is holding it while the seat is confirmed.",
  },
  Confirmed: {
    title: "Seat confirmed",
    body: "Your seat is held. Your agent will issue the ticket before you fly.",
  },
  Ticketed: {
    title: "Ticket issued",
    body: "You're all set. Bring valid photo ID that matches the name on this booking.",
  },
  Cancelled: {
    title: "Booking cancelled",
    body: "This booking is no longer active. Contact your agent if you didn't expect this.",
  },
};

const STEPS = [
  { status: "Pending" as const, text: "Your agent books the flight and you get a booking number." },
  { status: "Confirmed" as const, text: "The seat is confirmed and held under your name." },
  { status: "Ticketed" as const, text: "The ticket is issued and you're ready to travel." },
];

const daysUntil = (iso: string) =>
  Math.round((new Date(`${iso}T00:00:00`).getTime() - new Date(new Date().toDateString()).getTime()) / 86_400_000);

// The public side of the site: a traveller looks up their own booking. The lookup endpoint is
// anonymous and rate limited, and answers the same way for a wrong number or a wrong name.
export function CustomerSite() {
  const [reference, setReference] = useState("");
  const [name, setName] = useState("");
  const [trip, setTrip] = useState<Trip | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function find(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setTrip(null);
    try {
      setTrip(await lookupTrip(Number(reference), name.trim()));
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 429
          ? "Too many lookups from this connection. Please wait a minute and try again."
          : err instanceof Error
            ? err.message
            : "Something went wrong. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  const days = trip ? daysUntil(trip.departureDate) : 0;

  return (
    <div className="shell">
      <div className="utility">
        <div className="utility-inner">
          <span>Flights booked through your travel agent</span>
          <a className="utility-link" href="/agent">
            Agent sign in
          </a>
        </div>
      </div>

      <header className="header">
        <div className="header-inner">
          <a href="/" className="wordmark-link" aria-label="Flight Bookings home">
            <Wordmark subline="Your trips" />
          </a>
          <nav className="menu" aria-label="Sections">
            <a href="#manage" aria-current="page">
              Manage booking
            </a>
            <a href="#how">How it works</a>
          </nav>
        </div>
      </header>

      <main>
        <section className="hero" id="manage">
          <div className="hero-inner">
            <div className="hero-copy">
              <h1>Your trip, in one place.</h1>
              <p>Look up your booking with the booking number and the name your agent gave you.</p>
            </div>

            <form className="panel lookup" onSubmit={find}>
              <h2 className="lookup-title">Find my booking</h2>
              <label className="field">
                <span className="field-label">Booking number</span>
                <input
                  inputMode="numeric"
                  required
                  placeholder="e.g. 4"
                  value={reference}
                  onChange={(e) => setReference(e.target.value.replace(/\D/g, ""))}
                />
              </label>
              <label className="field">
                <span className="field-label">Passenger name</span>
                <input
                  required
                  maxLength={100}
                  autoComplete="name"
                  placeholder="As on the booking"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <button type="submit" className="btn-primary" disabled={loading}>
                <ButtonLabel>{loading ? "Looking up…" : "Find booking"}</ButtonLabel>
              </button>
              {error && (
                <p className="notice" role="alert">
                  {error}
                </p>
              )}
              <p className="hint">Demo: try booking number 4 with the name user4.</p>
            </form>
          </div>
        </section>

        {trip && (
          <section className="band band-white trip-band" aria-live="polite">
            <article className="panel trip">
              <div className="trip-head">
                <div>
                  <p className="trip-ref">Booking #{trip.reference}</p>
                  <Route from={trip.origin} to={trip.destination} size="lg" />
                </div>
                <StatusTag status={trip.status} />
              </div>

              <div className={`trip-meaning is-${trip.status.toLowerCase()}`}>
                <h2>{MEANING[trip.status].title}</h2>
                <p>{MEANING[trip.status].body}</p>
              </div>

              <dl className="detail-facts trip-facts">
                <div>
                  <dt>Passenger</dt>
                  <dd>{trip.passengerName}</dd>
                </div>
                <div>
                  <dt>Flight</dt>
                  <dd>{trip.flightNumber}</dd>
                </div>
                <div>
                  <dt>Departs</dt>
                  <dd>{shortDate(trip.departureDate)}</dd>
                </div>
                <div>
                  <dt>Time to go</dt>
                  <dd>
                    {trip.status === "Cancelled"
                      ? "Not travelling"
                      : days < 0
                        ? "Departed"
                        : days === 0
                          ? "Today"
                          : `${days} ${days === 1 ? "day" : "days"}`}
                  </dd>
                </div>
              </dl>

              <h3 className="detail-subhead">Booking updates</h3>
              <ol className="timeline">
                {trip.history.map((h, i) => (
                  <li key={`${h.status}-${h.changedAt}`} className={i === trip.history.length - 1 ? "is-latest" : ""}>
                    <span className="timeline-dot" aria-hidden="true" />
                    <div>
                      <StatusTag status={h.status} />
                    </div>
                    <p className="timeline-meta">
                      <Icon name="clock" />
                      <time dateTime={h.changedAt}>{dateTime(h.changedAt)}</time>
                    </p>
                  </li>
                ))}
              </ol>
            </article>
          </section>
        )}

        <section className="band band-grey" id="how">
          <h2 className="band-title">How it works</h2>
          <p className="band-lead">Every booking moves through the same three steps. Check back here at any time.</p>
          <ol className="steps">
            {STEPS.map((s, i) => (
              <li key={s.status} className="panel step">
                <span className="step-number">{i + 1}</span>
                <StatusTag status={s.status} />
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="footer">
        <div className="footer-inner">
          <span>Demo project with synthetic data. All fares are in Canadian dollars.</span>
          <span>Questions about a booking? Contact the agent who made it.</span>
        </div>
      </footer>
    </div>
  );
}
