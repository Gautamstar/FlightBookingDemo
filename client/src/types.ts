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

export interface FareQuote {
  bookingId: number;
  fareCad: number;
  currency: string;
  rate: number;
  convertedFare: number;
  ratesUpdatedAt: string;
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

export interface Session {
  token: string;
  username: string;
  role: string;
}
