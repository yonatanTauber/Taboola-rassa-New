"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { AppLogo } from "@/components/AppLogo";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({ error: "לא ניתן להתחבר כרגע." }))) as { error?: string };
      setError(data.error ?? "שגיאה בהתחברות.");
      setLoading(false);
      return;
    }
    window.location.assign("/");
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-lg items-center">
      <section className="surface-card w-full rounded-2xl border border-black/20 p-6 md:p-7">
        <div className="mb-5 flex items-center gap-3">
          <AppLogo compact />
          <div>
            <h1 className="text-xl font-semibold text-ink">ברוכים הבאים לטאבולה ראסה</h1>
            <p className="text-sm text-muted">מערכת לניהול קליניקה, ידע מקצועי וחיבורים קליניים.</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block text-sm text-muted">
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
            סיסמה
            <div className="mt-1 flex items-center gap-2">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                autoComplete="current-password"
                required
                minLength={8}
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

          {error ? <p className="text-sm text-danger">{error}</p> : null}

          <div className="flex items-center justify-between pt-1">
            <Link href="/register" className="text-sm text-accent hover:underline">
              אין חשבון? הרשמה חדשה
            </Link>
            <button type="submit" disabled={loading} className="app-btn app-btn-primary disabled:opacity-60">
              {loading ? "מתחבר..." : "כניסה"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
