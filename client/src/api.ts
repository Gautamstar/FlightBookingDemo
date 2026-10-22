import type {
  Booking,
  CreateBookingRequest,
  FareQuote,
  PagedResult,
  RouteSummary,
  SearchFilters,
  Session,
  StatusChange,
  TokenResponse,
} from "./types";

// The API's address comes from the environment (.env files), so dev, test and prod can differ.
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5130";

// The API answers errors with ProblemDetails JSON. This turns it into one error type the UI can show.
export class ApiError extends Error {
  status: number;
  fieldErrors: Record<string, string[]>;

  constructor(status: number, message: string, fieldErrors: Record<string, string[]> = {}) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

async function request<T>(path: string, token: string | null, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    // fetch only throws when there's no HTTP response at all: API down, wrong URL, or CORS blocked.
    throw new ApiError(0, "Can't reach the API. Is it running?");
  }

  if (!response.ok) {
    const problem = await response.json().catch(() => null);
    const message =
      problem?.detail ??
      problem?.title ??
      (response.status === 401 ? "Please log in again." :
       response.status === 403 ? "You don't have permission to do that." :
       `Request failed (${response.status}).`);
    throw new ApiError(response.status, message, problem?.errors ?? {});
  }

  // 204 No Content has no body to parse.
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

// The JWT payload is plain Base64Url JSON, so the UI can read the username and role.
// The UI only uses this to decide what to show; the API still checks the signature and role on every call.
function readClaims(token: string): { username: string; role: string } {
  const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
  const claims: Record<string, string> = JSON.parse(atob(payload));
  const find = (suffix: string) =>
    Object.entries(claims).find(([key]) => key === suffix || key.endsWith(`/${suffix}`))?.[1] ?? "";
  return { username: find("name") || claims.sub, role: find("role") };
}

export async function login(username: string, password: string): Promise<Session> {
  const result = await request<TokenResponse>("/api/auth/login", null, {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  return { token: result.accessToken, ...readClaims(result.accessToken) };
}

export function searchBookings(token: string, filters: SearchFilters): Promise<PagedResult<Booking>> {
  // URLSearchParams encodes each value safely; empty filters are left out entirely.
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  }
  return request(`/api/bookings/search?${params}`, token);
}

export function createBooking(token: string, booking: CreateBookingRequest): Promise<Booking> {
  return request("/api/bookings", token, { method: "POST", body: JSON.stringify(booking) });
}

export type StatusAction = "confirm" | "ticket" | "cancel";

export function changeStatus(token: string, id: number, action: StatusAction): Promise<Booking> {
  return request(`/api/bookings/${id}/${action}`, token, { method: "PUT" });
}

export function getFare(token: string, id: number, currency: string): Promise<FareQuote> {
  return request(`/api/bookings/${id}/fare?currency=${encodeURIComponent(currency)}`, token);
}

// Operations: each call is backed by a T-SQL object in SQL Server.

export function getRouteSummary(token: string, from: string, to: string): Promise<RouteSummary[]> {
  const params = new URLSearchParams({ from, to });
  return request(`/api/operations/route-summary?${params}`, token);
}

export function getUnticketed(token: string, days: number): Promise<Booking[]> {
  return request(`/api/operations/unticketed?days=${days}`, token);
}

export function expireUnpaid(token: string, olderThanHours: number): Promise<{ expiredCount: number }> {
  return request(`/api/operations/expire-unpaid?olderThanHours=${olderThanHours}`, token, { method: "POST" });
}

export function getHistory(token: string, id: number): Promise<StatusChange[]> {
  return request(`/api/operations/bookings/${id}/history`, token);
}
