"use client";
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError, type Session } from "./api";
import { Login } from "./login";
import { Dashboard } from "./dashboard";

export function SnapshotApp() {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: (count, error) =>
              !(
                error instanceof ApiError && [401, 403].includes(error.status)
              ) && count < 2,
            refetchOnWindowFocus: true,
          },
        },
      }),
  );
  const [session, setSession] = useState<Session | null>(null);
  function changeSession(next: Session | null) {
    client.clear();
    setSession(next);
  }
  return (
    <QueryClientProvider client={client}>
      <div className="app-shell min-h-screen">
        <aside className="sidebar">
          <a className="brand" href="/" aria-label="ArrowFin home">
            <span className="brand-icon">↗</span>arrowfin
            <span className="brand-dot">.</span>
          </a>
          <div className="workspace-label">TRADING WORKSPACE</div>
          <div className="nav-active">
            <span aria-hidden="true">▦</span> Daily snapshot{" "}
            <span className="nav-dot" />
          </div>
          <div className="sidebar-bottom">
            <span className="security-icon" aria-hidden="true">
              ◇
            </span>
            <div>
              Private workspace<small>Account-scoped access</small>
            </div>
          </div>
        </aside>
        <div className="main-shell min-w-0">
          <header className="topbar">
            <div className="breadcrumb">
              Workspace <span>/</span> <strong>Daily snapshot</strong>
            </div>
            <span className="demo-badge">ASSESSMENT DEMO</span>
          </header>
          <main>
            {session ? (
              <Dashboard
                key={`${session.trader.brokerId}:${session.trader.id}`}
                session={session}
                onSignOut={() => changeSession(null)}
              />
            ) : (
              <Login onLogin={changeSession} />
            )}
          </main>
          <footer>
            ARROWFIN <span>Trading intelligence, in focus.</span>
            <span className="footer-right">Assessment environment</span>
          </footer>
        </div>
      </div>
    </QueryClientProvider>
  );
}
