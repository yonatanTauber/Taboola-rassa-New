import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { detectPotentialMerge } from "@/lib/recurring-sessions";

export async function POST(request: NextRequest) {
  try {
    const { patientId, date, hour, minute } = await request.json();

    if (!patientId || !date) {
      return NextResponse.json(
        { error: "patientId and date are required" },
        { status: 400 }
      );
    }

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: {
        fixedSessionDay: true,
        fixedSessionTime: true,
        sessions: {
          where: {
            status: { in: ["SCHEDULED", "COMPLETED"] },
            // Look at sessions from last 7 days to this month
            scheduledAt: {
              gte: new Date(new Date().setDate(new Date().getDate() - 7)),
            },
          },
          select: {
            id: true,
            scheduledAt: true,
            status: true,
          },
        },
      },
    });

    if (!patient) {
      return NextResponse.json(
        { error: "Patient not found" },
        { status: 404 }
      );
    }

    const newDate = new Date(date);
    const suggestion = detectPotentialMerge(
      newDate,
      hour,
      minute,
      patient,
      patient.sessions
    );

    return NextResponse.json(suggestion);
  } catch (error) {
    console.error("Error detecting merge suggestion:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
