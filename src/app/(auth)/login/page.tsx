import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { homeFor } from "@/lib/auth/permissions";
import { DEMO_ACCOUNTS, DEMO_PASSWORD, isDemoMode } from "@/lib/demo";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [{ next }, user] = await Promise.all([searchParams, getCurrentUser()]);
  if (user) redirect(homeFor(user.role));

  return (
    <div className="w-full max-w-md">
      <h1 className="font-serif text-3xl text-primary">Welcome back</h1>
      <p className="mt-2 text-sm text-muted-foreground">Sign in to your Hotel Imperial account.</p>
      <LoginForm next={next} demo={isDemoMode() ? { accounts: [...DEMO_ACCOUNTS], password: DEMO_PASSWORD } : null} />
      <p className="mt-8 text-center text-sm text-muted-foreground">
        New to Hotel Imperial?{" "}
        <Link href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"} className="font-medium text-primary underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
      <p className="mt-3 text-center text-sm">
        <Link href="/" className="text-muted-foreground hover:text-primary">
          ← Back to the website
        </Link>
      </p>
    </div>
  );
}
