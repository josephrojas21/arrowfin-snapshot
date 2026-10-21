import { PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { NewFill, SnapshotRepository } from '../application/service';
import { Identity } from '../domain/snapshot';
export class AccessDenied extends Error {}
export class InvalidFill extends Error {}
export class PrismaSnapshotRepository implements SnapshotRepository {
  constructor(private readonly db: PrismaClient) {}
  async read(identity: Identity, asOf: string) {
    const accounts = await this.db.account.findMany({ where: { traderId: identity.traderId, brokerId: identity.brokerId }, orderBy: { id: 'asc' }, include: { fills: { where: { filledAt: { lte: new Date(asOf) } }, orderBy: [{ filledAt: 'asc' }, { sequence: 'asc' }, { id: 'asc' }] } } });
    const instruments = await this.db.instrument.findMany({ orderBy: { symbol: 'asc' } });
    const converted = accounts.map(a => ({ id: a.id, status: a.status, balance: a.balance.toString(), fills: a.fills.map(f => ({ id: f.id, sequence: f.sequence, instrumentSymbol: f.instrumentSymbol, side: f.side as 'BUY' | 'SELL', quantity: f.quantity, price: f.price.toString(), commission: f.commission.toString(), filledAt: f.filledAt.toISOString() })) }));
    const specs = instruments.map(i => ({ symbol: i.symbol, pointValue: i.pointValue.toString(), initialMargin: i.initialMargin.toString(), markPrice: i.markPrice.toString() }));
    return { accounts: converted, instruments: specs, version: createHash('sha256').update(JSON.stringify([converted, specs])).digest('hex').slice(0, 20) };
  }
  async addFill(identity: Identity, input: NewFill, asOf: string) {
    const id = randomUUID();
    await this.db.$transaction(async tx => {
      const account = await tx.account.findFirst({ where: { id: input.account_id, traderId: identity.traderId, brokerId: identity.brokerId } });
      if (!account) throw new AccessDenied();
      if (account.status.toLowerCase() !== 'active') throw new InvalidFill();
      if (!await tx.instrument.findUnique({ where: { symbol: input.instrument_symbol } })) throw new InvalidFill();
      await tx.fill.create({ data: { id, accountId: account.id, instrumentSymbol: input.instrument_symbol, side: input.side, quantity: input.quantity, price: input.price, commission: input.commission_usd, filledAt: new Date(asOf), orderId: `demo-${id}` } });
    });
    return id;
  }
}
