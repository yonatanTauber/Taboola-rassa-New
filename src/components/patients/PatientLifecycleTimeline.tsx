"use client";

import { useMemo, useState } from "react";
import { PatientLifecycleEventType, SessionStatus } from "@prisma/client";

type LifecycleRow = {
  id: string;
  eventType: PatientLifecycleEventType | "PATIENT_CREATED";
  occurredAt: string;
  reason: string | null;
  actorName: string | null;
  metadata?: {
    canceledSessionsCount?: number;
    closedTasksCount?: number;
  } | null;
};

type SessionRow = {
  id: string;
  scheduledAt: string;
  status: SessionStatus;
};

export function PatientLifecycleTimeline({
  events,
  sessions = [],
}: {
  events: LifecycleRow[];
  sessions?: SessionRow[];
}) {
  const [showSessions, setShowSessions] = useState(false);

  const mergedTimeline = useMemo(() => {
    if (!showSessions) return events;
    const sessionEvents: LifecycleRow[] = sessions.map((session) => ({
      id: `session-${session.id}`,
      eventType: "PATIENT_CREATED",
      occurredAt: session.scheduledAt,
      reason: `פגישה: ${sessionStatusLabel(session.status)}`,
      actorName: null,
      metadata: null,
    }));

    return [...events, ...sessionEvents]
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
      .slice(0, 180);
  }, [events, sessions, showSessions]);

  return (
    <section className="app-section border-black/18">
      <details>
        <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg px-1 py-1 hover:bg-black/[0.02]">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">ציר זמן מטופל</h2>
            <span className="rounded-full bg-black/[0.05] px-2 py-0.5 text-[11px] text-muted">{events.length}</span>
          </div>
          <span className="text-xs text-muted">פתח/י</span>
        </summary>

        <div className="mt-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">מחזור חיים</span>
            <label className="flex items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={showSessions}
                onChange={(event) => setShowSessions(event.target.checked)}
                className="size-4 accent-accent"
              />
              הצג גם פגישות טיפול
            </label>
          </div>

          {mergedTimeline.length === 0 ? (
            <p className="text-sm text-muted">אין אירועים להצגה.</p>
          ) : (
            <ol className="space-y-2">
              {mergedTimeline.map((event) => (
                <li key={event.id} className="rounded-xl border border-black/10 bg-gradient-to-b from-white to-black/[0.01] px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium text-ink">{eventLabel(event.eventType, event.reason)}</div>
                      <div className="text-xs text-muted">
                        {new Date(event.occurredAt).toLocaleDateString("he-IL")}
                        {" · "}
                        {new Date(event.occurredAt).toLocaleTimeString("he-IL", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                    {event.actorName ? (
                      <span className="rounded-full bg-black/[0.04] px-2 py-1 text-[11px] text-muted">
                        {event.actorName}
                      </span>
                    ) : null}
                  </div>

                  {event.reason && !event.reason.startsWith("פגישה:") ? (
                    <p className="mt-2 text-sm text-ink">{event.reason}</p>
                  ) : null}

                  {event.metadata?.canceledSessionsCount || event.metadata?.closedTasksCount ? (
                    <p className="mt-1 text-xs text-muted">
                      {`בוטלו ${event.metadata?.canceledSessionsCount ?? 0} פגישות · נסגרו ${event.metadata?.closedTasksCount ?? 0} משימות`}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </div>
      </details>
    </section>
  );
}

function eventLabel(eventType: LifecycleRow["eventType"], reason: string | null) {
  if (reason?.startsWith("פגישה:")) return reason;
  switch (eventType) {
    case "PATIENT_CREATED":
      return "פתיחת תיק מטופל";
    case "INQUIRY_LINKED":
      return "קישור פנייה למטופל";
    case "CONVERTED_TO_PATIENT":
      return "המרת פנייה לתיק מטופל";
    case "SET_INACTIVE":
      return "העברה למצב לא פעיל";
    case "REACTIVATED":
      return "השבה למצב פעיל";
    default:
      return eventType;
  }
}

function sessionStatusLabel(status: SessionStatus) {
  if (status === SessionStatus.COMPLETED) return "התקיימה";
  if (status === SessionStatus.SCHEDULED) return "נקבעה";
  if (status === SessionStatus.CANCELED) return "בוטלה";
  if (status === SessionStatus.CANCELED_LATE) return "בוטלה מאוחר";
  return "לא תועדה";
}
