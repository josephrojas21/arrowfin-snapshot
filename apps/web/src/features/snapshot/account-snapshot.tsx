import type { Snapshot } from "@arrowfin/contracts";
import { money, price, pnlClass } from "./format";

export function AccountSnapshot({
  account,
}: {
  account: Snapshot["accounts"][number];
}) {
  const highRisk = account.riskScore !== null && account.riskScore > 75;
  const riskLabel =
    account.riskScore === null
      ? "Unavailable"
      : highRisk
        ? "Elevated risk"
        : "Within threshold";
  return (
    <>
      <div className="metrics">
        <Metric
          label="ACCOUNT BALANCE"
          value={account.balance}
          note="Starting account balance"
        />
        <Metric
          label="REALIZED P&L"
          value={account.realizedPnl}
          note="Current trading session"
          signed
        />
        <Metric
          label="UNREALIZED P&L"
          value={account.unrealizedPnl}
          note="Across open positions"
          signed
        />
        <Metric
          label="COMMISSIONS"
          value={account.commissions}
          note="Current trading session"
        />
      </div>
      <div className="detail-grid">
        <section className="panel positions-panel">
          <div className="panel-heading">
            <div>
              <h2>
                Open positions{" "}
                <span className="count-badge">{account.positions.length}</span>
              </h2>
              <p>Your current market exposure</p>
            </div>
            <span className="outlined-label">POSITIONS</span>
          </div>
          {account.positions.length === 0 ? (
            <div className="positions-empty">
              <span aria-hidden="true">◎</span>
              <h3>No open positions</h3>
              <p>
                You are flat. New positions will appear here when a fill is
                recorded.
              </p>
            </div>
          ) : (
            <div
              className="table-scroll"
              tabIndex={0}
              role="region"
              aria-label="Open positions table, horizontally scrollable"
            >
              <table>
                <caption className="sr-only">
                  Open positions for account {account.id}. All monetary values
                  are in USD.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Instrument</th>
                    <th scope="col">Position</th>
                    <th scope="col">Avg. price</th>
                    <th scope="col">Market price</th>
                    <th scope="col">Notional</th>
                    <th scope="col">Unrealized P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {account.positions.map((position) => (
                    <tr key={position.instrument}>
                      <td>
                        <span className="instrument-icon" aria-hidden="true">
                          ↗
                        </span>
                        <strong>{position.instrument}</strong>
                      </td>
                      <td>
                        <span
                          className={`direction ${position.netQuantity < 0 ? "short" : ""}`}
                        >
                          {position.netQuantity < 0 ? "SHORT" : "LONG"}
                        </span>{" "}
                        <span className="tabular">
                          {Math.abs(position.netQuantity)}
                        </span>
                      </td>
                      <td>{price(position.averagePrice)}</td>
                      <td>{price(position.marketPrice)}</td>
                      <td>{money(position.notional)}</td>
                      <td className={pnlClass(position.unrealizedPnl)}>
                        {money(position.unrealizedPnl)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="panel-footer">
            <span className="status-dot" />
            Positions include carried exposure from earlier sessions.
          </div>
        </section>
        <section
          className={`panel risk-panel ${highRisk ? "risk-high" : ""}`}
          aria-label="Account risk"
        >
          <div className="panel-heading">
            <div>
              <h2>Risk monitor</h2>
              <p>Account exposure score</p>
            </div>
            <span aria-hidden="true">◈</span>
          </div>
          <div className="risk-number">
            {account.riskScore === null ? "—" : account.riskScore.toFixed(1)}
            <span>/ 100</span>
          </div>
          <div
            className="risk-track"
            role="meter"
            aria-label="Risk score"
            aria-valuemin={0}
            aria-valuemax={100}
            {...(account.riskScore === null
              ? { "aria-valuetext": "Risk score unavailable" }
              : { "aria-valuenow": account.riskScore })}
          >
            <div
              style={{
                width: `${Math.max(0, Math.min(100, account.riskScore ?? 0))}%`,
              }}
            />
            <span />
          </div>
          <div className="risk-scale">
            <span>0</span>
            <span>75 threshold</span>
            <span>100</span>
          </div>
          <div className="risk-label">
            {highRisk ? "!" : "◉"} {riskLabel}
          </div>
          <p className="risk-description">
            {account.riskReason ??
              (highRisk
                ? "Your exposure is above the 75-point threshold. Review your open positions."
                : "Risk scores above 75 are flagged for attention.")}
          </p>
        </section>
      </div>
    </>
  );
}
function Metric({
  label,
  value,
  note,
  signed = false,
}: {
  label: string;
  value: string;
  note: string;
  signed?: boolean;
}) {
  return (
    <section className="metric">
      <p>{label}</p>
      <strong className={signed ? pnlClass(value) : ""}>{money(value)}</strong>
      <span>{note}</span>
    </section>
  );
}
