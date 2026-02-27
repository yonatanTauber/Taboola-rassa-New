import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateUpcomingSessions } from "@/lib/recurring-sessions";

export async function POST(request: NextRequest) {
  try {
    const { patientId } = await request.json();

    if (!patientId) {
      return NextResponse.json(
        { error: "patientId is required" },
        { status: 400 }
      );
    }

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: {
        id: true,
        fixedSessionDay: true,
        fixedSessionTime: true,
      },
    });

    if (!patient) {
      return NextResponse.json(
        { error: "Patient not found" },
        { status: 404 }
      );
    }

    const { dates, summary } = await generateUpcomingSessions(
      patientId,
      patient,
      prisma
    );

    // Create sessions
    const created = await Promise.all(
      dates.map((date) =>
        prisma.session.create({
          data: {
            patientId,
            scheduledAt: date,
            status: "SCHEDULED",
            isRecurringTemplate: true,
          },
        })
      )
    );

    return NextResponse.json({
      created: created.length,
      summary,
      sessions: created.map((s) => ({
        id: s.id,
        scheduledAt: s.scheduledAt,
      })),
    });
  } catch (error) {
    console.error("Error creating recurring sessions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
