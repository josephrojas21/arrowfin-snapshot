"use client";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";
import { API_URL, ApiError, getSnapshot, type Session } from "./api";
import { AccountSnapshot } from "./account-snapshot";
import { sessionDate, sessionTime } from "./format";

export function Dashboard({
  session,
  onSignOut,
}: {
  session: Session;
  onSignOut: () => void;
}) {
  const client = useQueryClient();
  const queryKey = ["snapshot", session.trader.brokerId, session.trader.id];
  const snapshot = useQuery({
    queryKey,
    queryFn: ({ signal }) => getSnapshot(session.accessToken, signal),
  });
  const [connection, setConnection] = useState<
    "connecting" | "connected" | "disconnected"
  >("connecting");
  const [selectedAccount, setSelectedAccount] = useState("");
  useEffect(() => {
    const key = ["snapshot", session.trader.brokerId, session.trader.id];
    const socket = io(API_URL, { auth: { token: session.accessToken } });
    socket.on("connect", () => {
      setConnection("connecting");
      void client.invalidateQueries({ queryKey: key }).then(() => {
        if (socket.connected) setConnection("connected");
      });
    });
    socket.on("disconnect", () => setConnection("disconnected"));
    socket.on("connect_error", () => setConnection("disconnected"));
    socket.on(
      "snapshot.updated",
      () => void client.invalidateQueries({ queryKey: key }),
    );
    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [client, session.accessToken, session.trader.brokerId, session.trader.id]);
  const account =
    snapshot.data?.accounts.find((item) => item.id === selectedAccount) ??
    snapshot.data?.accounts[0];
  const unauthorized =
    snapshot.error instanceof ApiError &&
    [401, 403].includes(snapshot.error.status);
  const stale = connection !== "connected" || snapshot.isError;
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">TRADER WORKSPACE</p>
          <h1>
            Daily snapshot<span className="heading-dot">.</span>
          </h1>
          <p className="subtitle">
            Your exposure, performance and risk — at a glance.
          </p>
        </div>
        <div className="identity">
          <span className="avatar" aria-hidden="true">
            ↗
          </span>
          <div>
            <strong>{session.trader.id}</strong>
            <small>{session.trader.brokerId}</small>
          </div>
          <button className="text-button" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </div>
      <div className="session-bar">
        <div>
          <span className="small-label">SESSION</span>
          <strong>
            {snapshot.data
              ? sessionDate(snapshot.data.asOf, snapshot.data.session.timeZone)
              : "Loading session…"}
          </strong>
          {snapshot.data ? (
            <span className="muted">{snapshot.data.session.timeZone}</span>
          ) : null}
        </div>
        <div
          className={`connection ${stale ? "connection-stale" : ""}`}
          role="status"
        >
          <span className="status-dot" />
          {connection === "connecting"
            ? "Connecting"
            : stale
              ? "Data may be stale"
              : snapshot.isFetching
                ? "Syncing snapshot"
                : "Live connection"}
        </div>
        <button
          className="secondary-button refresh"
          onClick={() => void snapshot.refetch()}
          disabled={snapshot.isFetching}
        >
          ↻ <span>Refresh</span>
        </button>
      </div>
      {stale && snapshot.data ? (
        <div className="notice" role="status">
          {snapshot.isError
            ? "The latest snapshot could not be loaded."
            : "Live updates are interrupted."}{" "}
          Displayed values may be outdated.{" "}
          {connection === "connected"
            ? "Refresh to try again."
            : "Reconnecting automatically; you can also refresh manually."}
        </div>
      ) : null}
      {snapshot.isPending ? (
        <div className="loading-state" role="status">
          <span className="spinner" />
          Loading your account snapshot…
        </div>
      ) : snapshot.isError && (!snapshot.data || unauthorized) ? (
        <div className="empty-state" role="alert">
          <h2>
            {unauthorized
              ? "Session unavailable"
              : "Unable to load your snapshot"}
          </h2>
          <p>{snapshot.error.message}</p>
          <button
            className="primary-button"
            onClick={unauthorized ? onSignOut : () => void snapshot.refetch()}
          >
            {unauthorized ? "Return to sign-in" : "Try again"}
          </button>
        </div>
      ) : snapshot.data && account ? (
        <>
          <div className="account-toolbar">
            <div className="account-picker">
              <label htmlFor="account">Account</label>
              <select
                id="account"
                value={account.id}
                onChange={(event) => setSelectedAccount(event.target.value)}
              >
                {snapshot.data.accounts.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.id}
                  </option>
                ))}
              </select>
              <span
                className={`account-status ${account.status.toLowerCase() === "active" ? "" : "inactive"}`}
              >
                {account.status}
              </span>
            </div>
            <span className="muted">
              {snapshot.data.accounts.length}{" "}
              {snapshot.data.accounts.length === 1 ? "account" : "accounts"} in
              your workspace
            </span>
          </div>
          <AccountSnapshot account={account} />
          <div className="snapshot-footnote">
            <span>
              As of{" "}
              {sessionTime(snapshot.data.asOf, snapshot.data.session.timeZone)}
            </span>
            <span>USD · Unrealized P&L is marked to market</span>
          </div>
        </>
      ) : (
        <div className="empty-state">
          <h2>No accounts yet</h2>
          <p>This trader has no accounts available in this workspace.</p>
        </div>
      )}
    </>
  );
}
