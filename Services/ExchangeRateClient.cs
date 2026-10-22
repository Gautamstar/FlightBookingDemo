using System.Net;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Caching.Memory;

namespace FlightBookingDemo.Services;

// The shape of the third party's JSON. JsonPropertyName maps their snake_case names to ours.
// On a record, attributes for JSON need the "property:" target so they land on the property.
public record RatesResponse(
    [property: JsonPropertyName("result")] string Result,
    [property: JsonPropertyName("time_last_update_unix")] long TimeLastUpdateUnix,
    [property: JsonPropertyName("rates")] Dictionary<string, decimal>? Rates);

// Our own clean type, so the rest of the app never depends on the supplier's JSON format.
public record ExchangeRates(IReadOnlyDictionary<string, decimal> Rates, DateTimeOffset UpdatedAt);

// Thrown only after every retry has failed.
public class ExchangeRateUnavailableException : Exception
{
    public ExchangeRateUnavailableException(string message, Exception? inner = null) : base(message, inner)
    {
    }
}

// A typed HttpClient: IHttpClientFactory creates it with the base address and timeout from Program.cs.
public class ExchangeRateClient
{
    private const int MaxAttempts = 4;
    private const string CacheKey = "rates:CAD";
    private static readonly TimeSpan CacheFor = TimeSpan.FromMinutes(10);

    private readonly HttpClient _http;
    private readonly IMemoryCache _cache;
    private readonly ILogger<ExchangeRateClient> _logger;

    public ExchangeRateClient(HttpClient http, IMemoryCache cache, ILogger<ExchangeRateClient> logger)
    {
        _http = http;
        _cache = cache;
        _logger = logger;
    }

    public async Task<ExchangeRates> GetCadRatesAsync(CancellationToken ct)
    {
        // Rates change slowly, so one call every 10 minutes serves every request in between.
        if (_cache.TryGetValue(CacheKey, out ExchangeRates? cached) && cached is not null)
        {
            return cached;
        }

        var rates = await FetchWithRetryAsync(ct);
        _cache.Set(CacheKey, rates, CacheFor);
        return rates;
    }

    private async Task<ExchangeRates> FetchWithRetryAsync(CancellationToken ct)
    {
        for (var attempt = 1; attempt <= MaxAttempts; attempt++)
        {
            try
            {
                using var response = await _http.GetAsync("v6/latest/CAD", ct);

                if (IsTransient(response.StatusCode))
                {
                    _logger.LogWarning("Exchange-rate API returned {StatusCode} (attempt {Attempt} of {Max})",
                        (int)response.StatusCode, attempt, MaxAttempts);
                }
                else if (!response.IsSuccessStatusCode)
                {
                    // A 4xx means our request is wrong. Retrying would get the same answer.
                    throw new ExchangeRateUnavailableException(
                        $"Exchange-rate API rejected the request with {(int)response.StatusCode}.");
                }
                else
                {
                    var body = await response.Content.ReadFromJsonAsync<RatesResponse>(ct);
                    if (body is null || body.Result != "success" || body.Rates is null)
                    {
                        throw new ExchangeRateUnavailableException("Exchange-rate API returned an unexpected response.");
                    }

                    return new ExchangeRates(body.Rates, DateTimeOffset.FromUnixTimeSeconds(body.TimeLastUpdateUnix));
                }
            }
            catch (HttpRequestException ex)
            {
                // Network failure: DNS, connection refused, connection reset.
                _logger.LogWarning("Exchange-rate API unreachable: {Message} (attempt {Attempt} of {Max})",
                    ex.Message, attempt, MaxAttempts);
            }
            catch (TaskCanceledException) when (!ct.IsCancellationRequested)
            {
                // HttpClient.Timeout fired. (If the caller cancelled, ct is set and we let it bubble up.)
                _logger.LogWarning("Exchange-rate API timed out (attempt {Attempt} of {Max})", attempt, MaxAttempts);
            }
            catch (JsonException ex)
            {
                throw new ExchangeRateUnavailableException("Exchange-rate API returned invalid JSON.", ex);
            }

            if (attempt < MaxAttempts)
            {
                // Exponential backoff: 200ms, 400ms, 800ms. Gives a struggling service room to recover.
                var delay = TimeSpan.FromMilliseconds(200 * Math.Pow(2, attempt - 1));
                await Task.Delay(delay, ct);
            }
        }

        throw new ExchangeRateUnavailableException($"Exchange-rate API failed after {MaxAttempts} attempts.");
    }

    // 5xx and 429 (rate limited) are usually temporary. Everything else is not worth retrying.
    private static bool IsTransient(HttpStatusCode status) =>
        (int)status >= 500 || status == HttpStatusCode.TooManyRequests;
}
