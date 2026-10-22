using System.ComponentModel.DataAnnotations;
using FlightBookingDemo.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FlightBookingDemo.Controllers;

public record LoginRequest([Required] string Username, [Required] string Password);

[ApiController]
[Route("api/auth")]
[AllowAnonymous] // you can't require a token on the endpoint that hands out tokens
public class AuthController : ControllerBase
{
    private readonly DemoUserStore _users;
    private readonly TokenService _tokens;

    public AuthController(DemoUserStore users, TokenService tokens)
    {
        _users = users;
        _tokens = tokens;
    }

    // POST api/auth/login
    [HttpPost("login")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public ActionResult<TokenResponse> Login(LoginRequest request)
    {
        var user = _users.Validate(request.Username, request.Password);
        if (user is null)
        {
            // Same answer for "no such user" and "wrong password", so attackers can't probe for usernames.
            return Unauthorized();
        }

        return Ok(_tokens.CreateToken(user));
    }
}
