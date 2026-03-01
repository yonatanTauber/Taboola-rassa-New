import { notFound } from "next/navigation";
import Link from "next/link";
import { BackButton } from "@/components/BackButton";
import { PatientNoteEditor } from "@/components/patients/PatientNoteEditor";
import { requireCurrentUserId } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

export default async function PatientNotePage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await requireCurrentUserId();
  if (!userId) return null;
  const { id } = await params;

  const note = await prisma.patientNote.findFirst({
    where: { id, patient: { ownerUserId: userId } },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  if (!note) return notFound();

  const patientName = `${note.patient.firstName} ${note.patient.lastName}`;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BackButton fallback={`/patients/${note.patient.id}`} />
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold text-ink">{note.title}</h1>
          <p className="text-sm text-muted">
            <Link href={`/patients/${note.patient.id}`} className="hover:text-accent hover:underline">
              {patientName}
            </Link>
            {note.createdAt && (
              <>
                {" · "}
                <span>{new Date(note.createdAt).toLocaleDateString("he-IL")}</span>
              </>
            )}
          </p>
        </div>
      </div>

      {/* Editor */}
      <PatientNoteEditor
        noteId={id}
        initialTitle={note.title}
        initialContent={note.content ?? ""}
        patientId={note.patient.id}
      />
    </div>
  );
}
