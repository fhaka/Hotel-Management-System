import { PageHeader } from "@/components/page-header";
import { SubNav } from "@/components/sub-nav";
import { requireStaff } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";

export default async function RoomsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff("rooms");
  return (
    <>
      <PageHeader title="Rooms & rates" description="Inventory, room status, pricing and seasons." />
      <SubNav
        items={[
          { href: "/admin/rooms", label: "Rooms" },
          ...(can(user.role, "manageRooms")
            ? [
                { href: "/admin/rooms/types", label: "Room types & rates" },
                { href: "/admin/rooms/seasons", label: "Seasonal pricing" },
              ]
            : []),
        ]}
      />
      {children}
    </>
  );
}
