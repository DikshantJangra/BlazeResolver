import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createSupportHandler } from '../support/handler.js';
import { SupportStore } from '../support/index.js';

describe('Support Desk API Authorization', () => {
  const adminSecret = 'topsecret-token-xyz';
  const store = new SupportStore();
  const handler = createSupportHandler({ store, adminToken: adminSecret });

  it('allows customer ticket creation and viewing own tickets without admin token', async () => {
    // 1. Customer can create ticket
    const createRes = await handler(
      new Request('http://localhost/api/support/tickets', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          subject: 'Help with my login',
          message: 'I cannot log in',
          customerEmail: 'alice@example.com'
        })
      })
    );
    assert.equal(createRes.status, 201);
    const createData = await createRes.json();
    assert.equal(createData.success, true);
    const ticketId = createData.data.ticket.id;

    // 2. Customer can fetch their own tickets with customerEmail query
    const ownTicketsRes = await handler(
      new Request('http://localhost/api/support/tickets?customerEmail=alice@example.com')
    );
    assert.equal(ownTicketsRes.status, 200);
    const ownTicketsData = await ownTicketsRes.json();
    assert.equal(ownTicketsData.data.length, 1);

    // 3. Customer can view thread messages
    const messagesRes = await handler(
      new Request(`http://localhost/api/support/tickets/${ticketId}/messages`)
    );
    assert.equal(messagesRes.status, 200);
  });

  it('rejects listing all tickets without admin token', async () => {
    const res = await handler(new Request('http://localhost/api/support/tickets'));
    assert.equal(res.status, 401);
    const json = await res.json();
    assert.match(json.error, /adminToken required/);
  });

  it('allows listing all tickets with valid admin token', async () => {
    const res = await handler(
      new Request('http://localhost/api/support/tickets', {
        headers: { authorization: `Bearer ${adminSecret}` }
      })
    );
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(Array.isArray(json.data));
  });

  it('rejects sensitive admin operations without admin token', async () => {
    const ticketRes = await handler(
      new Request('http://localhost/api/support/tickets', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          subject: 'Need refund',
          message: 'My order was cold',
          customerEmail: 'bob@example.com'
        })
      })
    );
    const ticket = (await ticketRes.json()).data.ticket;

    // 1. Takeover rejected
    const takeoverRes = await handler(
      new Request(`http://localhost/api/support/tickets/${ticket.id}/takeover`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ enabled: true })
      })
    );
    assert.equal(takeoverRes.status, 401);

    // 2. 1-Click Action rejected
    const actionRes = await handler(
      new Request(`http://localhost/api/support/tickets/${ticket.id}/action`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'refund', amount: 200 })
      })
    );
    assert.equal(actionRes.status, 401);

    // 3. Close rejected
    const closeRes = await handler(
      new Request(`http://localhost/api/support/tickets/${ticket.id}/close`, {
        method: 'POST'
      })
    );
    assert.equal(closeRes.status, 401);

    // 4. Canned response creation rejected
    const cannedRes = await handler(
      new Request('http://localhost/api/support/canned-responses', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'New canned', body: 'reply' })
      })
    );
    assert.equal(cannedRes.status, 401);
  });

  it('allows sensitive admin operations with valid admin token', async () => {
    const ticketRes = await handler(
      new Request('http://localhost/api/support/tickets', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          subject: 'Issue to close',
          message: 'Fixed already',
          customerEmail: 'charlie@example.com'
        })
      })
    );
    const ticket = (await ticketRes.json()).data.ticket;

    const closeRes = await handler(
      new Request(`http://localhost/api/support/tickets/${ticket.id}/close`, {
        method: 'POST',
        headers: { authorization: `Bearer ${adminSecret}` }
      })
    );
    assert.equal(closeRes.status, 200);
    const closeData = await closeRes.json();
    assert.equal(closeData.data.status, 'closed');
  });
});
