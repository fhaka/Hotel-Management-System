import "server-only";
import { z } from "zod";
import { BookingError } from "@/lib/reservations";

export type ActionState = { error?: string; success?: string; fieldErrors?: Record<string, string[] | undefined> } | null;

/** Runs a mutation and converts known, user-safe errors into an action state. */
export async function attempt(fn: () => Promise<string | void>): Promise<ActionState> {
  try {
    const message = await fn();
    return { success: message || "Saved." };
  } catch (e) {
    if (e instanceof BookingError) return { error: e.message };
    if (e instanceof z.ZodError) {
      const first = e.issues[0];
      const field = first?.path.join(".");
      return { error: first ? `${field ? `${field}: ` : ""}${first.message}` : "Please check the form." };
    }
    if (e instanceof Error && e.message.startsWith("You do not have permission")) return { error: e.message };
    // Next.js control flow (redirect/notFound) must propagate.
    if (e && typeof e === "object" && "digest" in e) throw e;
    console.error(e);
    return { error: "Something went wrong. Please try again." };
  }
}

export const formObject = (formData: FormData) => Object.fromEntries([...formData.keys()].map((k) => [k, formData.getAll(k).length > 1 ? formData.getAll(k) : formData.get(k)]));
