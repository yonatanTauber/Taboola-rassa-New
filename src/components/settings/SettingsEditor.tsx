"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuickActions } from "@/components/QuickActions";

type SettingsState = {
  therapistName: string;
  email: string;
  phone: string;
  clinicAddress: string;
  sessionMinutes: number;
  defaultFee: number;
  cancellationWindowHours: number;
  remindBeforeSession: boolean;
  autoChargeLateCancel: boolean;
  partialPayment: boolean;
  whatsappTemplates: boolean;
  debtReminders: boolean;
  missingDocReminder: boolean;
  lockOnIdle: boolean;
  twoFactor: boolean;
  hidePatientIds: boolean;
  auditLog: boolean;
  encryptedBackup: boolean;
  cloudSync: boolean;
  ocrAuto: boolean;
  aiLinkSuggestions: boolean;
};

type SettingsProfile = {
  therapistName?: string;
  email?: string;
  defaultFee?: number;
};

const STORAGE_KEY_PREFIX = "tabula.settings.v1";

const DEFAULT_SETTINGS: SettingsState = {
  therapistName: "",
  email: "",
  phone: "050-0000000",
  clinicAddress: "תל אביב",
  sessionMinutes: 50,
  defaultFee: 350,
  cancellationWindowHours: 24,
  remindBeforeSession: true,
  autoChargeLateCancel: true,
  partialPayment: true,
  whatsappTemplates: true,
  debtReminders: true,
  missingDocReminder: true,
  lockOnIdle: true,
  twoFactor: false,
  hidePatientIds: true,
  auditLog: true,
  encryptedBackup: true,
  cloudSync: false,
  ocrAuto: true,
  aiLinkSuggestions: true,
};

