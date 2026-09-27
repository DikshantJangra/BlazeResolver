import { WebSocket } from 'ws';
import { BlazeResolverPipeline } from '../core/pipeline/index.js';
import { CustomerInput } from '../core/types.js';
import { extractOrderId, formatMoney, matchesKeywords, normalizeOrderId } from '../core/domain.js';
import { getVoiceToolDeclarations, executeVoiceTool } from './voice/tools.js';
import { generateTonePcm24k, bufferToBase64 } from './voice/pcm-utils.js';

export interface VoiceSessionOptions {
  userId?: string;
  orderId?: string;
  apiKey?: string;
  voiceName?: string;
}

export class VoiceChannelBridge {
  private pipeline: BlazeResolverPipeline;

  constructor(pipeline: BlazeResolverPipeline) {
    this.pipeline = pipeline;
  }

  public handleConnection(clientWs: WebSocket, queryParams?: URLSearchParams) {
    const profile = this.pipeline.getProfile();
    const money = (amount: number) => formatMoney(amount, profile.currency);
    const threshold = this.pipeline.getResolutionEngine().getAutoApproveThreshold();
    const activeUserId = queryParams?.get('user_id') || 'guest';
    const requestedOrderId = queryParams?.get('order_id');
    const activeOrderId = requestedOrderId ? normalizeOrderId(requestedOrderId, profile) : undefined;
    const apiKey = queryParams?.get('api_key') || process.env.GEMINI_API_KEY;

    console.log(`🎙️ [VoiceBridge] Client connected. (User: ${activeUserId}, Order: ${activeOrderId ?? 'none'})`);

    // Notify client that connection is open
    clientWs.send(JSON.stringify({
      type: 'voice_ready',
      message: 'BlazeResolver Voice Bridge connected. Ready for bidirectional PCM audio stream.',
      activeUserId,
      activeOrderId
    }));

    let geminiWs: WebSocket | null = null;
    let isGeminiConnected = false;
    let isSimulatorMode = false;

    // Build system instructions for the voice agent
    const buildSystemInstruction = (userId: string) => {
      const issueTypes = profile.categories.map((c) => c.label.toLowerCase()).join(', ');
      return `You are Blazzy, the real-time AI voice resolution assistant for BlazeResolver, supporting customers of a ${profile.labels.business}.
You speak naturally, empathetically, concisely, and with a fast conversational cadence — like an expert phone customer support agent.
Your primary goal is to resolve customer issues accurately, enforce policy guardrails, and minimize unnecessary refunds while keeping customer satisfaction high.

## REFUND RULES (STRICT MONEY-GATE)
1. Refunds and credits up to ${money(threshold)} are processed instantly through the gateway.
2. Larger refunds require supervisor approval — the system will automatically place them in the Supervisor HITL priority queue for 1-click approval.
3. When a customer reports a problem with an order (${issueTypes}), ALWAYS dispatch tools mid-conversation:
   - First lookup order details or user profile.
   - Run 'file_complaint' so the correlation engine can detect systemic operational issues.
   - Run 'initiate_refund' or 'process_refund' to resolve eligible requests.
   - Run 'escalate_to_human' if the customer demands a human supervisor or there is a critical dispute.

## CONVERSATION STYLE
- Use quick fillers before tool calls: "Let me check that order for you", "One moment please".
- Always state refund amounts clearly in ${profile.currency.code} (${profile.currency.symbol}).
- Keep voice answers brief, empathetic, and clear.

Current connected customer ID: ${userId}.`;
    };

    // Tool declarations formatted for Gemini Live API
    const itemLabel = profile.labels.item.toLowerCase();
    const resourceLabel = profile.labels.resource.toLowerCase();
    const toolDeclarations = [
      {
        name: 'get_user_profile',
        description: 'Fetches customer profile, order history, total lifetime spend (LTV), and loyalty tier.',
        parameters: {
          type: 'OBJECT',
          properties: {
            user_id: { type: 'STRING', description: 'Customer ID' }
          },
          required: ['user_id']
        }
      },
      {
        name: 'check_order_status',
        description: 'Looks up an order with its status, amount, and live operational signal.',
        parameters: {
          type: 'OBJECT',
          properties: {
            user_id: { type: 'STRING', description: 'Customer ID' }
          },
          required: ['user_id']
        }
      },
      {
        name: 'get_order_details',
        description: `Look up specific order line items, ${resourceLabel}, total price, and operational signal.`,
        parameters: {
          type: 'OBJECT',
          properties: {
            order_id: { type: 'STRING', description: 'The order ID the customer mentioned' }
          },
          required: ['order_id']
        }
      },
      {
        name: 'lookup_order',
        description: `Alias to lookup full order information, items, pricing, ${resourceLabel}, and bottleneck status.`,
        parameters: {
          type: 'OBJECT',
          properties: {
            orderId: { type: 'STRING', description: 'Order ID' }
          },
          required: ['orderId']
        }
      },
      {
        name: 'initiate_refund',
        description: `Process a refund or store credit. Enforces MoneyGate policy (auto-approves <= ${money(threshold)}, queues larger amounts for HITL approval).`,
        parameters: {
          type: 'OBJECT',
          properties: {
            order_id: { type: 'STRING', description: 'The order ID' },
            amount: { type: 'NUMBER', description: `Refund amount in ${profile.currency.code}` },
            reason: { type: 'STRING', description: 'Reason for refund' }
          },
          required: ['order_id', 'amount', 'reason']
        }
      },
      {
        name: 'process_refund',
        description: 'Alias to process refund or store credit through BlazeResolver MoneyGate.',
        parameters: {
          type: 'OBJECT',
          properties: {
            orderId: { type: 'STRING', description: 'Order ID' },
            amount: { type: 'NUMBER', description: `Refund amount in ${profile.currency.code}` },
            reason: { type: 'STRING', description: 'Reason for refund' }
          },
          required: ['orderId', 'amount', 'reason']
        }
      },
      {
        name: 'file_complaint',
        description: `File complaint and run through BlazeResolver correlation engine to detect systemic ${resourceLabel} bottlenecks.`,
        parameters: {
          type: 'OBJECT',
          properties: {
            complaintText: { type: 'STRING', description: 'Detailed customer complaint text' },
            orderId: { type: 'STRING', description: 'Associated order ID' },
            itemName: { type: 'STRING', description: `Affected ${itemLabel} name` }
          },
          required: ['complaintText']
        }
      },
      {
        name: 'escalate_to_human',
        description: 'Escalate to human supervisor for high-risk disputes or explicit human transfer requests.',
        parameters: {
          type: 'OBJECT',
          properties: {
            orderId: { type: 'STRING', description: 'Order ID' },
            reason: { type: 'STRING', description: 'Reason for escalation' }
          },
          required: ['reason']
        }
      },
      {
        name: 'check_incident_status',
        description: `Check active systemic incidents and operational bottlenecks at a ${resourceLabel}.`,
        parameters: {
          type: 'OBJECT',
          properties: {
            resourceId: { type: 'STRING', description: `${profile.labels.resource} ID` }
          },
          required: ['resourceId']
        }
      }
    ];

    // Tool dispatcher execution helper
    const dispatchTool = async (name: string, args: Record<string, unknown>): Promise<string> => {
      const adapters = this.pipeline.getAdapters();
      const requested = args.order_id || args.orderId || activeOrderId;
      const orderId = requested ? normalizeOrderId(String(requested), profile) : '';
      const uid = String(args.user_id || activeUserId);

      clientWs.send(JSON.stringify({
        type: 'tool_call_start',
        toolName: name,
        args
      }));

      try {
        if (name === 'get_user_profile') {
          const orders = await adapters.orderSource.getOrdersByCustomer(uid);
          const totalSpend = orders.reduce((sum, o) => sum + o.totalAmount, 0);
          return JSON.stringify({
            userId: uid,
            name: orders[0]?.customerName || 'Valued Customer',
            totalOrders: orders.length,
            lifetimeSpend: totalSpend,
            currency: profile.currency.code,
            tier: totalSpend >= profile.moneyPolicy.loyalCustomerSpend ? 'Loyal Tier' : 'Standard Tier',
            activeOrders: orders.map(o => ({ id: o.id, amount: o.totalAmount, status: o.status }))
          });
        }

        if (name === 'check_order_status' || name === 'get_order_details' || name === 'lookup_order') {
          if (!orderId) return JSON.stringify({ error: 'No order ID provided. Ask the customer for their order number.' });
          const order = await adapters.orderSource.getOrder(orderId);
          if (!order) return JSON.stringify({ error: `Order #${orderId} not found` });
          const signal = adapters.signalSource ? await adapters.signalSource.getOrderSignal(orderId) : null;
          return JSON.stringify({
            orderId: order.id,
            customerName: order.customerName,
            resourceId: order.resourceId,
            items: order.items.map(i => `${i.name} (x${i.quantity}) - ${money(i.totalPrice)}`),
            totalAmount: order.totalAmount,
            currency: order.currency,
            status: order.status,
            operationalSignal: signal ? {
              label: signal.label,
              value: signal.value,
              baseline: signal.baseline,
              unit: signal.unit,
              isAnomalous: signal.isAnomalous,
              notes: signal.notes
            } : null
          });
        }

        if (name === 'initiate_refund' || name === 'process_refund') {
          const order = orderId ? await adapters.orderSource.getOrder(orderId) : null;
          const amount = Number(args.amount) || order?.totalAmount || 0;
          const reason = String(args.reason || 'Voice complaint');
          const res = await executeVoiceTool('process_refund', { orderId, amount, reason }, {
            pipeline: this.pipeline,
            adapters,
            customerId: uid
          });
          return JSON.stringify(res);
        }

        if (name === 'file_complaint') {
          const complaintText = String(args.complaintText || args.description || 'Voice complaint');
          const itemName = args.itemName ? String(args.itemName) : undefined;
          const res = await executeVoiceTool('file_complaint', {
            complaintText,
            orderId: orderId || undefined,
            itemName
          }, {
            pipeline: this.pipeline,
            adapters,
            customerId: uid
          });
          return JSON.stringify(res);
        }

        if (name === 'escalate_to_human') {
          const reason = String(args.reason || 'Customer requested human agent');
          const res = await executeVoiceTool('escalate_to_human', { orderId: orderId || undefined, reason, urgency: 'high' }, {
            pipeline: this.pipeline,
            adapters,
            customerId: uid
          });
          return JSON.stringify(res);
        }

        if (name === 'check_incident_status') {
          const res = await executeVoiceTool('check_incident_status', { resourceId: args.resourceId }, {
            pipeline: this.pipeline,
            adapters,
            customerId: uid
          });
          return JSON.stringify(res);
        }

        return JSON.stringify({ error: `Unsupported tool ${name}` });
      } catch (err: unknown) {
        return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
      }
    };

    // Setup Gemini Live WebSocket connection if API key is provided
    if (apiKey && apiKey.trim() !== '') {
      try {
        const geminiUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;
        geminiWs = new WebSocket(geminiUrl);

        geminiWs.on('open', () => {
          console.log('🎙️ [VoiceBridge] Connected to Gemini Multimodal Live WebSocket!');
          isGeminiConnected = true;

          const setupMessage = {
            setup: {
              model: 'models/gemini-2.0-flash-exp',
              systemInstruction: {
                parts: [{ text: buildSystemInstruction(activeUserId) }]
              },
              tools: [{ functionDeclarations: toolDeclarations }],
              generationConfig: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Kore' }
                  }
                }
              }
            }
          };

          geminiWs?.send(JSON.stringify(setupMessage));
        });

