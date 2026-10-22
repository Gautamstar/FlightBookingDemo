using FlightBookingDemo.Data;
using Microsoft.EntityFrameworkCore;

namespace FlightBookingDemo.Diagnostics;

public record BookingRow(int Id, string PassengerName, string FlightNumber, string Origin, string Destination,
    DateOnly DepartureDate, decimal FareCad, string Status, DateTime CreatedAt);
public record StatusChangeRow(long Id, int BookingId, string? OldStatus, string NewStatus, DateTime ChangedAt, string ChangedBy);
public record TableSnapshot<T>(int Total, IReadOnlyList<T> Rows);
public record DevTables(TableSnapshot<BookingRow> Bookings, TableSnapshot<StatusChangeRow> StatusChanges);

// DEMO / DEBUG FEATURE. Program.cs maps these only when the environment is Development, so in
// production the routes don't exist at all (404), instead of existing behind a check that could
// be misconfigured. They still need a valid token: even locally, this is real booking data.
// ActivityMiddleware skips /api/dev, so polling these never shows up in the feed itself.
public static class DevEndpoints
{
    private const int RowsPerTable = 15;

    public static void MapDevEndpoints(this IEndpointRouteBuilder app)
    {
        // RequireAuthorization() is the minimal-API form of [Authorize]: any signed-in user, any role.
        var dev = app.MapGroup("/api/dev").RequireAuthorization();

        // GET api/dev/activity?after=42   (only entries newer than seq 42)
        dev.MapGet("/activity", (ActivityFeed feed, long after = 0) => feed.After(after));

        // GET api/dev/tables   (latest rows of the two tables the demo writes to)
        dev.MapGet("/tables", async (AppDbContext db, CancellationToken ct) =>
        {
            // AsNoTracking: read-only, so EF skips the change-tracking bookkeeping.
            var bookings = await db.Bookings.AsNoTracking()
                .OrderByDescending(b => b.Id).Take(RowsPerTable).ToListAsync(ct);
            var changes = await db.StatusChanges.AsNoTracking()
                .OrderByDescending(c => c.Id).Take(RowsPerTable).ToListAsync(ct);

            return new DevTables(
                new TableSnapshot<BookingRow>(
                    await db.Bookings.CountAsync(ct),
                    bookings.Select(b => new BookingRow(b.Id, b.PassengerName, b.FlightNumber, b.Origin, b.Destination,
                        b.DepartureDate, b.FareCad, b.Status.ToString(), AsUtc(b.CreatedAt))).ToList()),
                new TableSnapshot<StatusChangeRow>(
                    await db.StatusChanges.CountAsync(ct),
                    changes.Select(c => new StatusChangeRow(c.Id, c.BookingId, c.OldStatus, c.NewStatus,
                        AsUtc(c.ChangedAt), c.ChangedBy)).ToList()));
        });
    }

    // SQL Server's datetime2 has no time zone, so EF reads values back as Kind=Unspecified and
    // they serialize without a "Z". They are stored as UTC, so mark them and the JSON ends in Z.
    private static DateTime AsUtc(DateTime value) => DateTime.SpecifyKind(value, DateTimeKind.Utc);
}
