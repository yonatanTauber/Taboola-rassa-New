import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { BackButton } from "@/components/BackButton";
import { requireCurrentUserId } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

async function saveIntake(formData: FormData) {
  "use server";
  const userId = await requireCurrentUserId();
  if (!userId) return;

  const patientId = String(formData.get("patientId") ?? "").trim();
  if (!patientId) return;
  const patient = await prisma.patient.findFirst({ where: { id: patientId, ownerUserId: userId }, select: { id: true } });
  if (!patient) return;

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
}

export default async function PatientIntakePage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await requireCurrentUserId();
  if (!userId) return null;
  const { id } = await params;

  const patient = await prisma.patient.findFirst({
    where: { id, ownerUserId: userId, archivedAt: null },
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
      </section>

      <section className="app-section">
        <form action={saveIntake} className="space-y-3">
          <input type="hidden" name="patientId" value={patient.id} />
          <Field label="סיבת הפנייה">
            <input name="referralReason" defaultValue={intake?.referralReason ?? ""} className="app-field" />
          </Field>
          <Field label="מטרות טיפול">
            <textarea name="goals" defaultValue={intake?.goals ?? ""} className="app-textarea min-h-24" />
          </Field>
          <Field label="טיפול קודם">
            <input name="previousTherapy" defaultValue={intake?.previousTherapy ?? ""} className="app-field" />
          </Field>
          <Field label="טיפול תרופתי">
            <input name="currentMedication" defaultValue={intake?.currentMedication ?? ""} className="app-field" />
          </Field>
          <Field label="אשפוזים">
            <input name="hospitalizations" defaultValue={intake?.hospitalizations ?? ""} className="app-field" />
          </Field>
          <Field label="הערכת סיכון">
            <textarea name="riskAssessment" defaultValue={intake?.riskAssessment ?? ""} className="app-textarea min-h-20" />
          </Field>
          <Field label="מלל חופשי">
            <textarea name="freeText" defaultValue={intake?.freeText ?? ""} className="app-textarea min-h-24" />
          </Field>
          <div className="flex justify-end gap-2">
            <Link href={`/patients/${patient.id}`} className="app-btn app-btn-secondary">חזרה למטופל</Link>
            <button className="app-btn app-btn-primary">שמירה</button>
          </div>
        </form>
      </section>
    </main>
  );
}

function normalize(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1">
      <div className="text-xs text-muted">{label}</div>
      {children}
    </label>
  );
}
