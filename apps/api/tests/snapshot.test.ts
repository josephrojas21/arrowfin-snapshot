import { describe, expect, it } from "vitest";
import {
  calculateSnapshot,
  tradingSession,
  Fill,
} from "../src/domain/snapshot";
const instrument = {
  symbol: "MES",
  pointValue: "5",
  initialMargin: "1320",
  markPrice: "110",
};
const fill = (
  id: string,
  side: "BUY" | "SELL",
  quantity: number,
  price: string,
  filledAt = "2026-08-25T12:00:00.000Z",
): Fill => ({
  id,
  instrumentSymbol: "MES",
  side,
  quantity,
  price,
  commission: "1.40",
  filledAt,
});
const snapshot = (fills: Fill[], balance = "10000") =>
  calculateSnapshot(
    [{ id: "A", balance, status: "active", fills }],
    [instrument],
    "2026-08-25T14:30:00.000Z",
    "v",
  ).accounts[0];
describe("snapshot math", () => {
  it("uses Chicago Globex open and close rather than UTC midnight", () => {
    expect(tradingSession("2026-08-25T14:30:00Z")).toEqual({
      start: "2026-08-24T22:00:00.000Z",
      end: "2026-08-25T21:00:00.000Z",
      timeZone: "America/Chicago",
    });
    expect(tradingSession("2026-01-05T14:30:00Z").start).toBe(
      "2026-01-04T23:00:00.000Z",
    );
  });
  it("retains prior-session basis, multiplies contracts, and charges today commission per contract", () => {
    const result = snapshot([
      fill("1", "BUY", 3, "100", "2026-08-24T10:00:00.000Z"),
      fill("2", "SELL", 1, "106"),
    ]);
    expect(result.realizedPnl).toBe("28.60");
    expect(result.commissions).toBe("1.40");
    expect(result.unrealizedPnl).toBe("100.00");
    expect(result.riskScore).toBe(11);
    expect(result.positions[0]).toEqual({
      instrument: "MES",
      netQuantity: 2,
      averagePrice: "100.00000000",
      marketPrice: "110.00000000",
      unrealizedPnl: "100.00",
      notional: "1100.00",
    });
  });
  it("handles short close and reversal", () => {
    const result = snapshot([
      fill("1", "SELL", 2, "120"),
      fill("2", "BUY", 3, "105"),
    ]);
    expect(result.realizedPnl).toBe("143.00");
    expect(result.unrealizedPnl).toBe("25.00");
    expect(result.positions[0].netQuantity).toBe(1);
  });
  it("uses execution sequence for fills sharing the fixed demo timestamp", () => {
    const result = snapshot([
      { ...fill("z", "BUY", 1, "100"), sequence: 1 },
      { ...fill("a", "SELL", 2, "120"), sequence: 2 },
      { ...fill("b", "BUY", 1, "110"), sequence: 3 },
    ]);
    expect(result.realizedPnl).toBe("144.40");
    expect(result.positions).toEqual([]);
  });
  it("weighted average, zero balances, future fills and no trades", () => {
    const result = snapshot(
      [
        fill("1", "BUY", 1, "100"),
        fill("2", "BUY", 3, "104"),
        fill("3", "SELL", 4, "200", "2026-08-26T12:00:00.000Z"),
      ],
      "0",
    );
    expect(result.positions[0].averagePrice).toBe("103.00000000");
    expect(result.commissions).toBe("5.60");
    expect(result.riskScore).toBeNull();
    expect(snapshot([]).positions).toEqual([]);
    expect(snapshot([]).realizedPnl).toBe("0.00");
  });
});
