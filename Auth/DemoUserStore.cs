using Microsoft.AspNetCore.Identity;

namespace FlightBookingDemo.Auth;

public record DemoUser(string Username, string Role);

// Demo login only: test users come from appsettings.Development.json.
// Even here, passwords are hashed on startup and checked with PasswordHasher (PBKDF2 with a salt),
// so the comparison works the same way it would against a real user table.
// A production app would use ASP.NET Core Identity or an identity provider (Entra ID, Okta, Auth0).
public class DemoUserStore
{
    private readonly PasswordHasher<DemoUser> _hasher = new();
    private readonly Dictionary<string, (DemoUser User, string Hash)> _users;

    public DemoUserStore(IConfiguration config)
    {
        _users = config.GetSection("DemoUsers").GetChildren()
            .Select(s => new DemoUser(s["Username"]!, s["Role"]!) is var user
                ? (User: user, Hash: _hasher.HashPassword(user, s["Password"]!))
                : default)
            .ToDictionary(u => u.User.Username, StringComparer.OrdinalIgnoreCase);
    }

    public DemoUser? Validate(string username, string password)
    {
        if (!_users.TryGetValue(username, out var entry))
        {
            return null;
        }

        var result = _hasher.VerifyHashedPassword(entry.User, entry.Hash, password);
        return result == PasswordVerificationResult.Failed ? null : entry.User;
    }
}
