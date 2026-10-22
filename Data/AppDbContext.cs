using FlightBookingDemo.Models;
using Microsoft.EntityFrameworkCore;

namespace FlightBookingDemo.Data;

// One DbContext = one unit of work against the database (like a JPA EntityManager).
public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    // Each DbSet maps to a table: Bookings.
    public DbSet<Booking> Bookings => Set<Booking>();
    public DbSet<BookingStatusChange> StatusChanges => Set<BookingStatusChange>();

    // Mapped to a view, not a table. Read-only.
    public DbSet<RouteSummary> RouteSummaries => Set<RouteSummary>();

    // Fluent configuration: exact column types, so the schema is designed rather than guessed.
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Booking>(b =>
        {
            b.Property(x => x.PassengerName).HasMaxLength(100).IsRequired();
            b.Property(x => x.FlightNumber).HasMaxLength(10).IsRequired();
            b.Property(x => x.Origin).HasMaxLength(3).IsFixedLength().IsRequired();
            b.Property(x => x.Destination).HasMaxLength(3).IsFixedLength().IsRequired();
            b.Property(x => x.FareCad).HasPrecision(18, 2);

            // Store "Ticketed" rather than 2, so the table reads clearly in SQL and in reports.
            b.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);

            // Safety net for the duplicate rule: a filtered unique index, enforced by SQL Server
            // even if two requests arrive at the same moment. Cancelled rows don't count.
            b.HasIndex(x => new { x.PassengerName, x.FlightNumber, x.DepartureDate })
                .IsUnique()
                .HasFilter("[Status] <> 'Cancelled'");

            // Speeds up route searches. Column order matters: the most common filters go first.
            b.HasIndex(x => new { x.Origin, x.Destination, x.DepartureDate });

            // EF Core normally reads generated values back with an OUTPUT clause, which SQL Server
            // forbids on tables with triggers. Declaring the trigger makes EF use a compatible method.
            b.ToTable(tb => tb.HasTrigger("trg_Bookings_StatusHistory"));
        });

        modelBuilder.Entity<BookingStatusChange>(h =>
        {
            h.ToTable("BookingStatusChanges");
            h.Property(x => x.OldStatus).HasMaxLength(20);
            h.Property(x => x.NewStatus).HasMaxLength(20).IsRequired();
            h.Property(x => x.ChangedBy).HasMaxLength(128).IsRequired();
            h.HasIndex(x => x.BookingId); // history is always looked up by booking
        });

        // HasNoKey + ToView: EF reads it like a table but never tries to create, insert or update it.
        modelBuilder.Entity<RouteSummary>(v =>
        {
            v.HasNoKey().ToView("vw_RouteSummary");
            v.Property(x => x.RevenueCad).HasPrecision(18, 2);
        });
    }
}
