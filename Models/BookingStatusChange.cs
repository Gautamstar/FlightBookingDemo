namespace FlightBookingDemo.Models;

// One row per status change, written by the database trigger trg_Bookings_StatusHistory.
// The app only reads this table; SQL Server fills it for every insert or status update,
// whether the change came from EF Core, a stored procedure, or someone running SQL by hand.
public class BookingStatusChange
{
    public long Id { get; set; }
    public int BookingId { get; set; }
    public string? OldStatus { get; set; } // null when the booking was first created
    public string NewStatus { get; set; } = "";
    public DateTime ChangedAt { get; set; }
    public string ChangedBy { get; set; } = ""; // the database login, from SUSER_SNAME()
}
