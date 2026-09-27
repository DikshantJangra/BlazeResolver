import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createSupportHandler, SupportStore } from './index.js';

describe('createSupportHandler Web standard handler', () => {
  test('returns 200 and tickets list on GET /api/support/tickets', async () => {
    const store = new SupportStore();
    const handler = createSupportHandler({ store, embed: false });

    const req = new Request('http://localhost:3000/api/support/tickets', { method: 'GET' });
    const res = await handler(req);

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
  });

  test('creates customer ticket on POST /api/support/tickets/create', async () => {
    const store = new SupportStore();
    const handler = createSupportHandler({ store, embed: false, complete: async () => '{"reply": "Sorry about the garlic bread!"}' });

    const req = new Request('http://localhost:3000/api/support/tickets/create', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        subject: 'Order missing items',
        rawText: 'My pizza arrived without garlic bread',
        orderId: 'ORD-9821'
      })
    });

    const res = await handler(req);
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.ticket.subject, 'Order missing items');
    assert.ok(body.data.ticket.ticketNumber.startsWith('TKT-'));
    assert.equal(body.data.aiReply.body, 'Sorry about the garlic bread!');
    assert.deepEqual(store.getMessages(body.data.ticket.id).map((m) => m.senderType), ['user', 'bot']);
  });

  const createTicket = async (handler: (req: Request) => Promise<Response>, rawText: string) => {
    const res = await handler(new Request('http://localhost/api/support/tickets/create', { method: 'POST', body: JSON.stringify({ rawText }) }));
    return (await res.json()).data.ticket.id as string;
  };
  const say = (handler: (req: Request) => Promise<Response>, id: string, text: string) =>
    handler(new Request(`http://localhost/api/support/tickets/${id}/messages`, { method: 'POST', body: JSON.stringify({ senderType: 'user', role: 'user', body: text }) }));

  test('answers every customer message with the model, given the thread so far', async () => {
    const store = new SupportStore();
    const prompts: string[] = [];
    const handler = createSupportHandler({ store, embed: false, complete: async (_system, user) => (prompts.push(user), `{"reply": "reply ${prompts.length}"}`) });
    const id = await createTicket(handler, 'The app logs me out every few minutes');

    const res = await say(handler, id, 'Is there any update?');
    assert.equal((await res.json()).aiReply.body, 'reply 2');
    assert.deepEqual(store.getMessages(id).map((m) => m.body), ['The app logs me out every few minutes', 'reply 1', 'Is there any update?', 'reply 2']);
    assert.match(prompts[1], /<conversation>\nCustomer: The app logs me out every few minutes\nSupport: reply 1\n<\/conversation>/);
    assert.match(prompts[1], /<message>\nIs there any update\?\n<\/message>/);
  });

  test('still replies when the model fails, and stays quiet once a human has taken over', async () => {
    const store = new SupportStore();
    const handler = createSupportHandler({ store, embed: false, complete: async () => { throw new Error('provider down'); } });
    const id = await createTicket(handler, 'Where is my order?');
    assert.equal(store.getMessages(id).at(-1)?.senderType, 'bot');

    await say(handler, id, 'can I talk to a human please');
    assert.equal(store.getTicket(id)?.isHumanTakeover, true);
    const before = store.getMessages(id).length;
    const res = await say(handler, id, 'hello?');
    assert.equal((await res.json()).aiReply, undefined);
    assert.equal(store.getMessages(id).length, before + 1);
  });

  test('handles options CORS preflight', async () => {
    const handler = createSupportHandler({ embed: false });
    const req = new Request('http://localhost:3000/api/support/tickets', { method: 'OPTIONS' });
    const res = await handler(req);

    assert.equal(res.status, 204);
    assert.equal(res.headers.get('access-control-allow-origin'), '*');
  });
});

describe("a product's desk answers only from that product", () => {
  test('starts with no saved replies, so no demo text reaches its customers', async () => {
    const store = new SupportStore();
    assert.deepEqual(store.getCannedResponses(), []);
    // No model and nothing matching: the neutral holding reply, never a canned claim about the order or a credit.
    const handler = createSupportHandler({ store, embed: false, complete: async () => { throw new Error('model down'); } });
    const res = await handler(new Request('http://localhost/api/support/tickets', { method: 'POST', body: JSON.stringify({ rawText: 'My order never came and I want a refund' }) }));
    const reply = JSON.stringify((await res.json()).data.aiReply);
    assert.doesNotMatch(reply, /in transit|processed a credit|BlazeResolver|dev pipeline/i);
    assert.match(reply, /Our team is checking this/);
  });

  test('keeps the saved replies it was given, also across a reset', async () => {
    const store = new SupportStore({ savedReplies: [{ id: 'r1', title: 'Refunds', body: 'Refunds take 5 days.' }] });
    store.resetAll();
    assert.deepEqual(store.getCannedResponses().map((r) => r.title), ['Refunds']);
  });
});
