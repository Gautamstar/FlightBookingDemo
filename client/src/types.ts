// TypeScript mirrors of the C# records the API returns. If the API changes shape,
// the compiler points at every place in the UI that needs updating.

export type BookingStatus = "Pending" | "Confirmed" | "Ticketed" | "Cancelled";

export interface Booking {
  id: number;
  passengerName: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departureDate: string; // "2026-11-15" (C# DateOnly)
  fareCad: number;
  status: BookingStatus;
  createdAt: string;
}

export interface CreateBookingRequest {
  passengerName: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departureDate: string;
  fareCad: number;
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface TokenResponse {
  accessToken: string;
  expiresAtUtc: string;
}

export interface SearchFilters {
  origin?: string;
  destination?: string;
  date?: string;
  status?: BookingStatus | "";
  page: number;
  pageSize: number;
}

// Rows from the view dbo.vw_RouteSummary.
export interface RouteSummary {
  origin: string;
  destination: string;
  departureDate: string;
  activeBookings: number;
  ticketedBookings: number;
  revenueCad: number;
}

// Rows the trigger trg_Bookings_StatusHistory writes on every insert and status change.
export interface StatusChange {
  id: number;
  bookingId: number;
  oldStatus: BookingStatus | null;
  newStatus: BookingStatus;
  changedAt: string;
  changedBy: string;
}

export interface Session {
  token: string;
  username: string;
  role: string;
}

// What the public lookup returns: enough for a traveller, without fares or who changed what.
export interface Trip {
  reference: number;
  passengerName: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departureDate: string;
  status: BookingStatus;
  history: { status: BookingStatus; changedAt: string }[];
}
