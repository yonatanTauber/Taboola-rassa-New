import { MedicalDocumentKind } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireCurrentUserId } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

const VALID_KINDS: MedicalDocumentKind[] = ["EVALUATION", "TEST_RESULT", "HOSPITAL_SUMMARY", "REFERRAL", "OTHER"];

export async function POST(req: Request) {
  const userId = await requireCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    patientId?: string;
    sessionId?: string;
    title?: string;
    filePath?: string;
    kind?: string;
    mimeType?: string;
    ocrText?: string;
  };

  const patientId = String(body.patientId ?? "").trim();
  const sessionId = String(body.sessionId ?? "").trim() || null;
  const title = String(body.title ?? "").trim();
  const filePath = String(body.filePath ?? "").trim();
  const kindRaw = String(body.kind ?? "OTHER").trim().toUpperCase();
  const kind: MedicalDocumentKind = VALID_KINDS.includes(kindRaw as MedicalDocumentKind)
    ? (kindRaw as MedicalDocumentKind)
    : "OTHER";
  const mimeType = String(body.mimeType ?? "").trim() || null;
  const ocrText = String(body.ocrText ?? "").trim() || null;

  if (!patientId) return NextResponse.json({ error: "חובה לציין מטופל" }, { status: 400 });
  if (!title) return NextResponse.json({ error: "חובה להזין כותרת" }, { status: 400 });
  if (!filePath) return NextResponse.json({ error: "חובה לציין נתיב קובץ" }, { status: 400 });

  const patient = await prisma.patient.findFirst({
    where: { id: patientId, ownerUserId: userId, archivedAt: null },
    select: { id: true },
  });
  if (!patient) return NextResponse.json({ error: "מטופל לא נמצא" }, { status: 404 });

  if (sessionId) {
    const session = await prisma.session.findFirst({
      where: { id: sessionId, patientId, patient: { ownerUserId: userId } },
      select: { id: true },
    });
    if (!session) return NextResponse.json({ error: "פגישה לא נמצאה" }, { status: 404 });
  }

  const doc = await prisma.medicalDocument.create({
    data: { patientId, sessionId, title, filePath, kind, mimeType, ocrText },
  });

  return NextResponse.json({ ok: true, doc });
}

export async function GET(req: Request) {
  const userId = await requireCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const patientId = searchParams.get("patientId") ?? "";

  const docs = await prisma.medicalDocument.findMany({
    where: {
      patient: { ownerUserId: userId },
      ...(patientId ? { patientId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ ok: true, docs });
}
