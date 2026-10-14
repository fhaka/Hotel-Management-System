import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Avatar, Badge, Card, Table, Td, Th } from "@/components/ui/primitives";
import { requireStaff } from "@/lib/auth/dal";
import { ROLE_LABELS, STAFF_ROLES } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/dates";
import { EditStaffDialog, NewStaffDialog, ResetPasswordDialog } from "./dialogs";

export const metadata: Metadata = { title: "Staff" };

const ROLE_TONE = { ADMIN: "dark", MANAGER: "gold", RECEPTIONIST: "info", HOUSEKEEPING: "success", GUEST: "neutral" } as const;

export default async function StaffPage() {
  const me = await requireStaff("staff");
  const [staff, guestAccounts] = await Promise.all([
    db.user.findMany({ where: { role: { in: STAFF_ROLES } }, orderBy: [{ active: "desc" }, { role: "asc" }, { name: "asc" }] }),
    db.user.count({ where: { role: "GUEST" } }),
  ]);
  return (
    <>
      <PageHeader title="Staff" description={`${staff.filter((s) => s.active).length} active staff accounts · ${guestAccounts} guest website accounts`} actions={<NewStaffDialog />} />
      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Role</Th>
              <Th>Phone</Th>
              <Th>Last sign-in</Th>
              <Th>Status</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id} className={s.active ? "" : "opacity-60"}>
                <Td>
                  <div className="flex items-center gap-3">
                    <Avatar name={s.name} />
                    <div>
                      <p className="font-medium">{s.name} {s.id === me.id && <span className="text-xs text-muted-foreground">(you)</span>}</p>
                      <p className="text-xs text-muted-foreground">{s.email}</p>
                    </div>
                  </div>
                </Td>
                <Td><Badge tone={ROLE_TONE[s.role]}>{ROLE_LABELS[s.role]}</Badge></Td>
                <Td className="text-muted-foreground">{s.phone ?? "—"}</Td>
                <Td className="text-muted-foreground">{s.lastLoginAt ? formatDateTime(s.lastLoginAt) : "Never"}</Td>
                <Td>{s.active ? <Badge tone="success" dot>Active</Badge> : <Badge dot>Deactivated</Badge>}</Td>
                <Td>
                  <div className="flex justify-end gap-1">
                    <ResetPasswordDialog id={s.id} name={s.name} />
                    <EditStaffDialog user={{ id: s.id, name: s.name, phone: s.phone ?? "", role: s.role, active: s.active }} />
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      <Card className="mt-6 p-5">
        <p className="text-sm font-medium">Role permissions</p>
        <div className="mt-3 grid gap-4 text-sm text-muted-foreground sm:grid-cols-2 xl:grid-cols-4">
          <p><span className="font-medium text-foreground">Administrator</span> — everything, including staff accounts and hotel settings.</p>
          <p><span className="font-medium text-foreground">Manager</span> — operations, rates, seasons, services, refunds and reports.</p>
          <p><span className="font-medium text-foreground">Receptionist</span> — reservations, front desk, guests, billing and messages.</p>
          <p><span className="font-medium text-foreground">Housekeeping</span> — room status and housekeeping tasks.</p>
        </div>
      </Card>
    </>
  );
}
