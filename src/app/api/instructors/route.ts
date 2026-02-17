import { NextResponse } from "next/server";
import { requireCurrentUserId } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const userId = await requireCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const instructors = await prisma.instructor.findMany({
    where: { ownerUserId: userId },
    orderBy: [{ fullName: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      fullName: true,
      phone: true,
      email: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ ok: true, instructors });
}

export async function POST(req: Request) {
  const userId = await requireCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const fullName = String(body.fullName ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const email = String(body.email ?? "").trim();

  if (!fullName) {
    return NextResponse.json({ error: "Missing fullName" }, { status: 400 });
  }

  const created = await prisma.instructor.create({
    data: {
      ownerUserId: userId,
      fullName,
      phone: phone || null,
      email: email || null,
    },
    select: {
      id: true,
      fullName: true,
      phone: true,
      email: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ ok: true, instructor: created });
}
