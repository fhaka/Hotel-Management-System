import Link from "next/link";
import { requireUser } from "@/lib/auth/dal";
import { logout } from "@/app/(auth)/actions";
import { AccountNav } from "./account-nav";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/account");
  return (
    <div className="min-h-[70vh] bg-ivory pb-24 pt-28">
      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="eyebrow">My account</p>
            <h1 className="mt-2 font-serif text-4xl text-primary">Welcome, {user.name.split(" ")[0]}</h1>
          </div>
          <form action={logout}>
            <button className="cursor-pointer text-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline">Sign out</button>
          </form>
        </div>
        {user.role !== "GUEST" && (
          <p className="mt-4 rounded-lg border border-info/20 bg-info-soft px-4 py-3 text-sm text-info">
            You are signed in with a staff account.{" "}
            <Link href="/admin" className="font-medium underline">
              Open the operations dashboard
            </Link>
          </p>
        )}
        <AccountNav />
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
