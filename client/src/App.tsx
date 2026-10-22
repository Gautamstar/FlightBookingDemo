import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ApiError, searchBookings } from "./api";
import { BookingsTable } from "./components/BookingsTable";
import { CreateBookingForm } from "./components/CreateBookingForm";
import { LoginForm } from "./components/LoginForm";
import type { Booking, BookingStatus, SearchFilters, Session } from "./types";

const PAGE_SIZE = 10;

export default function App() {
  // The token lives only in memory: refreshing the page signs you out, but no script can read it from storage.
  const [session, setSession] = useState<Session | null>(null);
  const [filters, setFilters] = useState<SearchFilters>({ page: 1, pageSize: PAGE_SIZE });
  const [draft, setDraft] = useState({ origin: "", destination: "", date: "", status: "" });
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // useCallback keeps the same function between renders unless session or filters change,
  // so the effect below only re-runs when there's actually something new to load.
  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const result = await searchBookings(session.token, filters);
      setBookings(result.items);
      setTotalPages(Math.max(result.totalPages, 1));
      setTotalCount(result.totalCount);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setSession(null); // token expired or invalid: back to the login screen
      }
      setError(err instanceof Error ? err.message : "Couldn't load bookings.");
    } finally {
      setLoading(false);
    }
  }, [session, filters]);

  useEffect(() => {
    load();
  }, [load]);

  function applySearch(e: FormEvent) {
    e.preventDefault();
    setFilters({
      origin: draft.origin || undefined,
      destination: draft.destination || undefined,
      date: draft.date || undefined,
      status: (draft.status as BookingStatus) || undefined,
      page: 1, // new filters always start from the first page
      pageSize: PAGE_SIZE,
    });
  }

  if (!session) {
    return (
      <main>
        <header>
          <h1>Flight Bookings</h1>
        </header>
        <LoginForm onLogin={setSession} />
      </main>
    );
  }

  return (
    <main>
      <header>
        <h1>Flight Bookings</h1>
        <div className="who">
          {session.username} <span className="role">{session.role}</span>
          <button className="secondary" onClick={() => setSession(null)}>
            Sign out
          </button>
        </div>
      </header>

      <CreateBookingForm token={session.token} onCreated={load} />

      <section className="card">
        <h2>Bookings</h2>
        <form className="filters" onSubmit={applySearch}>
          <input
            placeholder="From (YYZ)"
            maxLength={3}
            value={draft.origin}
            onChange={(e) => setDraft({ ...draft, origin: e.target.value.toUpperCase() })}
          />
          <input
            placeholder="To (PVG)"
            maxLength={3}
            value={draft.destination}
            onChange={(e) => setDraft({ ...draft, destination: e.target.value.toUpperCase() })}
          />
          <input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
          <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
            <option value="">Any status</option>
            <option>Pending</option>
            <option>Confirmed</option>
            <option>Ticketed</option>
            <option>Cancelled</option>
          </select>
          <button type="submit">Search</button>
        </form>

        {error && <p className="error">{error}</p>}
        {loading ? (
          <p className="hint">Loading...</p>
        ) : (
          <BookingsTable
            token={session.token}
            isAdmin={session.role === "Admin"}
            bookings={bookings}
            onChanged={load}
            onError={setError}
          />
        )}

        <div className="pager">
          <button
            className="secondary"
            disabled={filters.page <= 1}
            onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
          >
            Previous
          </button>
          <span>
            Page {filters.page} of {totalPages} ({totalCount} {totalCount === 1 ? "booking" : "bookings"})
          </span>
          <button
            className="secondary"
            disabled={filters.page >= totalPages}
            onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
          >
            Next
          </button>
        </div>
      </section>
    </main>
  );
}
