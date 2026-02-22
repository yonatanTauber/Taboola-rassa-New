import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { InquiryStatusField } from "@/components/inquiries/InquiryStatusField";
import { requireCurrentUserId } from "@/lib/auth-server";
import { convertInquiryToPatientById } from "@/lib/inquiries";
import { prisma } from "@/lib/prisma";

async function createInquiry(formData: FormData) {
  "use server";
  const userId = await requireCurrentUserId();
  if (!userId) return;
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const gender = String(formData.get("gender") ?? "").trim();
  const referralSource = String(formData.get("referralSource") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!firstName || !lastName || !phone) return;

  await prisma.inquiry.create({
    data: {
      ownerUserId: userId,
      firstName,
      lastName,
      phone,
      gender: gender === "MALE" || gender === "FEMALE" || gender === "OTHER" ? gender : null,
      referralSource: referralSource || null,
      notes: notes || null,
    },
  });
  revalidatePath("/inquiries");
}

async function convertInquiryToPatient(formData: FormData) {
  "use server";
  const userId = await requireCurrentUserId();
  if (!userId) return;
  const inquiryId = String(formData.get("inquiryId") ?? "");
  if (!inquiryId) return;
  const converted = await convertInquiryToPatientById({ inquiryId, userId });
  if (!converted?.patientId) return;
  revalidatePath("/inquiries");
  revalidatePath("/patients");
  redirect(`/patients/${converted.patientId}`);
}

export default async function InquiriesPage() {
  const userId = await requireCurrentUserId();
  if (!userId) return null;
  const inquiries = await prisma.inquiry.findMany({
    where: { ownerUserId: userId },
    include: {
      patient: {
        select: { id: true, firstName: true, lastName: true, archivedAt: true },
      },
    },
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
            <select name="gender" className="app-select">
              <option value="">מגדר (אופציונלי)</option>
              <option value="MALE">גבר</option>
              <option value="FEMALE">אישה</option>
              <option value="OTHER">אחר</option>
            </select>
            <input name="referralSource" placeholder="מקור פנייה" className="app-field" />
          </div>
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
                <th className="p-2 font-medium">מטופל מקושר</th>
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
                    <InquiryStatusField
                      inquiryId={inquiry.id}
                      initialStatus={inquiry.status}
                      patientId={inquiry.patient?.id ?? inquiry.patientId ?? null}
                    />
                  </td>
                  <td className="p-2">
                    {inquiry.patient ? (
                      <div className="space-y-1">
                        <Link href={`/patients/${inquiry.patient.id}`} className="text-accent hover:underline">
                          {inquiry.patient.firstName} {inquiry.patient.lastName}
                        </Link>
                        {inquiry.patient.archivedAt ? (
                          <div className="text-xs text-amber-700">המטופל כרגע לא פעיל</div>
                        ) : null}
                      </div>
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
                    ) : inquiry.status === "CONVERTED" ? (
                      <span className="text-xs text-muted">סטטוס נעול</span>
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
