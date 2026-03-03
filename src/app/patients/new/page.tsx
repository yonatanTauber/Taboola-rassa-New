import { redirect } from "next/navigation";
import { BackButton } from "@/components/BackButton";
import { requireCurrentUserId } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { generateUpcomingSessions } from "@/lib/recurring-sessions";
import { NewPatientForm } from "@/components/patients/NewPatientForm";

const HOURS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, step) => String(step * 5).padStart(2, "0"));

const AVATAR_KEYS = [
  "calm-man",
  "calm-woman",
  "thoughtful-man",
  "thoughtful-woman",
  "young-man",
  "young-woman",
  "older-man",
  "older-woman",
  "neutral-1",
  "neutral-2",
];

function parseDateInput(raw: string) {
  if (!raw) return null;
  const parsed = new Date(`${raw}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

async function generateInternalCode() {
  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const suffix = Math.floor(Math.random() * 1_000_000)
      .toString()
      .padStart(6, "0");
    const candidate = `PT-${year}-${suffix}`;
    const exists = await prisma.patient.findUnique({
      where: { internalCode: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
  }
  return `PT-${year}-${Date.now()}`;
}

async function createPatient(formData: FormData) {
  "use server";
  const userId = await requireCurrentUserId();
  if (!userId) {
    redirect("/login");
  }

  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const gender = String(formData.get("gender") ?? "").trim() || "OTHER";
  const dateOfBirth = String(formData.get("dateOfBirth") ?? "").trim();
  const treatmentStartDateRaw = String(formData.get("treatmentStartDate") ?? "").trim();
  const fixedSessionDay = String(formData.get("fixedSessionDay") ?? "").trim();
  const fixedSessionHour = String(formData.get("fixedSessionHour") ?? "").trim();
  const fixedSessionMinute = String(formData.get("fixedSessionMinute") ?? "").trim();
  const defaultSessionFeeNis = Number(formData.get("defaultSessionFeeNis") ?? 0);
  const referralReason = String(formData.get("referralReason") ?? "").trim();
  const goals = String(formData.get("goals") ?? "").trim();
  const previousTherapy = String(formData.get("previousTherapy") ?? "").trim();
  const currentMedication = String(formData.get("currentMedication") ?? "").trim();
  const hospitalizations = String(formData.get("hospitalizations") ?? "").trim();
  const freeText = String(formData.get("freeText") ?? "").trim();

  if (!firstName || !lastName) {
    redirect("/patients/new?error=missing-required");
  }

  const parsedFixedDay = fixedSessionDay !== "" ? Number(fixedSessionDay) : null;
  const parsedFee = Number.isFinite(defaultSessionFeeNis) && defaultSessionFeeNis > 0 ? defaultSessionFeeNis : null;
  const parsedDateOfBirth = dateOfBirth ? parseDateInput(dateOfBirth) : null;
  const parsedTreatmentStartDate = treatmentStartDateRaw
    ? parseDateInput(treatmentStartDateRaw)
    : new Date();

  if (dateOfBirth && !parsedDateOfBirth) {
    redirect("/patients/new?error=invalid-birth-date");
  }
  if (treatmentStartDateRaw && !parsedTreatmentStartDate) {
    redirect("/patients/new?error=invalid-treatment-start-date");
  }

  if (
    parsedFixedDay !== null &&
    (!Number.isInteger(parsedFixedDay) || parsedFixedDay < 0 || parsedFixedDay > 6)
  ) {
    redirect("/patients/new?error=invalid-fixed-day");
  }

  const hasFixedTimePart = fixedSessionHour !== "" || fixedSessionMinute !== "";
  if (parsedFixedDay === null && hasFixedTimePart) {
    redirect("/patients/new?error=invalid-fixed-time");
  }
  if (parsedFixedDay !== null) {
    if (!HOURS.includes(fixedSessionHour) || !MINUTES.includes(fixedSessionMinute)) {
      redirect("/patients/new?error=invalid-fixed-time");
    }
  }

  const normalizedFixedTime =
    parsedFixedDay !== null ? `${fixedSessionHour}:${fixedSessionMinute}` : null;

  try {
    const internalCode = await generateInternalCode();

    const created = await prisma.patient.create({
      data: {
        ownerUserId: userId,
        internalCode,
        firstName,
        lastName,
        phone: phone || null,
        email: email || null,
        gender: gender === "MALE" || gender === "FEMALE" || gender === "OTHER" ? gender : "OTHER",
        researchAlias: `P-${Math.floor(Math.random() * 1_000_000)
          .toString()
          .padStart(6, "0")}`,
        avatarKey: AVATAR_KEYS[Math.floor(Math.random() * AVATAR_KEYS.length)],
        defaultSessionFeeNis: parsedFee,
        dateOfBirth: parsedDateOfBirth,
        treatmentStartDate: parsedTreatmentStartDate ?? new Date(),
        fixedSessionDay: parsedFixedDay,
        fixedSessionTime: normalizedFixedTime,
      },
    });

    if (referralReason || goals || previousTherapy || currentMedication || hospitalizations || freeText) {
      await prisma.intake.create({
        data: {
          patientId: created.id,
          referralReason: referralReason || null,
          goals: goals || null,
          previousTherapy: previousTherapy || null,
          currentMedication: currentMedication || null,
          hospitalizations: hospitalizations || null,
          freeText: freeText || null,
        },
      });
    }

    // Auto-generate recurring sessions if fixed schedule was set
    if (created.fixedSessionDay !== null && created.fixedSessionTime) {
      const { dates } = await generateUpcomingSessions(created.id, {
        fixedSessionDay: created.fixedSessionDay,
        fixedSessionTime: created.fixedSessionTime,
      }, prisma);
      if (dates.length > 0) {
        for (const date of dates) {
          await prisma.session.create({
            data: {
              patientId: created.id,
              scheduledAt: date,
              status: "SCHEDULED",
              isRecurringTemplate: true,
            },
          });
        }
      }
    }
  } catch (error) {
    console.error("createPatient failed", error);
    redirect("/patients/new?error=create-failed");
  }

  redirect(`/patients?saved=patient`);
}

function errorText(errorCode?: string) {
  if (errorCode === "missing-required") return "יש להשלים שם פרטי ושם משפחה.";
  if (errorCode === "invalid-birth-date") return "תאריך הלידה שהוזן אינו תקין.";
  if (errorCode === "invalid-treatment-start-date") return "תאריך התחלת הטיפול אינו תקין.";
  if (errorCode === "invalid-fixed-day") return "יום קבוע לפגישה אינו תקין.";
  if (errorCode === "invalid-fixed-time") return "השעה הקבועה לפגישה אינה תקינה.";
  if (errorCode === "create-failed") return "שמירת המטופל נכשלה. נסה שוב.";
  return null;
}

export default async function NewPatientPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const query = await searchParams;
  const error = errorText(query.error);
  return (
    <main className="space-y-4">
      <BackButton fallback="/patients" />
      <section className="rounded-2xl border border-black/10 bg-white p-4">
        <h1 className="mb-3 text-xl font-semibold">מטופל חדש</h1>
        <NewPatientForm action={createPatient} error={error} />
      </section>
    </main>
  );
}