        geminiWs.on('message', async (data: Buffer | string) => {
          try {
            const raw = typeof data === 'string' ? data : data.toString('utf-8');
            const response = JSON.parse(raw);

            // 1. Handle Voice Audio Output & Transcripts
            if (response.serverContent?.modelTurn?.parts) {
              for (const part of response.serverContent.modelTurn.parts) {
                if (part.inlineData?.data) {
                  // Forward raw 24kHz PCM binary audio to browser
                  const audioBuffer = Buffer.from(part.inlineData.data, 'base64');
                  if (clientWs.readyState === WebSocket.OPEN) {
                    clientWs.send(audioBuffer);
                  }
                }
                if (part.text) {
                  if (clientWs.readyState === WebSocket.OPEN) {
                    clientWs.send(JSON.stringify({
                      type: 'transcript',
                      role: 'model',
                      text: part.text
                    }));
                  }
                }
              }
            }

            // 2. Handle Tool Calls
            if (response.toolCall?.functionCalls) {
              const functionResponses = [];
              for (const call of response.toolCall.functionCalls) {
                const name = call.name;
                const args = call.args || {};
                const callId = call.id;

                console.log(`⚡ [VoiceBridge] Mid-conversation tool dispatched: ${name}`, args);

                // Send UI progress indicator
                clientWs.send(JSON.stringify({
                  type: 'tool_call_start',
                  toolName: name,
                  callId,
                  args
                }));

                const resultStr = await dispatchTool(name, args);

                clientWs.send(JSON.stringify({
                  type: 'tool_call_complete',
                  toolName: name,
                  callId,
                  result: JSON.parse(resultStr)
                }));

                functionResponses.push({
                  id: callId,
                  name,
                  response: { result: resultStr }
                });
              }

              // Send toolResponse frame back to Gemini Live
              const toolResponsePayload = {
                toolResponse: {
                  functionResponses
                }
              };
              geminiWs?.send(JSON.stringify(toolResponsePayload));
            }
          } catch (err) {
            console.error('⚠️ [VoiceBridge] Error processing Gemini frame:', err);
          }
        });

