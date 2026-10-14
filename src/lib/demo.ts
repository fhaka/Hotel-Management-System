// Demo-mode helpers. Set DEMO_MODE="false" in production to hide demo shortcuts.
export const DEMO_PASSWORD = "Imperial2026!";

export const DEMO_ACCOUNTS = [
  { email: "admin@hotelimperial.al", role: "Administrator", description: "Full access incl. staff & settings" },
  { email: "manager@hotelimperial.al", role: "Manager", description: "Operations, rates & reports" },
  { email: "reception@hotelimperial.al", role: "Receptionist", description: "Front desk & reservations" },
  { email: "housekeeping@hotelimperial.al", role: "Housekeeping", description: "Room status & tasks" },
  { email: "guest@example.com", role: "Guest", description: "Website guest account" },
] as const;

export function isDemoMode() {
  return process.env.DEMO_MODE !== "false";
}
