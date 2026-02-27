import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUserId } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

export interface SearchResult {
  type: "patient" | "session" | "note" | "task" | "guidance" | "research" | "receipt";
  id: string;
  title: string;
  subtitle?: string;
  href: string;
}

export async function GET(req: NextRequest) {
  const userId = await requireCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  const take = 8;
  const results: SearchResult[] = [];

  // Run all searches in parallel
  const [patients, tasks, guidances, researchDocs, researchNotes, patientNotes] = await Promise.all([
    // Patients
    prisma.patient.findMany({
      where: {
        ownerUserId: userId,
        archivedAt: null,
        OR: [
          { firstName: { contains: q } },
          { lastName: { contains: q } },
          { phone: { contains: q } },
          { email: { contains: q } },
        ],
      },
      select: { id: true, firstName: true, lastName: true, phone: true },
      take,
    }),

    // Tasks
    prisma.task.findMany({
      where: {
        patientId: { not: null },
        patient: { ownerUserId: userId },
        title: { contains: q },
        status: "OPEN",
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
      },
      take,
    }),

    // Guidances
    prisma.guidance.findMany({
      where: {
        patient: { ownerUserId: userId },
        title: { contains: q },
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
      },
      take,
    }),

    // Research documents
    prisma.researchDocument.findMany({
      where: { title: { contains: q } },
      select: { id: true, title: true, kind: true },
      take,
    }),

    // Research notes
    prisma.researchNote.findMany({
      where: { title: { contains: q } },
      select: { id: true, title: true },
      take,
    }),

    // Patient notes
    prisma.patientNote.findMany({
      where: {
        patient: { ownerUserId: userId },
        OR: [
          { title: { contains: q } },
          { content: { contains: q } },
        ],
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
      },
      take,
    }),
  ]);

  // Map to results
  patients.forEach((p) => {
    results.push({
      type: "patient",
      id: p.id,
      title: `${p.firstName} ${p.lastName}`,
      subtitle: p.phone ?? undefined,
      href: `/patients/${p.id}`,
    });
  });

  tasks.forEach((t) => {
    results.push({
      type: "task",
      id: t.id,
      title: t.title,
      subtitle: t.patient ? `${t.patient.firstName} ${t.patient.lastName}` : undefined,
      href: t.patientId ? `/patients/${t.patientId}` : "/tasks",
    });
  });

  guidances.forEach((g) => {
    results.push({
      type: "guidance",
      id: g.id,
      title: g.title,
      subtitle: `${g.patient.firstName} ${g.patient.lastName}`,
      href: `/guidance/${g.id}`,
    });
  });

  researchDocs.forEach((d) => {
    results.push({
      type: "research",
      id: d.id,
      title: d.title,
      subtitle: d.kind,
      href: `/research/${d.id}`,
    });
  });

  researchNotes.forEach((n) => {
    results.push({
      type: "note",
      id: n.id,
      title: n.title,
      href: `/research`,
    });
  });

  patientNotes.forEach((n) => {
    results.push({
      type: "note",
      id: n.id,
      title: n.title,
      subtitle: `${n.patient.firstName} ${n.patient.lastName}`,
      href: `/patients/${n.patientId}`,
    });
  });

  return NextResponse.json({ results: results.slice(0, 20) });
}
