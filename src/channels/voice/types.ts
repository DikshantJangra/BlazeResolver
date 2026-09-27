export interface VoiceSessionConfig {
  voiceName?: 'Puck' | 'Aoede' | 'Fenrir' | 'Kore' | 'Charon';
  model?: string;
  systemInstruction?: string;
  orderId?: string;
  customerId?: string;
  resourceId?: string;
  apiKey?: string;
}

export interface ClientVoiceMessage {
  type: 'voice_start' | 'audio_chunk' | 'text_input' | 'interrupt' | 'ping' | 'tool_response';
  payload?: {
    pcm16Base64?: string;
    text?: string;
    sessionConfig?: VoiceSessionConfig;
    callId?: string;
    output?: unknown;
  };
}

export interface ServerVoiceMessage {
  type:
    | 'voice_ready'
    | 'audio_output'
    | 'transcript'
    | 'tool_call_start'
    | 'tool_call_complete'
    | 'incident_detected'
    | 'hitl_gated'
    | 'interrupted'
    | 'turn_complete'
    | 'error'
    | 'pong';
  payload?: {
    pcm24Base64?: string;
    role?: 'user' | 'model' | 'system';
    text?: string;
    isFinal?: boolean;
    toolName?: string;
    callId?: string;
    args?: Record<string, unknown>;
    result?: unknown;
    status?: string;
    message?: string;
    error?: string;
    timestamp?: number;
  };
}

// Gemini Multimodal Live API Protocol Types
export interface GeminiSetupMessage {
  setup: {
    model: string;
    generationConfig?: {
      responseModalities?: string[];
      speechConfig?: {
        voiceConfig?: {
          prebuiltVoiceConfig?: {
            voiceName?: string;
          };
        };
      };
    };
    systemInstruction?: {
      parts: Array<{ text: string }>;
    };
    tools?: Array<{
      functionDeclarations: GeminiFunctionDeclaration[];
    }>;
  };
}

export interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, {
      type: string;
      description?: string;
      enum?: string[];
      items?: { type: string };
    }>;
    required?: string[];
  };
}

export interface GeminiRealtimeInputMessage {
  realtimeInput: {
    mediaChunks: Array<{
      mimeType: string;
      data: string; // base64
    }>;
  };
}

export interface GeminiClientContentMessage {
  clientContent: {
    turns: Array<{
      role: string;
      parts: Array<{ text?: string }>;
    }>;
    turnComplete: boolean;
  };
}

export interface GeminiToolResponseMessage {
  toolResponse: {
    functionResponses: Array<{
      id: string;
      response: {
        output: unknown;
      };
    }>;
  };
}

export interface GeminiServerContentMessage {
  serverContent?: {
    modelTurn?: {
      parts?: Array<{
        text?: string;
        inlineData?: {
          mimeType: string;
          data: string; // base64 24kHz PCM
        };
      }>;
    };
    interrupted?: boolean;
    turnComplete?: boolean;
  };
  toolCall?: {
    functionCalls?: Array<{
      id: string;
      name: string;
      args: Record<string, unknown>;
    }>;
  };
  toolCallCancellation?: {
    ids: string[];
  };
}
