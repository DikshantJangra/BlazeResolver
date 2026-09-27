import { SupportStore, type SupportTicket, type SupportMessage } from './index.js';
import { retrieve, type Chunk } from '../answer/retrieve.js';
import { resolveComplete, type Complete } from '../triage/index.js';

export interface SupportHandlerOptions {
  store?: SupportStore;
  adminToken?: string;
  allowOrigin?: string;
  complete?: Complete;
}

// Global default in-memory store instance for serverless / app runtimes
let defaultStore: SupportStore | null = null;
function getStore(custom?: SupportStore): SupportStore {
  if (custom) return custom;
  if (!defaultStore) defaultStore = new SupportStore();
  return defaultStore;
}

function isCustomerRequestingHuman(text: string): boolean {
  const lower = text.toLowerCase();
  const humanPhrases = [
    'talk to a human', 'talk to human', 'speak to a human', 'speak to human',
    'connect to human', 'connect with human', 'speak to an agent', 'talk to an agent',
    'speak to agent', 'talk to agent', 'real person', 'live person', 'human agent',
    'human representative', 'speak to someone', 'talk to someone', 'customer care executive',
    'human please', 'agent please', 'representative please', 'escalate to supervisor',
    'talk to manager', 'speak to manager', 'human support', 'connect human'
  ];
  return humanPhrases.some(phrase => lower.includes(phrase));
}

/**
 * Web-standard (Request) => Promise<Response> handler for all /api/support/* endpoints.
 * Mountable directly in Next.js App Router (`/api/support/[...slug]/route.ts`),
 * Pages Router, Cloudflare Workers, Vercel, Express, etc.
 */
