import type {
  Snapshot,
  DemoTrader,
  DemoLoginResponse,
} from "@arrowfin/contracts";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000";
export type Identity = DemoTrader;
export type AuthMode = "demo" | "credentials";
export type Session = DemoLoginResponse & { authMode: AuthMode };
export const getAuthConfig = async (
  signal?: AbortSignal,
): Promise<{ mode: AuthMode }> => {
  const config = await request<{ mode: string }>("/api/auth/config", {
    signal,
  });
  if (config.mode !== "demo" && config.mode !== "credentials")
    throw new Error("Unsupported authentication configuration.");
  return { mode: config.mode };
};
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    cache: "no-store",
  });
  if (!response.ok)
    throw new ApiError(
      response.status,
      response.status === 401
        ? "Your session has expired. Please sign in again."
        : response.status === 403
          ? "You do not have access to this resource."
          : "We could not complete this request. Please try again.",
    );
  return response.json() as Promise<T>;
}
export const listTraders = (signal?: AbortSignal) =>
  request<{ traders: Identity[] }>("/api/dev/traders", { signal });
export const login = (traderId: string) =>
  request<DemoLoginResponse>("/api/dev/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ traderId }),
  });
export const getSnapshot = (token: string, signal?: AbortSignal) =>
  request<Snapshot>("/api/me/snapshot", {
    signal,
    headers: { Authorization: `Bearer ${token}` },
  });

export const credentialsLogin = (traderId: string, password: string) =>
  request<DemoLoginResponse>("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ traderId, password }),
  });
export interface SimulatedFill {
  account_id: string;
  instrument_symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  price: string;
  commission_usd: string;
}
export const submitFill = (token: string, fill: SimulatedFill) =>
  request<{ version: string }>("/api/dev/fills", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(fill),
  });
