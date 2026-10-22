namespace FlightBookingDemo.Models;

// Mirrors the real airline flow: a booking is held, confirmed, then ticketed.
public enum BookingStatus
{
    Pending,
    Confirmed,
    Ticketed,
    Cancelled
}

public class Booking
{
    public int Id { get; set; }
    public string PassengerName { get; set; } = "";
    public string FlightNumber { get; set; } = "";
    public string Origin { get; set; } = "";
    public string Destination { get; set; } = "";
    public DateOnly DepartureDate { get; set; }

    // Money is always decimal: exact base-10, so fares never drift by fractions of a cent.
    public decimal FareCad { get; set; }

    public BookingStatus Status { get; set; } = BookingStatus.Pending;

    // UTC on the server; convert to local time only when displaying.
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
