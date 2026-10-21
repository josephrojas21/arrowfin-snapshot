import { describe, it, expect } from "vitest";
import { scryptSync } from "node:crypto";
import {
  BadRequestException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ReviewerCredentials } from "../src/adapters/credentials";
const salt = "12".repeat(32);
const config = JSON.stringify([
  {
    traderId: "TRADER-TEST",
    salt,
    hash: scryptSync(
      "test-only-password",
      Buffer.from(salt, "hex"),
      64,
    ).toString("hex"),
  },
]);
describe("reviewer credentials", () => {
  it("accepts a valid salted password and ignores a client broker claim", async () => {
    const auth = new ReviewerCredentials(() => config);
    await expect(
      auth.verify(
        {
          traderId: "TRADER-TEST",
          password: "test-only-password",
          brokerId: "FORGED",
        },
        "peer",
      ),
    ).resolves.toBe("TRADER-TEST");
  });
  it("rejects incorrect passwords and unknown traders identically", async () => {
    const auth = new ReviewerCredentials(() => config);
    await expect(
      auth.verify({ traderId: "TRADER-TEST", password: "wrong" }, "peer"),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      auth.verify(
        { traderId: "UNKNOWN", password: "test-only-password" },
        "peer",
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it.each([
    undefined,
    "not-json",
    "[]",
    "{}",
    '[{"traderId":"T","salt":"aa","hash":"bb"}]',
  ])("fails closed for invalid configuration %s", async (value) => {
    await expect(
      new ReviewerCredentials(() => value).verify(
        { traderId: "T", password: "any" },
        "peer",
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
  it.each([
    null,
    [],
    { traderId: ["TRADER-TEST"], password: "x" },
    { traderId: "TRADER-TEST", password: 123 },
    { traderId: "TRADER-TEST", password: "x".repeat(1025) },
  ])("rejects malformed login bodies", async (body) => {
    await expect(
      new ReviewerCredentials(() => config).verify(body, "peer"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it("limits attempts per peer and releases expired entries", async () => {
    let now = 0;
    const auth = new ReviewerCredentials(
      () => config,
      () => now,
    );
    for (let i = 0; i < 10; i++)
      await expect(auth.verify(null, "peer")).rejects.toBeInstanceOf(
        BadRequestException,
      );
    await expect(auth.verify(null, "peer")).rejects.toMatchObject({
      status: 429,
    });
    now = 900001;
    await expect(auth.verify(null, "peer")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
