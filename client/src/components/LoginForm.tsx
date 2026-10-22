import { useState, type FormEvent } from "react";
import { login } from "../api";
import type { Session } from "../types";
import { ButtonLabel } from "./Ui";

interface Props {
  onLogin: (session: Session) => void;
}

export function LoginForm({ onLogin }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault(); // stop the browser's full-page form submit
    setBusy(true);
    setError(null);
    try {
      onLogin(await login(username, password));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="band band-grey signin">
      <h1 className="band-title">Agent sign in</h1>
      <p className="band-lead">Book, confirm and ticket flights for your customers.</p>
      <form className="panel signin-panel" onSubmit={handleSubmit}>
        <label className="field">
          <span className="field-label">Username</span>
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
        </label>
        <label className="field">
          <span className="field-label">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error && (
          <p className="notice" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn-primary" disabled={busy}>
          <ButtonLabel>{busy ? "Signing in…" : "Sign in"}</ButtonLabel>
        </button>
        <p className="hint">
          Demo logins for <code>agent</code> and <code>admin</code> are in <code>appsettings.Local.json</code>, and{" "}
          <code>start-demo.ps1</code> prints them.
        </p>
      </form>
    </section>
  );
}
