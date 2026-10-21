import {
  BadRequestException,
  HttpException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
const derive = promisify(scrypt);
type Credential = { traderId: string; salt: string; hash: string };

/** Single-instance reviewer access. IP comes from the socket, never a client header. */
export class ReviewerCredentials {
  private readonly attempts = new Map<
    string,
    { count: number; until: number }
  >();
  private inFlight = 0;
  constructor(
    private readonly config: () => string | undefined = () =>
      process.env.REVIEWER_CREDENTIALS_JSON,
    private readonly now: () => number = Date.now,
  ) {}

  private load(): Credential[] {
    try {
      const value: unknown = JSON.parse(this.config() ?? "null");
      if (!Array.isArray(value) || value.length === 0 || value.length > 100)
        throw new Error();
      const seen = new Set<string>();
      for (const entry of value) {
        if (
          !entry ||
          typeof entry !== "object" ||
          typeof entry.traderId !== "string" ||
          !entry.traderId ||
          entry.traderId.length > 100 ||
          seen.has(entry.traderId) ||
          typeof entry.salt !== "string" ||
          !/^(?:[a-fA-F0-9]{2}){16,64}$/.test(entry.salt) ||
          typeof entry.hash !== "string" ||
          !/^[a-fA-F0-9]{128}$/.test(entry.hash)
        )
          throw new Error();
        seen.add(entry.traderId);
      }
      return value as Credential[];
    } catch {
      throw new ServiceUnavailableException(
        "Credential login is not configured",
      );
    }
  }

  async verify(body: unknown, peerIp: string): Promise<string> {
    this.limit(peerIp);
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new BadRequestException();
    const { traderId, password } = body as Record<string, unknown>;
    if (
      typeof traderId !== "string" ||
      !traderId ||
      traderId.length > 100 ||
      typeof password !== "string" ||
      password.length === 0 ||
      password.length > 1024
    )
      throw new BadRequestException();
    const credentials = this.load();
    const credential = credentials.find((entry) => entry.traderId === traderId);
    if (this.inFlight >= 4)
      throw new HttpException("Too many login requests", 429);
    this.inFlight++;
    try {
      // Unknown identities pay the same scrypt cost and receive the same response.
      const salt = Buffer.from(credential?.salt ?? "00".repeat(32), "hex");
      const expected = Buffer.from(credential?.hash ?? "00".repeat(64), "hex");
      const actual = (await derive(password, salt, 64)) as Buffer;
      const matches = timingSafeEqual(actual, expected);
      if (!credential || !matches) throw new UnauthorizedException();
      return credential.traderId;
    } finally {
      this.inFlight--;
    }
  }

  private limit(peerIp: string) {
    const now = this.now();
    for (const [key, state] of this.attempts)
      if (state.until <= now) this.attempts.delete(key);
    let state = this.attempts.get(peerIp);
    if (!state) {
      if (this.attempts.size >= 10000)
        throw new HttpException("Too many login requests", 429);
      state = { count: 0, until: now + 15 * 60_000 };
      this.attempts.set(peerIp, state);
    }
    state.count++;
    if (state.count > 10)
      throw new HttpException("Too many login requests", 429);
  }
}
