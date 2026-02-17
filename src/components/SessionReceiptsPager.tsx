"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type ReceiptLink = {
  id: string;
  receiptId: string;
  receiptNumber: string;
  amountNis: number;
};

const PAGE_SIZE = 4;

export function SessionReceiptsPager({ items }: { items: ReceiptLink[] }) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const pageItems = useMemo(() => items.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE), [items, page]);

  if (!items.length) {
    return <li className="rounded-lg bg-black/[0.02] px-3 py-2 text-muted">אין קבלה משויכת לפגישה זה</li>;
  }

  return (
    <>
      {pageItems.map((allocation) => (
        <li key={allocation.id}>
          <Link href={`/receipts/${allocation.receiptId}`} className="block rounded-lg border border-black/10 px-3 py-2 hover:bg-accent-soft">
            {allocation.receiptNumber} · שולם ₪{allocation.amountNis}
          </Link>
        </li>
      ))}
      {items.length > PAGE_SIZE ? (
        <li className="flex items-center justify-between rounded-lg border border-black/10 px-3 py-2 text-xs text-muted">
          <button
            type="button"
            className="app-btn app-btn-secondary px-2 py-1 text-xs"
            disabled={page <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            ◀
          </button>
          <span>{page + 1} מתוך {totalPages}</span>
          <button
            type="button"
            className="app-btn app-btn-secondary px-2 py-1 text-xs"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          >
            ▶
          </button>
        </li>
      ) : null}
    </>
  );
}
