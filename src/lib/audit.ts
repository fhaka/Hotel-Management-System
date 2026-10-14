import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export async function audit(
  entry: { userId?: string | null; action: string; entity: string; entityId?: string | null; summary: string },
  client: Prisma.TransactionClient | typeof db = db,
) {
  await client.auditLog.create({
    data: {
      userId: entry.userId ?? null,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      summary: entry.summary,
    },
  });
}
