using System.Diagnostics;

namespace FlightBookingDemo.Diagnostics;

// DEMO / DEBUG FEATURE (Development only). Opens an activity entry when an /api request starts
// and publishes it to the feed once the response has been sent.
public class ActivityMiddleware
{
    private static readonly PathString Api = "/api";
    private static readonly PathString Dev = "/api/dev";

    private readonly RequestDelegate _next;
    private readonly ActivityFeed _feed;

    public ActivityMiddleware(RequestDelegate next, ActivityFeed feed)
    {
        _next = next;
        _feed = feed;
    }

    public Task InvokeAsync(HttpContext context)
    {
        // /api/dev is skipped so the panel's own polling doesn't flood the feed. Swagger and
        // anything else outside /api is not part of the API, so it isn't recorded either.
        // CORS preflights (OPTIONS) are the browser asking permission, not API work, so they're skipped too.
        var path = context.Request.Path;
        if (!path.StartsWithSegments(Api) || path.StartsWithSegments(Dev) || HttpMethods.IsOptions(context.Request.Method))
        {
            return _next(context);
        }

        var activity = new RequestActivity();
        context.Items[RequestActivity.ItemsKey] = activity;
        var startedAt = DateTime.UtcNow;
        var timer = Stopwatch.StartNew();

        // OnCompleted runs after the response has been sent, so the status is final even when an
        // error page or the rate limiter rewrote the response further down the pipeline.
        context.Response.OnCompleted(() =>
        {
            var (sql, external) = activity.Snapshot();
            _feed.Publish(seq => new ActivityEntry(
                seq,
                startedAt,
                context.Request.Method,
                path + context.Request.QueryString,
                context.Response.StatusCode,
                Math.Round(timer.Elapsed.TotalMilliseconds, 2),
                // Set by the authentication middleware; null for anonymous calls.
                context.User.Identity?.IsAuthenticated == true ? context.User.Identity.Name : null,
                sql,
                external));
            return Task.CompletedTask;
        });

        return _next(context);
    }
}
