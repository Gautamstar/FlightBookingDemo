namespace FlightBookingDemo.Models;

// What a passenger sees when they look up their own trip without signing in.
// Deliberately narrow: no fare, no CreatedAt, no audit columns, and no ids beyond the reference
// they already hold, because anyone who knows a name and a number can read it.
public record TripLookupResult(
    int Reference,
    string PassengerName,
    string FlightNumber,
    string Origin,
    string Destination,
    DateOnly DepartureDate,
    BookingStatus Status,
    List<TripStatusEvent> History);

// One step in the booking's life, from the trigger-filled BookingStatusChanges table.
// ChangedAt is UTC (the trigger writes SYSUTCDATETIME()).
public record TripStatusEvent(string Status, DateTime ChangedAt);
