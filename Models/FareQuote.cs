namespace FlightBookingDemo.Models;

// A booking's fare converted into another currency, with the rate used so the number can be checked.
public record FareQuote(
    int BookingId,
    decimal FareCad,
    string Currency,
    decimal Rate,
    decimal ConvertedFare,
    DateTimeOffset RatesUpdatedAt);
