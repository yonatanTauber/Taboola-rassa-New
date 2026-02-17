import { GuidanceStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type GuidanceExpenseSyncInput = {
  id: string;
  title: string;
  feeNis: number | null;
  status: GuidanceStatus;
  completedAt: Date | null;
  instructorName: string | null;
};

export async function syncGuidanceExpense(input: GuidanceExpenseSyncInput) {
  const shouldCreateExpense = input.status === GuidanceStatus.COMPLETED && (input.feeNis ?? 0) > 0;

  if (!shouldCreateExpense) {
    await prisma.expense.deleteMany({ where: { guidanceId: input.id } });
    return;
  }

  const occurredAt = input.completedAt ?? new Date();
  const title = `הדרכה: ${safeTitle(input.title)} · ${input.instructorName?.trim() || "ללא מדריך"}`;
  const amountNis = Math.max(0, Math.trunc(input.feeNis ?? 0));

  await prisma.expense.upsert({
    where: { guidanceId: input.id },
    update: {
      title,
      amountNis,
      category: "הדרכה",
      occurredAt,
    },
    create: {
      title,
      amountNis,
      category: "הדרכה",
      occurredAt,
      guidanceId: input.id,
    },
  });
}

function safeTitle(title: string) {
  const cleaned = title.trim();
  return cleaned.length > 0 ? cleaned : "ללא כותרת";
}
