import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { PasswordForm, ProfileForm } from "./forms";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireUser("/account/profile");
  const guest = user.guest ? await db.guest.findUnique({ where: { id: user.guest.id } }) : null;
  const [first, ...rest] = user.name.split(" ");
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-border bg-white p-6">
        <h2 className="font-serif text-2xl text-primary">Personal details</h2>
        <p className="mt-1 text-sm text-muted-foreground">Used to pre-fill your bookings and on your invoices.</p>
        <ProfileForm
          values={{
            firstName: guest?.firstName ?? first ?? "",
            lastName: guest?.lastName ?? rest.join(" "),
            email: user.email,
            phone: guest?.phone ?? user.phone ?? "",
            country: guest?.country ?? "",
            city: guest?.city ?? "",
            address: guest?.address ?? "",
          }}
        />
      </section>
      <section className="self-start rounded-2xl border border-border bg-white p-6">
        <h2 className="font-serif text-2xl text-primary">Password</h2>
        <p className="mt-1 text-sm text-muted-foreground">Choose a strong password you don&apos;t use elsewhere.</p>
        <PasswordForm />
      </section>
    </div>
  );
}
