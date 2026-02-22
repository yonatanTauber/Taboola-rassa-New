import { NextResponse } from "next/server";
import { requireCurrentUserId } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

type AllocationInput = {
  sessionId: string;
  amountNis: number;
};

async function generateReceiptNumber() {
  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const suffix = Math.floor(Math.random() * 100_000)
      .toString()
      .padStart(5, "0");
    const candidate = `RC-${year}-${suffix}`;
    const exists = await prisma.receipt.findUnique({
      where: { receiptNumber: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
  }
  return `RC-${year}-${Date.now()}`;
}

export async function POST(req: Request) {
  const userId = await requireCurrentUserId();
  if (!userId) return NextResponse.json({ error: "נדרשת התחברות." }, { status: 401 });
  const body = await req.json();
  const patientId = String(body.patientId ?? "").trim();
  const allocationsRaw = Array.isArray(body.allocations) ? body.allocations : [];

  if (!patientId || allocationsRaw.length === 0) {
    return NextResponse.json({ error: "חסרים נתונים להפקת קבלה." }, { status: 400 });
  }
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, ownerUserId: userId, archivedAt: null },
    select: { id: true },
  });
  if (!patient) {
    return NextResponse.json({ error: "לא ניתן להפיק קבלה למטופל לא פעיל או לא קיים." }, { status: 400 });
  }

  const allocations: AllocationInput[] = allocationsRaw
    .map((item: unknown) => {
      const row = item as { sessionId?: unknown; amountNis?: unknown };
      return {
        sessionId: String(row.sessionId ?? "").trim(),
        amountNis: Number(row.amountNis ?? 0),
      };
    })
    .filter((item: AllocationInput) => item.sessionId && Number.isFinite(item.amountNis) && item.amountNis > 0);

  if (allocations.length === 0) {
    return NextResponse.json({ error: "לא נמצאו הקצאות תקינות לקבלה." }, { status: 400 });
  }
  const sessionsCount = await prisma.session.count({
    where: {
      id: { in: allocations.map((a) => a.sessionId) },
      patientId,
      patient: { ownerUserId: userId, archivedAt: null },
    },
  });
  if (sessionsCount !== allocations.length) {
    return NextResponse.json({ error: "רשימת ההקצאות אינה תקינה." }, { status: 400 });
  }

  const amountNis = allocations.reduce((sum, item) => sum + item.amountNis, 0);
  const receiptNumber = await generateReceiptNumber();

  const receipt = await prisma.receipt.create({
    data: {
      patientId,
      receiptNumber,
      amountNis,
      paymentAllocations: {
        create: allocations.map((item) => ({
          sessionId: item.sessionId,
          amountNis: item.amountNis,
        })),
      },
    },
  });

  return NextResponse.json({ ok: true, receiptId: receipt.id, receiptNumber: receipt.receiptNumber });
}
