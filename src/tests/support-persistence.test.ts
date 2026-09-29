import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SupportStore } from '../support/index.js';

describe('SupportStore persistence', () => {
  it('saves and reloads tickets and messages across instances', async () => {
    const testFile = join(tmpdir(), `support-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);

    try {
      // 1. Create first store with persistPath
      const store1 = new SupportStore({ persistPath: testFile });
      const created = await store1.createTicketFromCustomer({
        subject: 'Cannot login to account',
        rawText: 'My password is not accepted',
        customerName: 'Sam Developer',
        customerEmail: 'sam@example.com'
      });

      assert.ok(created.ticket.id);
      store1.addMessage(created.ticket.id, {
        ticketId: created.ticket.id,
        role: 'agent',
        senderType: 'agent',
        content: 'We have reset your session.',
        body: 'We have reset your session.',
        authorName: 'Agent Cooper'
      });

      // Confirm file was written
      assert.ok(existsSync(testFile), 'Persistence file was created on disk');

      // 2. Instantiate new store from same file
      const store2 = new SupportStore({ persistPath: testFile });
      const reloadedTickets = store2.getTickets({ customerEmail: 'sam@example.com' });
      assert.equal(reloadedTickets.length, 1);
      assert.equal(reloadedTickets[0].subject, 'Cannot login to account');

      const reloadedMessages = store2.getMessages(created.ticket.id);
      assert.ok(reloadedMessages.length >= 2);
      assert.ok(reloadedMessages.some((m) => m.body === 'We have reset your session.'));
    } finally {
      if (existsSync(testFile)) {
        try { unlinkSync(testFile); } catch {}
      }
    }
  });
});
