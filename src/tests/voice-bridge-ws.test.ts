import { describe, it, before, after, mock } from 'node:test';
import assert from 'node:assert';
import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { WebSocket, WebSocketServer } from 'ws';
import { BlazeResolverPipeline } from '../core/pipeline/index.js';
import { VoiceChannelBridge } from '../channels/voice.js';
import { createRestaurantAdapters, RESTAURANT_PROFILE } from '../examples/restaurant/index.js';

interface Frame {
  type: string;
  role?: string;
  text?: string;
}

/** The voice bridge over a real WebSocket, as the dashboard's voice console talks to it. No Gemini key: simulator mode. */
describe('Voice bridge over WebSocket', () => {
  let server: Server;
  let wss: WebSocketServer;
  let url: string;
  const savedKey = process.env.GEMINI_API_KEY;

  before(async () => {
    // The bridge logs to stdout, which node --test also uses to report results, and it logs socket closes
    // that can land after the last test. Interleaved writes corrupt the report, so this file stays quiet
    // for its whole run (it runs in its own process) rather than restoring console.log in after().
    mock.method(console, 'log', () => {});
    delete process.env.GEMINI_API_KEY;
    const pipeline = new BlazeResolverPipeline(createRestaurantAdapters(), { profile: RESTAURANT_PROFILE });
    const bridge = new VoiceChannelBridge(pipeline);
    wss = new WebSocketServer({ noServer: true });
    server = createServer();
    server.on('upgrade', (request, socket, head) => {
      const params = new URL(request.url ?? '', 'http://localhost').searchParams;
      wss.handleUpgrade(request, socket, head, (ws) => bridge.handleConnection(ws, params));
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    url = `ws://localhost:${(server.address() as AddressInfo).port}/ws?user_id=tester&order_id=ord-1021`;
  });

  after(async () => {
    if (savedKey !== undefined) process.env.GEMINI_API_KEY = savedKey;
    for (const client of wss.clients) client.terminate();
    await new Promise((resolve) => wss.close(resolve));
    await new Promise((resolve) => server.close(resolve));
  });

  /** Opens a session, runs `send` once the bridge is ready, and collects frames until `until` matches or time runs out. */
  function session(send: (ws: WebSocket) => void, until: (frames: Frame[]) => boolean, timeoutMs = 3000): Promise<Frame[]> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      const frames: Frame[] = [];
      const finish = () => {
        clearTimeout(timer);
        ws.close();
        resolve(frames);
      };
      const timer = setTimeout(finish, timeoutMs);
      ws.on('error', reject);
      ws.on('message', (data, isBinary) => {
        // Spoken replies are followed by binary PCM audio; record it without parsing.
        if (isBinary) {
          frames.push({ type: 'audio' });
          if (until(frames)) finish();
          return;
        }
        const frame = JSON.parse(String(data)) as Frame;
        frames.push(frame);
        if (frame.type === 'voice_ready') send(ws);
        if (until(frames)) finish();
      });
    });
  }

  it('answers a ping', async () => {
    const frames = await session(
      (ws) => ws.send(JSON.stringify({ type: 'ping' })),
      (f) => f.some((x) => x.type === 'pong')
    );
    assert.ok(frames.some((f) => f.type === 'pong'), `frames: ${frames.map((f) => f.type).join(', ')}`);
  });

  it('echoes a typed question and replies to it, as the dashboard voice console sends it', async () => {
    const question = 'My order arrived cold, can I get a refund?';
    const frames = await session(
      (ws) => ws.send(JSON.stringify({ type: 'text_input', text: question })),
      (f) => f.some((x) => x.type === 'transcript' && x.role === 'model') && f.some((x) => x.type === 'audio')
    );
    assert.ok(frames.some((f) => f.type === 'transcript' && f.role === 'user' && f.text === question));
    const reply = frames.find((f) => f.type === 'transcript' && f.role === 'model');
    assert.ok(reply?.text, `no agent reply; frames: ${frames.map((f) => f.type).join(', ')}`);
    assert.ok(frames.some((f) => f.type === 'audio'), 'the reply is spoken as audio');
  });

  it('acknowledges a barge-in interrupt', async () => {
    const frames = await session(
      (ws) => ws.send(JSON.stringify({ type: 'interrupt' })),
      (f) => f.some((x) => x.type === 'interrupted')
    );
    assert.ok(frames.some((f) => f.type === 'interrupted'));
  });

  it('treats binary frames as audio, not as text', async () => {
    const frames = await session(
      (ws) => ws.send(Buffer.from(JSON.stringify({ type: 'ping' }))),
      () => false,
      500
    );
    // Audio has nowhere to go without Gemini; it must not be parsed and answered as a text command.
    assert.deepStrictEqual(frames.map((f) => f.type), ['voice_ready']);
  });
});
