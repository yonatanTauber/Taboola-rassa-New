import Link from "next/link";
import { redirect } from "next/navigation";
import { BackButton } from "@/components/BackButton";
import { FixedSessionPicker } from "@/components/patients/FixedSessionPicker";
import { requireCurrentUserId } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

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

function toDateInput(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

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
  const gender = String(formData.get("gender") ?? "OTHER");
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
  const defaultTreatmentStartDate = toDateInput(new Date());
  return (
    <main className="space-y-4">
      <BackButton fallback="/patients" />
      <section className="rounded-2xl border border-black/10 bg-white p-4">
        <h1 className="mb-3 text-xl font-semibold">מטופל חדש</h1>
        {error ? (
          <div className="mb-3 rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </div>
        ) : null}
        <form action={createPatient} className="space-y-4">
          <div className="grid gap-2 md:grid-cols-2">
            <input required name="firstName" placeholder="שם פרטי *" className="app-field" />
            <input required name="lastName" placeholder="שם משפחה *" className="app-field" />
            <select name="gender" className="app-select">
              <option value="MALE">גבר</option>
              <option value="FEMALE">אישה</option>
              <option value="OTHER">אחר</option>
            </select>
            <input name="phone" placeholder="טלפון ליצירת קשר (אופציונלי)" className="app-field" />
            <input name="email" placeholder="אימייל" className="app-field" />
            <label className="space-y-1">
              <div className="text-xs text-muted">תאריך לידה</div>
              <input name="dateOfBirth" type="date" lang="he-IL" className="app-field" />
            </label>
            <div className="space-y-2 md:col-span-2 md:grid md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] md:items-start md:gap-2">
              <label className="space-y-1">
                <div className="text-xs text-muted">תאריך התחלת טיפול</div>
                <input
                  name="treatmentStartDate"
                  type="date"
                  lang="he-IL"
                  defaultValue={defaultTreatmentStartDate}
                  className="app-field"
                />
              </label>

              <div className="space-y-1">
                <div className="text-xs text-muted">יום ושעה קבועים (אופציונלי)</div>
                <FixedSessionPicker />
              </div>
            </div>
            <input
              name="defaultSessionFeeNis"
              type="number"
              min="0"
              placeholder="מחיר טיפול קבוע (₪)"
              className="app-field"
            />
          </div>

          <div className="rounded-xl border border-black/10 p-3">
            <h2 className="mb-2 text-sm font-semibold">אינטייק</h2>
            <div className="grid gap-2">
              <input name="referralReason" placeholder="סיבת פנייה" className="app-field" />
              <textarea name="goals" placeholder="מטרות טיפול" className="app-textarea min-h-20" />
              <input name="previousTherapy" placeholder="טיפול קודם" className="app-field" />
              <input name="currentMedication" placeholder="טיפול תרופתי" className="app-field" />
              <input name="hospitalizations" placeholder="אשפוזים בעבר" className="app-field" />
              <textarea name="freeText" placeholder="מלל חופשי" className="app-textarea min-h-24" />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Link href="/patients" className="app-btn app-btn-secondary">
              ביטול
            </Link>
            <button className="app-btn app-btn-primary">
              שמור
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
