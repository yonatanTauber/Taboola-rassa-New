import Link from "next/link";
import { notFound } from "next/navigation";
import { BackButton } from "@/components/BackButton";
import { requireCurrentUserId } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

const KIND_LABELS: Record<string, string> = {
  ARTICLE: "מאמר",
  BOOK: "ספר",
  VIDEO: "וידאו",
  LECTURE_NOTE: "הרצאה",
  OTHER: "אחר",
};

export default async function AuthorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const userId = await requireCurrentUserId();
  if (!userId) return null;
  const { id } = await params;

  const author = await prisma.author.findUnique({
    where: { id },
    include: {
      documentAuthors: {
        where: { document: { ownerUserId: userId } },
        include: {
          document: {
            select: { id: true, title: true, kind: true, createdAt: true, externalUrl: true },
          },
        },
        orderBy: { document: { createdAt: "desc" } },
      },
    },
  });
  if (!author) notFound();

  const docs = author.documentAuthors.map((da) => da.document);

  return (
    <main className="flex flex-col gap-4 p-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <BackButton />
        <h1 className="text-2xl font-semibold text-ink">{author.name}</h1>
      </div>

      <section className="app-section">
        <h2 className="mb-3 text-base font-semibold text-ink">
          מסמכי מחקר ({docs.length})
        </h2>
        {docs.length === 0 ? (
          <p className="text-sm text-muted">אין מסמכים ברשימה.</p>
        ) : (
          <ul className="space-y-2">
            {docs.map((doc) => (
              <li key={doc.id}>
                <Link
                  href={`/research?q=${encodeURIComponent(author.name)}`}
                  className="flex items-start justify-between gap-3 rounded-xl border border-black/8 bg-white px-3 py-2.5 hover:bg-black/[0.02]"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-ink">{doc.title}</div>
                    <div className="mt-0.5 text-xs text-muted">
                      {new Date(doc.createdAt).toLocaleDateString("he-IL")}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-black/[0.04] px-2 py-0.5 text-xs text-muted">
                    {KIND_LABELS[doc.kind] ?? doc.kind}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
