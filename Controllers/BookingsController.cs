using System.ComponentModel.DataAnnotations;
using FlightBookingDemo.Models;
using FlightBookingDemo.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FlightBookingDemo.Controllers;

// The controller only handles HTTP: read the request, call the service, pick the status code.
// [Authorize] on the class: every endpoint needs a valid token (401 without one).
[ApiController]
[Route("api/bookings")]
[Authorize]
public class BookingsController : ControllerBase
{
    private readonly IBookingService _service;

    public BookingsController(IBookingService service)
    {
        _service = service;
    }

    // GET api/bookings
    [HttpGet]
    public async Task<ActionResult<List<Booking>>> GetAll()
    {
        return Ok(await _service.GetAllAsync());
    }

    // GET api/bookings/search?origin=YYZ&destination=PVG&date=2026-11-15&page=1&pageSize=20
    [HttpGet("search")]
    public async Task<ActionResult<PagedResult<Booking>>> Search([FromQuery] BookingSearchQuery query, CancellationToken ct)
    {
        return Ok(await _service.SearchAsync(query, ct));
    }

    // GET api/bookings/5  (":int" means this route only matches numbers)
    [HttpGet("{id:int}")]
    public async Task<ActionResult<Booking>> GetById(int id)
    {
        var booking = await _service.GetByIdAsync(id);
        if (booking is null)
        {
            return NotFound();
        }

        return Ok(booking);
    }

    // POST api/bookings
    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<Booking>> Create(CreateBookingRequest request)
    {
        var result = await _service.CreateAsync(request);
        if (result.Status != ResultStatus.Ok)
        {
            return ToProblem(result);
        }

        // 201 Created, with a Location header pointing at GET api/bookings/{id}
        return CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, result.Value);
    }

    // PUT api/bookings/5/confirm  (payment received)
    [HttpPut("{id:int}/confirm")]
    public Task<ActionResult<Booking>> Confirm(int id) => ChangeStatus(id, BookingStatus.Confirmed);

    // PUT api/bookings/5/ticket  (ticket issued; only a Confirmed booking can be ticketed)
    // Issuing a ticket commits money with the airline, so only Admins may do it (403 for Agents).
    [HttpPut("{id:int}/ticket")]
    [Authorize(Roles = "Admin")]
    public Task<ActionResult<Booking>> Ticket(int id) => ChangeStatus(id, BookingStatus.Ticketed);

    // PUT api/bookings/5/cancel
    [HttpPut("{id:int}/cancel")]
    public Task<ActionResult<Booking>> Cancel(int id) => ChangeStatus(id, BookingStatus.Cancelled);

    // GET api/bookings/5/fare?currency=CNY
    // CancellationToken is filled in by ASP.NET Core and fires if the client disconnects.
    [HttpGet("{id:int}/fare")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<ActionResult<FareQuote>> GetFare(
        int id,
        [FromQuery, Required, RegularExpression("^[A-Z]{3}$", ErrorMessage = "Use a 3-letter ISO currency code like CNY.")]
        string currency,
        CancellationToken ct)
    {
        var result = await _service.GetFareQuoteAsync(id, currency, ct);
        return result.Status == ResultStatus.Ok ? Ok(result.Value) : ToProblem(result);
    }

    private async Task<ActionResult<Booking>> ChangeStatus(int id, BookingStatus newStatus)
    {
        var result = await _service.ChangeStatusAsync(id, newStatus);
        return result.Status == ResultStatus.Ok ? Ok(result.Value) : ToProblem(result);
    }

    // One place that turns a service outcome into an HTTP status + ProblemDetails body.
    private ActionResult ToProblem<T>(ServiceResult<T> result)
    {
        if (result.Status == ResultStatus.Unavailable)
        {
            Response.Headers.RetryAfter = "30"; // tells well-behaved clients when to try again
        }

        return result.Status switch
        {
            ResultStatus.NotFound => NotFound(),
            ResultStatus.Invalid => Problem(result.Error, statusCode: StatusCodes.Status400BadRequest),
            ResultStatus.Conflict => Problem(result.Error, statusCode: StatusCodes.Status409Conflict),
            ResultStatus.Unavailable => Problem(result.Error, statusCode: StatusCodes.Status503ServiceUnavailable),
            _ => Problem(statusCode: StatusCodes.Status500InternalServerError)
        };
    }
}
