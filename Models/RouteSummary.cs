namespace FlightBookingDemo.Models;

// A row from the view dbo.vw_RouteSummary: active bookings and revenue per route and departure date.
// It has no key because a view row isn't an entity you update; EF Core only reads it.
public class RouteSummary
{
    public string Origin { get; set; } = "";
    public string Destination { get; set; } = "";
    public DateOnly DepartureDate { get; set; }
    public int ActiveBookings { get; set; }
    public int TicketedBookings { get; set; }
    public decimal RevenueCad { get; set; }
}
