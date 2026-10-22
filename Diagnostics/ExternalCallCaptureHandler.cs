using System.Diagnostics;

namespace FlightBookingDemo.Diagnostics;

// DEMO / DEBUG FEATURE (Development only). Sits inside the ExchangeRateClient's HttpClient
// pipeline, so it sees each attempt separately: a call that retried three times shows three rows.
public class ExternalCallCaptureHandler : DelegatingHandler
{
    private readonly IHttpContextAccessor _accessor;

    public ExternalCallCaptureHandler(IHttpContextAccessor accessor)
    {
        _accessor = accessor;
    }

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var activity = RequestActivity.Current(_accessor);
        var timer = Stopwatch.StartNew();
        int? status = null; // stays null if the call throws (timeout, DNS failure, refused)
        try
        {
            var response = await base.SendAsync(request, cancellationToken);
            status = (int)response.StatusCode;
            return response;
        }
        finally
        {
            activity?.AddExternal(new ExternalCallEntry(
                request.Method.Method,
                request.RequestUri?.ToString() ?? "",
                status,
                Math.Round(timer.Elapsed.TotalMilliseconds, 2)));
        }
    }
}
