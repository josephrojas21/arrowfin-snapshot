import { BadRequestException } from "@nestjs/common";
import Decimal from "decimal.js";
import { NewFill } from "../application/service";

export function parseNewFill(raw: unknown): NewFill {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new BadRequestException();
  const body = raw as Record<string, unknown>;
  const decimal = (value: unknown, positive: boolean) => {
    if (typeof value !== "string" && typeof value !== "number")
      throw new BadRequestException();
    try {
      const d = new Decimal(value);
      if (
        !d.isFinite() ||
        (positive ? d.lte(0) : d.lt(0)) ||
        d.gt("1000000000000") ||
        d.decimalPlaces() > 8
      )
        throw new Error();
      return d.toFixed();
    } catch {
      throw new BadRequestException();
    }
  };
  if (
    typeof body.account_id !== "string" ||
    body.account_id.length === 0 ||
    body.account_id.length > 100 ||
    typeof body.instrument_symbol !== "string" ||
    body.instrument_symbol.length === 0 ||
    body.instrument_symbol.length > 20 ||
    typeof body.side !== "string" ||
    !["BUY", "SELL"].includes(body.side) ||
    !Number.isSafeInteger(body.quantity) ||
    Number(body.quantity) < 1 ||
    Number(body.quantity) > 10000
  )
    throw new BadRequestException();
  return {
    account_id: body.account_id,
    instrument_symbol: body.instrument_symbol,
    side: body.side as "BUY" | "SELL",
    quantity: Number(body.quantity),
    price: decimal(body.price, true),
    commission_usd: decimal(body.commission_usd, false),
  };
}
