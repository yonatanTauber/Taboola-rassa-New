import { NextResponse } from "next/server";
import { requireCurrentUserId } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const userId = await requireCurrentUserId();
  if (!userId) return NextResponse.json({ sessions: [] }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const patientId = searchParams.get("patientId")?.trim() ?? "";
  if (!patientId) return NextResponse.json({ sessions: [] });

  const sessions = await prisma.session.findMany({
    where: {
      patientId,
      patient: { archivedAt: null, ownerUserId: userId },
      feeNis: { not: null },
      status: { in: ["COMPLETED", "CANCELED_LATE"] },
    },
    include: {
      paymentAllocations: true,
    },
    orderBy: { scheduledAt: "asc" },
    take: 500,
  });

  const rows = sessions
    .map((session) => {
      const fee = session.feeNis ?? 0;
      const paid = session.paymentAllocations.reduce((sum, p) => sum + p.amountNis, 0);
      const outstanding = Math.max(0, fee - paid);
      return {
        id: session.id,
        scheduledAt: session.scheduledAt.toISOString(),
        feeNis: fee,
        paidNis: paid,
        outstandingNis: outstanding,
      };
    })
    .filter((session) => session.outstandingNis > 0);

  return NextResponse.json({ sessions: rows });
}
