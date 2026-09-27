import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createSupportHandler, SupportStore } from './index.js';

describe('createSupportHandler Web standard handler', () => {
  test('returns 200 and tickets list on GET /api/support/tickets', async () => {
    const store = new SupportStore();
    const handler = createSupportHandler({ store });

    const req = new Request('http://localhost:3000/api/support/tickets', { method: 'GET' });
    const res = await handler(req);

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
  });

  test('creates customer ticket on POST /api/support/tickets/create', async () => {
    const store = new SupportStore();
    const handler = createSupportHandler({ store });

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
  });

  test('handles options CORS preflight', async () => {
    const handler = createSupportHandler();
    const req = new Request('http://localhost:3000/api/support/tickets', { method: 'OPTIONS' });
    const res = await handler(req);

    assert.equal(res.status, 204);
    assert.equal(res.headers.get('access-control-allow-origin'), '*');
  });
});
