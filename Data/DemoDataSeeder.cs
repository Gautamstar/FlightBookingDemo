using FlightBookingDemo.Models;
using Microsoft.EntityFrameworkCore;

namespace FlightBookingDemo.Data;

// Development only: fills an empty database with realistic bookings so a demo never starts blank.
// Departure dates are relative to today, so reports like "unticketed in the next 30 days" always have data.
public static class DemoDataSeeder
{
    public static void Seed(AppDbContext db)
    {
        if (db.Bookings.Any())
        {
            return; // never touch a database that already has data
        }

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        Booking Make(string name, string flight, string from, string to, int daysOut, decimal fare, BookingStatus status) =>
            new()
            {
                PassengerName = name,
                FlightNumber = flight,
                Origin = from,
                Destination = to,
                DepartureDate = today.AddDays(daysOut),
                FareCad = fare,
                Status = status
            };

        db.Bookings.AddRange(
            Make("user1", "WS214", "YEG", "YHZ", 12, 489.99m, BookingStatus.Ticketed),
            Make("user2", "WS214", "YEG", "YHZ", 12, 489.99m, BookingStatus.Confirmed),
            Make("user3", "WS214", "YEG", "YHZ", 12, 489.99m, BookingStatus.Pending),
            Make("user4", "AC877", "YUL", "MAD", 5, 1180.00m, BookingStatus.Confirmed),
            Make("user5", "PD452", "YOW", "YWG", 19, 312.00m, BookingStatus.Pending),
            Make("user6", "AC1871", "YYC", "MEX", 8, 845.00m, BookingStatus.Ticketed),
            Make("user7", "F8611", "YXE", "YLW", 26, 205.00m, BookingStatus.Pending),
            Make("user8", "WS2702", "YQB", "CUN", 40, 960.00m, BookingStatus.Confirmed),
            Make("user9", "AC8455", "YQR", "YXU", 15, 398.00m, BookingStatus.Cancelled),
            Make("user10", "TS130", "YHZ", "LIS", 33, 1050.00m, BookingStatus.Ticketed));

        db.SaveChanges(); // the audit trigger records each new booking in BookingStatusChanges
    }
}
