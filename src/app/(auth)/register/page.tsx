import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { homeFor } from "@/lib/auth/permissions";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [{ next }, user] = await Promise.all([searchParams, getCurrentUser()]);
  if (user) redirect(homeFor(user.role));

  return (
    <div className="w-full max-w-md">
      <h1 className="font-serif text-3xl text-primary">Create your account</h1>
      <p className="mt-2 text-sm text-muted-foreground">Book faster, manage your stays and download invoices anytime.</p>
      <RegisterForm next={next} />
      <p className="mt-8 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-medium text-primary underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
