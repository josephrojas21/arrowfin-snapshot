import DecimalJs from "decimal.js";
const Decimal = DecimalJs.clone({ precision: 40 });
type Decimal = DecimalJs;

export interface Identity {
  traderId: string;
  brokerId: string;
}
export interface Fill {
  id: string;
  sequence?: number;
  instrumentSymbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  price: string;
  commission: string;
  filledAt: string;
}
export interface Instrument {
  symbol: string;
  pointValue: string;
  initialMargin: string;
  markPrice: string;
}
export interface Account {
  id: string;
  status: string;
  balance: string;
  fills: Fill[];
}

/** Convert a Chicago wall-clock hour to UTC, including DST transitions. */
function chicagoUtc(day: string, hour: number): Date {
  const guess = new Date(`${day}T${String(hour).padStart(2, "0")}:00:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    timeZoneName: "longOffset",
  }).formatToParts(guess);
  const offset = parts
    .find((p) => p.type === "timeZoneName")!
    .value.match(/GMT([+-])(\d{2}):(\d{2})/)!;
  const minutes =
    (Number(offset[2]) * 60 + Number(offset[3])) * (offset[1] === "+" ? 1 : -1);
  return new Date(guess.getTime() - minutes * 60_000);
}
export function tradingSession(asOf: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(asOf));
  const value = (type: string) => parts.find((p) => p.type === type)!.value;
  const day = `${value("year")}-${value("month")}-${value("day")}`;
  const shift = (n: number) =>
    new Date(new Date(`${day}T12:00:00Z`).getTime() + n * 86_400_000)
      .toISOString()
      .slice(0, 10);
  const afterOpen = Number(value("hour")) >= 17;
  return {
    start: chicagoUtc(afterOpen ? day : shift(-1), 17).toISOString(),
    end: chicagoUtc(afterOpen ? shift(1) : day, 16).toISOString(),
    timeZone: "America/Chicago",
  };
}
export function calculateSnapshot(
  accounts: Account[],
  instruments: Instrument[],
  asOf: string,
  version: string,
) {
  const session = tradingSession(asOf);
  const specs = new Map(instruments.map((i) => [i.symbol, i]));
  return {
    asOf,
    session,
    version,
    accounts: [...accounts]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((account) => {
        const positions = new Map<
          string,
          { quantity: number; basis: Decimal }
        >();
        let realized = new Decimal(0),
          commissions = new Decimal(0),
          unrealized = new Decimal(0),
          grossNotional = new Decimal(0);
        for (const fill of [...account.fills].sort(
          (a, b) =>
            Date.parse(a.filledAt) - Date.parse(b.filledAt) ||
            (a.sequence ?? 0) - (b.sequence ?? 0) ||
            a.id.localeCompare(b.id),
        )) {
          if (Date.parse(fill.filledAt) > Date.parse(asOf)) continue;
          const spec = specs.get(fill.instrumentSymbol);
          if (!spec) throw new Error("Missing instrument specification");
          const today =
            Date.parse(fill.filledAt) >= Date.parse(session.start) &&
            Date.parse(fill.filledAt) < Date.parse(session.end);
          const price = new Decimal(fill.price),
            signed = fill.quantity * (fill.side === "BUY" ? 1 : -1);
          const current = positions.get(fill.instrumentSymbol) ?? {
            quantity: 0,
            basis: new Decimal(0),
          };
          if (today)
            commissions = commissions.plus(
              new Decimal(fill.commission).times(fill.quantity),
            );
          if (
            current.quantity === 0 ||
            Math.sign(current.quantity) === Math.sign(signed)
          ) {
            current.basis = current.basis
              .times(Math.abs(current.quantity))
              .plus(price.times(fill.quantity))
              .div(Math.abs(current.quantity) + fill.quantity);
          } else {
            const closed = Math.min(Math.abs(current.quantity), fill.quantity);
            if (today)
              realized = realized.plus(
                price
                  .minus(current.basis)
                  .times(Math.sign(current.quantity))
                  .times(closed)
                  .times(spec.pointValue),
              );
            if (fill.quantity > Math.abs(current.quantity))
              current.basis = price;
          }
          current.quantity += signed;
          if (current.quantity === 0) current.basis = new Decimal(0);
          positions.set(fill.instrumentSymbol, current);
        }
        const output = [...positions.entries()]
          .filter(([, p]) => p.quantity !== 0)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([instrument, p]) => {
            const spec = specs.get(instrument)!;
            const pnl = new Decimal(spec.markPrice)
              .minus(p.basis)
              .times(p.quantity)
              .times(spec.pointValue);
            unrealized = unrealized.plus(pnl);
            grossNotional = grossNotional.plus(
              new Decimal(spec.markPrice)
                .times(spec.pointValue)
                .times(Math.abs(p.quantity)),
            );
            return {
              instrument,
              netQuantity: p.quantity,
              averagePrice: p.basis.toFixed(8),
              marketPrice: new Decimal(spec.markPrice).toFixed(8),
              unrealizedPnl: pnl.toFixed(2),
              notional: new Decimal(spec.markPrice)
                .times(Math.abs(p.quantity))
                .times(spec.pointValue)
                .toFixed(2),
            };
          });
        const balance = new Decimal(account.balance);
        return {
          id: account.id,
          status: account.status,
          balance: balance.toFixed(2),
          realizedPnl: realized.minus(commissions).toFixed(2),
          unrealizedPnl: unrealized.toFixed(2),
          commissions: commissions.toFixed(2),
          riskScore: balance.gt(0)
            ? Decimal.min(100, grossNotional.div(balance).times(100))
                .toDecimalPlaces(2)
                .toNumber()
            : null,
          riskReason: balance.gt(0) ? null : "Balance is zero or negative",
          positions: output,
        };
      }),
  };
}
