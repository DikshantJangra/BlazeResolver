import { WebSocket } from 'ws';
import { BlazeResolverPipeline } from '../core/pipeline/index.js';
import { CustomerInput } from '../core/types.js';
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
    const activeUserId = queryParams?.get('user_id') || 'cust_amit_01';
    const activeOrderId = queryParams?.get('order_id') || 'ord-1021';
    const apiKey = queryParams?.get('api_key') || process.env.GEMINI_API_KEY;

    console.log(`🎙️ [VoiceBridge] Client connected. (User: ${activeUserId}, Order: ${activeOrderId})`);

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
      return `You are Blazzy, the real-time AI voice resolution assistant for BlazeResolver (food delivery & restaurant operations).
You speak naturally, empathetically, concisely, and with a fast conversational cadence — like an expert phone customer support agent.
Your primary goal is to resolve customer issues accurately, enforce restaurant policy guardrails, and minimize unnecessary refunds while keeping customer satisfaction high.

## REFUND RULES (STRICT MONEY-GATE)
1. Orders delivered within 2 hours are eligible for resolution.
2. Auto-refunds under ₹300 are processed instantly through the gateway.
3. High-value refunds (e.g. ₹1,450 party orders) require supervisor approval — the system will automatically place them in the Supervisor HITL priority queue for 1-click approval.
4. When a customer reports a food issue (cold food, delayed delivery, missing items, wrong dish), ALWAYS dispatch tools mid-conversation:
   - First lookup order details or user profile.
   - Run 'file_complaint' to correlate kitchen prep timestamps with KDS bottlenecks.
   - Run 'initiate_refund' or 'process_refund' to resolve eligible requests.
   - Run 'escalate_to_human' if the customer demands a human supervisor or there is a critical dispute.

## CONVERSATION STYLE
- Use quick fillers before tool calls: "Let me check that order for you", "One moment please", "Pulling up your kitchen ticket".
- Always state refund amounts clearly in Indian Rupees (₹).
- Keep voice answers brief, empathetic, and clear.

Current connected customer ID: ${userId}.`;
    };

    // Tool declarations formatted for Gemini Live API
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
        description: 'Lists all customer orders with status, amount, and KDS kitchen prep timings.',
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
        description: 'Look up specific order line items, branch, total price, and kitchen timing.',
        parameters: {
          type: 'OBJECT',
          properties: {
            order_id: { type: 'STRING', description: 'The order ID (e.g. ord-1021, ord-1030, ord-1044)' }
          },
          required: ['order_id']
        }
      },
      {
        name: 'lookup_order',
        description: 'Alias to lookup full order information, items, pricing, branch, and bottleneck status.',
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
        description: 'Process a refund or store credit. Enforces MoneyGate policy (auto-approves <= ₹300, queues > ₹300 for HITL approval).',
        parameters: {
          type: 'OBJECT',
          properties: {
            order_id: { type: 'STRING', description: 'The order ID' },
            amount: { type: 'NUMBER', description: 'Refund amount in INR' },
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
            amount: { type: 'NUMBER', description: 'Refund amount in INR' },
            reason: { type: 'STRING', description: 'Reason for refund' }
          },
          required: ['orderId', 'amount', 'reason']
        }
      },
      {
        name: 'file_complaint',
        description: 'File complaint and run through BlazeResolver correlation engine to detect systemic branch kitchen bottlenecks.',
        parameters: {
          type: 'OBJECT',
          properties: {
            complaintText: { type: 'STRING', description: 'Detailed customer complaint text' },
            orderId: { type: 'STRING', description: 'Associated order ID' },
            dishName: { type: 'STRING', description: 'Affected dish name' }
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
        description: 'Check active systemic incidents and kitchen bottlenecks at a restaurant branch.',
        parameters: {
          type: 'OBJECT',
          properties: {
            branchId: { type: 'STRING', description: 'Restaurant branch ID' }
          },
          required: ['branchId']
        }
      }
    ];

    // Tool dispatcher execution helper
    const dispatchTool = async (name: string, args: Record<string, unknown>): Promise<string> => {
      const adapters = this.pipeline.getAdapters();
      const orderId = String(args.order_id || args.orderId || activeOrderId).toLowerCase();
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
            lifetimeSpendINR: totalSpend,
            tier: totalSpend >= 1000 ? 'Loyal Tier' : 'Standard Tier',
            activeOrders: orders.map(o => ({ id: o.id, amount: o.totalAmount, status: o.status }))
          });
        }

        if (name === 'check_order_status' || name === 'get_order_details' || name === 'lookup_order') {
          const order = await adapters.orderSource.getOrder(orderId);
          if (!order) return JSON.stringify({ error: `Order #${orderId} not found` });
          const timing = await adapters.orderSource.getKitchenTiming(orderId);
          return JSON.stringify({
            orderId: order.id,
            customerName: order.customerName,
            branchId: order.branchId,
            items: order.items.map(i => `${i.name} (x${i.quantity}) - ₹${i.totalPrice}`),
            totalAmountINR: order.totalAmount,
            status: order.status,
            kitchenTiming: timing ? {
              prepMinutes: timing.prepMinutes,
              baselineMinutes: timing.baselineMinutes,
              isBottleneck: timing.isBottleneck,
              chefNotes: timing.chefNotes
            } : null
          });
        }

        if (name === 'initiate_refund' || name === 'process_refund') {
          const amount = Number(args.amount || 280);
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
          const dishName = args.dishName ? String(args.dishName) : undefined;
          const res = await executeVoiceTool('file_complaint', {
            complaintText,
            orderId,
            dishName
          }, {
            pipeline: this.pipeline,
            adapters,
            customerId: uid
          });
          return JSON.stringify(res);
        }

        if (name === 'escalate_to_human') {
          const reason = String(args.reason || 'Customer requested human agent');
          const res = await executeVoiceTool('escalate_to_human', { orderId, reason, urgency: 'high' }, {
            pipeline: this.pipeline,
            adapters,
            customerId: uid
          });
          return JSON.stringify(res);
        }

        if (name === 'check_incident_status') {
          const branchId = String(args.branchId || 'branch_cp_02');
          const res = await executeVoiceTool('check_incident_status', { branchId }, {
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
        if (isBinary || Buffer.isBuffer(data)) {
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
    activeOrderId: string,
    activeUserId: string,
    clientWs: WebSocket,
    dispatchTool: (name: string, args: Record<string, unknown>) => Promise<string>
  ): Promise<void> {
    const lower = text.toLowerCase();
    const orderMatch = lower.match(/ord-\d+/);
    const orderId = orderMatch ? orderMatch[0] : activeOrderId;

    // 1. Order status / Details lookup
    if (lower.includes('order') || lower.includes('status') || lower.includes('where') || orderMatch) {
      const orderJsonStr = await dispatchTool('get_order_details', { order_id: orderId });
      const order = JSON.parse(orderJsonStr);

      if (lower.includes('cold') || lower.includes('delayed') || lower.includes('late') || lower.includes('spill') || lower.includes('refund') || lower.includes('complaint')) {
        // Dispatch complaint correlation
        const cmpStr = await dispatchTool('file_complaint', {
          complaintText: text,
          orderId,
          dishName: order.items?.[0]
        });
        const cmpResult = JSON.parse(cmpStr);

        // Dispatch refund
        const amount = order.totalAmountINR || 280;
        const refStr = await dispatchTool('initiate_refund', {
          order_id: orderId,
          amount,
          reason: 'Customer voice complaint'
        });
        const refResult = JSON.parse(refStr);

        let spokenText = '';
        if (refResult.status === 'hitl_gated') {
          spokenText = `I looked up Order #${orderId}. Because this is a high-value order of ₹${amount}, I have escalated it directly to our Senior Supervisor Queue for instant 1-click approval. You will receive an SMS confirmation in a few minutes.`;
        } else {
          spokenText = `I apologize for the issue with your order #${orderId}. I have processed an instant refund of ₹${amount} back to your original payment method. Is there anything else I can assist you with?`;
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

      const spokenText = `I pulled up Order #${orderId} for you. It contains ${order.items?.join(', ') || 'items'} totaling ₹${order.totalAmountINR || 280}. Status is currently ${order.status || 'delivered'}. How can I assist you with this order?`;
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
    const spokenText = `Hello! I'm Blazzy, your AI voice resolution assistant. If you have an issue with your meal, need a refund, or want to check order status, please tell me your order number or what happened!`;
    clientWs.send(JSON.stringify({
      type: 'transcript',
      role: 'model',
      text: spokenText
    }));

    const toneBuffer = generateTonePcm24k(480, 500);
    clientWs.send(toneBuffer);
  }
}
