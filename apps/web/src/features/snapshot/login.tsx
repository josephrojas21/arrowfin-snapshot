"use client";
import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getAuthConfig,
  credentialsLogin,
  ApiError,
  listTraders,
  login,
  type Session,
} from "./api";

export function Login({ onLogin }: { onLogin: (session: Session) => void }) {
  const config = useQuery({
    queryKey: ["auth-config"],
    queryFn: ({ signal }) => getAuthConfig(signal),
    retry: false,
  });
  const mode = config.data?.mode;
  const traders = useQuery({
    queryKey: ["demo-traders"],
    enabled: mode === "demo",
    queryFn: ({ signal }) => listTraders(signal),
    retry: false,
  });
  const [selected, setSelected] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || pending || !mode || (mode === "credentials" && !password))
      return;
    setPending(true);
    setError("");
    try {
      const result =
        mode === "demo"
          ? await login(selected)
          : await credentialsLogin(selected, password);
      setPassword("");
      onLogin({ ...result, authMode: mode });
    } catch (failure) {
      setPassword("");
      setError(
        failure instanceof ApiError && failure.status === 401
          ? mode === "demo"
            ? "This demo trader is unavailable."
            : "Invalid trader ID or password."
          : failure instanceof Error
            ? failure.message
            : "Sign-in failed.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="login-layout">
      <div>
        <p className="eyebrow">YOUR SESSION. ONE CLEAR VIEW.</p>
        <h1>
          Every position.
          <br />
          <span>In perspective.</span>
        </h1>
        <p className="intro">
          A focused view of your positions, performance and risk. Connected to
          your trading session in real time.
        </p>
        <div className="intro-feature">
          <span>01</span> Account-level performance
        </div>
        <div className="intro-feature">
          <span>02</span> Live position updates
        </div>
        <div className="intro-feature">
          <span>03</span> Risk that stays in view
        </div>
      </div>
      <div className="login-card shadow-2xl shadow-black/10">
        <div className="card-symbol" aria-hidden="true">
          ↗
        </div>
        <p className="eyebrow">
          {mode === "demo" ? "DEVELOPMENT ACCESS" : "PRIVATE ACCESS"}
        </p>
        <h2>Open your workspace</h2>
        <p>
          {mode === "demo"
            ? "Choose a dataset identity to explore the demo. This selector is available only when demo authentication is enabled."
            : "Sign in with your assigned trader ID and password to access your accounts."}
        </p>
        {config.isPending ? (
          <p role="status">Loading sign-in configuration…</p>
        ) : config.isError ? (
          <div className="inline-error" role="alert">
            Sign-in configuration is unavailable. Please try again.
            <button
              className="text-button"
              type="button"
              onClick={() => void config.refetch()}
            >
              Try again
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            {mode === "demo" ? (
              <>
                <label htmlFor="trader">Demo trader</label>
                <select
                  id="trader"
                  value={selected}
                  onChange={(event) => setSelected(event.target.value)}
                  disabled={pending || traders.isPending || traders.isError}
                >
                  <option value="">
                    {traders.isPending ? "Loading traders…" : "Select a trader"}
                  </option>
                  {traders.data?.traders.map((trader) => (
                    <option key={trader.id} value={trader.id}>
                      {trader.id} · {trader.brokerId}
                    </option>
                  ))}
                </select>
                {traders.isError ? (
                  <div className="inline-error" role="alert">
                    Demo sign-in is unavailable. The API may be offline or demo
                    authentication disabled.
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => void traders.refetch()}
                    >
                      Try again
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <label htmlFor="trader-id">Trader ID</label>
                <input
                  id="trader-id"
                  autoComplete="username"
                  value={selected}
                  onChange={(event) => setSelected(event.target.value)}
                  required
                  disabled={pending}
                  maxLength={100}
                />
                <label htmlFor="password" className="field-label">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  disabled={pending}
                />
              </>
            )}
            {error ? (
              <p className="inline-error" role="alert">
                {error}
              </p>
            ) : null}
            <button
              className="primary-button"
              disabled={
                !selected || pending || (mode === "credentials" && !password)
              }
              type="submit"
            >
              {pending ? "Opening workspace…" : "Enter workspace"}
              <span aria-hidden="true">↗</span>
            </button>
          </form>
        )}
        <div className="login-note">
          {mode === "demo" ? "Demo identities only · " : ""}Session kept in
          memory
        </div>
      </div>
    </section>
  );
}
