"use server";

import { revalidatePath } from "next/cache";
import { attempt, type ActionState } from "@/lib/actions";
import { assertPermission } from "@/lib/auth/dal";
import { db } from "@/lib/db";

export async function toggleMessageAction(id: string, handled: boolean): Promise<ActionState> {
  return attempt(async () => {
    await assertPermission("messages");
    await db.contactMessage.update({ where: { id }, data: { handled } });
    revalidatePath("/admin", "layout");
    return handled ? "Marked as handled." : "Reopened.";
  });
}
