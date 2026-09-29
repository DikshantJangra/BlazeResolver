import { WebSocket } from 'ws';
import {
  VoiceSessionConfig,
  GeminiSetupMessage,
  GeminiRealtimeInputMessage,
  GeminiClientContentMessage,
  GeminiToolResponseMessage,
  GeminiServerContentMessage
} from './types.js';
import { getVoiceToolDeclarations, executeVoiceTool, VoiceToolExecutionContext } from './tools.js';
import { extractOrderId, formatMoney, matchesKeywords, normalizeOrderId } from '../../core/domain.js';
import { generateTonePcm24k, bufferToBase64 } from './pcm-utils.js';

export interface GeminiLiveClientCallbacks {
  onAudioOutput?: (pcm24Base64: string) => void;
  onTranscript?: (text: string, role: 'user' | 'model', isFinal: boolean) => void;
  onToolCallStart?: (toolName: string, callId: string, args: Record<string, unknown>) => void;
  onToolCallComplete?: (toolName: string, callId: string, result: unknown) => void;
  onInterrupted?: () => void;
  onTurnComplete?: () => void;
  onError?: (error: string) => void;
  onReady?: () => void;
}

export class GeminiLiveSession {
  private ws: WebSocket | null = null;
  private config: VoiceSessionConfig;
  private context: VoiceToolExecutionContext;
  private callbacks: GeminiLiveClientCallbacks;
  private isConnected = false;
  private isSimulatorMode = false;

  constructor(
    config: VoiceSessionConfig,
    context: VoiceToolExecutionContext,
    callbacks: GeminiLiveClientCallbacks
  ) {
    this.config = config;
    this.context = context;
    this.callbacks = callbacks;
  }

  public async connect(): Promise<void> {
    const apiKey = this.config.apiKey || process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey.trim() === '') {
      console.log('🎙️ [VoiceLayer] No GEMINI_API_KEY detected. Initializing Intelligent Live Simulation Engine.');
      this.isSimulatorMode = true;
      this.isConnected = true;
      this.callbacks.onReady?.();
      return;
    }

