using System.Text;
using System.Text.Json.Serialization;
using FlightBookingDemo.Auth;
using FlightBookingDemo.Data;
using FlightBookingDemo.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

// Local secrets (JWT signing key, demo users) live in a gitignored file, never in source control.
// Environment variables and command-line arguments are added again after it so they still win.
builder.Configuration
    .AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: true)
    .AddEnvironmentVariables()
    .AddCommandLine(args);

// Add services to the container.

// Enums go over the wire as names ("Cancelled"), not numbers (3).
builder.Services.AddControllers()
    .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(o =>
{
    // Adds the "Authorize" button to Swagger UI so you can paste a token and call protected endpoints.
    o.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        Description = "Paste the accessToken from POST /api/auth/login"
    });
    o.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        [new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" } }]
            = Array.Empty<string>()
    });
});

// AddDbContext registers AppDbContext as scoped (one per request).
builder.Services.AddDbContext<AppDbContext>(o =>
    o.UseSqlServer(builder.Configuration.GetConnectionString("Default")));

// Typed HttpClient for the exchange-rate API. IHttpClientFactory pools the connections underneath.
builder.Services.AddMemoryCache();
builder.Services.AddHttpClient<ExchangeRateClient>(c =>
{
    c.BaseAddress = new Uri(builder.Configuration["ExchangeRates:BaseUrl"]!);
    c.Timeout = TimeSpan.FromSeconds(5); // never wait forever on a third party
});

// Scoped to match the DbContext it depends on. Swapping storage is this one line.
builder.Services.AddScoped<IBookingService, EfBookingService>();
builder.Services.AddScoped<OperationsService>();

// Authentication: who are you? Every request's "Authorization: Bearer <token>" header is checked here.
var jwt = builder.Configuration.GetSection("Jwt").Get<JwtOptions>()!;
// Fail fast at startup with a clear message, rather than on the first login.
if (string.IsNullOrWhiteSpace(jwt.SigningKey) || jwt.SigningKey.Length < 32)
{
    throw new InvalidOperationException(
        "Jwt:SigningKey is missing or shorter than 32 characters. Run start-demo.ps1, " +
        "or copy appsettings.Local.example.json to appsettings.Local.json and fill it in.");
}
builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection("Jwt"));
builder.Services.AddSingleton<DemoUserStore>();
builder.Services.AddSingleton<TokenService>();
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwt.Issuer,
            ValidateAudience = true,
            ValidAudience = jwt.Audience,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.SigningKey)),
            ClockSkew = TimeSpan.FromSeconds(30) // default is 5 minutes of grace after expiry
        };
    });

// Authorization: what are you allowed to do? Read by [Authorize] and [Authorize(Roles = "...")].
builder.Services.AddAuthorization();

// CORS: browsers block a page on one origin (localhost:5173) from reading responses from another
// (localhost:5130) unless the API says it's allowed. Only the listed frontend origins are trusted.
const string FrontendCors = "Frontend";
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? Array.Empty<string>();
builder.Services.AddCors(o => o.AddPolicy(FrontendCors, p => p
    .WithOrigins(allowedOrigins)
    .WithHeaders("Authorization", "Content-Type")
    .WithMethods("GET", "POST", "PUT")));

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    // Dev convenience: create or update the database from the migrations on startup.
    // In production, migrations run as a reviewed deployment step instead.
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();
    DemoDataSeeder.Seed(db);

    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

// Before auth, so the browser's preflight (OPTIONS) request gets CORS headers without needing a token.
app.UseCors(FrontendCors);

// Order matters: identify the user first, then check permissions.
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
