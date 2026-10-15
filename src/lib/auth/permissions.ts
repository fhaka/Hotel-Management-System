import type { Role } from "@/generated/prisma/enums";

export const STAFF_ROLES: Role[] = ["ADMIN", "MANAGER", "RECEPTIONIST", "HOUSEKEEPING"];

const FRONT_OFFICE: Role[] = ["ADMIN", "MANAGER", "RECEPTIONIST"];
const MANAGEMENT: Role[] = ["ADMIN", "MANAGER"];

export const PERMISSIONS = {
  dashboard: FRONT_OFFICE,
  reservations: FRONT_OFFICE,
  frontDesk: FRONT_OFFICE,
  guests: FRONT_OFFICE,
  billing: FRONT_OFFICE,
  refunds: MANAGEMENT,
  messages: FRONT_OFFICE,
  reviews: FRONT_OFFICE,
  rooms: STAFF_ROLES,
  manageRooms: MANAGEMENT,
  housekeeping: STAFF_ROLES,
  services: FRONT_OFFICE,
  manageServices: MANAGEMENT,
  reports: MANAGEMENT,
  staff: ["ADMIN"] as Role[],
  settings: ["ADMIN"] as Role[],
  audit: MANAGEMENT,
} satisfies Record<string, Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role | undefined | null, permission: Permission) {
  return !!role && PERMISSIONS[permission].includes(role);
}

export function isStaff(role: Role | undefined | null) {
  return !!role && STAFF_ROLES.includes(role);
}

/** Where a user lands after signing in. */
export function homeFor(role: Role) {
  if (role === "GUEST") return "/account";
  if (role === "HOUSEKEEPING") return "/admin/housekeeping";
  return "/admin";
}

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrator",
  MANAGER: "Manager",
  RECEPTIONIST: "Receptionist",
  HOUSEKEEPING: "Housekeeping",
  GUEST: "Guest",
};
