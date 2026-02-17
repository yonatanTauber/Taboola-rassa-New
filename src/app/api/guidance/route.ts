import { GuidanceStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireCurrentUserId } from "@/lib/auth-server";
import { syncGuidanceExpense } from "@/lib/guidance-expense";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const userId = await requireCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = normalizeStatus(searchParams.get("status"));
  const patientId = (searchParams.get("patientId") ?? "").trim();
  const instructorId = (searchParams.get("instructorId") ?? "").trim();

  const guidances = await prisma.guidance.findMany({
    where: {
      patient: { ownerUserId: userId },
      ...(status ? { status } : {}),
      ...(patientId ? { patientId } : {}),
      ...(instructorId ? { instructorId } : {}),
    },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true } },
      instructor: { select: { id: true, fullName: true } },
      sessions: {
        include: {
          session: {
            select: {
              id: true,
              scheduledAt: true,
              status: true,
            },
          },
        },
        orderBy: { session: { scheduledAt: "desc" } },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 300,
  });

  return NextResponse.json({
    ok: true,
    guidances: guidances.map((item) => ({
      id: item.id,
      title: item.title,
      scheduledAt: item.scheduledAt,
      status: item.status,
      feeNis: item.feeNis,
      completedAt: item.completedAt,
      updatedAt: item.updatedAt,
      patient: item.patient,
      instructor: item.instructor,
      sessions: item.sessions.map((link) => ({
        id: link.session.id,
        scheduledAt: link.session.scheduledAt,
        status: link.session.status,
      })),
    })),
  });
}

export async function POST(req: Request) {
  const userId = await requireCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const patientId = String(body.patientId ?? "").trim();
  const instructorId = String(body.instructorId ?? "").trim();
  const title = String(body.title ?? "").trim() || "הדרכה ללא כותרת";
  const status = normalizeStatus(body.status) ?? GuidanceStatus.ACTIVE;
  const feeNis = parseFee(body.feeNis);
  const scheduledAt = parseDate(body.scheduledAt);
  const sessionIds = parseSessionIds(body.sessionIds);

  if (!patientId) {
    return NextResponse.json({ error: "Missing patientId" }, { status: 400 });
  }

  const patient = await prisma.patient.findFirst({
    where: { id: patientId, ownerUserId: userId },
    select: { id: true },
  });
  if (!patient) return NextResponse.json({ error: "Patient not found" }, { status: 404 });

  if (instructorId) {
    const instructor = await prisma.instructor.findFirst({
      where: { id: instructorId, ownerUserId: userId },
      select: { id: true },
    });
    if (!instructor) {
      return NextResponse.json({ error: "Instructor not found" }, { status: 404 });
    }
  }

  if (sessionIds.length > 0) {
    const validCount = await prisma.session.count({
      where: {
        id: { in: sessionIds },
        patientId,
        patient: { ownerUserId: userId },
      },
    });
    if (validCount !== sessionIds.length) {
      return NextResponse.json({ error: "Invalid session links" }, { status: 400 });
    }
  }

  const completedAt = status === GuidanceStatus.COMPLETED ? parseDate(body.completedAt) ?? new Date() : null;

  const created = await prisma.guidance.create({
    data: {
      patientId,
      instructorId: instructorId || null,
      title,
      contentMarkdown: "",
      notesMarkdown: "",
      status,
      feeNis,
      completedAt,
      ...(scheduledAt ? { scheduledAt } : {}),
      sessions: sessionIds.length
        ? {
            create: sessionIds.map((sessionId) => ({ sessionId })),
          }
        : undefined,
    },
    include: {
      instructor: { select: { fullName: true } },
    },
  });

  await syncGuidanceExpense({
    id: created.id,
    title: created.title,
    feeNis: created.feeNis,
    status: created.status,
    completedAt: created.completedAt,
    instructorName: created.instructor?.fullName ?? null,
  });

  return NextResponse.json({ ok: true, guidanceId: created.id, updatedAt: created.updatedAt });
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
