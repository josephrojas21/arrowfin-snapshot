import { describe, expect, it } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { parseNewFill } from "../src/adapters/validation";

describe("fill HTTP payload validation", () => {
  it("rejects an array side instead of coercing it to BUY", () => {
    expect(() =>
      parseNewFill({
        account_id: "A1",
        instrument_symbol: "MES",
        side: ["BUY"],
        quantity: 1,
        price: "100",
        commission_usd: "1.40",
      }),
    ).toThrow(BadRequestException);
  });
  it("accepts the documented scalar payload", () => {
    expect(
      parseNewFill({
        account_id: "A1",
        instrument_symbol: "MES",
        side: "BUY",
        quantity: 1,
        price: "100",
        commission_usd: "1.40",
      }),
    ).toEqual({
      account_id: "A1",
      instrument_symbol: "MES",
      side: "BUY",
      quantity: 1,
      price: "100",
      commission_usd: "1.4",
    });
  });
});
