import { describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  AccessDenied,
  PrismaSnapshotRepository,
} from "../src/adapters/repository";
import { TokenAuth, roomFor, devEnabled } from "../src/adapters/auth";
import { SnapshotService } from "../src/application/service";
describe("isolation and auth", () => {
  it("requires valid scoped signed tokens and rejects tampering", () => {
    const auth = new TokenAuth("a".repeat(40));
    const token = auth.issue({ traderId: "T1", brokerId: "B1" });
    expect(auth.verify(token)).toEqual({ traderId: "T1", brokerId: "B1" });
    expect(() => auth.verify(`${token}x`)).toThrow();
    expect(() => auth.verify(undefined)).toThrow();
    expect(roomFor({ traderId: "T1", brokerId: "B1" })).not.toBe(
      roomFor({ traderId: "T1", brokerId: "B2" }),
    );
  });
  it.each([
    { traderId: "other-trader", brokerId: "B1" },
    { traderId: "T1", brokerId: "other-broker" },
  ])("denies unowned fill before insertion %j", async (identity) => {
    const tx = {
      account: { findFirst: vi.fn().mockResolvedValue(null) },
      fill: { create: vi.fn() },
    };
    const db = { $transaction: async (fn: (t: unknown) => unknown) => fn(tx) };
    const repo = new PrismaSnapshotRepository(db as unknown as PrismaClient);
    await expect(
      repo.addFill(
        identity,
        {
          account_id: "A1",
          instrument_symbol: "MES",
          side: "BUY",
          quantity: 1,
          price: "100",
          commission_usd: "1.4",
        },
        "2026-08-25T14:30:00Z",
      ),
    ).rejects.toBeInstanceOf(AccessDenied);
    expect(tx.account.findFirst).toHaveBeenCalledWith({
      where: {
        id: "A1",
        traderId: identity.traderId,
        brokerId: identity.brokerId,
      },
    });
    expect(tx.fill.create).not.toHaveBeenCalled();
  });
  it("queries snapshots with both identity boundaries", async () => {
    const db = {
      account: { findMany: vi.fn().mockResolvedValue([]) },
      instrument: { findMany: vi.fn().mockResolvedValue([]) },
    };
    await new PrismaSnapshotRepository(db as unknown as PrismaClient).read(
      { traderId: "T1", brokerId: "B1" },
      "2026-08-25T14:30:00Z",
    );
    expect(db.account.findMany.mock.calls[0][0].where).toEqual({
      traderId: "T1",
      brokerId: "B1",
    });
  });
  it("never emits success when persistence rejects", async () => {
    const events = { updated: vi.fn() };
    const repo = {
      read: vi.fn(),
      addFill: vi.fn().mockRejectedValue(new Error("db")),
    };
    const service = new SnapshotService(
      repo,
      events,
      () => "2026-08-25T14:30:00Z",
    );
    await expect(
      service.addFill(
        { traderId: "T1", brokerId: "B1" },
        {
          account_id: "A1",
          instrument_symbol: "MES",
          side: "BUY",
          quantity: 1,
          price: "100",
          commission_usd: "1",
        },
      ),
    ).rejects.toThrow();
    expect(events.updated).not.toHaveBeenCalled();
  });
  it("disables dev endpoints in production even with flag", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENABLE_DEV_TOOLS", "true");
    expect(devEnabled()).toBe(false);
    vi.unstubAllEnvs();
  });
});
