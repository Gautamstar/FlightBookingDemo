namespace FlightBookingDemo.Models;

// One page of results plus what the client needs to show "page 2 of 7".
public record PagedResult<T>(List<T> Items, int Page, int PageSize, int TotalCount)
{
    public int TotalPages => (int)Math.Ceiling(TotalCount / (double)PageSize);
}
