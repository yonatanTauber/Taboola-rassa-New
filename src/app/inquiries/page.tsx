import { InquiryStatus } from "@prisma/client";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireCurrentUserId } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

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

async function createInquiry(formData: FormData) {
  "use server";
  const userId = await requireCurrentUserId();
  if (!userId) return;
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const gender = String(formData.get("gender") ?? "").trim();
  const age = Number(formData.get("age") ?? 0);
  const referralSource = String(formData.get("referralSource") ?? "").trim();
  const referralDetails = String(formData.get("referralDetails") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!firstName || !lastName || !phone) return;

  await prisma.inquiry.create({
    data: {
      ownerUserId: userId,
      firstName,
      lastName,
      phone,
      gender: gender === "MALE" || gender === "FEMALE" || gender === "OTHER" ? gender : null,
      age: Number.isFinite(age) && age > 0 ? age : null,
      referralSource: referralSource || null,
      referralDetails: referralDetails || null,
      notes: notes || null,
    },
  });
  revalidatePath("/inquiries");
}

async function updateInquiryStatus(formData: FormData) {
  "use server";
  const userId = await requireCurrentUserId();
  if (!userId) return;
  const inquiryId = String(formData.get("inquiryId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!inquiryId) return;
  if (
    status !== "NEW" &&
    status !== "DISCOVERY_CALL" &&
    status !== "WAITLIST" &&
    status !== "CONVERTED" &&
    status !== "CLOSED"
  ) {
    return;
  }
  const ownInquiry = await prisma.inquiry.findFirst({ where: { id: inquiryId, ownerUserId: userId }, select: { id: true } });
  if (!ownInquiry) return;
  await prisma.inquiry.update({ where: { id: inquiryId }, data: { status: status as InquiryStatus } });
  revalidatePath("/inquiries");
}

async function convertInquiryToPatient(formData: FormData) {
  "use server";
  const userId = await requireCurrentUserId();
  if (!userId) return;
  const inquiryId = String(formData.get("inquiryId") ?? "");
  if (!inquiryId) return;

  const inquiry = await prisma.inquiry.findFirst({ where: { id: inquiryId, ownerUserId: userId } });
  if (!inquiry) return;
  if (inquiry.patientId) {
    await prisma.inquiry.update({ where: { id: inquiryId }, data: { status: "CONVERTED" } });
    revalidatePath("/inquiries");
    return;
  }

  const patient = await prisma.patient.create({
    data: {
      ownerUserId: userId,
      internalCode: await generateInternalCode(),
      firstName: inquiry.firstName,
      lastName: inquiry.lastName,
      gender: inquiry.gender ?? "OTHER",
      phone: inquiry.phone,
      treatmentStartDate: new Date(),
      researchAlias: `P-${Math.floor(Math.random() * 1_000_000)
        .toString()
        .padStart(6, "0")}`,
      intakes:
        inquiry.referralSource || inquiry.referralDetails || inquiry.notes
          ? {
              create: {
                referralReason: inquiry.referralSource || null,
                freeText: [inquiry.referralDetails, inquiry.notes].filter(Boolean).join("\n\n") || null,
              },
            }
          : undefined,
    },
  });

  await prisma.inquiry.update({ where: { id: inquiryId }, data: { patientId: patient.id, status: "CONVERTED" } });
  revalidatePath("/inquiries");
  revalidatePath("/patients");
}

export default async function InquiriesPage() {
  const userId = await requireCurrentUserId();
  if (!userId) return null;
  const inquiries = await prisma.inquiry.findMany({
    where: { ownerUserId: userId },
    include: { patient: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <main className="grid gap-4 lg:grid-cols-[1.1fr_1.9fr]">
      <section className="rounded-2xl border border-black/10 bg-white p-4">
        <h1 className="mb-3 text-xl font-semibold">פנייה חדשה לטיפול</h1>
        <form action={createInquiry} className="space-y-2">
          <div className="grid gap-2 md:grid-cols-2">
            <input name="firstName" required placeholder="שם פרטי *" className="app-field" />
            <input name="lastName" required placeholder="שם משפחה *" className="app-field" />
            <input name="phone" required placeholder="טלפון *" className="app-field" />
            <input name="age" type="number" min="1" placeholder="גיל" className="app-field" />
            <select name="gender" className="app-select">
              <option value="">מגדר (אופציונלי)</option>
              <option value="MALE">גבר</option>
              <option value="FEMALE">אישה</option>
              <option value="OTHER">אחר</option>
            </select>
            <input name="referralSource" placeholder="מקור פנייה" className="app-field" />
          </div>
          <input name="referralDetails" placeholder="פירוט מקור הפנייה (קולגה, ארגון...)" className="app-field" />
          <textarea name="notes" placeholder="הערות על הפנייה" className="app-textarea min-h-24" />
          <div className="flex justify-end">
            <button className="app-btn app-btn-primary">שמור</button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-black/10 bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold">ניהול פניות</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-black/10 text-right text-xs text-muted">
                <th className="p-2 font-medium">שם</th>
                <th className="p-2 font-medium">טלפון</th>
                <th className="p-2 font-medium">מקור</th>
                <th className="p-2 font-medium">סטטוס</th>
                <th className="p-2 font-medium">קישור</th>
                <th className="p-2 font-medium">פעולה</th>
              </tr>
            </thead>
            <tbody>
              {inquiries.map((inquiry) => (
                <tr key={inquiry.id} className="border-b border-black/5 align-top">
                  <td className="p-2">{inquiry.firstName} {inquiry.lastName}</td>
                  <td className="p-2">{inquiry.phone}</td>
                  <td className="p-2">{inquiry.referralSource ?? "—"}</td>
                  <td className="p-2">
                    <form action={updateInquiryStatus}>
                      <input type="hidden" name="inquiryId" value={inquiry.id} />
                      <select name="status" defaultValue={inquiry.status} className="app-select">
                        <option value="NEW">חדשה</option>
                        <option value="DISCOVERY_CALL">שיחת היכרות</option>
                        <option value="WAITLIST">המתנה</option>
                        <option value="CONVERTED">הפכה למטופל</option>
                        <option value="CLOSED">נסגרה</option>
                      </select>
                      <button className="mt-2 app-btn app-btn-secondary">שמור</button>
                    </form>
                  </td>
                  <td className="p-2">
                    {inquiry.patient ? (
                      <Link href={`/patients/${inquiry.patient.id}`} className="text-accent hover:underline">
                        {inquiry.patient.firstName} {inquiry.patient.lastName}
                      </Link>
                    ) : (
                      <span className="text-muted">לא קושר</span>
                    )}
                  </td>
                  <td className="p-2">
                    {!inquiry.patient && inquiry.status !== "CLOSED" ? (
                      <form action={convertInquiryToPatient}>
                        <input type="hidden" name="inquiryId" value={inquiry.id} />
                        <button className="app-btn app-btn-primary">הפוך למטופל</button>
                      </form>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
