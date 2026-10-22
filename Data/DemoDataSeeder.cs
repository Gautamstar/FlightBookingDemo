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
            Make("Wei Chen", "AC25", "YYZ", "PVG", 12, 1249.99m, BookingStatus.Ticketed),
            Make("Mei Zhang", "AC25", "YYZ", "PVG", 12, 1249.99m, BookingStatus.Confirmed),
            Make("Tom Ho", "AC25", "YYZ", "PVG", 12, 1249.99m, BookingStatus.Pending),
            Make("Kevin Lau", "CX829", "YYZ", "HKG", 5, 1580.00m, BookingStatus.Confirmed),
            Make("Ivy Tan", "CX829", "YYZ", "HKG", 19, 1620.00m, BookingStatus.Pending),
            Make("Grace Liu", "AC7", "YVR", "PEK", 8, 1100.00m, BookingStatus.Ticketed),
            Make("Jun Park", "AC63", "YYZ", "ICN", 26, 1350.00m, BookingStatus.Pending),
            Make("Amy Wong", "CX889", "YVR", "HKG", 40, 1450.00m, BookingStatus.Confirmed),
            Make("Leo Chan", "BR35", "YVR", "TPE", 15, 1190.00m, BookingStatus.Cancelled),
            Make("Sara Lin", "AC1", "YYZ", "NRT", 33, 1399.00m, BookingStatus.Ticketed));

        db.SaveChanges(); // the audit trigger records each new booking in BookingStatusChanges
    }
}
