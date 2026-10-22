using System.ComponentModel.DataAnnotations;

namespace FlightBookingDemo.Models;

// The POST body. The client never sends Id, Status or CreatedAt; the server owns those.
// [ApiController] checks these attributes before the action runs and returns 400 if any fail.
public record CreateBookingRequest(
    [Required, StringLength(100, MinimumLength = 2)]
    string PassengerName,

    // Airline code (2 letters or digits) + 1 to 4 digit flight number, e.g. AC25, CX829.
    [Required, RegularExpression("^[A-Z0-9]{2}[0-9]{1,4}$", ErrorMessage = "Use a flight number like AC25.")]
    string FlightNumber,

    // IATA airport codes are exactly three uppercase letters.
    [Required, RegularExpression("^[A-Z]{3}$", ErrorMessage = "Use a 3-letter IATA code like YYZ.")]
    string Origin,

    [Required, RegularExpression("^[A-Z]{3}$", ErrorMessage = "Use a 3-letter IATA code like PVG.")]
    string Destination,

    DateOnly DepartureDate,

    [Range(typeof(decimal), "0.01", "100000")]
    decimal FareCad);
