import { prisma } from "@/lib/prisma";

export type AuditAction =
  | "LOGIN"
  | "LOGIN_FAILED"
  | "LOGOUT"
  | "VIEW_PATIENT"
  | "CREATE_PATIENT"
  | "EDIT_PATIENT"
  | "DELETE_PATIENT"
  | "VIEW_SESSION"
  | "CREATE_SESSION"
  | "EDIT_SESSION"
  | "DELETE_SESSION"
  | "DOCUMENT_UPLOAD"
  | "DOCUMENT_VIEW"
  | "DOCUMENT_DELETE";

function getIp(req: Request): string | null {
  const forwarded = (req.headers as Headers).get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return null;
}

function getUserAgent(req: Request): string | null {
  return (req.headers as Headers).get("user-agent") ?? null;
}

export async function logAudit(params: {
  action: AuditAction;
  userId?: string | null;
  resourceId?: string;
  resourceType?: string;
  req?: Request;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: params.action,
        userId: params.userId ?? null,
        resourceId: params.resourceId ?? null,
        resourceType: params.resourceType ?? null,
        ipAddress: params.req ? getIp(params.req) : null,
        userAgent: params.req ? getUserAgent(params.req) : null,
      },
    });
  } catch {
    // לא לשבור את הבקשה הראשית בגלל כישלון ב-audit log
  }
}
