import { PageHeader } from "@/components/page-header";
import { SubNav } from "@/components/sub-nav";
import { requireStaff } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";

export default async function RoomsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff("rooms");
  return (
    <>
      <PageHeader title="Rooms & rates" description="Inventory, room status, pricing, promotions and booking rules." />
      <SubNav
        items={[
          { href: "/admin/rooms", label: "Rooms" },
          ...(can(user.role, "manageRooms")
            ? [
                { href: "/admin/rooms/types", label: "Room types & rates" },
                { href: "/admin/rooms/seasons", label: "Seasonal pricing" },
                { href: "/admin/rooms/promotions", label: "Promotions" },
                { href: "/admin/rooms/rules", label: "Booking rules" },
              ]
            : []),
        ]}
      />
      {children}
    </>
  );
}
