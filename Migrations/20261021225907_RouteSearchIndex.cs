using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FlightBookingDemo.Migrations
{
    /// <inheritdoc />
    public partial class RouteSearchIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_Bookings_Origin_Destination_DepartureDate",
                table: "Bookings",
                columns: new[] { "Origin", "Destination", "DepartureDate" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Bookings_Origin_Destination_DepartureDate",
                table: "Bookings");
        }
    }
}
