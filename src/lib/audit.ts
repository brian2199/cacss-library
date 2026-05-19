import type { AuditAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function auditLog(params: {
  actorId: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  summary: string;
  payload?: Record<string, unknown>;
}) {
  await prisma.auditLog.create({
    data: {
      actorId: params.actorId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      summary: params.summary,
      payload: params.payload as never,
    },
  });
}
