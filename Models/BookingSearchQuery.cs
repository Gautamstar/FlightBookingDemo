using System.ComponentModel.DataAnnotations;

namespace FlightBookingDemo.Models;

// Bound from the query string: ?origin=YYZ&destination=YVR&date=2026-11-15&page=1&pageSize=20
// Every filter is optional; paging has safe defaults and a hard cap.
public class BookingSearchQuery
{
    [RegularExpression("^[A-Z]{3}$")]
    public string? Origin { get; set; }

    [RegularExpression("^[A-Z]{3}$")]
    public string? Destination { get; set; }

    public DateOnly? Date { get; set; }

    public BookingStatus? Status { get; set; }

    [Range(1, int.MaxValue)]
    public int Page { get; set; } = 1;

    [Range(1, 100)]
    public int PageSize { get; set; } = 20;
}
