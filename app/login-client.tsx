"use client";

import { FormEvent, useState } from "react";
import { KeyRound, LogIn, Mail, RefreshCw, WifiOff } from "lucide-react";

const LOGIN_TIMEOUT_MS = 15_000;

export default function LoginClient() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!navigator.onLine) {
      setError("Internet မရရှိပါ။ Connection စစ်ပြီး ပြန်စမ်းပါ");
      return;
    }
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), LOGIN_TIMEOUT_MS);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
        }),
        cache: "no-store",
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({ error: "Server မှ အဖြေမှန်ကန်စွာ မရရှိပါ" }));
      if (!response.ok) throw new Error(data.error || "ဝင်ရောက်၍မရပါ");
      window.location.replace("/");
    } catch (loginError) {
      if (loginError instanceof DOMException && loginError.name === "AbortError") {
        setError("Server ချိတ်ဆက်ချိန်ကြာနေပါသည်။ Internet စစ်ပြီး ပြန်စမ်းပါ");
      } else {
        setError(loginError instanceof Error ? loginError.message : "ဝင်ရောက်၍မရပါ");
      }
    } finally {
      window.clearTimeout(timeout);
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-logo"><img src="/app-icon.svg" alt="Nawaratt Logo" /></div>
        <p className="login-eyebrow">MEDICAL OPERATIONS</p>
        <h1>Nawaratt</h1>
        <p className="login-intro">Admin သတ်မှတ်ပေးထားသော Email နှင့် Password ဖြင့် ဝင်ရောက်ပါ</p>

        <form className="login-form" onSubmit={submit}>
          <label>
            <span>Email</span>
            <div><Mail size={18} /><input name="email" type="email" inputMode="email" autoCapitalize="none" autoComplete="email" placeholder="name@gmail.com" required /></div>
          </label>
          <label><span>Password</span><div><KeyRound size={18} /><input name="password" type="password" autoComplete="current-password" placeholder="Password" required /></div></label>
          {error && <p className="login-error" role="alert"><WifiOff size={17} /> <span>{error}</span></p>}
          <button type="submit" disabled={busy}>{busy ? <RefreshCw className="spin" size={18} /> : <LogIn size={18} />}{busy ? "စစ်ဆေးနေပါသည်…" : "Application ဝင်ရန်"}</button>
        </form>

        <p className="login-help">ဝင်မရပါက Admin ထံမှ Email နှင့် Password ကို စစ်ဆေးပါ</p>
      </section>
    </main>
  );
}
