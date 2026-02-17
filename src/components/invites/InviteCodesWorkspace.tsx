"use client";

import { useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type InviteRow = {
  id: string;
  code: string;
  invitedEmail: string | null;
  expiresAt: string | null;
  usedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  usedByUser: {
    id: string;
    fullName: string;
    email: string;
  } | null;
};

export function InviteCodesWorkspace({
  initialInvites,
  registrationMode,
}: {
  initialInvites: InviteRow[];
  registrationMode: "open" | "invite" | "closed";
}) {
  const [invites, setInvites] = useState(initialInvites);
  const [invitedEmail, setInvitedEmail] = useState("");
  const [expiresAt, setExpiresAt] = useState(getDefaultExpiryInput());
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [revokeTargetId, setRevokeTargetId] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);

  const activeCount = useMemo(
    () => invites.filter((invite) => statusFor(invite).kind === "ACTIVE").length,
    [invites],
  );

  async function createInvite() {
    setError("");
    setMessage("");
    setCreating(true);

    const res = await fetch("/api/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invitedEmail: invitedEmail.trim() || null,
        expiresAt: expiresAt || null,
      }),
    });
    const payload = (await res.json().catch(() => ({}))) as {
      error?: string;
      invite?: InviteRow;
    };
    setCreating(false);

    if (!res.ok || !payload.invite) {
      setError(payload.error ?? "יצירת קוד הזמנה נכשלה.");
      return;
    }

    setInvites((prev) => [payload.invite as InviteRow, ...prev]);
    setInvitedEmail("");
    setExpiresAt(getDefaultExpiryInput());
    setMessage(`נוצר קוד הזמנה: ${payload.invite.code}`);
  }

  async function revokeInvite(inviteId: string) {
    setError("");
    setMessage("");
    setRevoking(true);

    const res = await fetch(`/api/invites/${inviteId}`, { method: "DELETE" });
    setRevoking(false);
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(payload.error ?? "ביטול קוד הזמנה נכשל.");
      return;
    }
    setInvites((prev) =>
      prev.map((item) =>
        item.id === inviteId
          ? { ...item, revokedAt: new Date().toISOString() }
          : item,
      ),
    );
    setRevokeTargetId(null);
    setMessage("קוד ההזמנה בוטל.");
  }

  async function copyText(value: string, okText: string) {
    try {
      await navigator.clipboard.writeText(value);
      setError("");
      setMessage(okText);
    } catch {
      setError("לא ניתן להעתיק ללוח כרגע.");
    }
  }

  return (
    <main className="space-y-4">
      <section className="app-section space-y-2">
        <h1 className="text-xl font-semibold text-ink">הזמנות משתמשים</h1>
        <p className="text-sm text-muted">
          יצירת קודי הזמנה חד-פעמיים עם תפוגה, לשימוש בעמוד ההרשמה.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full border border-black/14 bg-white/90 px-2 py-1">
            מצב הרשמה: {registrationModeLabel(registrationMode)}
          </span>
          <span className="rounded-full border border-black/14 bg-white/90 px-2 py-1">
            קודים פעילים: {activeCount}
          </span>
          <button
            type="button"
            className="app-btn app-btn-secondary text-xs"
            onClick={() => copyText(`${window.location.origin}/register`, "לינק הרשמה הועתק")}
          >
            העתק לינק הרשמה
          </button>
        </div>
      </section>

      <section className="app-section space-y-3">
        <h2 className="text-base font-semibold text-ink">יצירת קוד חדש</h2>
        <div className="grid gap-2 md:grid-cols-[1fr_260px_auto]">
          <input
            type="email"
            value={invitedEmail}
            onChange={(event) => setInvitedEmail(event.target.value)}
            className="app-field"
            placeholder="מייל ייעודי (אופציונלי)"
            aria-label="מייל ייעודי לקוד"
          />
          <input
            type="datetime-local"
            value={expiresAt}
            onChange={(event) => setExpiresAt(event.target.value)}
            className="app-field"
            aria-label="תאריך תפוגה"
          />
          <button
            type="button"
            onClick={createInvite}
            disabled={creating}
            className="app-btn app-btn-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creating ? "יוצר..." : "צור קוד"}
          </button>
        </div>
        <p className="text-xs text-muted">
          בלי מייל: הקוד יעבוד לכל מייל. עם מייל: הקוד יעבוד רק למייל הזה.
        </p>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      </section>

      <section className="app-section">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-black/10 text-right text-xs text-muted">
                <th className="p-2 font-medium">קוד</th>
                <th className="p-2 font-medium">מייל מוגבל</th>
                <th className="p-2 font-medium">תפוגה</th>
                <th className="p-2 font-medium">סטטוס</th>
                <th className="p-2 font-medium">נוצל על ידי</th>
                <th className="p-2 font-medium">נוצר</th>
                <th className="p-2 font-medium">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((invite) => {
                const status = statusFor(invite);
                return (
                  <tr key={invite.id} className="border-b border-black/7 hover:bg-black/[0.02]">
                    <td className="p-2 font-medium tracking-wide">{invite.code}</td>
                    <td className="p-2">{invite.invitedEmail ?? "—"}</td>
                    <td className="p-2">{invite.expiresAt ? formatDateTime(invite.expiresAt) : "ללא תפוגה"}</td>
                    <td className="p-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${status.tone}`}>{status.label}</span>
                    </td>
                    <td className="p-2">{invite.usedByUser ? `${invite.usedByUser.fullName} (${invite.usedByUser.email})` : "—"}</td>
                    <td className="p-2">{formatDateTime(invite.createdAt)}</td>
                    <td className="p-2">
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          className="app-btn app-btn-secondary !px-2 !py-1 text-xs"
                          onClick={() => copyText(invite.code, "קוד ההזמנה הועתק")}
                        >
                          העתק קוד
                        </button>
                        {status.kind === "ACTIVE" ? (
                          <button
                            type="button"
                            className="app-btn app-btn-secondary !px-2 !py-1 text-xs text-danger"
                            onClick={() => setRevokeTargetId(invite.id)}
                          >
                            בטל קוד
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {invites.length === 0 ? (
            <p className="pt-3 text-sm text-muted">עדיין לא נוצרו קודי הזמנה.</p>
          ) : null}
        </div>
      </section>
      <ConfirmDialog
        open={revokeTargetId !== null}
        title="ביטול קוד הזמנה"
        message="לבטל את קוד ההזמנה? לאחר הביטול אי אפשר להשתמש בו."
        confirmLabel="בטל קוד"
        cancelLabel="חזרה"
        busy={revoking}
        onCancel={() => setRevokeTargetId(null)}
        onConfirm={() => {
          if (!revokeTargetId) return;
          void revokeInvite(revokeTargetId);
        }}
      />
    </main>
  );
}

function registrationModeLabel(mode: "open" | "invite" | "closed") {
  if (mode === "open") return "פתוחה";
  if (mode === "closed") return "סגורה";
  return "בקוד הזמנה";
}

function statusFor(invite: InviteRow) {
  if (invite.revokedAt) return { kind: "REVOKED", label: "בוטל", tone: "bg-zinc-200 text-zinc-700" };
  if (invite.usedAt) return { kind: "USED", label: "נוצל", tone: "bg-emerald-100 text-emerald-700" };
  if (invite.expiresAt && new Date(invite.expiresAt).getTime() <= Date.now()) {
    return { kind: "EXPIRED", label: "פג תוקף", tone: "bg-amber-100 text-amber-700" };
  }
  return { kind: "ACTIVE", label: "פעיל", tone: "bg-sky-100 text-sky-700" };
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("he-IL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDefaultExpiryInput() {
  const date = new Date();
  date.setDate(date.getDate() + 14);
  date.setSeconds(0, 0);
  return toDateTimeLocalInput(date);
}

function toDateTimeLocalInput(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const hours = String(value.getHours()).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}