    try {
      const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;
      this.ws = new WebSocket(url);

      this.ws.on('open', () => {
        this.sendSetupFrame();
      });

      this.ws.on('message', async (data: Buffer | string) => {
        try {
          const raw = typeof data === 'string' ? data : data.toString('utf-8');
          const msg: GeminiServerContentMessage = JSON.parse(raw);
          await this.handleGeminiServerMessage(msg);
        } catch (err) {
          console.error('⚠️ [VoiceLayer] Error parsing Gemini Live frame:', err);
        }
      });

      this.ws.on('error', (err) => {
        console.error('⚠️ [VoiceLayer] Gemini WebSocket error:', err.message);
        // Fallback to simulator mode gracefully
        if (!this.isConnected) {
          console.log('🎙️ [VoiceLayer] Falling back to intelligent simulator mode.');
          this.isSimulatorMode = true;
          this.isConnected = true;
          this.callbacks.onReady?.();
        } else {
          this.callbacks.onError?.(err.message);
        }
      });

      this.ws.on('close', (code, reason) => {
        this.isConnected = false;
        console.log(`🎙️ [VoiceLayer] Gemini Live session closed: ${code} - ${reason.toString()}`);
      });
    } catch (err: unknown) {
      console.warn('⚠️ [VoiceLayer] Direct Gemini WebSocket connection failed, starting simulator mode:', err);
      this.isSimulatorMode = true;
      this.isConnected = true;
      this.callbacks.onReady?.();
    }
  }

  private sendSetupFrame(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const voiceName = this.config.voiceName || 'Puck';
    const model = this.config.model || 'models/gemini-2.0-flash-exp';

    const profile = this.context.pipeline.getProfile();
    const hasRefundGateway = !!this.context.pipeline.getAdapters().refundGateway;
    const systemPrompt =
      this.config.systemInstruction ||
      `You are Blazzy, the real-time AI voice resolution agent for BlazeResolver, supporting customers of a ${profile.labels.business}.
You speak empathetically, concisely, and with a natural conversational tone.
When customers complain about an order or state an order ID, ALWAYS dispatch tools mid-conversation:
- lookup_order: to check items, pricing, delivery status, and live operational signals.
${hasRefundGateway ? `- process_refund: to issue refunds/credits for valid issues like ${profile.categories.slice(0, 4).map((c) => c.label.toLowerCase()).join(', ')}.` : "- This business has no refund or payment system connected: never promise, imply, or offer a refund, credit, or coupon. If the customer asks for one, apologize and use file_complaint or escalate_to_human instead."}
- file_complaint: to file complaints into the correlation engine and detect systemic operational issues.
- escalate_to_human: if the customer demands a human supervisor or there is a critical dispute.
- check_incident_status: to check for active incidents at a ${profile.labels.resource.toLowerCase()}.

Always clearly mention amounts in ${profile.currency.code} (${profile.currency.symbol}) when refunds or credits are issued. Keep voice responses short, natural, and helpful without robotic lists.`;

    const setupMsg: GeminiSetupMessage = {
      setup: {
        model,
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName
              }
            }
          }
        },
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        tools: [
          {
            functionDeclarations: getVoiceToolDeclarations(profile, hasRefundGateway)
          }
        ]
      }
    };

    this.ws.send(JSON.stringify(setupMsg));
    this.isConnected = true;
    this.callbacks.onReady?.();
  }

  public sendAudioChunk(pcm16Base64: string): void {
    if (this.isSimulatorMode) {
      // In simulator mode, we track activity
      return;
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const msg: GeminiRealtimeInputMessage = {
        realtimeInput: {
          mediaChunks: [
            {
              mimeType: 'audio/pcm;rate=16000',
              data: pcm16Base64
            }
          ]
        }
      };
      this.ws.send(JSON.stringify(msg));
    }
  }

  public async sendTextMessage(text: string): Promise<void> {
    this.callbacks.onTranscript?.(text, 'user', true);

    if (this.isSimulatorMode) {
      await this.handleSimulatorTurn(text);
      return;
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const msg: GeminiClientContentMessage = {
        clientContent: {
          turns: [
            {
              role: 'user',
              parts: [{ text }]
            }
          ],
          turnComplete: true
        }
      };
      this.ws.send(JSON.stringify(msg));
    }
  }

  private async handleGeminiServerMessage(msg: GeminiServerContentMessage): Promise<void> {
    // 1. Check for audio chunks or transcription from model
    if (msg.serverContent?.modelTurn?.parts) {
      for (const part of msg.serverContent.modelTurn.parts) {
        if (part.text) {
          this.callbacks.onTranscript?.(part.text, 'model', false);
        }
        if (part.inlineData?.data) {
          this.callbacks.onAudioOutput?.(part.inlineData.data);
        }
      }
    }

    if (msg.serverContent?.interrupted) {
      this.callbacks.onInterrupted?.();
    }

    if (msg.serverContent?.turnComplete) {
      this.callbacks.onTurnComplete?.();
    }

    // 2. Check for mid-conversation tool calls
    if (msg.toolCall?.functionCalls) {
      for (const call of msg.toolCall.functionCalls) {
        const { id, name, args } = call;
        this.callbacks.onToolCallStart?.(name, id, args);

        try {
          // Execute against BlazeResolver adapters & pipeline
          const result = await executeVoiceTool(name, args, this.context);
          this.callbacks.onToolCallComplete?.(name, id, result);

          // Send tool response frame back to Gemini Live
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const toolResponseMsg: GeminiToolResponseMessage = {
              toolResponse: {
                functionResponses: [
                  {
                    id,
                    response: { output: result }
                  }
                ]
              }
            };
            this.ws.send(JSON.stringify(toolResponseMsg));
          }
        } catch (err: unknown) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          this.callbacks.onError?.(`Tool ${name} failed: ${errorMsg}`);

          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const toolResponseMsg: GeminiToolResponseMessage = {
              toolResponse: {
                functionResponses: [
                  {
                    id,
                    response: { output: { error: errorMsg } }
                  }
                ]
              }
            };
            this.ws.send(JSON.stringify(toolResponseMsg));
          }
        }
      }
    }
  }

  /**
   * High-Fidelity Voice Simulator Fallback for Instant Testing & Offline Environments
   */
  private async handleSimulatorTurn(text: string): Promise<void> {
    const profile = this.context.pipeline.getProfile();
    const money = (amount: number) => formatMoney(amount, profile.currency);
    const lower = text.toLowerCase();
    const mentionedOrderId = extractOrderId(text, profile);
    const orderId = mentionedOrderId ?? (this.config.orderId ? normalizeOrderId(this.config.orderId, profile) : undefined);
    const isComplaint =
      lower.includes('refund') ||
      lower.includes('complaint') ||
      profile.categories.some((category) => matchesKeywords(lower, category.keywords));

    // 1. Detect Intent & Dispatch Tools Mid-Conversation
    if ((lower.includes('order') || lower.includes('status') || lower.includes('where') || mentionedOrderId) && !orderId) {
      this.speak('I can help with that. Could you tell me your order number?', 500);
      return;
    }

    if (orderId && (lower.includes('order') || lower.includes('status') || lower.includes('where') || mentionedOrderId)) {
      const callId = `sim_call_${Date.now()}`;
      this.callbacks.onToolCallStart?.('lookup_order', callId, { orderId });
      const orderResult = await executeVoiceTool('lookup_order', { orderId }, this.context);
      this.callbacks.onToolCallComplete?.('lookup_order', callId, orderResult);

      if (!(orderResult as any).found) {
        this.speak(`I couldn't find order #${orderId}. Could you double-check the order number for me?`, 500);
        return;
      }

      if (isComplaint) {
        // Dispatch file_complaint tool
        const cmpCallId = `sim_cmp_${Date.now()}`;
        this.callbacks.onToolCallStart?.('file_complaint', cmpCallId, {
          complaintText: text,
          orderId,
          itemName: (orderResult as any)?.items?.[0]?.name
        });
        const cmpResult = await executeVoiceTool('file_complaint', {
          complaintText: text,
          orderId,
          itemName: (orderResult as any)?.items?.[0]?.name
        }, this.context);
        this.callbacks.onToolCallComplete?.('file_complaint', cmpCallId, cmpResult);

        // Dispatch process_refund tool
        const refCallId = `sim_ref_${Date.now()}`;
        const amount = (orderResult as any).totalAmount;
        this.callbacks.onToolCallStart?.('process_refund', refCallId, {
          orderId,
          amount,
          reason: 'Customer reported an order problem via Voice'
        });
        const refResult = await executeVoiceTool('process_refund', {
          orderId,
          amount,
          reason: 'Customer reported an order problem via Voice'
        }, this.context);
        this.callbacks.onToolCallComplete?.('process_refund', refCallId, refResult);

        // Emit synthesized audio & response
        let spokenText = '';
        if ((refResult as any).status === 'hitl_gated') {
          spokenText = `I looked up Order #${orderId}. Because this is a high-value order of ${money(amount)}, I have expedited it directly to our Senior Supervisor Priority Queue for instant 1-click approval. You will receive an SMS confirmation within a few minutes.`;
        } else {
          spokenText = `I apologize for the issue with your ${(orderResult as any)?.items?.[0]?.name || 'order'} on #${orderId}. I have processed an instant refund of ${money(amount)} back to your original payment method. Is there anything else I can help you with?`;
        }

        this.callbacks.onTranscript?.(spokenText, 'model', true);
        const toneBuffer = generateTonePcm24k(440, 1200);
        this.callbacks.onAudioOutput?.(bufferToBase64(toneBuffer));
        this.callbacks.onTurnComplete?.();
        return;
      }

      const spokenText = `I have pulled up Order #${orderId} for ${(orderResult as any)?.customerName || 'you'}. It includes ${(orderResult as any)?.items?.map((i: any) => i.name).join(', ')} totaling ${money((orderResult as any).totalAmount)}. Status is currently ${(orderResult as any)?.status}. How can I assist you with this order?`;
      this.callbacks.onTranscript?.(spokenText, 'model', true);
      const toneBuffer = generateTonePcm24k(520, 1000);
      this.callbacks.onAudioOutput?.(bufferToBase64(toneBuffer));
      this.callbacks.onTurnComplete?.();
      return;
    }

    if (lower.includes('human') || lower.includes('agent') || lower.includes('manager') || lower.includes('supervisor')) {
      const callId = `sim_esc_${Date.now()}`;
      this.callbacks.onToolCallStart?.('escalate_to_human', callId, {
        orderId,
        reason: 'Customer explicitly requested human supervisor transfer',
        urgency: 'high'
      });
      const escResult = await executeVoiceTool('escalate_to_human', {
        orderId,
        reason: 'Customer explicitly requested human supervisor transfer',
        urgency: 'high'
      }, this.context);
      this.callbacks.onToolCallComplete?.('escalate_to_human', callId, escResult);

      const spokenText = `I understand. I have transferred your ticket with high priority to our Senior Operations Lead, DJ. A manager has been alerted to review your case right away.`;
      this.callbacks.onTranscript?.(spokenText, 'model', true);
      const toneBuffer = generateTonePcm24k(600, 1000);
      this.callbacks.onAudioOutput?.(bufferToBase64(toneBuffer));
      this.callbacks.onTurnComplete?.();
      return;
    }

    // Default conversational turn
    const spokenText = `Hello! I'm Blazzy, your AI resolution assistant. If you have an issue with an order or need a refund, please let me know your order number or describe what happened.`;
    this.callbacks.onTranscript?.(spokenText, 'model', true);
    const toneBuffer = generateTonePcm24k(480, 800);
    this.callbacks.onAudioOutput?.(bufferToBase64(toneBuffer));
    this.callbacks.onTurnComplete?.();
  }

  private speak(text: string, toneMs: number): void {
    this.callbacks.onTranscript?.(text, 'model', true);
    this.callbacks.onAudioOutput?.(bufferToBase64(generateTonePcm24k(500, toneMs)));
    this.callbacks.onTurnComplete?.();
  }

  public close(): void {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
    this.isConnected = false;
  }
}
