import { Account, Fill, Identity, Instrument, calculateSnapshot } from '../domain/snapshot';
export interface SnapshotRepository {
  read(identity: Identity, asOf: string): Promise<{ accounts: Account[]; instruments: Instrument[]; version: string }>;
  addFill(identity: Identity, input: NewFill, asOf: string): Promise<string>;
}
export interface NewFill { account_id: string; instrument_symbol: string; side: 'BUY' | 'SELL'; quantity: number; price: string; commission_usd: string }
export interface SnapshotEvents { updated(identity: Identity, version: string): void }
export class SnapshotService {
  constructor(private readonly repository: SnapshotRepository, private readonly events: SnapshotEvents, private readonly clock: () => string) {}
  async snapshot(identity: Identity) {
    const asOf = this.clock();
    const data = await this.repository.read(identity, asOf);
    return calculateSnapshot(data.accounts, data.instruments, asOf, data.version);
  }
  async addFill(identity: Identity, input: NewFill) {
    const version = await this.repository.addFill(identity, input, this.clock());
    this.events.updated(identity, version);
    return { version };
  }
}
