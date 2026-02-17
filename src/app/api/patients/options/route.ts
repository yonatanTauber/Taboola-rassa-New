import { NextResponse } from "next/server";
import { requireCurrentUserId } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { formatPatientName } from "@/lib/patient-name";

export async function GET() {
  const userId = await requireCurrentUserId();
  if (!userId) return NextResponse.json({ patients: [] }, { status: 401 });
  const patients = await prisma.patient.findMany({
    where: { archivedAt: null, ownerUserId: userId },
    select: { id: true, firstName: true, lastName: true, defaultSessionFeeNis: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    take: 500,
  });

  return NextResponse.json({
    patients: patients.map((p) => ({
      id: p.id,
      name: formatPatientName(p.firstName, p.lastName),
      defaultSessionFeeNis: p.defaultSessionFeeNis,
    })),
  });
}
