"use client";
import { useState } from "react";
import { C } from "@/config/colors";
import { useAuth } from "@/lib/auth/AuthProvider";

type Mode = "signin" | "signup";

/** Maps Firebase auth error codes to friendly copy. */
function friendlyError(code: string): string {
  switch (code) {
    case "auth/invalid-email":          return "That email doesn't look right.";
    case "auth/missing-password":       return "Please enter a password.";
    case "auth/weak-password":          return "Password should be at least 6 characters.";
    case "auth/email-already-in-use":   return "An account with this email already exists. Try signing in.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":         return "Email or password is incorrect.";
    case "auth/popup-closed-by-user":   return "Sign-in was cancelled.";
    default:                            return "Something went wrong. Please try again.";
  }
}

export default function SignInScreen() {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, configured } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      const code = (e as { code?: string })?.code ?? "";
      setError(friendlyError(code));
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "signin") run(() => signInWithEmail(email, password));
    else run(() => signUpWithEmail(email, password, name.trim() || undefined));
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", background: C.bg, border: `1px solid ${C.border}`,
    borderRadius: 8, padding: "11px 13px", fontSize: 14, color: C.ink, outline: "none",
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: C.bg }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        {/* Wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center", marginBottom: 8 }}>
          <div style={{ width: 3, height: 34, borderRadius: 2, background: C.teal }} />
          <div>
            <div style={{ color: C.ink, fontSize: 16, fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", lineHeight: 1 }}>
              Horizon
            </div>
            <div style={{ color: C.inkSoft, fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", marginTop: 4 }}>
              The Elegant Taper
            </div>
          </div>
        </div>
        <p style={{ textAlign: "center", color: C.inkSoft, fontSize: 13, marginTop: 14, marginBottom: 28 }}>
          {mode === "signin" ? "Welcome back. Sign in to your plan." : "Create an account to chart your horizon."}
        </p>

        {!configured && (
          <div style={{ background: C.warmWash, border: `1px solid ${C.warmLight}`, color: C.warm, borderRadius: 8, padding: "10px 12px", fontSize: 12, marginBottom: 18 }}>
            Firebase isn’t configured yet. Add your <code>NEXT_PUBLIC_FIREBASE_*</code> values to <code>.env.local</code> to enable sign-in.
          </div>
        )}

        <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, boxShadow: `0 1px 3px ${C.border}` }}>
          {/* Google */}
          <button
            type="button"
            disabled={busy || !configured}
            onClick={() => run(signInWithGoogle)}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, padding: "11px 0",
              fontSize: 14, fontWeight: 500, color: C.ink, cursor: busy || !configured ? "not-allowed" : "pointer",
              opacity: busy || !configured ? 0.6 : 1,
            }}
          >
            <GoogleGlyph /> Continue with Google
          </button>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0" }}>
            <div style={{ flex: 1, height: 1, background: C.border }} />
            <span style={{ color: C.inkFaint, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" }}>or</span>
            <div style={{ flex: 1, height: 1, background: C.border }} />
          </div>

          {/* Email/password */}
          <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {mode === "signup" && (
              <input style={inputStyle} type="text" placeholder="Name" value={name}
                     onChange={(e) => setName(e.target.value)} autoComplete="name" />
            )}
            <input style={inputStyle} type="email" placeholder="Email" value={email} required
                   onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            <input style={inputStyle} type="password" placeholder="Password" value={password} required
                   onChange={(e) => setPassword(e.target.value)}
                   autoComplete={mode === "signin" ? "current-password" : "new-password"} />

            {error && <p style={{ color: C.warm, fontSize: 12, margin: 0 }}>{error}</p>}

            <button
              type="submit"
              disabled={busy || !configured}
              style={{
                width: "100%", background: C.teal, color: "#fff", border: "none", borderRadius: 8,
                padding: "12px 0", fontSize: 14, fontWeight: 600, cursor: busy || !configured ? "not-allowed" : "pointer",
                opacity: busy || !configured ? 0.6 : 1, marginTop: 2,
              }}
            >
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>
        </div>

        {/* Toggle */}
        <p style={{ textAlign: "center", color: C.inkSoft, fontSize: 13, marginTop: 20 }}>
          {mode === "signin" ? "New here? " : "Already have an account? "}
          <button
            type="button"
            onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); }}
            style={{ background: "none", border: "none", color: C.tealDark, fontWeight: 600, cursor: "pointer", fontSize: 13 }}
          >
            {mode === "signin" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}
