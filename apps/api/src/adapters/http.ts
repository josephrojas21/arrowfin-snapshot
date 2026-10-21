import { BadRequestException, Body, Controller, ForbiddenException, Get, Inject, NotFoundException, Post, Req, UnauthorizedException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import Decimal from 'decimal.js';
import { SnapshotService, NewFill } from '../application/service';
import { TokenAuth, devEnabled } from './auth';
import { AccessDenied, InvalidFill } from './repository';
@Controller('api')
export class ApiController {
  constructor(@Inject(SnapshotService) private readonly service: SnapshotService, @Inject(TokenAuth) private readonly auth: TokenAuth, @Inject(PrismaClient) private readonly db: PrismaClient) {}
  private identity(req: { headers: { authorization?: string } }) {
    const value = req.headers.authorization;
    if (!value?.startsWith('Bearer ')) throw new UnauthorizedException();
    try { return this.auth.verify(value.slice(7)); } catch { throw new UnauthorizedException(); }
  }
  private dev() { if (!devEnabled()) throw new NotFoundException(); }
  @Get('health') health() { return { status: 'ok' }; }
  @Get('me/snapshot') snapshot(@Req() req: { headers: { authorization?: string } }) { return this.service.snapshot(this.identity(req)); }
  @Get('dev/traders') async traders() { this.dev(); return { traders: await this.db.trader.findMany({ select: { id: true, brokerId: true }, orderBy: { id: 'asc' } }) }; }
  @Post('dev/login') async login(@Body() body: unknown) {
    this.dev();
    if (!body || typeof body !== 'object' || !('traderId' in body) || typeof body.traderId !== 'string') throw new BadRequestException();
    const trader = await this.db.trader.findUnique({ where: { id: body.traderId }, select: { id: true, brokerId: true } });
    if (!trader) throw new UnauthorizedException();
    return { accessToken: this.auth.issue({ traderId: trader.id, brokerId: trader.brokerId }), trader };
  }
  @Post('dev/fills') async fill(@Req() req: { headers: { authorization?: string } }, @Body() raw: unknown) {
    this.dev(); const identity = this.identity(req);
    if (!raw || typeof raw !== 'object') throw new BadRequestException();
    const body = raw as Record<string, unknown>;
    const decimal = (value: unknown, positive: boolean) => {
      if (typeof value !== 'string' && typeof value !== 'number') throw new BadRequestException();
      try { const d = new Decimal(value); if (!d.isFinite() || (positive ? d.lte(0) : d.lt(0)) || d.gt('1000000000000') || d.decimalPlaces() > 8) throw new Error(); return d.toFixed(); } catch { throw new BadRequestException(); }
    };
    if (typeof body.account_id !== 'string' || body.account_id.length > 100 || typeof body.instrument_symbol !== 'string' || body.instrument_symbol.length > 20 || !['BUY','SELL'].includes(String(body.side)) || !Number.isSafeInteger(body.quantity) || Number(body.quantity) < 1 || Number(body.quantity) > 10000) throw new BadRequestException();
    const input: NewFill = { account_id: body.account_id, instrument_symbol: body.instrument_symbol, side: body.side as 'BUY' | 'SELL', quantity: Number(body.quantity), price: decimal(body.price, true), commission_usd: decimal(body.commission_usd, false) };
    try { return await this.service.addFill(identity, input); } catch (error) { if (error instanceof AccessDenied) throw new ForbiddenException(); if (error instanceof InvalidFill) throw new BadRequestException(); throw error; }
  }
}
