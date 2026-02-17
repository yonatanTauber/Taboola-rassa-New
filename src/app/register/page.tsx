"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppLogo } from "@/components/AppLogo";

const PROFESSION_OPTIONS = [
  "מטפל/ת באמנויות",
  "פסיכותרפיסט/ית",
  "פסיכולוג/ית קליני/ת",
  "עובד/ת סוציאלי/ת קליני/ת",
  "פסיכיאטר/ית",
];

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [profession, setProfession] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, email, password, profession, dateOfBirth, inviteCode }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({ error: "לא ניתן להשלים הרשמה כרגע." }))) as { error?: string };
      setError(data.error ?? "שגיאה בהרשמה.");
      setLoading(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-xl items-center">
      <section className="surface-card w-full rounded-2xl border border-black/20 p-6 md:p-7">
        <div className="mb-5 flex items-center gap-3">
          <AppLogo compact />
          <div>
            <h1 className="text-xl font-semibold text-ink">יצירת משתמש חדש</h1>
            <p className="text-sm text-muted">פתיחת חשבון מאובטח לשימוש במערכת.</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
          <label className="block text-sm text-muted md:col-span-2">
            שם מלא
            <input
              type="text"
              name="fullName"
              autoComplete="name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="app-field mt-1"
              placeholder="יונתן ישראלי"
            />
          </label>

          <label className="block text-sm text-muted md:col-span-2">
            מייל
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="app-field mt-1"
              placeholder="name@example.com"
            />
          </label>

          <label className="block text-sm text-muted">
            מקצוע
            <select
              name="profession"
              required
              value={profession}
              onChange={(e) => setProfession(e.target.value)}
              className="app-select mt-1"
            >
              <option value="" disabled>
                בחר/י מקצוע
              </option>
              {PROFESSION_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm text-muted">
            תאריך לידה
            <input
              type="date"
              name="dateOfBirth"
              autoComplete="bday"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className="app-field mt-1"
            />
          </label>
          <label className="block text-sm text-muted md:col-span-2">
            קוד הזמנה (אם נדרש)
            <input
              type="text"
              name="inviteCode"
              autoComplete="off"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              className="app-field mt-1"
              placeholder="הכנס/י קוד הזמנה"
            />
          </label>

          <label className="block text-sm text-muted md:col-span-2">
            סיסמה
            <div className="mt-1 flex items-center gap-2">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="app-field"
                placeholder="לפחות 8 תווים"
              />
              <button type="button" className="app-btn app-btn-secondary whitespace-nowrap" onClick={() => setShowPassword((v) => !v)}>
                {showPassword ? "הסתר" : "הצג"}
              </button>
            </div>
          </label>

          {error ? <p className="text-sm text-danger md:col-span-2">{error}</p> : null}

          <div className="flex items-center justify-between pt-1 md:col-span-2">
            <Link href="/login" className="text-sm text-accent hover:underline">
              כבר יש לי חשבון
            </Link>
            <button type="submit" disabled={loading} className="app-btn app-btn-primary disabled:opacity-60">
              {loading ? "יוצר חשבון..." : "הרשמה"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
