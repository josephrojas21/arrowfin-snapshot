export interface SnapshotPosition {
  instrument: string;
  netQuantity: number;
  averagePrice: string;
  marketPrice: string;
  unrealizedPnl: string;
  notional: string;
}
export interface SnapshotAccount {
  id: string;
  status: string;
  balance: string;
  realizedPnl: string;
  unrealizedPnl: string;
  commissions: string;
  riskScore: number | null;
  riskReason: string | null;
  positions: SnapshotPosition[];
}
export interface Snapshot {
  asOf: string;
  session: {start: string; end: string; timeZone: string};
  version: string;
  accounts: SnapshotAccount[];
}
export interface DemoTrader { id: string; brokerId: string }
export interface DemoTradersResponse { traders: DemoTrader[] }
export interface DemoLoginResponse { accessToken: string; trader: DemoTrader }
export interface SnapshotUpdatedEvent { version: string }
