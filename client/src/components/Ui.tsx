import type { BookingStatus } from "../types";

// Small shared pieces: status tags, route codes, the wordmark and a drawn icon set.

export function StatusTag({ status, fresh = false }: { status: BookingStatus; fresh?: boolean }) {
  return <span className={`tag tag-${status.toLowerCase()}${fresh ? " is-fresh" : ""}`}>{status}</span>;
}

type IconName =
  | "plane"
  | "arrow"
  | "search"
  | "signout"
  | "close"
  | "chevron-left"
  | "chevron-right"
  | "user"
  | "clock";

const ICONS: Record<IconName, React.ReactNode> = {
  plane: <path d="M2.5 13.5 21 6.5c.8-.3 1.4.6.8 1.2L17 12l-3.5 8.5c-.3.7-1.3.7-1.5 0L10.5 14l-5.5-.2c-.9 0-1.4-1-.7-1.6L5 11.5" />,
  arrow: <path d="M3 12h17m-5-5 5 5-5 5" />,
  search: <path d="m20 20-4.5-4.5M10.5 17a6.5 6.5 0 1 1 0-13 6.5 6.5 0 0 1 0 13Z" />,
  signout: <path d="M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14M10 16l-4-4 4-4m-4 4h11" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  "chevron-left": <path d="m14.5 6-6 6 6 6" />,
  "chevron-right": <path d="m9.5 6 6 6-6 6" />,
  user: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7.5 8a7.5 7.5 0 0 1 15 0" />,
  clock: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v4.5l3 2" />,
};

export function Icon({ name, className = "" }: { name: IconName; className?: string }) {
  return (
    <svg className={`icon ${className}`} viewBox="0 0 24 24" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

// Route codes: bold IATA codes with a drawn arrow between them.
export function Route({ from, to, size = "md" }: { from: string; to: string; size?: "md" | "lg" }) {
  return (
    <span className={`route route-${size}`} aria-label={`${from} to ${to}`}>
      <span>{from}</span>
      <Icon name="arrow" />
      <span>{to}</span>
    </span>
  );
}

export function Wordmark({ subline = "Agency console" }: { subline?: string }) {
  return (
    <span className="wordmark">
      <span className="wordmark-mark" aria-hidden="true">
        <Icon name="plane" />
      </span>
      <span className="wordmark-text">
        Flight Bookings
        <small>{subline}</small>
      </span>
    </span>
  );
}

// The chevron segment on the right of primary buttons.
export function ButtonLabel({ children }: { children: React.ReactNode }) {
  return (
    <>
      <span className="btn-text">{children}</span>
      <span className="btn-chevron" aria-hidden="true">
        <Icon name="chevron-right" />
      </span>
    </>
  );
}
