import type { Permission } from "@/lib/auth/permissions";

export type NavItem = { href: string; label: string; icon: string; permission: Permission };
export type NavGroup = { label: string; items: NavItem[] };

export const NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/admin", label: "Dashboard", icon: "LayoutDashboard", permission: "dashboard" },
      { href: "/admin/calendar", label: "Room calendar", icon: "CalendarRange", permission: "reservations" },
    ],
  },
  {
    label: "Front office",
    items: [
      { href: "/admin/front-desk", label: "Front desk", icon: "ConciergeBell", permission: "frontDesk" },
      { href: "/admin/reservations", label: "Reservations", icon: "BookOpenCheck", permission: "reservations" },
      { href: "/admin/guests", label: "Guests", icon: "Users", permission: "guests" },
      { href: "/admin/companies", label: "Companies", icon: "Building2", permission: "guests" },
      { href: "/admin/messages", label: "Messages", icon: "Inbox", permission: "messages" },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/admin/rooms", label: "Rooms & rates", icon: "BedDouble", permission: "rooms" },
      { href: "/admin/housekeeping", label: "Housekeeping", icon: "Sparkles", permission: "housekeeping" },
      { href: "/admin/services", label: "Services", icon: "Wine", permission: "services" },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/admin/billing", label: "Billing", icon: "Receipt", permission: "billing" },
      { href: "/admin/reports", label: "Reports", icon: "ChartColumnBig", permission: "reports" },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/admin/staff", label: "Staff", icon: "UserCog", permission: "staff" },
      { href: "/admin/activity", label: "Activity log", icon: "History", permission: "audit" },
      { href: "/admin/settings", label: "Settings", icon: "Settings", permission: "settings" },
    ],
  },
];
