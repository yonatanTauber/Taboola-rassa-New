"use client";

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "אישור",
  cancelLabel = "ביטול",
  busy = false,
  danger = true,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/30 px-3"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div role="dialog" aria-modal="true" className="w-[min(92vw,30rem)] rounded-2xl border border-black/16 bg-white p-4 shadow-2xl">
        <h3 className={`text-lg font-semibold ${danger ? "text-danger" : "text-ink"}`}>{title}</h3>
        <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{message}</p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" className="app-btn app-btn-secondary" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`app-btn ${danger ? "bg-danger/10 text-danger" : "app-btn-primary"} disabled:cursor-not-allowed disabled:opacity-50`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "מבצע..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
