"use client";

import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { HebrewDateInput } from "@/components/HebrewDateInput";
import {
  createContext,
  FormEvent,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type ActionType = "task" | "session" | "note";

type ToastInput = {
  message: string;
  durationMs?: number;
  undoLabel?: string;
  onUndo?: () => Promise<void> | void;
  anchor?: { x: number; y: number };
};

type QuickActionsContextValue = {
  openAction: (type: ActionType) => void;
  showToast: (toast: ToastInput) => void;
  openMenu: boolean;
  menuAnimatingOut: boolean;
  toggleMenu: () => void;
  closeMenuWithAnimation: () => void;
};

type PatientOption = {
  id: string;
  name: string;
  defaultSessionFeeNis?: number | null;
};

const HOURS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, step) => String(step * 5).padStart(2, "0"));

const QuickActionsContext = createContext<QuickActionsContextValue | null>(null);

export function QuickActionsProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [openMenu, setOpenMenu] = useState(false);
  const [openAction, setOpenAction] = useState<ActionType | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [toast, setToast] = useState<(ToastInput & { id: number }) | null>(null);
  const [menuAnimatingOut, setMenuAnimatingOut] = useState(false);
  const [dirtyCloseOpen, setDirtyCloseOpen] = useState(false);
  const closeMenuTimer = useRef<number | null>(null);

  const [sessionForm, setSessionForm] = useState(() => defaultSessionForm());
  const [taskForm, setTaskForm] = useState(() => defaultTaskForm());
  const [noteForm, setNoteForm] = useState(() => defaultNoteForm());

  const closeMenuWithAnimation = useCallback(() => {
    if (!openMenu) return;
    setOpenMenu(false);
    setMenuAnimatingOut(true);
    if (closeMenuTimer.current) {
      window.clearTimeout(closeMenuTimer.current);
    }
    closeMenuTimer.current = window.setTimeout(() => {
      setMenuAnimatingOut(false);
      closeMenuTimer.current = null;
    }, 220);
  }, [openMenu]);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/patients/options", { cache: "no-store", signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setPatients((data as { patients: PatientOption[] }).patients);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);



  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!openMenu) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-quick-add-root='true']")) return;
      closeMenuWithAnimation();
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [openMenu, closeMenuWithAnimation]);

  const toggleMenu = useCallback(() => {
    if (openMenu) {
      closeMenuWithAnimation();
      return;
    }
    if (closeMenuTimer.current) {
      window.clearTimeout(closeMenuTimer.current);
      closeMenuTimer.current = null;
    }
    setMenuAnimatingOut(false);
    setOpenMenu(true);
  }, [openMenu, closeMenuWithAnimation]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.durationMs ?? 2000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(
    () => () => {
      if (closeMenuTimer.current) {
        window.clearTimeout(closeMenuTimer.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!isDirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const showToast = useCallback((payload: ToastInput) => {
    setToast({ id: Date.now(), ...payload });
  }, []);

  const openActionModal = useCallback((type: ActionType) => {
    setOpenMenu(false);
    setMenuAnimatingOut(false);
    if (type === "session") {
      setSessionForm(defaultSessionForm());
    }
    if (type === "task") {
      setTaskForm(defaultTaskForm());
    }
    if (type === "note") {
      setNoteForm(defaultNoteForm());
    }
    setIsDirty(false);
    setOpenAction(type);
  }, []);

  const ctx = useMemo(
    () => ({
      openAction: openActionModal,
      showToast,
      openMenu,
      menuAnimatingOut,
      toggleMenu,
      closeMenuWithAnimation,
    }),
    [openActionModal, showToast, openMenu, menuAnimatingOut, toggleMenu, closeMenuWithAnimation],
  );

  const toastStyle = toast?.anchor
    ? {
        left:
          typeof window !== "undefined"
            ? Math.min(window.innerWidth - 320, Math.max(16, toast.anchor.x - 160))
            : 16,
        top: Math.max(72, toast.anchor.y - 72),
      }
    : { right: 20, top: 84 };

  function attemptCloseAction() {
    if (isDirty) {
      setDirtyCloseOpen(true);
      return;
    }
    setIsDirty(false);
    setOpenAction(null);
  }

  async function createSession(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const date = sessionForm.date;
    const hour = sessionForm.hour;
    const minute = sessionForm.minute;

    if (!sessionForm.patientId || !date) return;

    const scheduledAt = toIsoFromParts(date, hour, minute);

    const payload = {
      patientId: sessionForm.patientId,
      scheduledAt,
      feeNis: sessionForm.feeNis,
      location: sessionForm.location,
      note: sessionForm.note,
    };

    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      showToast({ message: "שמירת הפגישה נכשלה. נסה שוב." });
      return;
    }
    const data = (await res.json()) as { sessionId: string };

    setIsDirty(false);
    setOpenAction(null);
    router.push("/");
    showToast({
      message: "הפגישה הוזנה בהצלחה",
      durationMs: 4500,
      undoLabel: "↺",
      onUndo: async () => {
        await fetch(`/api/sessions/${data.sessionId}`, { method: "DELETE" });
        router.refresh();
      },
    });
  }

  async function createTask(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!taskForm.title.trim()) {
      showToast({ message: "יש להזין טקסט למשימה." });
      return;
    }

    const payload = {
      title: taskForm.title,
      patientId: taskForm.patientId,
      dueAt: taskForm.dueDate || "",
      reminderAt: taskForm.withReminder && taskForm.dueDate ? `${taskForm.dueDate}T09:00` : "",
    };

    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      showToast({ message: "שמירת המשימה נכשלה. נסה שוב." });
      return;
    }
    const data = (await res.json()) as { taskId: string };

    setIsDirty(false);
    setOpenAction(null);
    router.refresh();
    showToast({
      message: "המשימה נכנסה למערכת",
      durationMs: 4500,
      undoLabel: "↺",
      onUndo: async () => {
        await fetch(`/api/tasks/${data.taskId}`, { method: "DELETE" });
        router.refresh();
      },
    });
  }

  async function createNote(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const payload = {
      title: noteForm.title,
      content: noteForm.content,
      patientId: noteForm.patientId,
      relatedEntityType: noteForm.relatedEntityType,
      relatedEntityId: noteForm.relatedEntityId,
    };

    const res = await fetch("/api/research-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      showToast({ message: "שמירת הפתק נכשלה. נסה שוב." });
      return;
    }

    setIsDirty(false);
    setOpenAction(null);
    router.refresh();
    showToast({
      message: "הפתק נשמר במרחב המחקר",
      durationMs: 3000,
    });
  }

  return (
    <QuickActionsContext.Provider value={ctx}>
      {children}


      <ActionModal
        open={openAction === "session"}
        title="הזנת פגישה"
        onClose={attemptCloseAction}
      >
        <form onSubmit={createSession} className="space-y-3 text-sm">
          <label className="block space-y-1">
            <span className="text-xs text-muted">מטופל</span>
            <select
              required
              name="patientId" autoComplete="off" value={sessionForm.patientId}
              onChange={(e) => {
                const patientId = e.target.value;
                const selected = patients.find((p) => p.id === patientId);
                setSessionForm((prev) => ({
                  ...prev,
                  patientId,
                  feeNis: selected?.defaultSessionFeeNis ? String(selected.defaultSessionFeeNis) : prev.feeNis,
                }));
                setIsDirty(true);
              }}
              className="app-select"
            >
              <option value="">בחר מטופל</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-[1fr_auto_auto] items-end gap-2">
            <label className="space-y-1">
              <span className="text-xs text-muted">תאריך</span>
              <HebrewDateInput
                namePrefix="sessionDate"
                ariaLabelPrefix="תאריך פגישה"
                value={sessionForm.date}
                onChange={(next) => {
                  setSessionForm((prev) => ({ ...prev, date: next }));
                  setIsDirty(true);
                }}
              />
            </label>
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                setSessionForm((prev) => ({ ...prev, date: toDateInput(now) }));
                setIsDirty(true);
              }}
              className="app-btn app-btn-secondary text-xs"
            >
              היום
            </button>
          </div>

          <div className="space-y-1">
            <span className="text-xs text-muted">שעת מפגש</span>
            <div className="flex items-end gap-2">
              <label className="sr-only">דקות</label>
              <select
                name="sessionMinute" autoComplete="off" value={sessionForm.minute}
                onChange={(e) => {
                  setSessionForm((prev) => ({ ...prev, minute: e.target.value }));
                  setIsDirty(true);
                }}
                className="app-select app-time-select"
              >
                {MINUTES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              <span className="pb-2 text-sm text-muted">:</span>
              <label className="sr-only">שעה</label>
              <select
                name="sessionHour" autoComplete="off" value={sessionForm.hour}
                onChange={(e) => {
                  setSessionForm((prev) => ({ ...prev, hour: e.target.value }));
                  setIsDirty(true);
                }}
                className="app-select app-time-select"
              >
                {HOURS.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              <div className="mb-[1px] rounded-md border border-black/10 bg-black/[0.02] px-2 py-1 text-[11px] text-muted">
                50 דק׳
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-xs text-muted">מחיר (₪)</span>
              <input
                type="number"
                min="0"
                name="feeNis" autoComplete="off" inputMode="numeric" value={sessionForm.feeNis}
                onChange={(e) => {
                  setSessionForm((prev) => ({ ...prev, feeNis: e.target.value }));
                  setIsDirty(true);
                }}
                className="app-field"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-muted">מיקום</span>
              <select
                name="location" autoComplete="off" value={sessionForm.location}
                onChange={(e) => {
                  setSessionForm((prev) => ({ ...prev, location: e.target.value }));
                  setIsDirty(true);
                }}
                className="app-select"
              >
                <option value="קליניקה">קליניקה</option>
                <option value="אונליין">אונליין</option>
              </select>
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-xs text-muted">תוכן הפגישה (אופציונלי)</span>
            <textarea
              name="sessionNote" autoComplete="off" value={sessionForm.note}
              onChange={(e) => {
                setSessionForm((prev) => ({ ...prev, note: e.target.value }));
                setIsDirty(true);
              }}
              className="app-textarea min-h-28"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={attemptCloseAction} className="app-btn app-btn-secondary">
              ביטול
            </button>
            <button type="submit" className="app-btn app-btn-primary">
              שמור
            </button>
          </div>
        </form>
      </ActionModal>

      <ActionModal
        open={openAction === "task"}
        title="הוספת משימה"
        onClose={attemptCloseAction}
      >
        <form onSubmit={createTask} className="space-y-3 text-sm">
          <label className="block space-y-1">
            <span className="text-xs text-muted">משימה</span>
            <textarea
              required
              name="taskTitle" autoComplete="off" value={taskForm.title}
              onChange={(e) => {
                setTaskForm((prev) => ({ ...prev, title: e.target.value }));
                setIsDirty(true);
              }}
              placeholder="כתוב משימה בטקסט חופשי… לדוגמה: לתאם הדרכה"
              className="app-textarea min-h-24"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs text-muted">שיוך</span>
            <select
              name="taskPatientId" autoComplete="off" value={taskForm.patientId}
              onChange={(e) => {
                setTaskForm((prev) => ({ ...prev, patientId: e.target.value }));
                setIsDirty(true);
              }}
              className="app-select"
            >
              <option value="">משימה כללית לקליניקה</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-xs text-muted">תאריך ביצוע</span>
            <HebrewDateInput
              namePrefix="taskDue"
              ariaLabelPrefix="תאריך משימה"
              value={taskForm.dueDate}
              onChange={(next) => {
                setTaskForm((prev) => ({ ...prev, dueDate: next }));
                setIsDirty(true);
              }}
            />
          </label>

          <label className="flex items-center gap-2 rounded-lg border border-black/10 px-3 py-2">
            <input
              type="checkbox"
              checked={taskForm.withReminder}
              onChange={(e) => {
                setTaskForm((prev) => ({ ...prev, withReminder: e.target.checked }));
                setIsDirty(true);
              }}
              className="size-4 accent-accent"
            />
            <span>תזכורת במערכת</span>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={attemptCloseAction} className="app-btn app-btn-secondary">
              ביטול
            </button>
            <button type="submit" className="app-btn app-btn-primary">
              שמור
            </button>
          </div>
        </form>
      </ActionModal>

      <ActionModal
        open={openAction === "note"}
        title="פתק חופשי"
        onClose={attemptCloseAction}
      >
        <form onSubmit={createNote} className="space-y-3 text-sm">
          <label className="block space-y-1">
            <span className="text-xs text-muted">נושא</span>
            <input
              required
              name="noteTitle" autoComplete="off" value={noteForm.title}
              onChange={(e) => {
                setNoteForm((prev) => ({ ...prev, title: e.target.value }));
                setIsDirty(true);
              }}
              className="app-field"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-xs text-muted">קישור</span>
              <select
                name="noteRelatedType" autoComplete="off" value={noteForm.relatedEntityType}
                onChange={(e) => {
                  setNoteForm((prev) => ({
                    ...prev,
                    relatedEntityType: e.target.value,
                    relatedEntityId: "",
                    patientId: "",
                  }));
                  setIsDirty(true);
                }}
                className="app-select"
              >
                <option value="">ללא קישור</option>
                <option value="PATIENT">מטופל</option>
                <option value="RESEARCH_DOCUMENT">מאמר</option>
                <option value="OTHER">ישות אחרת</option>
              </select>
            </label>

            {noteForm.relatedEntityType === "PATIENT" ? (
              <label className="space-y-1">
                <span className="text-xs text-muted">בחר מטופל</span>
                <select
                  name="notePatientId" autoComplete="off" value={noteForm.patientId}
                  onChange={(e) => {
                    setNoteForm((prev) => ({ ...prev, patientId: e.target.value }));
                    setIsDirty(true);
                  }}
                  className="app-select"
                >
                  <option value="">ללא מטופל</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="space-y-1">
                <span className="text-xs text-muted">מזהה/שם יעד</span>
                <input
                  name="noteRelatedId" autoComplete="off" value={noteForm.relatedEntityId}
                  onChange={(e) => {
                    setNoteForm((prev) => ({ ...prev, relatedEntityId: e.target.value }));
                    setIsDirty(true);
                  }}
                  placeholder="לדוגמה: מאמר, מושג או ישות…"
                  className="app-field"
                />
              </label>
            )}
          </div>

          <label className="block space-y-1">
            <span className="text-xs text-muted">תוכן</span>
            <textarea
              name="noteContent" autoComplete="off" value={noteForm.content}
              onChange={(e) => {
                setNoteForm((prev) => ({ ...prev, content: e.target.value }));
                setIsDirty(true);
              }}
              className="app-textarea min-h-44"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={attemptCloseAction} className="app-btn app-btn-secondary">
              ביטול
            </button>
            <button type="submit" className="app-btn app-btn-primary">
              שמור
            </button>
          </div>
        </form>
      </ActionModal>

      <ConfirmDialog
        open={dirtyCloseOpen}
        title="לסגור בלי לשמור?"
        message="יש שינויים שלא נשמרו. האם לצאת בלי שמירה?"
        confirmLabel="צא בלי שמירה"
        cancelLabel="המשך עריכה"
        onCancel={() => setDirtyCloseOpen(false)}
        onConfirm={() => {
          setDirtyCloseOpen(false);
          setIsDirty(false);
          setOpenAction(null);
        }}
      />

      {toast ? (
        <div
          className="fixed z-[70] min-w-72 rounded-xl border border-accent/25 bg-white px-4 py-3 shadow-xl" aria-live="polite" role="status"
          style={toastStyle}
        >
          <div className="text-sm text-ink">{toast.message}</div>
          {toast.undoLabel && toast.onUndo ? (
            <button
              className="mt-2 inline-flex size-7 items-center justify-center rounded-full border border-accent/35 bg-accent-soft text-accent" aria-label="ביטול פעולה"
              title="ביטול פעולה"
              onClick={async () => {
                await toast.onUndo?.();
                setToast(null);
              }}
            >
              <span aria-hidden>↺</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </QuickActionsContext.Provider>
  );
}

function ActionModal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`fixed inset-0 z-[65] flex items-center justify-center bg-black/20 backdrop-blur-sm transition-opacity duration-150 overscroll-contain ${
        open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      }`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`relative rounded-2xl border border-black/10 bg-white p-5 shadow-2xl transition-all ${
          open ? "animate-[modal-pop_180ms_ease-out]" : "animate-[modal-close_180ms_ease-in]"
        } h-auto w-[min(92vw,760px)]`}
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md border border-black/10 px-2 py-1 text-xs hover:bg-accent-soft"
        >
          סגור
        </button>
        <h3 className="mb-4 text-lg font-semibold text-ink">{title}</h3>
        <div className="max-h-[72vh] overflow-auto">{children}</div>
      </div>
    </div>
  );
}

function defaultTaskForm() {
  const now = new Date();
  return {
    title: "",
    patientId: "",
    dueDate: toDateInput(now),
    withReminder: true,
  };
}

function defaultNoteForm() {
  return {
    title: "",
    relatedEntityType: "",
    relatedEntityId: "",
    patientId: "",
    content: "",
  };
}

function defaultSessionForm() {
  const now = new Date();
  return {
    patientId: "",
    date: toDateInput(now),
    hour: String(now.getHours()).padStart(2, "0"),
    minute: String(Math.floor(now.getMinutes() / 5) * 5).padStart(2, "0"),
    feeNis: "",
    location: "קליניקה",
    note: "",
  };
}

function toDateInput(date: Date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 10);
}

function toIsoFromParts(dateStr: string, hour: string, minute: string) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, (month ?? 1) - 1, day ?? 1, Number(hour), Number(minute));
  return date.toISOString();
}

export function useQuickActions() {
  const ctx = useContext(QuickActionsContext);
  if (!ctx) throw new Error("useQuickActions must be used inside QuickActionsProvider");
  return ctx;
}
