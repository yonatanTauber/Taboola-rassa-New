"use server";

import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { BackButton } from "@/components/BackButton";
import { requireCurrentUserId } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { IntakeForm } from "./intake-form";

async function saveIntake(formData: FormData) {
  const userId = await requireCurrentUserId();
  if (!userId) {
    return { error: "Unauthorized" };
  }

  const patientId = String(formData.get("patientId") ?? "").trim();
  if (!patientId) {
    return { error: "Patient ID is required" };
  }

  const patient = await prisma.patient.findFirst({
    where: { id: patientId, ownerUserId: userId },
    select: { id: true },
  });
  if (!patient) {
    return { error: "Patient not found" };
  }

  const payload = {
    referralReason: normalize(formData.get("referralReason")),
    goals: normalize(formData.get("goals")),
    previousTherapy: normalize(formData.get("previousTherapy")),
    currentMedication: normalize(formData.get("currentMedication")),
    hospitalizations: normalize(formData.get("hospitalizations")),
    riskAssessment: normalize(formData.get("riskAssessment")),
    freeText: normalize(formData.get("freeText")),
  };

  const latest = await prisma.intake.findFirst({
    where: { patientId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  if (latest) {
    await prisma.intake.update({ where: { id: latest.id }, data: payload });
  } else {
    await prisma.intake.create({ data: { patientId, ...payload } });
  }

  revalidatePath(`/patients/${patientId}`);
  revalidatePath(`/patients/${patientId}/intake`);

  return { success: true };
}

export default async function PatientIntakePage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await requireCurrentUserId();
  if (!userId) return null;
  const { id } = await params;

  const patient = await prisma.patient.findFirst({
    where: { id, ownerUserId: userId },
    include: { intakes: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!patient) return notFound();
  const intake = patient.intakes[0];

  return (
    <main className="mx-auto w-full max-w-4xl space-y-4">
      <BackButton fallback={`/patients/${patient.id}`} />
      <section className="app-section">
        <h1 className="text-xl font-semibold">אינטייק מטופל</h1>
        <p className="text-sm text-muted">{patient.firstName} {patient.lastName}</p>
        {patient.archivedAt ? <p className="mt-1 text-xs text-amber-700">המטופל במצב לא פעיל. ניתן לערוך את התיעוד ולהשיב אותו לפעיל מדף המטופל.</p> : null}
      </section>

      <IntakeForm patientId={patient.id} initialIntake={intake} saveIntake={saveIntake} />
    </main>
  );
}

function normalize(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}
