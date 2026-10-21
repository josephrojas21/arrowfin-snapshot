import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Post,
  Req,
  UnauthorizedException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { SnapshotService } from "../application/service";
import { TokenAuth, devEnabled } from "./auth";
import { AccessDenied, InvalidFill } from "./repository";
import { parseNewFill } from "./validation";
import { ReviewerCredentials } from "./credentials";
@Controller("api")
export class ApiController {
  constructor(
    @Inject(SnapshotService) private readonly service: SnapshotService,
    @Inject(TokenAuth) private readonly auth: TokenAuth,
    @Inject(PrismaClient) private readonly db: PrismaClient,
    @Inject(ReviewerCredentials)
    private readonly credentials: ReviewerCredentials,
  ) {}
  private identity(req: { headers: { authorization?: string } }) {
    const value = req.headers.authorization;
    if (!value?.startsWith("Bearer ")) throw new UnauthorizedException();
    try {
      return this.auth.verify(value.slice(7));
    } catch {
      throw new UnauthorizedException();
    }
  }
  private dev() {
    if (!devEnabled()) throw new NotFoundException();
  }
  @Get("health") health() {
    return { status: "ok" };
  }
  @Get("ready") async ready() {
    try {
      await this.db.$queryRaw`SELECT 1`;
      return { status: "ready" };
    } catch {
      throw new ServiceUnavailableException("Database unavailable");
    }
  }
  @Get("auth/config") authConfig() {
    return { mode: devEnabled() ? "demo" : "credentials" };
  }
  @Post("auth/login") async credentialsLogin(
    @Body() body: unknown,
    @Req() request: { socket: { remoteAddress?: string } },
  ) {
    const traderId = await this.credentials.verify(
      body,
      request.socket.remoteAddress ?? "unknown",
    );
    const trader = await this.db.trader.findUnique({
      where: { id: traderId },
      select: { id: true, brokerId: true },
    });
    if (!trader) throw new UnauthorizedException();
    return {
      accessToken: this.auth.issue({
        traderId: trader.id,
        brokerId: trader.brokerId,
      }),
      trader,
    };
  }
  @Get("me/snapshot") snapshot(
    @Req() req: { headers: { authorization?: string } },
  ) {
    return this.service.snapshot(this.identity(req));
  }
  @Get("dev/traders") async traders() {
    this.dev();
    return {
      traders: await this.db.trader.findMany({
        select: { id: true, brokerId: true },
        orderBy: { id: "asc" },
      }),
    };
  }
  @Post("dev/login") async login(@Body() body: unknown) {
    this.dev();
    if (
      !body ||
      typeof body !== "object" ||
      !("traderId" in body) ||
      typeof body.traderId !== "string"
    )
      throw new BadRequestException();
    const trader = await this.db.trader.findUnique({
      where: { id: body.traderId },
      select: { id: true, brokerId: true },
    });
    if (!trader) throw new UnauthorizedException();
    return {
      accessToken: this.auth.issue({
        traderId: trader.id,
        brokerId: trader.brokerId,
      }),
      trader,
    };
  }
  @Post("dev/fills") async fill(
    @Req() req: { headers: { authorization?: string } },
    @Body() raw: unknown,
  ) {
    this.dev();
    const identity = this.identity(req);
    const input = parseNewFill(raw);
    try {
      return await this.service.addFill(identity, input);
    } catch (error) {
      if (error instanceof AccessDenied) throw new ForbiddenException();
      if (error instanceof InvalidFill) throw new BadRequestException();
      throw error;
    }
  }
}
