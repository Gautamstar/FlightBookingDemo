namespace FlightBookingDemo.Diagnostics;

// DEMO / DEBUG FEATURE. Everything in this folder powers the "behind the scenes" panel: it shows
// which SQL and which outbound HTTP calls each API request caused. It is registered and mapped
// only in Development (see Program.cs). It must never ship to production: SQL text reveals the
// schema, the feed shows every user's requests to anyone with a token, and capturing adds overhead.

// The wire shapes. Records, so they are immutable once published to the feed.
public record SqlCommandEntry(string Text, double DurationMs);
public record ExternalCallEntry(string Method, string Url, int? Status, double DurationMs);
public record ActivityEntry(
    long Seq,
    DateTime At,
    string Method,
    string Path,
    int Status,
    double DurationMs,
    string? User,
    IReadOnlyList<SqlCommandEntry> Sql,
    IReadOnlyList<ExternalCallEntry> External);

// Collects what happens during one request. The middleware puts it in HttpContext.Items;
// the SQL interceptor and the HTTP handler add to it. Locked because an outbound call and a
// query could finish on different threads at the same time.
public class RequestActivity
{
    public const string ItemsKey = "dev:activity";

    private readonly object _gate = new();
    private readonly List<SqlCommandEntry> _sql = new();
    private readonly List<ExternalCallEntry> _external = new();

    public void AddSql(SqlCommandEntry entry)
    {
        lock (_gate) _sql.Add(entry);
    }

    public void AddExternal(ExternalCallEntry entry)
    {
        lock (_gate) _external.Add(entry);
    }

    public (SqlCommandEntry[] Sql, ExternalCallEntry[] External) Snapshot()
    {
        lock (_gate) return (_sql.ToArray(), _external.ToArray());
    }

    // The entry for the current request, or null outside a request (startup seeding, for example).
    public static RequestActivity? Current(IHttpContextAccessor accessor) =>
        accessor.HttpContext?.Items[ItemsKey] as RequestActivity;
}

// Singleton ring buffer of finished requests. Memory stays bounded: only the last 200 are kept.
public class ActivityFeed
{
    private const int Capacity = 200;
    private const int MaxPerRead = 50;

    private readonly object _gate = new();
    private readonly Queue<ActivityEntry> _entries = new();
    private long _lastSeq;

    // Seq is assigned here, under the lock, so the buffer is always in seq order.
    public void Publish(Func<long, ActivityEntry> build)
    {
        lock (_gate)
        {
            _entries.Enqueue(build(++_lastSeq));
            if (_entries.Count > Capacity)
            {
                _entries.Dequeue();
            }
        }
    }

    // Clients poll with the last seq they saw, so each poll returns only what is new.
    public IReadOnlyList<ActivityEntry> After(long after)
    {
        lock (_gate)
        {
            var newer = _entries.Where(e => e.Seq > after).ToList();
            return newer.Skip(Math.Max(0, newer.Count - MaxPerRead)).ToList(); // the latest 50, oldest first
        }
    }
}
