import { WebSocket } from 'ws';
import { BlazeResolverPipeline } from '../core/pipeline/index.js';
import { CustomerInput } from '../core/types.js';

export interface VoiceMessage {
  type: 'voice_start' | 'audio_chunk' | 'transcription' | 'text_query' | 'ping';
  payload?: {
    text?: string;
    audioBase64?: string;
    orderId?: string;
    customerId?: string;
    branchId?: string;
  };
}

export class VoiceChannelBridge {
  private pipeline: BlazeResolverPipeline;

  constructor(pipeline: BlazeResolverPipeline) {
    this.pipeline = pipeline;
  }

  public handleConnection(ws: WebSocket) {
    ws.send(JSON.stringify({
      type: 'voice_ready',
      message: 'BlazeResolver Voice Bridge connected. Ready for audio/text stream.'
    }));

    ws.on('message', async (data: string) => {
      try {
        const msg: VoiceMessage = JSON.parse(data.toString());

        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          return;
        }

        if (msg.type === 'transcription' || msg.type === 'text_query') {
          const text = msg.payload?.text || '';
          if (!text.trim()) return;

          ws.send(JSON.stringify({
            type: 'pipeline_status',
            stage: 'triaging',
            message: `Analyzing voice input: "${text}"`
          }));

          const input: CustomerInput = {
            id: `voice_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
            channel: 'voice',
            rawText: text,
            orderId: msg.payload?.orderId,
            customerId: msg.payload?.customerId || 'cust_voice_user',
            branchId: msg.payload?.branchId,
            timestamp: new Date()
          };

          const result = await this.pipeline.processComplaint(input);

          // Stream back full pipeline response
          ws.send(JSON.stringify({
            type: 'voice_response',
            result,
            spokenText: result.response.text,
            isRefunded: result.response.containsRefundConfirmation,
            isSystemicIncident: result.correlation.isSystemic
          }));
        }
      } catch (err: unknown) {
        ws.send(JSON.stringify({
          type: 'error',
          error: err instanceof Error ? err.message : String(err)
        }));
      }
    });
  }
}
