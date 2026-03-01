import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Merge two sessions:
 * - Keep the "primary" session (the one in the URL)
 * - Delete the "secondary" session (mergeWithId)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { mergeWithId } = await request.json();
    const { id: primaryId } = await params;

    if (!mergeWithId || !primaryId) {
      return NextResponse.json(
        { error: "primaryId (URL) and mergeWithId (body) are required" },
        { status: 400 }
      );
    }

    // Validate both sessions exist and belong to same patient
    const [primary, secondary] = await Promise.all([
      prisma.session.findUnique({ where: { id: primaryId } }),
      prisma.session.findUnique({ where: { id: mergeWithId } }),
    ]);

    if (!primary || !secondary) {
      return NextResponse.json(
        { error: "One or both sessions not found" },
        { status: 404 }
      );
    }

    if (primary.patientId !== secondary.patientId) {
      return NextResponse.json(
        { error: "Sessions belong to different patients" },
        { status: 400 }
      );
    }

    // Keep primary, delete secondary
    await prisma.session.delete({ where: { id: secondary.id } });

    return NextResponse.json({
      merged: true,
      kept: primaryId,
      deleted: mergeWithId,
    });
  } catch (error) {
    console.error("Error merging sessions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
