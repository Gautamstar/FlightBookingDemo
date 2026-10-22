using FlightBookingDemo.Models;

namespace FlightBookingDemo.Services;

// The contract the controller depends on. Any storage (memory, SQLite, SQL Server)
// can sit behind it without the controller changing.
// Every method returns a Task because database calls are I/O: the thread is freed while waiting.
public interface IBookingService
{
    Task<List<Booking>> GetAllAsync();
    Task<Booking?> GetByIdAsync(int id);
    Task<ServiceResult<Booking>> CreateAsync(CreateBookingRequest request);

    // Moves a booking to a new status if the business rules allow it.
    Task<ServiceResult<Booking>> ChangeStatusAsync(int id, BookingStatus newStatus);

    // Filtered, paged search. Only the filters that were provided are applied.
    Task<PagedResult<Booking>> SearchAsync(BookingSearchQuery query, CancellationToken ct);

    // The booking's fare converted with live exchange rates.
    Task<ServiceResult<FareQuote>> GetFareQuoteAsync(int id, string currency, CancellationToken ct);
}
