'use client';

import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { Session } from "@supabase/supabase-js";

type Props = {
  session: Session | null;
};

export default function AuthSection({ session }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus("");

    const authCall =
      mode === "signin"
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password });

    const { error } = await authCall;
    if (error) {
      setStatus(error.message);
    } else {
      setStatus(mode === "signin" ? "Signed in" : "Account created. Check your email if confirmations are required.");
    }
    setLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  if (session) {
    return (
      <div className="panel">
        <div className="section-heading">
          <span>Signed in</span>
          <button className="secondary" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
        <p className="muted">{session.user.email}</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="section-heading">Sign in to start planning</div>
      <form className="grid" onSubmit={handleSubmit}>
        <div>
          <label>Email</label>
          <input
            required
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label>Password</label>
          <input
            required
            type="password"
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="action-row">
          <button type="submit" disabled={loading}>
            {loading ? "Working..." : mode === "signin" ? "Sign in" : "Create account"}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            Switch to {mode === "signin" ? "Sign up" : "Sign in"}
          </button>
          {status && <span className="status">{status}</span>}
        </div>
      </form>
    </div>
  );
}
