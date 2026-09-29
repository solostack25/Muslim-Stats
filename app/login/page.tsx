"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null); setMsg(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return setErr(error.message);
    router.push("/dashboard");
    router.refresh();
  }

  async function sendLink() {
    if (!email) return setErr("Enter your email first.");
    setBusy(true); setErr(null); setMsg(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setBusy(false);
    if (error) return setErr(error.message);
    setMsg("Check your email for a sign-in link.");
  }

  return (
    <main className="auth">
      <a href="/" className="wordmark">txbyt</a>
      <h2 style={{ marginTop: 32 }}>Sign in to the dashboard</h2>
      <form onSubmit={signIn}>
        <div>
          <label htmlFor="email">Email</label>
          <input id="email" className="input" type="email" autoComplete="email" required
            value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label htmlFor="password">Password</label>
          <input id="password" className="input" type="password" autoComplete="current-password"
            value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button className="btn primary" disabled={busy}>Sign in</button>
        <button type="button" className="btn quiet" onClick={sendLink} disabled={busy}>
          Email me a sign-in link instead
        </button>
        {err && <p className="error">{err}</p>}
        {msg && <p>{msg}</p>}
      </form>
    </main>
  );
}
