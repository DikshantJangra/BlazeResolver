import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { WebSocket, WebSocketServer } from 'ws';
import { LiveEvents } from '../channels/live-events.js';

const TOKEN = 'test-admin-token';

/** Live events over real WebSockets: customer data must only reach sockets that presented the admin token. */
describe('Live events', () => {
  let server: Server;
  let wss: WebSocketServer;
  let events: LiveEvents;
  let url: string;

  before(async () => {
    wss = new WebSocketServer({ noServer: true });
    events = new LiveEvents(() => wss.clients, (headers) => headers.authorization === `Bearer ${TOKEN}`);
    server = createServer();
    server.on('upgrade', (request, socket, head) => {
      wss.handleUpgrade(request, socket, head, (ws) => events.register(ws, request.headers));
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    url = `ws://localhost:${(server.address() as AddressInfo).port}/ws`;
  });

  after(async () => {
    for (const client of wss.clients) client.terminate();
    await new Promise((resolve) => wss.close(resolve));
    await new Promise((resolve) => server.close(resolve));
  });

  /** Connects and records every event type the socket receives. */
  async function listen(authorization?: string): Promise<{ ws: WebSocket; received: string[] }> {
    const ws = new WebSocket(url, authorization ? { headers: { authorization } } : undefined);
    const received: string[] = [];
    ws.on('message', (data) => received.push(JSON.parse(String(data)).type));
    await new Promise((resolve, reject) => {
      ws.once('open', resolve);
      ws.once('error', reject);
    });
    return { ws, received };
  }

  const settle = () => new Promise((resolve) => setTimeout(resolve, 200));

  it('sends customer reports and incidents only to admin sockets', async () => {
    const anonymous = await listen();
    const wrongToken = await listen('Bearer not-the-token');
    const admin = await listen(`Bearer ${TOKEN}`);

    events.broadcast('report_triaged', { projectId: 'p1', triage: { summary: 'crash', email: 'customer@example.com' } }, 'admins');
    events.broadcast('incident_updated', { id: 'inc_1', status: 'pr_opened' }, 'admins');
    await settle();

    assert.deepStrictEqual(admin.received, ['report_triaged', 'incident_updated']);
    assert.deepStrictEqual(anonymous.received, []);
    assert.deepStrictEqual(wrongToken.received, []);

    for (const client of [anonymous, wrongToken, admin]) client.ws.close();
  });

  it('still sends public events to everyone', async () => {
    const anonymous = await listen();
    const admin = await listen(`Bearer ${TOKEN}`);

    events.broadcast('pipeline_result', { complaintId: 'c1' }, 'everyone');
    await settle();

    assert.deepStrictEqual(anonymous.received, ['pipeline_result']);
    assert.deepStrictEqual(admin.received, ['pipeline_result']);

    anonymous.ws.close();
    admin.ws.close();
  });

  it('stops sending to an admin socket after it closes', async () => {
    const admin = await listen(`Bearer ${TOKEN}`);
    admin.ws.close();
    await new Promise((resolve) => admin.ws.once('close', resolve));

    assert.doesNotThrow(() => events.broadcast('incident_updated', { id: 'inc_2' }, 'admins'));
  });
});
