"use client";
import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { listTraders, login, type Session } from "./api";

export function Login({ onLogin }: { onLogin: (session: Session) => void }) {
  const traders = useQuery({
    queryKey: ["demo-traders"],
    queryFn: ({ signal }) => listTraders(signal),
    retry: false,
  });
  const [selected, setSelected] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || pending) return;
    setPending(true);
    setError("");
    try {
      onLogin(await login(selected));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Sign-in failed.");
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
        <p className="eyebrow">DEVELOPMENT ACCESS</p>
        <h2>Open your workspace</h2>
        <p>
          Choose a dataset identity to explore the demo. This selector is
          available only when demo authentication is enabled.
        </p>
        <form onSubmit={submit}>
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
          {error ? (
            <p className="inline-error" role="alert">
              {error}
            </p>
          ) : null}
          <button
            className="primary-button"
            disabled={!selected || pending}
            type="submit"
          >
            {pending ? "Opening workspace…" : "Enter workspace"}
            <span aria-hidden="true">↗</span>
          </button>
        </form>
        <div className="login-note">
          Demo identities only · Session kept in memory
        </div>
      </div>
    </section>
  );
}
