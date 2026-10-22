namespace FlightBookingDemo.Services;

public enum ResultStatus
{
    Ok,
    NotFound,
    Invalid,   // the request breaks a business rule (maps to 400)
    Conflict,     // the request clashes with current data (maps to 409)
    Unavailable   // a dependency we rely on is down (maps to 503)
}

// What a service call produced, without the service knowing anything about HTTP.
// Expected outcomes (not found, duplicate) are return values; exceptions are kept for real failures.
public record ServiceResult<T>(ResultStatus Status, T? Value = default, string? Error = null)
{
    public static ServiceResult<T> Ok(T value) => new(ResultStatus.Ok, value);
    public static ServiceResult<T> NotFound() => new(ResultStatus.NotFound);
    public static ServiceResult<T> Invalid(string error) => new(ResultStatus.Invalid, Error: error);
    public static ServiceResult<T> Conflict(string error) => new(ResultStatus.Conflict, Error: error);
    public static ServiceResult<T> Unavailable(string error) => new(ResultStatus.Unavailable, Error: error);
}
