using System.Data;
using FlightBookingDemo.Data;
using FlightBookingDemo.Models;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace FlightBookingDemo.Services;

// Reporting and back-office work backed by T-SQL objects: a view, a table-valued function,
// a stored procedure, and the history table a trigger fills. Each method shows a different way
// to call SQL Server from EF Core.
public class OperationsService
{
    private readonly AppDbContext _db;

    public OperationsService(AppDbContext db)
    {
        _db = db;
    }

    // View: EF treats vw_RouteSummary like a read-only table, so normal LINQ composes on top of it.
    public async Task<List<RouteSummary>> GetRouteSummaryAsync(DateOnly? from, DateOnly? to, CancellationToken ct)
    {
        var rows = _db.RouteSummaries.AsQueryable();
        if (from is not null)
        {
            rows = rows.Where(r => r.DepartureDate >= from);
        }

        if (to is not null)
        {
            rows = rows.Where(r => r.DepartureDate <= to);
        }

        return await rows.OrderBy(r => r.DepartureDate).ThenBy(r => r.Origin).ThenBy(r => r.Destination)
            .ToListAsync(ct);
    }

    // Table-valued function: FromSql with an interpolated string. Despite the $"", EF sends
    // {fromDate} and {days} as SQL parameters, never as text pasted into the query.
    public async Task<List<Booking>> GetUnticketedDeparturesAsync(DateOnly fromDate, int days, CancellationToken ct)
    {
        return await _db.Bookings
            .FromSql($"SELECT * FROM dbo.fn_UnticketedDepartures({fromDate}, {days})")
            .AsNoTracking()
            .OrderBy(b => b.DepartureDate)
            .ToListAsync(ct);
    }

    // Stored procedure with an OUTPUT parameter: the classic ADO.NET pattern, run through EF's connection.
    public async Task<int> ExpireUnpaidBookingsAsync(int olderThanHours, CancellationToken ct)
    {
        var hours = new SqlParameter("@OlderThanHours", SqlDbType.Int) { Value = olderThanHours };
        var expired = new SqlParameter("@ExpiredCount", SqlDbType.Int) { Direction = ParameterDirection.Output };

        await _db.Database.ExecuteSqlRawAsync(
            "EXEC dbo.usp_ExpireUnpaidBookings @OlderThanHours, @ExpiredCount OUTPUT",
            new object[] { hours, expired },
            ct);

        return (int)expired.Value;
    }

    // History written by the trigger, read like any other table.
    public async Task<List<BookingStatusChange>> GetHistoryAsync(int bookingId, CancellationToken ct)
    {
        return await _db.StatusChanges.AsNoTracking()
            .Where(h => h.BookingId == bookingId)
            .OrderBy(h => h.Id)
            .ToListAsync(ct);
    }
}
