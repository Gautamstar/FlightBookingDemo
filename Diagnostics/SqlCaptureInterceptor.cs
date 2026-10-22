using System.Data.Common;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace FlightBookingDemo.Diagnostics;

// DEMO / DEBUG FEATURE (Development only). Records every command EF Core sends to SQL Server.
// Only CommandText is kept: it holds parameter names (@p0, @__id_0), never their values, so
// passenger names and other request data never reach the feed.
// Singleton: it holds no per-request state, it finds the current request through the accessor.
public class SqlCaptureInterceptor : DbCommandInterceptor
{
    private readonly IHttpContextAccessor _accessor;

    public SqlCaptureInterceptor(IHttpContextAccessor accessor)
    {
        _accessor = accessor;
    }

    private void Record(DbCommand command, TimeSpan duration) =>
        RequestActivity.Current(_accessor)?.AddSql(
            new SqlCommandEntry(command.CommandText, Math.Round(duration.TotalMilliseconds, 2)));

    public override DbDataReader ReaderExecuted(DbCommand command, CommandExecutedEventData eventData, DbDataReader result)
    {
        Record(command, eventData.Duration);
        return result;
    }

    public override ValueTask<DbDataReader> ReaderExecutedAsync(DbCommand command, CommandExecutedEventData eventData,
        DbDataReader result, CancellationToken cancellationToken = default)
    {
        Record(command, eventData.Duration);
        return ValueTask.FromResult(result);
    }

    public override int NonQueryExecuted(DbCommand command, CommandExecutedEventData eventData, int result)
    {
        Record(command, eventData.Duration);
        return result;
    }

    public override ValueTask<int> NonQueryExecutedAsync(DbCommand command, CommandExecutedEventData eventData,
        int result, CancellationToken cancellationToken = default)
    {
        Record(command, eventData.Duration);
        return ValueTask.FromResult(result);
    }

    public override object? ScalarExecuted(DbCommand command, CommandExecutedEventData eventData, object? result)
    {
        Record(command, eventData.Duration);
        return result;
    }

    public override ValueTask<object?> ScalarExecutedAsync(DbCommand command, CommandExecutedEventData eventData,
        object? result, CancellationToken cancellationToken = default)
    {
        Record(command, eventData.Duration);
        return ValueTask.FromResult(result);
    }

    // Failed commands too (a unique-index violation, say): those are often the interesting ones.
    public override void CommandFailed(DbCommand command, CommandErrorEventData eventData)
    {
        Record(command, eventData.Duration);
    }

    public override Task CommandFailedAsync(DbCommand command, CommandErrorEventData eventData,
        CancellationToken cancellationToken = default)
    {
        Record(command, eventData.Duration);
        return Task.CompletedTask;
    }
}
