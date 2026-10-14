"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { attempt, type ActionState } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { assertPermission } from "@/lib/auth/dal";
import { db } from "@/lib/db";

const time = z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM");

export async function saveSettingsAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return attempt(async () => {
    const user = await assertPermission("settings");
    const d = z
      .object({
        name: z.string().trim().min(2).max(80),
        legalName: z.string().trim().min(2).max(120),
        taxId: z.string().trim().min(2).max(40),
        email: z.email().trim(),
        phone: z.string().trim().min(5).max(30),
        address: z.string().trim().min(2).max(160),
        city: z.string().trim().min(2).max(80),
        country: z.string().trim().min(2).max(80),
        vatRate: z.coerce.number().min(0).max(50),
        cityTaxPerPersonNight: z.coerce.number().min(0).max(100),
        checkInTime: time,
        checkOutTime: time,
        freeCancellationHours: z.coerce.number().int().min(0).max(720),
      })
      .parse(Object.fromEntries(formData));
    await db.hotelSettings.update({ where: { id: 1 }, data: d });
    await audit({ userId: user.id, action: "settings.update", entity: "HotelSettings", entityId: "1", summary: `Updated hotel settings (VAT ${d.vatRate}%, city tax €${d.cityTaxPerPersonNight}, cancellation ${d.freeCancellationHours}h)` });
    revalidatePath("/", "layout");
    return "Settings saved.";
  });
}
