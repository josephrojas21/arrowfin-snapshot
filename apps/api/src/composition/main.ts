import "reflect-metadata";
import type { Request, Response, NextFunction } from "express";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { PrismaClient } from "@prisma/client";
import { SnapshotService } from "../application/service";
import { PrismaSnapshotRepository } from "../adapters/repository";
import { ApiController } from "../adapters/http";
import { TokenAuth } from "../adapters/auth";
import { ReviewerCredentials } from "../adapters/credentials";
import { SnapshotGateway } from "../adapters/socket";
@Module({
  controllers: [ApiController],
  providers: [
    { provide: PrismaClient, useFactory: () => new PrismaClient({ log: [] }) },
    {
      provide: TokenAuth,
      useFactory: () => new TokenAuth(process.env.JWT_SECRET ?? ""),
    },
    {
      provide: ReviewerCredentials,
      useFactory: () => new ReviewerCredentials(),
    },
    SnapshotGateway,
    {
      provide: SnapshotService,
      inject: [PrismaClient, SnapshotGateway],
      useFactory: (db: PrismaClient, events: SnapshotGateway) =>
        new SnapshotService(new PrismaSnapshotRepository(db), events, () => {
          const asOf = process.env.SNAPSHOT_NOW ?? "2026-08-25T14:30:00Z";
          if (Number.isNaN(Date.parse(asOf)))
            throw new Error("Invalid SNAPSHOT_NOW");
          return new Date(asOf).toISOString();
        }),
    },
  ],
})
export class AppModule {}
async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn"],
  });
  app.use((_request: Request, response: Response, next: NextFunction) => {
    response.setHeader("Cache-Control", "no-store");
    next();
  });
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? "http://127.0.0.1:3000" });
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 4000), "0.0.0.0");
}
void bootstrap();
