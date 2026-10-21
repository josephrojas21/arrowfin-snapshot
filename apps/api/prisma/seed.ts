import { PrismaClient } from "@prisma/client";
import { parse } from "csv-parse/sync";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const db = new PrismaClient({ log: [] });
const dir = resolve(process.env.DATASET_DIR ?? "./dataset");
const rows = (file: string): Record<string, string>[] =>
  parse(readFileSync(resolve(dir, file)), {
    columns: true,
    skip_empty_lines: true,
    bom: true,
  });
async function seed() {
  const traders = rows("traders.csv");
  const brokerFor = new Map(traders.map((t) => [t.id, t.broker_id]));
  const marks = new Map(
    rows("market_prices.csv").map((m) => [m.symbol, m.mark_price]),
  );
  // Persist sensitive operational IDs and trading data only. Direct identity fields and free-text support notes are excluded.
  // Parse before opening the transaction; send one bulk insert per dependency level.
  const accounts = rows("accounts.csv");
  const instruments = rows("instruments.csv");
  const fills = rows("fills.csv");
  await db.$transaction(
    async (tx) => {
      await tx.trader.createMany({
        data: traders.map((t) => ({ id: t.id, brokerId: t.broker_id })),
        skipDuplicates: true,
      });
      await tx.account.createMany({
        data: accounts.map((a) => ({
          id: a.id,
          traderId: a.trader_id,
          brokerId: brokerFor.get(a.trader_id)!,
          status: a.status,
          balance: a.balance || "0",
        })),
        skipDuplicates: true,
      });
      await tx.instrument.createMany({
        data: instruments.map((i) => ({
          symbol: i.symbol,
          pointValue: i.point_value_usd,
          initialMargin: i.initial_margin_usd,
          markPrice: marks.get(i.symbol)!,
        })),
        skipDuplicates: true,
      });
      await tx.fill.createMany({
        data: fills.map((f) => ({
          id: f.id,
          accountId: f.account_id,
          instrumentSymbol: f.instrument_symbol,
          side: f.side,
          quantity: Number(f.quantity),
          price: f.price,
          commission: f.commission_usd,
          filledAt: new Date(f.filled_at),
          orderId: f.order_id,
        })),
        skipDuplicates: true,
      });
    },
    { timeout: 60000 },
  );
  console.info("Dataset seeded without overwriting existing records.");
}
seed()
  .catch(() => {
    console.error("Seed failed; check dataset and database configuration.");
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
