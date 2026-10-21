import { Inject } from "@nestjs/common";
import {
  OnGatewayConnection,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { SnapshotEvents } from "../application/service";
import { Identity } from "../domain/snapshot";
import { TokenAuth, roomFor } from "./auth";
@WebSocketGateway({
  cors: { origin: process.env.WEB_ORIGIN ?? "http://127.0.0.1:3000" },
  maxHttpBufferSize: 1024,
})
export class SnapshotGateway
  implements OnGatewayConnection, OnGatewayInit, SnapshotEvents
{
  @WebSocketServer() server!: Server;
  constructor(@Inject(TokenAuth) private readonly auth: TokenAuth) {}
  afterInit(server: Server) {
    server.use((client, next) => {
      try {
        this.auth.verify(client.handshake.auth.token);
        next();
      } catch {
        next(new Error("Unauthorized"));
      }
    });
  }
  handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token;
      const identity = this.auth.verify(token);
      void client.join(roomFor(identity));
      const timeout = setTimeout(
        () => client.disconnect(true),
        Math.max(0, this.auth.expiry(token) - Date.now()),
      );
      timeout.unref();
      client.on("disconnect", () => clearTimeout(timeout));
    } catch {
      client.disconnect(true);
    }
  }
  updated(identity: Identity, version: string) {
    this.server.to(roomFor(identity)).emit("snapshot.updated", { version });
  }
}
