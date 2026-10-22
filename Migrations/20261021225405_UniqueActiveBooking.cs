using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FlightBookingDemo.Migrations
{
    /// <inheritdoc />
    public partial class UniqueActiveBooking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_Bookings_PassengerName_FlightNumber_DepartureDate",
                table: "Bookings",
                columns: new[] { "PassengerName", "FlightNumber", "DepartureDate" },
                unique: true,
                filter: "[Status] <> 'Cancelled'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Bookings_PassengerName_FlightNumber_DepartureDate",
                table: "Bookings");
        }
    }
}
