using FlightBookingDemo.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FlightBookingDemo.Migrations
{
    /// <summary>
    /// The view, table-valued function, trigger and stored procedure. Written by hand (no model
    /// changes, so no Designer file is needed) and created complete in one step.
    /// </summary>
    [DbContext(typeof(AppDbContext))]
    [Migration("20261021233000_SqlServerObjects")]
    public partial class SqlServerObjects : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Hand-written T-SQL objects. EF Core doesn't model these, so the migration carries the SQL.
            // Each CREATE must be the first statement in its batch, so each one is a separate Sql() call.

            // View: active bookings and revenue per route and departure date, for reports.
            migrationBuilder.Sql(@"
CREATE OR ALTER VIEW dbo.vw_RouteSummary
AS
SELECT Origin,
       Destination,
       DepartureDate,
       COUNT(*)                                            AS ActiveBookings,
       SUM(CASE WHEN Status = 'Ticketed' THEN 1 ELSE 0 END) AS TicketedBookings,
       SUM(FareCad)                                        AS RevenueCad
FROM dbo.Bookings
WHERE Status <> 'Cancelled'
GROUP BY Origin, Destination, DepartureDate;");

            // Inline table-valued function: bookings departing within @Days of @FromDate that still
            // need a ticket. A date range (not DATEDIFF on the column) keeps the index usable.
            migrationBuilder.Sql(@"
CREATE OR ALTER FUNCTION dbo.fn_UnticketedDepartures (@FromDate date, @Days int)
RETURNS TABLE
AS
RETURN
    SELECT Id, PassengerName, FlightNumber, Origin, Destination,
           DepartureDate, FareCad, Status, CreatedAt
    FROM dbo.Bookings
    WHERE Status IN ('Pending', 'Confirmed')
      AND DepartureDate >= @FromDate
      AND DepartureDate <  DATEADD(day, @Days, @FromDate);");

            // Trigger: records every new booking and every status change. Set-based, because one
            // UPDATE can change many rows and the trigger fires once per statement, not once per row.
            migrationBuilder.Sql(@"
CREATE OR ALTER TRIGGER dbo.trg_Bookings_StatusHistory
ON dbo.Bookings
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO dbo.BookingStatusChanges (BookingId, OldStatus, NewStatus, ChangedAt, ChangedBy)
    SELECT i.Id, d.Status, i.Status, SYSUTCDATETIME(), SUSER_SNAME()
    FROM inserted AS i
    LEFT JOIN deleted AS d ON d.Id = i.Id
    WHERE d.Id IS NULL            -- a new booking
       OR d.Status <> i.Status;   -- or the status actually changed
END;");

            // Stored procedure: cancel Pending bookings that were never paid within the time limit
            // (airlines auto-cancel unticketed reservations too). Returns the count in an OUTPUT parameter.
            migrationBuilder.Sql(@"
CREATE OR ALTER PROCEDURE dbo.usp_ExpireUnpaidBookings
    @OlderThanHours int,
    @ExpiredCount   int OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON; -- any error rolls back the whole statement, trigger included

    IF @OlderThanHours IS NULL OR @OlderThanHours < 0
        THROW 50001, 'OlderThanHours must be zero or more.', 1;

    UPDATE dbo.Bookings
    SET Status = 'Cancelled'
    WHERE Status = 'Pending'
      AND CreatedAt < DATEADD(hour, -@OlderThanHours, SYSUTCDATETIME());

    SET @ExpiredCount = @@ROWCOUNT;
END;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP PROCEDURE IF EXISTS dbo.usp_ExpireUnpaidBookings;");
            migrationBuilder.Sql("DROP TRIGGER IF EXISTS dbo.trg_Bookings_StatusHistory;");
            migrationBuilder.Sql("DROP FUNCTION IF EXISTS dbo.fn_UnticketedDepartures;");
            migrationBuilder.Sql("DROP VIEW IF EXISTS dbo.vw_RouteSummary;");
        }
    }
}