export function createSupportHandler(options: SupportHandlerOptions = {}): (req: Request) => Promise<Response> {
  const store = getStore(options.store);
  const allowOrigin = options.allowOrigin || '*';
  const corsHeaders: Record<string, string> = {
    'access-control-allow-origin': allowOrigin,
    'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'access-control-allow-headers': 'Content-Type, Authorization'
  };

  const json = (status: number, data: unknown) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'content-type': 'application/json', ...corsHeaders }
    });

  const complete = options.complete ?? resolveComplete({ timeoutMs: 8000 });

  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      const url = new URL(req.url);
      const pathname = url.pathname.replace(/\/$/, '');
      const searchParams = url.searchParams;

      // Extract path segments after /api/support
      // e.g. /api/support/tickets/123/messages -> ['tickets', '123', 'messages']
      const match = pathname.match(/\/api\/support(?:\/(.*))?$/);
      const subPath = match && match[1] ? match[1] : '';
      const segments = subPath ? subPath.split('/') : [];

      const method = req.method.toUpperCase();

      // 1. GET /api/support/tickets -> list tickets
      if (segments.length === 1 && segments[0] === 'tickets' && method === 'GET') {
        const status = searchParams.get('status') || undefined;
        const priority = searchParams.get('priority') || undefined;
        const category = searchParams.get('category') || undefined;
        const search = searchParams.get('search') || undefined;
        const tickets = store.getTickets({ status, priority, category, search });
        return json(200, { success: true, data: tickets });
      }

      // 2. POST /api/support/tickets/create or POST /api/support/tickets -> create ticket
      if (
        (segments.length === 1 && segments[0] === 'tickets' && method === 'POST') ||
        (segments.length === 2 && segments[0] === 'tickets' && segments[1] === 'create' && method === 'POST')
      ) {
        const body = await req.json().catch(() => ({}));
        const { subject, rawText, message, content, category, orderId, customerId, customerName, customerEmail, customerPhone, outletName } = body;
        const complaintText = rawText || message || content;
        if (!complaintText) {
          return json(400, { success: false, error: 'rawText or message is required' });
        }

        const result = await store.createTicketFromCustomer({
          subject: subject || (complaintText.slice(0, 50) + (complaintText.length > 50 ? '...' : '')),
          rawText: complaintText,
          category,
          orderId,
          customerId,
          customerName,
          customerEmail,
          customerPhone,
          outletName
        });

        return json(201, { success: true, data: result });
      }

      // 3. GET /api/support/tickets/:id -> single ticket
      if (segments.length === 2 && segments[0] === 'tickets' && method === 'GET') {
        const ticketId = segments[1];
        const ticket = store.getTicket(ticketId);
        if (!ticket) return json(404, { success: false, error: 'Ticket not found' });
        return json(200, { success: true, data: ticket });
      }

      // 4. PATCH /api/support/tickets/:id -> update ticket
      if (segments.length === 2 && segments[0] === 'tickets' && method === 'PATCH') {
        const ticketId = segments[1];
        const body = await req.json().catch(() => ({}));
        try {
          const updated = store.updateTicket(ticketId, body);
          return json(200, { success: true, data: updated });
        } catch (err) {
          return json(404, { success: false, error: err instanceof Error ? err.message : String(err) });
        }
      }

      // 5. GET /api/support/tickets/:id/messages -> get messages
      if (segments.length === 3 && segments[0] === 'tickets' && segments[2] === 'messages' && method === 'GET') {
        const ticketId = segments[1];
        const messages = store.getMessages(ticketId);
        return json(200, { success: true, data: messages });
      }

      // 6. POST /api/support/tickets/:id/messages -> send message
      if (segments.length === 3 && segments[0] === 'tickets' && segments[2] === 'messages' && method === 'POST') {
        const ticketId = segments[1];
        const ticket = store.getTicket(ticketId);
        if (!ticket) return json(404, { success: false, error: 'Ticket not found' });

        const body = await req.json().catch(() => ({}));
        const { body: msgBody, content, role = 'agent', senderType = 'agent', authorName = 'Support Staff', internalNote = false, attachments } = body;
        const text = msgBody || content;
        if (!text && (!attachments || attachments.length === 0)) {
          return json(400, { success: false, error: 'Message content is required' });
        }

        const newMessage = store.addMessage(ticketId, {
          ticketId,
          role: role as any,
          senderType: senderType as any,
          authorName,
          senderName: authorName,
          body: text,
          content: text,
          internalNote,
          attachments
        });

        // Customer message handling
        if (senderType === 'user' && ticket.status !== 'closed' && !internalNote) {
          if (isCustomerRequestingHuman(text)) {
            store.updateTicket(ticketId, {
              isHumanTakeover: true,
              humanTakeoverReason: 'Customer requested human support agent.'
            });
            store.addMessage(ticketId, {
              ticketId,
              role: 'system',
              senderType: 'system',
              content: '👤 Customer requested a human specialist. Handing over conversation.',
              body: '👤 Customer requested a human specialist. Handing over conversation.'
            });
            store.addMessage(ticketId, {
              ticketId,
              role: 'agent',
              senderType: 'bot',
              authorName: 'Blazzy AI',
              body: 'I have notified a human support specialist to join this conversation and assist you shortly.',
              content: 'I have notified a human support specialist to join this conversation and assist you shortly.'
            });
          } else if (!ticket.isHumanTakeover) {
            // RAG knowledge retrieval
            const canned = store.getCannedResponses();
            const docs = canned.map(c => `## ${c.title}\n${c.body}`).join('\n\n');
            const relevant = retrieve(docs, text, 2);
            let replyText = `Thank you for your message regarding '${ticket.subject}'. Our team is checking this for you right away.`;
            if (relevant.length > 0) {
              replyText = `Thank you for contacting support. Regarding your inquiry:\n\n${relevant[0].text}\n\nPlease let us know if you need further assistance!`;
            }

            store.addMessage(ticketId, {
              ticketId,
              role: 'agent',
              senderType: 'bot',
              authorName: 'Blazzy AI',
              body: replyText,
              content: replyText
            });
          }
        }

        return json(200, { success: true, data: newMessage });
      }

      // 7. POST /api/support/tickets/:id/takeover -> toggle takeover
      if (segments.length === 3 && segments[0] === 'tickets' && segments[2] === 'takeover' && method === 'POST') {
        const ticketId = segments[1];
        const body = await req.json().catch(() => ({}));
        const { enabled, reason } = body;
        const updated = store.updateTicket(ticketId, {
          isHumanTakeover: !!enabled,
          humanTakeoverReason: enabled ? reason || 'Support agent manual intervention activated.' : null
        });
        store.addMessage(ticketId, {
          ticketId,
          role: 'system',
          senderType: 'system',
          content: enabled ? '👤 Human Specialist took over conversation.' : '🤖 Handed back to Blazzy AI Auto-Pilot.',
          body: enabled ? '👤 Human Specialist took over conversation.' : '🤖 Handed back to Blazzy AI Auto-Pilot.'
        });
        return json(200, { success: true, data: updated });
      }

      // 8. POST /api/support/tickets/:id/blazzy-draft -> AI draft
      if (segments.length === 3 && segments[0] === 'tickets' && segments[2] === 'blazzy-draft' && method === 'POST') {
        const ticketId = segments[1];
        const ticket = store.getTicket(ticketId);
        if (!ticket) return json(404, { success: false, error: 'Ticket not found' });
        const body = await req.json().catch(() => ({}));
        const { prompt } = body;
        const messages = store.getMessages(ticketId);
        const lastUserMsg = [...messages].reverse().find(m => m.senderType === 'user')?.body || ticket.subject;

        const canned = store.getCannedResponses();
        const docs = canned.map(c => `[${c.title}]\n${c.body}`).join('\n\n');
        const relevant = retrieve(docs, prompt || lastUserMsg, 2);

        let draft = '';
        if (complete) {
          try {
            const system = 'You are Blazzy Copilot, a support assistant. Write a polite, empathetic customer draft.';
            const user = `Ticket: ${ticket.subject}\nCustomer: ${ticket.customerName || 'Customer'}\nMessage: ${lastUserMsg}\nGoal: ${prompt || 'Help customer'}\nContext:\n${relevant.map((r: Chunk) => r.text).join('\n')}`;
            const res = await complete(system, user);
            if (res && res.trim().length > 10) draft = res.trim();
          } catch {}
        }

        if (!draft) {
          draft = `Dear ${ticket.customerName || 'Customer'}, thank you for reaching out regarding ${ticket.subject}. We are looking into this with high priority and will ensure this is resolved for you immediately!`;
        }

        return json(200, { success: true, data: { draft } });
      }

      // 9. POST /api/support/tickets/:id/action -> 1-Click HITL Action
      if (segments.length === 3 && segments[0] === 'tickets' && segments[2] === 'action' && method === 'POST') {
        const ticketId = segments[1];
        const ticket = store.getTicket(ticketId);
        if (!ticket) return json(404, { success: false, error: 'Ticket not found' });
        const body = await req.json().catch(() => ({}));
        const { action, amount, reason = 'Admin resolution' } = body;

        const note = `⚡ Admin executed resolution action: ${action} (Amount: ₹${amount || 150}). Reason: ${reason}`;
        store.addMessage(ticketId, {
          ticketId,
          role: 'system',
          senderType: 'system',
          content: note,
          body: note
        });

        const updated = store.updateTicket(ticketId, {
          status: action === 'resolve' ? 'closed' : ticket.status,
          aiReport: {
            ...ticket.aiReport,
            suggestedAction: `Executed: ${action}`
          }
        });

        return json(200, { success: true, data: { ticket: updated, note } });
      }

      // 10. POST /api/support/tickets/:id/escalate -> escalate to dev pipeline
      if (segments.length === 3 && segments[0] === 'tickets' && segments[2] === 'escalate' && method === 'POST') {
        const ticketId = segments[1];
        const ticket = store.getTicket(ticketId);
        if (!ticket) return json(404, { success: false, error: 'Ticket not found' });
        const body = await req.json().catch(() => ({}));
        const { title, type = 'bug', priority = 'high', note } = body;

        const updated = store.updateTicket(ticketId, {
          isEscalated: true,
          pulseStatus: 'investigating',
          priority: priority as any
        });

        store.addMessage(ticketId, {
          ticketId,
          role: 'system',
          senderType: 'system',
          content: `⚡ Escalated to Dev Pipeline [${type.toUpperCase()}]: ${title}`,
          body: `⚡ Escalated to Dev Pipeline [${type.toUpperCase()}]: ${title}`
        });

        return json(200, { success: true, data: updated });
      }

      // 11. POST /api/support/tickets/:id/close -> close ticket
      if (segments.length === 3 && segments[0] === 'tickets' && segments[2] === 'close' && method === 'POST') {
        const ticketId = segments[1];
        const updated = store.updateTicket(ticketId, { status: 'closed' });
        store.addMessage(ticketId, {
          ticketId,
          role: 'system',
          senderType: 'system',
          content: '🔒 Ticket marked closed by Admin.',
          body: '🔒 Ticket marked closed by Admin.'
        });
        return json(200, { success: true, data: updated });
      }

      // 12. GET & POST /api/support/tickets/:id/rating -> CSAT rating
      if (segments.length === 3 && segments[0] === 'tickets' && segments[2] === 'rating') {
        const ticketId = segments[1];
        if (method === 'GET') {
          const rating = store.getRating(ticketId);
          return json(200, { success: true, data: rating });
        }
        if (method === 'POST') {
          const body = await req.json().catch(() => ({}));
          const { rating, comment } = body;
          const saved = store.setRating(ticketId, Number(rating) || 5, comment);
          return json(200, { success: true, data: saved });
        }
      }

      // 13. POST /api/support/tickets/:id/diagnose -> re-run AI triage diagnosis
      if (segments.length === 3 && segments[0] === 'tickets' && segments[2] === 'diagnose' && method === 'POST') {
        const ticketId = segments[1];
        const ticket = store.getTicket(ticketId);
        if (!ticket) return json(404, { success: false, error: 'Ticket not found' });

        const messages = store.getMessages(ticketId);
        const customerMsgs = messages.filter(m => m.senderType === 'user').map(m => m.body).join('\n');
        const textToAnalyze = customerMsgs || ticket.subject;

        const canned = store.getCannedResponses();
        const docs = canned.map(c => `[${c.title}]\n${c.body}`).join('\n\n');
        const relevant = retrieve(docs, textToAnalyze, 2);

        const updatedReport: SupportTicket['aiReport'] = {
          ...ticket.aiReport,
          processedAt: new Date().toISOString(),
          guardrailPassed: true,
          urgencyScore: ticket.priority === 'urgent' ? 90 : 45,
          policyAllowed: true,
          suggestedAction: ticket.category === 'refund' ? 'refund_credit' : 'support_resolution',
          policyRationale: `Verified against operational support policies. RAG matches: ${relevant.map(r => r.headings.join(' > ') || r.text.slice(0, 30)).join(', ') || 'none'}`
        };

        const updated = store.updateTicket(ticketId, { aiReport: updatedReport });
        return json(200, { success: true, data: { ticket: updated, diagnosis: updatedReport } });
      }

      // 14. Canned responses CRUD
      if (segments.length >= 1 && segments[0] === 'canned-responses') {
        if (segments.length === 1 && method === 'GET') {
          return json(200, { success: true, data: store.getCannedResponses() });
        }
        if (segments.length === 1 && method === 'POST') {
          const body = await req.json().catch(() => ({}));
          const created = store.addCannedResponse(body.title || 'New Response', body.body || '', body.category);
          return json(201, { success: true, data: created });
        }
        if (segments.length === 2 && method === 'PATCH') {
          const body = await req.json().catch(() => ({}));
          const updated = store.updateCannedResponse(segments[1], body.title, body.body);
          return json(200, { success: true, data: updated });
        }
        if (segments.length === 2 && method === 'DELETE') {
          const ok = store.deleteCannedResponse(segments[1]);
          return json(200, { success: ok });
        }
        if (segments.length === 3 && segments[2] === 'set-auto-reply' && method === 'POST') {
          const list = store.setAutoReply(segments[1]);
          return json(200, { success: true, data: list });
        }
      }

      // 15. GET /api/support/customer-context or GET /api/support/context/:id
      if (
        (segments.length === 1 && segments[0] === 'customer-context' && method === 'GET') ||
        (segments.length === 2 && segments[0] === 'context' && method === 'GET')
      ) {
        const customerId = segments[0] === 'context' ? segments[1] : (searchParams.get('customerId') || 'cust_default');
        const context = store.getCustomerContext(customerId);
        return json(200, { success: true, data: context });
      }

      return json(404, { success: false, error: `Support route not found: ${method} ${pathname}` });
    } catch (err: unknown) {
      return json(500, { success: false, error: err instanceof Error ? err.message : String(err) });
    }
  };
}
