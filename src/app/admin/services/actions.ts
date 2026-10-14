"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { attempt, type ActionState } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { assertPermission } from "@/lib/auth/dal";
import { db } from "@/lib/db";

const schema = z.object({
  name: z.string().trim().min(2, "Name is required").max(80),
  category: z.enum(["DINING", "SPA", "ROOM_SERVICE", "MINIBAR", "LAUNDRY", "TRANSPORT", "OTHER"]),
  description: z.string().trim().max(300),
  price: z.coerce.number().min(0, "Price cannot be negative").max(100_000),
  unit: z.string().trim().min(1).max(30),
  bookable: z.string().optional(),
  perNight: z.string().optional(),
  perGuest: z.string().optional(),
  active: z.string().optional(),
});

export async function saveServiceAction(id: string | null, _: ActionState, formData: FormData): Promise<ActionState> {
  return attempt(async () => {
    const user = await assertPermission("manageServices");
    const d = schema.parse(Object.fromEntries(formData));
    const data = {
      name: d.name,
      category: d.category,
      description: d.description || null,
      price: d.price,
      unit: d.unit,
      bookable: d.bookable === "on",
      perNight: d.perNight === "on",
      perGuest: d.perGuest === "on",
      active: id ? d.active === "on" : true,
    };
    const s = id ? await db.service.update({ where: { id }, data }) : await db.service.create({ data });
    await audit({ userId: user.id, action: id ? "service.update" : "service.create", entity: "Service", entityId: s.id, summary: `${id ? "Updated" : "Added"} service ${s.name} (€${d.price})` });
    revalidatePath("/", "layout");
    return `${s.name} saved.`;
  });
}
