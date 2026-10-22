using System.ComponentModel.DataAnnotations;
using FlightBookingDemo.Models;
using FlightBookingDemo.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FlightBookingDemo.Controllers;

public record ExpireResult(int ExpiredCount);

// Reports and back-office jobs, each backed by a T-SQL object in the database.
[ApiController]
[Route("api/operations")]
[Authorize]
public class OperationsController : ControllerBase
{
    private readonly OperationsService _ops;

    public OperationsController(OperationsService ops)
    {
        _ops = ops;
    }

    // GET api/operations/route-summary?from=2026-11-01&to=2026-11-30   (view)
    [HttpGet("route-summary")]
    public async Task<ActionResult<List<RouteSummary>>> RouteSummary(DateOnly? from, DateOnly? to, CancellationToken ct)
    {
        return Ok(await _ops.GetRouteSummaryAsync(from, to, ct));
    }

    // GET api/operations/unticketed?days=30   (table-valued function)
    [HttpGet("unticketed")]
    public async Task<ActionResult<List<Booking>>> Unticketed([Range(1, 365)] int days = 30, CancellationToken ct = default)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        return Ok(await _ops.GetUnticketedDeparturesAsync(today, days, ct));
    }

    // POST api/operations/expire-unpaid?olderThanHours=24   (stored procedure; Admin only)
    [HttpPost("expire-unpaid")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ExpireResult>> ExpireUnpaid([Range(0, 720)] int olderThanHours = 24, CancellationToken ct = default)
    {
        return Ok(new ExpireResult(await _ops.ExpireUnpaidBookingsAsync(olderThanHours, ct)));
    }

    // GET api/operations/bookings/5/history   (rows written by the trigger)
    [HttpGet("bookings/{id:int}/history")]
    public async Task<ActionResult<List<BookingStatusChange>>> History(int id, CancellationToken ct)
    {
        return Ok(await _ops.GetHistoryAsync(id, ct));
    }
}
