import type { IncomingHttpHeaders } from 'node:http';
import { WebSocket } from 'ws';

/**
 * `admins`: events carrying customer data (reports, incidents). Only sockets that presented the admin token
 * receive them, matching the admin-only REST endpoints that return the same data.
 * `everyone`: events whose data is already public over REST (the demo pipeline feed).
 */
export type Audience = 'admins' | 'everyone';

/** Pushes live events to dashboard WebSocket clients. Every broadcast names its audience, so nothing is public by default. */
export class LiveEvents {
  private admins = new Set<WebSocket>();

  constructor(
    private clients: () => Iterable<WebSocket>,
    private isAdmin: (headers: IncomingHttpHeaders) => boolean
  ) {}

  /** Call for every new socket. Browsers can't set headers on a WebSocket, so admin sockets come from server-side clients. */
  public register(ws: WebSocket, headers: IncomingHttpHeaders): void {
    if (!this.isAdmin(headers)) return;
    this.admins.add(ws);
    ws.once('close', () => this.admins.delete(ws));
  }

  public broadcast(type: string, data: unknown, audience: Audience): void {
    const message = JSON.stringify({ type, data });
    const targets = audience === 'admins' ? this.admins : this.clients();
    for (const client of targets) {
      if (client.readyState === WebSocket.OPEN) client.send(message);
    }
  }
}
