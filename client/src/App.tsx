import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ApiError, searchBookings } from "./api";
import { BookingDetail } from "./components/BookingDetail";
import { BookingsTable } from "./components/BookingsTable";
import { CreateBookingForm } from "./components/CreateBookingForm";
import { LoginForm } from "./components/LoginForm";
import { OperationsView } from "./components/OperationsView";
import { ButtonLabel, Icon, Wordmark } from "./components/Ui";
import type { Booking, BookingStatus, SearchFilters, Session } from "./types";

const PAGE_SIZE = 10;
const CURRENCIES = ["CNY", "HKD", "TWD", "JPY", "KRW", "USD"];

type View = "bookings" | "operations";

export default function App() {
  // The token lives only in memory: refreshing the page signs you out, but no script can read it from storage.
  const [session, setSession] = useState<Session | null>(null);
  const [view, setView] = useState<View>("bookings");
  const [filters, setFilters] = useState<SearchFilters>({ page: 1, pageSize: PAGE_SIZE });
  const [draft, setDraft] = useState({ origin: "", destination: "", date: "", status: "" });
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [currency, setCurrency] = useState("CNY");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [freshId, setFreshId] = useState<number | null>(null); // the row whose status just changed
  const [historyVersion, setHistoryVersion] = useState(0);

  // useCallback keeps the same function between renders unless session or filters change,
  // so the effect below only re-runs when there's actually something new to load.
  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
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
    setError(null);
    setFilters({
      origin: draft.origin || undefined,
      destination: draft.destination || undefined,
      date: draft.date || undefined,
      status: (draft.status as BookingStatus) || undefined,
      page: 1, // new filters always start from the first page
      pageSize: PAGE_SIZE,
    });
  }

  function changed(id: number) {
    setError(null);
    setFreshId(id);
    setHistoryVersion((v) => v + 1);
    load();
  }

  function signOut() {
    setSession(null);
    setSelectedId(null);
    setView("bookings");
  }

  const isAdmin = session?.role === "Admin";
  const selected = bookings.find((b) => b.id === selectedId) ?? null;

  return (
    <div className="shell">
      <div className="utility">
        <div className="utility-inner">
          <span>Flight booking API demo · ASP.NET Core, SQL Server, React</span>
          {session && (
            <span className="utility-user">
              <Icon name="user" />
              {session.username} · {session.role}
              <button type="button" className="utility-link" onClick={signOut}>
                Sign out
              </button>
            </span>
          )}
        </div>
      </div>

      <header className="header">
        <div className="header-inner">
          <Wordmark />
          {session && (
            <nav className="menu" aria-label="Sections">
              <button
                type="button"
                aria-current={view === "bookings" ? "page" : undefined}
                onClick={() => setView("bookings")}
              >
                Bookings
              </button>
              <button
                type="button"
                aria-current={view === "operations" ? "page" : undefined}
                onClick={() => setView("operations")}
              >
                Operations
              </button>
            </nav>
          )}
        </div>
      </header>

      {!session ? (
        <main>
          <LoginForm onLogin={setSession} />
        </main>
      ) : view === "operations" ? (
        <main>
          <section className="band band-grey">
            <h1 className="band-title">Operations</h1>
            <p className="band-lead">Reports and back-office jobs, each backed by a T-SQL object in SQL Server.</p>
            <OperationsView token={session.token} isAdmin={isAdmin} />
          </section>
        </main>
      ) : (
        <main>
          <section className="band band-grey">
            <h1 className="band-title">New booking</h1>
            <p className="band-lead">Book a seat for a customer. The API checks every rule before saving.</p>
            <CreateBookingForm
              token={session.token}
              onCreated={(b) => {
                setSelectedId(b.id);
                changed(b.id);
              }}
            />
          </section>

          <section className="band band-white">
            <h2 className="band-title">Bookings</h2>
            <p className="band-lead">
              {totalCount} {totalCount === 1 ? "booking" : "bookings"} on file. Select one to see its status history.
            </p>

            <div className={`bookings-layout${selected ? " has-detail" : ""}`}>
              <div className="panel register-panel">
                <form className="toolbar filters" onSubmit={applySearch}>
                  <label className="field compact">
                    <span className="field-label">From</span>
                    <input
                      className="code"
                      placeholder="YYZ"
                      maxLength={3}
                      value={draft.origin}
                      onChange={(e) => setDraft({ ...draft, origin: e.target.value.toUpperCase() })}
                    />
                  </label>
                  <label className="field compact">
                    <span className="field-label">To</span>
                    <input
                      className="code"
                      placeholder="PVG"
                      maxLength={3}
                      value={draft.destination}
                      onChange={(e) => setDraft({ ...draft, destination: e.target.value.toUpperCase() })}
                    />
                  </label>
                  <label className="field compact">
                    <span className="field-label">Departs on</span>
                    <input
                      type="date"
                      value={draft.date}
                      onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                    />
                  </label>
                  <label className="field compact">
                    <span className="field-label">Status</span>
                    <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
                      <option value="">Any status</option>
                      <option>Pending</option>
                      <option>Confirmed</option>
                      <option>Ticketed</option>
                      <option>Cancelled</option>
                    </select>
                  </label>
                  <button type="submit" className="btn-primary">
                    <ButtonLabel>Search</ButtonLabel>
                  </button>
                  <label className="field compact convert-to">
                    <span className="field-label">Convert fares to</span>
                    <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                      {CURRENCIES.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                </form>

                {error && (
                  <p className="notice" role="alert">
                    {error}
                  </p>
                )}

                <div className={`register-wrap${loading ? " is-loading" : ""}`} aria-busy={loading}>
                  <BookingsTable
                    token={session.token}
                    isAdmin={isAdmin}
                    bookings={bookings}
                    currency={currency}
                    selectedId={selectedId}
                    pressedId={freshId}
                    onSelect={(id) => setSelectedId((current) => (current === id ? null : id))}
                    onChanged={changed}
                    onError={setError}
                  />
                </div>

                <div className="pager">
                  <button
                    type="button"
                    className="quiet"
                    disabled={filters.page <= 1}
                    onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
                  >
                    <Icon name="chevron-left" />
                    Previous
                  </button>
                  <span>
                    Page {filters.page} of {totalPages}
                  </span>
                  <button
                    type="button"
                    className="quiet"
                    disabled={filters.page >= totalPages}
                    onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
                  >
                    Next
                    <Icon name="chevron-right" />
                  </button>
                </div>
              </div>

              {selected && (
                <BookingDetail
                  token={session.token}
                  booking={selected}
                  version={historyVersion}
                  onClose={() => setSelectedId(null)}
                />
              )}
            </div>
          </section>
        </main>
      )}

      <footer className="footer">
        <div className="footer-inner">
          <span>Demo project with synthetic data. Fares convert through a live exchange-rate API.</span>
          <span>Every rule is enforced by the API; the interface only hides what your role can't do.</span>
        </div>
      </footer>
    </div>
  );
}
