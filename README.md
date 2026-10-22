# FlightBookingDemo

A flight-booking system with an ASP.NET Core 8 API, SQL Server and a React + TypeScript frontend. Agents sign in with JWT roles to book, confirm and cancel flights, and only admins can issue tickets. Each booking moves through a state machine (Pending, Confirmed, Ticketed, Cancelled), and a filtered unique index in SQL Server blocks duplicate bookings even under concurrent requests. A SQL Server trigger records every status change, and back-office reports run on a view, a table-valued function and a stored procedure. Fares are stored in CAD, and an exchange-rate endpoint calls a third-party API with timeouts, retries and caching. Travellers can look up their own booking on a public page backed by a rate-limited endpoint. To run it locally on Windows with SQL Server LocalDB, run `.\start-demo.ps1`.

## Screenshots

Customer booking lookup:

![Customer booking lookup](docs/screenshots/customer.png)

Agent view with a booking's status history:

![Bookings, agent view](docs/screenshots/bookings-agent.png)

Admin view, where Confirmed bookings can be ticketed:

![Bookings, admin view](docs/screenshots/bookings-admin.png)

Operations reports:

![Operations reports](docs/screenshots/operations.png)

A duplicate booking rejected with a 409:

![Duplicate booking error](docs/screenshots/duplicate-booking.png)

The API in Swagger:

![Swagger UI](docs/screenshots/swagger.png)
