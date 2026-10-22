using System.ComponentModel.DataAnnotations;
using FlightBookingDemo.Models;
using FlightBookingDemo.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace FlightBookingDemo.Controllers;

// Policy names shared by Program.cs (where the limits are defined) and the attributes that apply them.
public static class RateLimitPolicies
{
    public const string TripLookup = "trip-lookup";
}

// Passenger-facing endpoints. [Authorize] on the class keeps anything added here locked by default;
// each public action has to opt out on purpose.
[ApiController]
[Route("api/trips")]
[Authorize]
public class TripsController : ControllerBase
{
    // One message for every miss, so the response never reveals whether the number or the name was wrong.
    private const string NotFoundDetail =
        "We couldn't find a booking with those details. Check the booking number and the name exactly as it was given.";

    private readonly IBookingService _service;

    public TripsController(IBookingService service)
    {
        _service = service;
    }

    // GET api/trips/lookup?reference=5&name=Jane%20Doe
    // Anonymous, so it's rate limited per IP: without a cap, anyone could guess names against every number.
    [HttpGet("lookup")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimitPolicies.TripLookup)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<ActionResult<TripLookupResult>> Lookup(
        // int? so a missing value fails [Required] with a clear message, instead of binding as 0.
        [FromQuery, Required, Range(1, int.MaxValue)] int? reference,
        [FromQuery, Required, StringLength(100, MinimumLength = 1)] string name,
        CancellationToken ct)
    {
        var result = await _service.LookupTripAsync(reference!.Value, name, ct);
        if (result.Status != ResultStatus.Ok)
        {
            return Problem(NotFoundDetail, statusCode: StatusCodes.Status404NotFound);
        }

        return Ok(result.Value);
    }
}
