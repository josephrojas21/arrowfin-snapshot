"use client";
import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { SnapshotAccount } from "@arrowfin/contracts";
import { ApiError, submitFill, type Session } from "./api";

export function FillSimulator({
  account,
  session,
  onSessionExpired,
}: {
  account: SnapshotAccount;
  session: Session;
  onSessionExpired: () => void;
}) {
  const client = useQueryClient();
  const [instrument, setInstrument] = useState(
    account.positions[0]?.instrument ?? "ES",
  );
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [quantity, setQuantity] = useState("1");
  const [price, setPrice] = useState(account.positions[0]?.marketPrice ?? "");
  const [commission, setCommission] = useState("0");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError("");
    setSuccess(false);
    setPending(true);
    try {
      await submitFill(session.accessToken, {
        account_id: account.id,
        instrument_symbol: instrument.trim().toUpperCase(),
        side,
        quantity: Number(quantity),
        price,
        commission_usd: commission,
      });
      setSuccess(true);
      await client.invalidateQueries({
        queryKey: ["snapshot", session.trader.brokerId, session.trader.id],
      });
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) {
        onSessionExpired();
        return;
      }
      setError(
        failure instanceof ApiError && failure.status === 400
          ? "Invalid fill. Check the instrument, quantity, price and commission."
          : failure instanceof Error
            ? failure.message
            : "The simulated fill could not be submitted.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <details className="panel simulator">
      <summary>
        Simulate a fill <span>DEVELOPMENT ONLY</span>
      </summary>
      <div className="simulator-body">
        <p>
          This records a simulated execution for <strong>{account.id}</strong>{" "}
          in the demo database. It changes positions, P&amp;L and risk; it does
          not place a market order.
        </p>
        <form
          onSubmit={submit}
          onChange={() => {
            setSuccess(false);
            setError("");
          }}
        >
          <fieldset disabled={pending}>
            <legend className="sr-only">Simulated execution details</legend>
            <div className="simulator-fields">
              <div>
                <label htmlFor="fill-instrument">Instrument</label>
                <input
                  id="fill-instrument"
                  value={instrument}
                  onChange={(event) => setInstrument(event.target.value)}
                  maxLength={20}
                  required
                  pattern="[A-Za-z0-9]+"
                />
              </div>
              <div>
                <label htmlFor="fill-side">Side</label>
                <select
                  id="fill-side"
                  value={side}
                  onChange={(event) =>
                    setSide(event.target.value as "BUY" | "SELL")
                  }
                >
                  <option value="BUY">BUY</option>
                  <option value="SELL">SELL</option>
                </select>
              </div>
              <div>
                <label htmlFor="fill-quantity">Quantity</label>
                <input
                  id="fill-quantity"
                  type="number"
                  min="1"
                  max="10000"
                  step="1"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  required
                />
              </div>
              <div>
                <label htmlFor="fill-price">Execution price</label>
                <input
                  id="fill-price"
                  type="number"
                  min="0.00000001"
                  max="1000000000000"
                  step="0.00000001"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                  required
                />
              </div>
              <div>
                <label htmlFor="fill-commission">
                  Commission / contract (USD)
                </label>
                <input
                  id="fill-commission"
                  type="number"
                  min="0"
                  max="1000000000000"
                  step="0.00000001"
                  value={commission}
                  onChange={(event) => setCommission(event.target.value)}
                  required
                />
              </div>
            </div>
            <button type="submit" className="primary-button simulator-submit">
              {pending
                ? "Submitting simulated execution…"
                : "Submit simulated execution"}
            </button>
          </fieldset>
          {error ? (
            <p className="inline-error" role="alert">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="positive simulator-result" role="status">
              Simulated execution recorded. The account snapshot is being
              refreshed.
            </p>
          ) : null}
        </form>
      </div>
    </details>
  );
}
