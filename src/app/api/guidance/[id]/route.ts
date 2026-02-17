import { unlink } from "node:fs/promises";
import path from "node:path";
import { GuidanceStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireCurrentUserId } from "@/lib/auth-server";
import { syncGuidanceExpense } from "@/lib/guidance-expense";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const guidance = await prisma.guidance.findFirst({
    where: { id, patient: { ownerUserId: userId } },
    include: {
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      instructor: {
        select: {
          id: true,
          fullName: true,
          phone: true,
          email: true,
        },
      },
      sessions: {
        include: {
          session: {
            select: {
              id: true,
              status: true,
              scheduledAt: true,
              location: true,
            },
          },
        },
        orderBy: { session: { scheduledAt: "desc" } },
      },
    },
  });

  if (!guidance) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    guidance: {
      id: guidance.id,
      title: guidance.title,
      scheduledAt: guidance.scheduledAt,
      contentMarkdown: guidance.contentMarkdown,
      notesMarkdown: guidance.notesMarkdown,
      status: guidance.status,
      feeNis: guidance.feeNis,
      completedAt: guidance.completedAt,
      attachmentFilePath: guidance.attachmentFilePath,
      attachmentFileName: guidance.attachmentFileName,
      attachmentMimeType: guidance.attachmentMimeType,
      updatedAt: guidance.updatedAt,
      patient: guidance.patient,
      instructor: guidance.instructor,
      sessions: guidance.sessions.map((item) => item.session),
    },
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const existing = await prisma.guidance.findFirst({
      where: { id, patient: { ownerUserId: userId } },
      select: {
        id: true,
        patientId: true,
        status: true,
        completedAt: true,
      },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await req.json();
    const patchData: {
      title?: string;
      scheduledAt?: Date | null;
      contentMarkdown?: string;
      notesMarkdown?: string;
      status?: GuidanceStatus;
      feeNis?: number | null;
      completedAt?: Date | null;
      instructorId?: string | null;
    } = {};

    if (typeof body.title === "string") {
      patchData.title = body.title.trim() || "הדרכה ללא כותרת";
    }
    if (body.scheduledAt !== undefined) {
      if (body.scheduledAt === null || body.scheduledAt === "") {
        patchData.scheduledAt = null;
      } else {
        const parsed = parseDate(body.scheduledAt);
        if (parsed) patchData.scheduledAt = parsed;
      }
    }
    if (typeof body.contentMarkdown === "string") {
      patchData.contentMarkdown = body.contentMarkdown;
    }
    if (typeof body.notesMarkdown === "string") {
      patchData.notesMarkdown = body.notesMarkdown;
    }
    if (body.feeNis !== undefined) {
      patchData.feeNis = parseFee(body.feeNis);
    }

    if (body.instructorId !== undefined) {
      const rawInstructorId = String(body.instructorId ?? "").trim();
      if (!rawInstructorId) {
        patchData.instructorId = null;
      } else {
        const instructor = await prisma.instructor.findFirst({
          where: { id: rawInstructorId, ownerUserId: userId },
          select: { id: true },
        });
        if (!instructor) {
          return NextResponse.json({ error: "Instructor not found" }, { status: 404 });
        }
        patchData.instructorId = instructor.id;
      }
    }

    const nextStatus = normalizeStatus(body.status) ?? existing.status;
    patchData.status = nextStatus;
    patchData.completedAt = resolveCompletedAt({
      nextStatus,
      existingCompletedAt: existing.completedAt,
      rawCompletedAt: body.completedAt,
    });

    const sessionIds = body.sessionIds !== undefined ? parseSessionIds(body.sessionIds) : null;
    if (sessionIds) {
      const validCount = await prisma.session.count({
        where: {
          id: { in: sessionIds },
          patientId: existing.patientId,
          patient: { ownerUserId: userId },
        },
      });
      if (validCount !== sessionIds.length) {
        return NextResponse.json({ error: "Invalid session links" }, { status: 400 });
      }
    }

    const runUpdate = async (data: typeof patchData) =>
      prisma.$transaction(async (tx) => {
        if (sessionIds) {
          await tx.guidanceSession.deleteMany({ where: { guidanceId: id } });
          if (sessionIds.length > 0) {
            for (const sessionId of sessionIds) {
              await tx.guidanceSession.create({
                data: {
                  guidanceId: id,
                  sessionId,
                },
              });
            }
          }
        }

        return tx.guidance.update({
          where: { id },
          data,
          include: {
            instructor: { select: { fullName: true } },
          },
        });
      });

    let updated;
    try {
      updated = await runUpdate(patchData);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "";
      if (msg.includes("Unknown argument `scheduledAt`") && "scheduledAt" in patchData) {
        const fallbackData = { ...patchData };
        delete fallbackData.scheduledAt;
        updated = await runUpdate(fallbackData);
      } else {
        throw error;
      }
    }

    await syncGuidanceExpense({
      id: updated.id,
      title: updated.title,
      feeNis: updated.feeNis,
      status: updated.status,
      completedAt: updated.completedAt,
      instructorName: updated.instructor?.fullName ?? null,
    });

    return NextResponse.json({
      ok: true,
      guidanceId: updated.id,
      updatedAt: updated.updatedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update guidance";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const existing = await prisma.guidance.findFirst({
    where: { id, patient: { ownerUserId: userId } },
    select: {
      id: true,
      attachmentFilePath: true,
    },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.$transaction([
    prisma.expense.deleteMany({ where: { guidanceId: id } }),
    prisma.guidance.delete({ where: { id } }),
  ]);

  await deleteStoredAttachment(existing.attachmentFilePath);

  return NextResponse.json({ ok: true, deleted: true });
}

function normalizeStatus(value: unknown): GuidanceStatus | null {
  if (value === GuidanceStatus.ACTIVE) return GuidanceStatus.ACTIVE;
  if (value === GuidanceStatus.COMPLETED) return GuidanceStatus.COMPLETED;
  return null;
}

function parseSessionIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item ?? "").trim()).filter(Boolean))];
}

function parseFee(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.trunc(parsed);
}

function parseDate(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function resolveCompletedAt({
  nextStatus,
  existingCompletedAt,
  rawCompletedAt,
}: {
  nextStatus: GuidanceStatus;
  existingCompletedAt: Date | null;
  rawCompletedAt: unknown;
}) {
  if (nextStatus === GuidanceStatus.ACTIVE) return null;
  if (rawCompletedAt !== undefined) {
    return parseDate(rawCompletedAt) ?? new Date();
  }
  return existingCompletedAt ?? new Date();
}

async function deleteStoredAttachment(filePath: string | null) {
  if (!filePath) return;
  if (!filePath.startsWith("/uploads/guidance/")) return;
  const fileName = path.basename(filePath);
  const absolutePath = path.join(process.cwd(), "public", "uploads", "guidance", fileName);
  try {
    await unlink(absolutePath);
  } catch {
    // Ignore file-system cleanup failures after DB deletion.
  }
}
