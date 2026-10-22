namespace FlightBookingDemo.Auth;

// Bound from the "Jwt" section of configuration (the options pattern).
// The signing key lives in appsettings.Development.json for local use only;
// in production it comes from an environment variable or a secret store like Azure Key Vault.
public class JwtOptions
{
    public string Issuer { get; set; } = "";
    public string Audience { get; set; } = "";
    public string SigningKey { get; set; } = "";
    public int ExpiryMinutes { get; set; } = 60;
}
