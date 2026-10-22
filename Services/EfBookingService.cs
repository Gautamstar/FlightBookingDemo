using FlightBookingDemo.Data;
using FlightBookingDemo.Models;
using Microsoft.EntityFrameworkCore;

namespace FlightBookingDemo.Services;

// Registered as scoped: one instance per HTTP request, sharing that request's DbContext.
public class EfBookingService : IBookingService
{
    // The booking state machine: which statuses each status may move to.
    // Book -> confirm (paid) -> ticket. A ticket can still be cancelled (void or refund).
    private static readonly Dictionary<BookingStatus, BookingStatus[]> AllowedTransitions = new()
    {
        [BookingStatus.Pending] = new[] { BookingStatus.Confirmed, BookingStatus.Cancelled },
        [BookingStatus.Confirmed] = new[] { BookingStatus.Ticketed, BookingStatus.Cancelled },
        [BookingStatus.Ticketed] = new[] { BookingStatus.Cancelled },
        [BookingStatus.Cancelled] = Array.Empty<BookingStatus>()
    };

    private readonly AppDbContext _db;
    private readonly ExchangeRateClient _rates;
    private readonly ILogger<EfBookingService> _logger;

    public EfBookingService(AppDbContext db, ExchangeRateClient rates, ILogger<EfBookingService> logger)
    {
        _db = db;
        _rates = rates;
        _logger = logger;
    }

    public async Task<List<Booking>> GetAllAsync()
    {
        // AsNoTracking: read-only query, so EF skips change tracking (faster, less memory).
        return await _db.Bookings.AsNoTracking().OrderBy(b => b.Id).ToListAsync();
    }

    public async Task<Booking?> GetByIdAsync(int id)
    {
        // FindAsync looks up the primary key (and checks EF's in-memory cache first).
        return await _db.Bookings.FindAsync(id);
    }

    public async Task<ServiceResult<Booking>> CreateAsync(CreateBookingRequest request)
    {
        if (request.Origin == request.Destination)
        {
            return ServiceResult<Booking>.Invalid("Origin and destination must be different.");
        }

        if (request.DepartureDate < DateOnly.FromDateTime(DateTime.UtcNow))
        {
            return ServiceResult<Booking>.Invalid("Departure date can't be in the past.");
        }

        // Rule: one active booking per passenger per flight per day.
        var duplicate = await _db.Bookings.AnyAsync(b =>
            b.PassengerName == request.PassengerName &&
            b.FlightNumber == request.FlightNumber &&
            b.DepartureDate == request.DepartureDate &&
            b.Status != BookingStatus.Cancelled);

        if (duplicate)
        {
            return ServiceResult<Booking>.Conflict(
                $"{request.PassengerName} already has an active booking on {request.FlightNumber} for {request.DepartureDate:yyyy-MM-dd}.");
        }

        var booking = new Booking
        {
            // No Id: SQL Server generates it (IDENTITY column).
            PassengerName = request.PassengerName,
            FlightNumber = request.FlightNumber,
            Origin = request.Origin,
            Destination = request.Destination,
            DepartureDate = request.DepartureDate,
            FareCad = request.FareCad
        };

        _db.Bookings.Add(booking);

        try
        {
            await _db.SaveChangesAsync(); // runs the INSERT; booking.Id is filled in afterwards
        }
        catch (DbUpdateException)
        {
            // Two identical requests raced past the AnyAsync check at the same moment.
            // The filtered unique index in SQL Server rejected the second one.
            return ServiceResult<Booking>.Conflict("An active booking for this passenger and flight already exists.");
        }

        return ServiceResult<Booking>.Ok(booking);
    }

    public async Task<ServiceResult<Booking>> ChangeStatusAsync(int id, BookingStatus newStatus)
    {
        var booking = await _db.Bookings.FindAsync(id);
        if (booking is null)
        {
            return ServiceResult<Booking>.NotFound();
        }

        if (!AllowedTransitions[booking.Status].Contains(newStatus))
        {
            return ServiceResult<Booking>.Conflict($"Can't change a {booking.Status} booking to {newStatus}.");
        }

        booking.Status = newStatus;   // EF notices the change (change tracking)
        await _db.SaveChangesAsync(); // and runs: UPDATE Bookings SET Status = ...
        return ServiceResult<Booking>.Ok(booking);
    }

    public async Task<PagedResult<Booking>> SearchAsync(BookingSearchQuery query, CancellationToken ct)
    {
        // IQueryable builds up a query without running it. Each Where adds to the SQL WHERE clause.
        var bookings = _db.Bookings.AsNoTracking().AsQueryable();

        if (query.Origin is not null)
        {
            bookings = bookings.Where(b => b.Origin == query.Origin);
        }

        if (query.Destination is not null)
        {
            bookings = bookings.Where(b => b.Destination == query.Destination);
        }

        if (query.Date is not null)
        {
            bookings = bookings.Where(b => b.DepartureDate == query.Date);
        }

        if (query.Status is not null)
        {
            bookings = bookings.Where(b => b.Status == query.Status);
        }

        // Two round trips: one COUNT for the total, one for the page itself.
        var total = await bookings.CountAsync(ct);
        var items = await bookings
            .OrderBy(b => b.DepartureDate).ThenBy(b => b.Id) // paging needs a stable order
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync(ct);

        return new PagedResult<Booking>(items, query.Page, query.PageSize, total);
    }

    public async Task<ServiceResult<FareQuote>> GetFareQuoteAsync(int id, string currency, CancellationToken ct)
    {
        var booking = await _db.Bookings.AsNoTracking().FirstOrDefaultAsync(b => b.Id == id, ct);
        if (booking is null)
        {
            return ServiceResult<FareQuote>.NotFound();
        }

        ExchangeRates rates;
        try
        {
            rates = await _rates.GetCadRatesAsync(ct);
        }
        catch (ExchangeRateUnavailableException ex)
        {
            // Full details go to the log; the client gets a short, safe message.
            _logger.LogError(ex, "Fare conversion failed for booking {BookingId}", id);
            return ServiceResult<FareQuote>.Unavailable("Currency conversion is temporarily unavailable. Please try again shortly.");
        }

        if (!rates.Rates.TryGetValue(currency, out var rate))
        {
            return ServiceResult<FareQuote>.Invalid($"Unknown currency code '{currency}'.");
        }

        // Round once, at the end, to 2 decimal places. AwayFromZero is the rounding people expect on a price.
        var converted = Math.Round(booking.FareCad * rate, 2, MidpointRounding.AwayFromZero);
        return ServiceResult<FareQuote>.Ok(
            new FareQuote(booking.Id, booking.FareCad, currency, rate, converted, rates.UpdatedAt));
    }
}
