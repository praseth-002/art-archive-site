"use client";

import { FormEvent, useState } from "react";

export function LoginForm() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setLoading(true);
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: data.get("password") }) });
    const result = await response.json() as { error?: string };
    if (!response.ok) { setError(result.error || "Could not sign in."); setLoading(false); return; }
    window.location.reload();
  }

  return <div className="login-wrap"><form className="login-card" onSubmit={submit}>
    <p className="eyebrow">Private studio</p><h1>Welcome back.</h1><p>This area is only for managing the archive. Enter your studio password to continue.</p>
    <div className="field"><label htmlFor="password">Studio password</label><input id="password" name="password" type="password" autoComplete="current-password" required /></div>
    {error && <p className="error" role="alert">{error}</p>}
    <button className="button" disabled={loading}>{loading ? "Opening…" : "Enter studio"}</button>
  </form></div>;
}
