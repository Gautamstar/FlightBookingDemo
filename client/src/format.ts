// Display helpers shared by several components.

export const money = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(amount);

// "2026-11-03" (C# DateOnly) shown as "Nov 03, 2026", read as a local date so it never shifts a day.
export const shortDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-CA", { day: "2-digit", month: "short", year: "numeric" });

// Trigger timestamps come back from SQL Server as UTC without a "Z"; read them as UTC.
export const dateTime = (iso: string) =>
  new Date(iso.endsWith("Z") ? iso : `${iso}Z`).toLocaleString("en-CA", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