export function SettingsEditor({ initialProfile, canManageInvites = false }: { initialProfile?: SettingsProfile; canManageInvites?: boolean }) {
  const { showToast } = useQuickActions();
  const storageKey = useMemo(
    () => buildStorageKey(initialProfile?.email),
    [initialProfile?.email],
  );
  const [settings, setSettings] = useState<SettingsState>(() => buildDefaultSettings(initialProfile));

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<SettingsState>;
      const timer = window.setTimeout(() => {
        setSettings((prev) => {
          const next = { ...prev, ...parsed };
          const parsedEmail = typeof parsed.email === "string" ? parsed.email.trim() : "";
          const parsedTherapistName = typeof parsed.therapistName === "string" ? parsed.therapistName.trim() : "";

          if (!parsedEmail || parsedEmail === DEFAULT_SETTINGS.email) {
            const profileEmail = initialProfile?.email?.trim().toLowerCase();
            if (profileEmail) next.email = profileEmail;
          }
          if (!parsedTherapistName || parsedTherapistName === DEFAULT_SETTINGS.therapistName) {
            const profileName = initialProfile?.therapistName?.trim();
            if (profileName) next.therapistName = profileName;
          }
          return next;
        });
      }, 0);
      return () => window.clearTimeout(timer);
    } catch {
      return;
    }
  }, [initialProfile, storageKey]);

  function save() {
    window.localStorage.setItem(storageKey, JSON.stringify(settings));
    showToast({ message: "ההגדרות נשמרו" });
  }

  return (
    <main className="space-y-3">
      <section className="grid gap-3 lg:grid-cols-2">
        <Card title="פרופיל קליניקה">
          <Field label="שם מטפל"><input className="app-field" name="therapistName" autoComplete="off" value={settings.therapistName} onChange={(e) => setSettings((s) => ({ ...s, therapistName: e.target.value }))} /></Field>
          <Field label="אימייל"><input className="app-field" name="email" autoComplete="off" spellCheck={false} type="email" value={settings.email} onChange={(e) => setSettings((s) => ({ ...s, email: e.target.value }))} /></Field>
          <Field label="טלפון"><input className="app-field" name="phone" autoComplete="off" type="tel" inputMode="tel" value={settings.phone} onChange={(e) => setSettings((s) => ({ ...s, phone: e.target.value }))} /></Field>
          <Field label="כתובת קליניקה"><input className="app-field" name="clinicAddress" autoComplete="off" value={settings.clinicAddress} onChange={(e) => setSettings((s) => ({ ...s, clinicAddress: e.target.value }))} /></Field>
        </Card>

        <Card title="שעות וחיובים">
          <Field label="ברירת מחדל משך פגישה (דקות)"><input type="number" min={30} className="app-field" name="sessionMinutes" inputMode="numeric" value={settings.sessionMinutes} onChange={(e) => setSettings((s) => ({ ...s, sessionMinutes: Number(e.target.value || 50) }))} /></Field>
          <Field label="ברירת מחדל עלות טיפול (₪)"><input type="number" min={0} className="app-field" name="defaultFee" inputMode="numeric" value={settings.defaultFee} onChange={(e) => setSettings((s) => ({ ...s, defaultFee: Number(e.target.value || 0) }))} /></Field>
          <Field label="חלון ביטול ללא חיוב (שעות)"><input type="number" min={0} className="app-field" name="cancellationWindowHours" inputMode="numeric" value={settings.cancellationWindowHours} onChange={(e) => setSettings((s) => ({ ...s, cancellationWindowHours: Number(e.target.value || 0) }))} /></Field>
          <Toggle label="תזכורת לפני פגישה" checked={settings.remindBeforeSession} onChange={(value) => setSettings((s) => ({ ...s, remindBeforeSession: value }))} />
          <Toggle label="חיוב אוטומטי על ביטול מאוחר" checked={settings.autoChargeLateCancel} onChange={(value) => setSettings((s) => ({ ...s, autoChargeLateCancel: value }))} />
          <Toggle label="תשלום חלקי" checked={settings.partialPayment} onChange={(value) => setSettings((s) => ({ ...s, partialPayment: value }))} />
        </Card>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <Card title="תקשורת ואבטחה">
          <Toggle label="תבניות WhatsApp" checked={settings.whatsappTemplates} onChange={(value) => setSettings((s) => ({ ...s, whatsappTemplates: value }))} />
          <Toggle label="תזכורות חוב פתוח" checked={settings.debtReminders} onChange={(value) => setSettings((s) => ({ ...s, debtReminders: value }))} />
          <Toggle label="תזכורת לתיעוד חסר" checked={settings.missingDocReminder} onChange={(value) => setSettings((s) => ({ ...s, missingDocReminder: value }))} />
          <Toggle label="נעילה אוטומטית" checked={settings.lockOnIdle} onChange={(value) => setSettings((s) => ({ ...s, lockOnIdle: value }))} />
          <Toggle label="אימות דו שלבי" checked={settings.twoFactor} onChange={(value) => setSettings((s) => ({ ...s, twoFactor: value }))} />
          <Toggle label="הסתרת מזהי מטופלים" checked={settings.hidePatientIds} onChange={(value) => setSettings((s) => ({ ...s, hidePatientIds: value }))} />
          <Toggle label="Audit log לשינויים" checked={settings.auditLog} onChange={(value) => setSettings((s) => ({ ...s, auditLog: value }))} />
        </Card>

        <Card title="גיבוי ומחקר">
          <Toggle label="גיבוי מוצפן" checked={settings.encryptedBackup} onChange={(value) => setSettings((s) => ({ ...s, encryptedBackup: value }))} />
          <Toggle label="סנכרון ענן" checked={settings.cloudSync} onChange={(value) => setSettings((s) => ({ ...s, cloudSync: value }))} />
          <Toggle label="OCR אוטומטי" checked={settings.ocrAuto} onChange={(value) => setSettings((s) => ({ ...s, ocrAuto: value }))} />
          <Toggle label="הצעות קשרים AI" checked={settings.aiLinkSuggestions} onChange={(value) => setSettings((s) => ({ ...s, aiLinkSuggestions: value }))} />
        </Card>
      </section>

      <section className="app-section flex flex-wrap gap-2">
        <button className="app-btn app-btn-primary" onClick={save}>שמור הגדרות</button>
        {canManageInvites ? (
          <Link href="/invites" className="app-btn app-btn-secondary">
            ניהול הזמנות משתמשים
          </Link>
        ) : null}
      </section>
    </main>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="app-section">
      <h2 className="mb-3 text-base font-semibold text-ink">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <label className="flex items-center justify-between rounded-lg border border-black/14 bg-white/95 px-3 py-2 text-sm">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
    </label>
  );
}

function buildDefaultSettings(initialProfile?: SettingsProfile): SettingsState {
  const therapistName = initialProfile?.therapistName?.trim();
  const email = initialProfile?.email?.trim().toLowerCase();
  const defaultFee = typeof initialProfile?.defaultFee === "number" && initialProfile.defaultFee > 0
    ? Math.trunc(initialProfile.defaultFee)
    : DEFAULT_SETTINGS.defaultFee;
  return {
    ...DEFAULT_SETTINGS,
    therapistName: therapistName || DEFAULT_SETTINGS.therapistName,
    email: email || DEFAULT_SETTINGS.email,
    defaultFee,
  };
}

function buildStorageKey(email: string | undefined) {
  const normalized = String(email ?? "").trim().toLowerCase();
  return normalized ? `${STORAGE_KEY_PREFIX}:${normalized}` : STORAGE_KEY_PREFIX;
}
