import jwt from "jsonwebtoken";
import { Identity } from "../domain/snapshot";
export class TokenAuth {
  constructor(private readonly secret: string) {
    if (secret.length < 32)
      throw new Error("JWT_SECRET must contain at least 32 characters");
  }
  issue(identity: Identity) {
    return jwt.sign({ brokerId: identity.brokerId }, this.secret, {
      subject: identity.traderId,
      algorithm: "HS256",
      expiresIn: "1h",
      audience: "arrowfin",
      issuer: "arrowfin-api",
    });
  }
  verify(token: unknown): Identity {
    if (typeof token !== "string") throw new Error("Unauthorized");
    const claims = jwt.verify(token, this.secret, {
      algorithms: ["HS256"],
      audience: "arrowfin",
      issuer: "arrowfin-api",
    });
    if (
      typeof claims === "string" ||
      typeof claims.sub !== "string" ||
      typeof claims.brokerId !== "string" ||
      typeof claims.exp !== "number"
    )
      throw new Error("Unauthorized");
    return { traderId: claims.sub, brokerId: claims.brokerId };
  }
  expiry(token: string) {
    return (jwt.decode(token) as jwt.JwtPayload).exp! * 1000;
  }
}
export const roomFor = (identity: Identity) =>
  JSON.stringify([identity.brokerId, identity.traderId]);
export const devEnabled = () =>
  process.env.NODE_ENV !== "production" &&
  process.env.ENABLE_DEV_TOOLS === "true";