        geminiWs.on('error', (err) => {
          console.warn('⚠️ [VoiceBridge] Gemini WebSocket error, switching to built-in simulator engine:', err.message);
          isSimulatorMode = true;
        });

        geminiWs.on('close', () => {
          isGeminiConnected = false;
        });
      } catch (err) {
        console.warn('⚠️ [VoiceBridge] Failed to init Gemini WebSocket:', err);
        isSimulatorMode = true;
      }
    } else {
      console.log('🎙️ [VoiceBridge] No GEMINI_API_KEY detected. Using High-Fidelity Voice Simulator Engine.');
      isSimulatorMode = true;
    }

    // Handle messages coming from the browser client
    clientWs.on('message', async (data: Buffer | string, isBinary: boolean) => {
      try {
        // 1. If binary frame: raw 16kHz PCM audio chunk from browser microphone
        // ws delivers text frames as Buffers too, so only the frame type tells audio from JSON.
        if (isBinary) {
          if (geminiWs && geminiWs.readyState === WebSocket.OPEN && isGeminiConnected) {
            const b64Audio = (data as Buffer).toString('base64');
            const realtimePayload = {
              realtimeInput: {
                mediaChunks: [
                  {
                    mimeType: 'audio/pcm;rate=16000',
                    data: b64Audio
                  }
                ]
              }
            };
            geminiWs.send(JSON.stringify(realtimePayload));
          }
          return;
        }

        // 2. Text / JSON messages from browser
        const textData = typeof data === 'string' ? data : (data as any).toString('utf-8');
        let parsed: any;
        try {
          parsed = JSON.parse(textData);
        } catch {
          parsed = { type: 'text_input', text: textData };
        }

        if (parsed.type === 'ping') {
          clientWs.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          return;
        }

        if (parsed.type === 'interrupt') {
          // User barge-in: cancel active audio playback
          clientWs.send(JSON.stringify({ type: 'interrupted' }));
          return;
        }

        if (parsed.type === 'text_input' || parsed.type === 'transcription' || parsed.type === 'text_query') {
          const userText = parsed.text || parsed.payload?.text || '';
          if (!userText.trim()) return;

          clientWs.send(JSON.stringify({
            type: 'transcript',
            role: 'user',
            text: userText
          }));

          if (geminiWs && geminiWs.readyState === WebSocket.OPEN && isGeminiConnected) {
            const clientTurn = {
              clientContent: {
                turns: [
                  {
                    role: 'user',
                    parts: [{ text: userText }]
                  }
                ],
                turnComplete: true
              }
            };
            geminiWs.send(JSON.stringify(clientTurn));
          } else {
            // Intelligent Simulator Fallback for immediate testing
            await this.handleSimulatorTurn(userText, activeOrderId, activeUserId, clientWs, dispatchTool);
          }
        }
      } catch (err: unknown) {
        console.error('⚠️ [VoiceBridge] Message error:', err);
        clientWs.send(JSON.stringify({
          type: 'error',
          message: err instanceof Error ? err.message : String(err)
        }));
      }
    });

    clientWs.on('close', () => {
      console.log('🎙️ [VoiceBridge] Browser client disconnected.');
      if (geminiWs) {
        try {
          geminiWs.close();
        } catch {
          // ignore
        }
      }
    });
  }

  /**
   * High-Fidelity Voice Simulator Fallback for Instant Testing
   */
  private async handleSimulatorTurn(
    text: string,
    activeOrderId: string | undefined,
    activeUserId: string,
    clientWs: WebSocket,
    dispatchTool: (name: string, args: Record<string, unknown>) => Promise<string>
  ): Promise<void> {
    const profile = this.pipeline.getProfile();
    const money = (amount: number) => formatMoney(amount, profile.currency);
    const lower = text.toLowerCase();
    const mentionedOrderId = extractOrderId(text, profile);
    const orderId = mentionedOrderId ?? activeOrderId;
    const isComplaint =
      lower.includes('refund') ||
      lower.includes('complaint') ||
      profile.categories.some((category) => matchesKeywords(lower, category.keywords));

    // 1. Order status / Details lookup
    if (lower.includes('order') || lower.includes('status') || lower.includes('where') || mentionedOrderId) {
      if (!orderId) {
        const spokenText = 'I can help with that. Could you tell me your order number?';
        clientWs.send(JSON.stringify({ type: 'transcript', role: 'model', text: spokenText }));
        clientWs.send(generateTonePcm24k(500, 500));
        return;
      }

      const orderJsonStr = await dispatchTool('get_order_details', { order_id: orderId });
      const order = JSON.parse(orderJsonStr);

      if (order.error) {
        const spokenText = `I couldn't find order #${orderId}. Could you double-check the order number for me?`;
        clientWs.send(JSON.stringify({ type: 'transcript', role: 'model', text: spokenText }));
        clientWs.send(generateTonePcm24k(500, 500));
        return;
      }

      if (isComplaint) {
        // Dispatch complaint correlation
        await dispatchTool('file_complaint', {
          complaintText: text,
          orderId,
          itemName: order.items?.[0]
        });

        // Dispatch refund
        const amount = order.totalAmount;
        const refStr = await dispatchTool('initiate_refund', {
          order_id: orderId,
          amount,
          reason: 'Customer voice complaint'
        });
        const refResult = JSON.parse(refStr);

        let spokenText = '';
        if (refResult.status === 'hitl_gated') {
          spokenText = `I looked up Order #${orderId}. Because this is a high-value order of ${money(amount)}, I have escalated it directly to our Senior Supervisor Queue for instant 1-click approval. You will receive an SMS confirmation in a few minutes.`;
        } else {
          spokenText = `I apologize for the issue with your order #${orderId}. I have processed an instant refund of ${money(amount)} back to your original payment method. Is there anything else I can assist you with?`;
        }

        clientWs.send(JSON.stringify({
          type: 'transcript',
          role: 'model',
          text: spokenText
        }));

        // Send simulated 24kHz audio test burst
        const toneBuffer = generateTonePcm24k(440, 800);
        clientWs.send(toneBuffer);
        return;
      }

      const spokenText = `I pulled up Order #${orderId} for you. It contains ${order.items?.join(', ') || 'items'} totaling ${money(order.totalAmount)}. Status is currently ${order.status}. How can I assist you with this order?`;
      clientWs.send(JSON.stringify({
        type: 'transcript',
        role: 'model',
        text: spokenText
      }));

      const toneBuffer = generateTonePcm24k(520, 600);
      clientWs.send(toneBuffer);
      return;
    }

    if (lower.includes('human') || lower.includes('manager') || lower.includes('supervisor') || lower.includes('agent')) {
      const escStr = await dispatchTool('escalate_to_human', {
        orderId,
        reason: 'Customer requested human supervisor transfer'
      });
      const spokenText = `I understand. I have transferred your ticket with high priority to our Senior Operations Lead, DJ. A supervisor has been alerted to assist you immediately.`;
      clientWs.send(JSON.stringify({
        type: 'transcript',
        role: 'model',
        text: spokenText
      }));

      const toneBuffer = generateTonePcm24k(600, 600);
      clientWs.send(toneBuffer);
      return;
    }

    // Default conversational response
    const spokenText = `Hello! I'm Blazzy, your AI voice resolution assistant. If you have an issue with an order, need a refund, or want to check order status, please tell me your order number or what happened!`;
    clientWs.send(JSON.stringify({
      type: 'transcript',
      role: 'model',
      text: spokenText
    }));

    const toneBuffer = generateTonePcm24k(480, 500);
    clientWs.send(toneBuffer);
  }
}
