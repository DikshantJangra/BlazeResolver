import React, { useState, useEffect, useRef } from 'react';
import {
  FiMic,
  FiMicOff,
  FiPhoneCall,
  FiPhoneOff,
  FiActivity,
  FiZap,
  FiCheckCircle,
  FiAlertTriangle,
  FiUser,
  FiDollarSign,
  FiShield,
  FiVolume2,
  FiVolumeX,
  FiSend,
  FiRefreshCw,
  FiSliders,
  FiLayers
} from 'react-icons/fi';
import { RiCustomerService2Fill, RiRobot2Line } from 'react-icons/ri';
import type { ProfileInfo } from '../App.js';
import { TbWaveSine } from 'react-icons/tb';

interface VoiceMessage {
  id: string;
  role: 'user' | 'model' | 'system';
  text: string;
  timestamp: Date;
}

interface ToolCallEvent {
  id: string;
  toolName: string;
  callId?: string;
  args?: Record<string, unknown>;
  result?: unknown;
  status: 'running' | 'completed' | 'failed';
  timestamp: Date;
}

interface VoiceAgentConsoleProps {
  profile?: ProfileInfo | null;
  onIncidentDetected?: () => void;
  onHitlUpdated?: () => void;
}

export const VoiceAgentConsole: React.FC<VoiceAgentConsoleProps> = ({
  profile,
  onIncidentDetected,
  onHitlUpdated
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [activeVoice, setActiveVoice] = useState('Kore');
  const [activeUserId, setActiveUserId] = useState('');
  const [activeOrderId, setActiveOrderId] = useState('');

  // Default the demo customer and order to the active example business once its profile loads
  useEffect(() => {
    if (!profile) return;
    setActiveUserId((current) => current || profile.demo.defaultCustomerId);
    setActiveOrderId((current) => current || (profile.demo.sampleOrders[0]?.id ?? ''));
  }, [profile]);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [messages, setMessages] = useState<VoiceMessage[]>([
    {
      id: 'welcome',
      role: 'system',
      text: '🎙️ Welcome to Blazzy Live Voice Assistant. Click "Start Live Call" or press any test scenario below to speak directly with Gemini Multimodal Live API.',
      timestamp: new Date()
    }
  ]);
  const [activeTools, setActiveTools] = useState<ToolCallEvent[]>([]);
  const [textInput, setTextInput] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const activeAudioSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, activeTools]);

  // Audio Visualizer Canvas Loop
  useEffect(() => {
    let animationFrameId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let phase = 0;
    const render = () => {
      phase += 0.05;
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const numBars = 32;
      const barWidth = width / numBars - 2;

      for (let i = 0; i < numBars; i++) {
        const factor = isRecording
          ? Math.sin(phase + i * 0.3) * 0.5 + 0.5
          : isSpeaking
          ? Math.cos(phase + i * 0.4) * 0.6 + 0.5
          : 0.1;

        const effectiveHeight = Math.max(4, factor * height * 0.85);
        const x = i * (barWidth + 2);
        const y = (height - effectiveHeight) / 2;

        const gradient = ctx.createLinearGradient(0, y, 0, y + effectiveHeight);
        if (isSpeaking) {
          gradient.addColorStop(0, '#f97316'); // Orange
          gradient.addColorStop(1, '#ea580c');
        } else if (isRecording) {
          gradient.addColorStop(0, '#10b981'); // Emerald
          gradient.addColorStop(1, '#059669');
        } else {
          gradient.addColorStop(0, '#475569'); // Slate
          gradient.addColorStop(1, '#334155');
        }

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, effectiveHeight, 3);
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [isRecording, isSpeaking]);

  // Connect to Voice WebSocket
  const startSession = async () => {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname === 'localhost' ? 'localhost:3001' : window.location.host;
      const wsUrl = `${protocol}//${host}/ws/voice?user_id=${activeUserId}&order_id=${activeOrderId}&voice=${activeVoice}${apiKeyInput ? `&api_key=${encodeURIComponent(apiKeyInput)}` : ''}`;

      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = async () => {
        setIsConnected(true);
        addMessage('system', `🟢 Connected to BlazeResolver Voice Bridge. Initializing audio session...`);
        await initMicrophone();
      };

      ws.onmessage = async (event) => {
        // 1. Binary audio payload (24kHz PCM from Gemini / Server)
        if (event.data instanceof ArrayBuffer) {
          playPcm24kAudio(event.data);
          return;
        }

        // 2. Text / JSON event payload
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'transcript') {
            addMessage(data.role, data.text);
          } else if (data.type === 'tool_call_start') {
            const toolEvent: ToolCallEvent = {
              id: `tool_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
              toolName: data.toolName,
              callId: data.callId,
              args: data.args,
              status: 'running',
              timestamp: new Date()
            };
            setActiveTools((prev) => [toolEvent, ...prev]);
          } else if (data.type === 'tool_call_complete') {
            setActiveTools((prev) =>
              prev.map((t) =>
                t.toolName === data.toolName
                  ? { ...t, result: data.result, status: 'completed' }
                  : t
              )
            );
            if (data.toolName === 'file_complaint' || data.toolName === 'check_incident_status') {
              onIncidentDetected?.();
            }
            if (data.toolName === 'initiate_refund' || data.toolName === 'process_refund') {
              onHitlUpdated?.();
            }
          } else if (data.type === 'interrupted') {
            stopAllPlayback();
          } else if (data.type === 'error') {
            addMessage('system', `❌ Error: ${data.message || data.error}`);
          }
        } catch (err) {
          console.error('Error handling voice ws message:', err);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        setIsRecording(false);
        setIsSpeaking(false);
        cleanupAudio();
        addMessage('system', '🔴 Voice session disconnected.');
      };

      ws.onerror = (err) => {
        console.error('Voice WebSocket Error:', err);
        addMessage('system', '⚠️ WebSocket connection error.');
      };
    } catch (err: unknown) {
      console.error('Failed to start voice session:', err);
      addMessage('system', `❌ Failed to connect: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Initialize Microphone & Audio Capture (16kHz 16-bit PCM)
  const initMicrophone = async () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000
      });
      audioContextRef.current = audioCtx;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      mediaStreamRef.current = stream;

      const micCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000
      });
      const source = micCtx.createMediaStreamSource(stream);
      const processor = micCtx.createScriptProcessor(2048, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (!isRecording || isMuted || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          return;
        }

        const inputData = e.inputBuffer.getChannelData(0);
        // Convert Float32 to 16-bit PCM
        const pcm16 = new Int16Array(inputData.length);
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          sum += Math.abs(s);
        }

        const avg = sum / inputData.length;
        setAudioLevel(Math.min(1, avg * 5));

        // Stream raw binary 16-bit PCM chunk over WebSocket
        wsRef.current.send(pcm16.buffer);
      };

      source.connect(processor);
      processor.connect(micCtx.destination);
      setIsRecording(true);
      addMessage('system', '🎙️ Microphone active. Speak naturally or select a test scenario.');
    } catch (err: unknown) {
      console.warn('Microphone access not granted or unavailable:', err);
      addMessage('system', '⚠️ Mic unavailable. You can still test voice using the text simulator prompts below!');
    }
  };

  // Play 24kHz PCM Binary Audio Chunks seamlessly
  const playPcm24kAudio = (arrayBuffer: ArrayBuffer) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
          sampleRate: 24000
        });
      }

      const audioCtx = audioContextRef.current;
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      const int16Array = new Int16Array(arrayBuffer);
      const float32Array = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
      }

      const audioBuffer = audioCtx.createBuffer(1, float32Array.length, 24000);
      audioBuffer.copyToChannel(float32Array, 0);

      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);

      const currentTime = audioCtx.currentTime;
      if (nextPlayTimeRef.current < currentTime) {
        nextPlayTimeRef.current = currentTime;
      }

      source.start(nextPlayTimeRef.current);
      nextPlayTimeRef.current += audioBuffer.duration;
      setIsSpeaking(true);

      activeAudioSourcesRef.current.push(source);
      source.onended = () => {
        activeAudioSourcesRef.current = activeAudioSourcesRef.current.filter((s) => s !== source);
        if (activeAudioSourcesRef.current.length === 0) {
          setIsSpeaking(false);
        }
      };
    } catch (err) {
      console.error('Error playing PCM audio chunk:', err);
    }
  };

  const stopAllPlayback = () => {
    activeAudioSourcesRef.current.forEach((source) => {
      try {
        source.stop();
      } catch {
        // ignore
      }
    });
    activeAudioSourcesRef.current = [];
    setIsSpeaking(false);
    if (audioContextRef.current) {
      nextPlayTimeRef.current = audioContextRef.current.currentTime;
    }
  };

  const cleanupAudio = () => {
    stopAllPlayback();
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  const endSession = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    cleanupAudio();
    setIsConnected(false);
    setIsRecording(false);
    setIsSpeaking(false);
  };

  const addMessage = (role: 'user' | 'model' | 'system', text: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        role,
        text,
        timestamp: new Date()
      }
    ]);
  };

  const handleSendText = (textToSend?: string) => {
    const query = textToSend || textInput;
    if (!query.trim()) return;

    if (!isConnected || !wsRef.current) {
      // Auto-connect first if not connected
      startSession().then(() => {
        setTimeout(() => {
          wsRef.current?.send(JSON.stringify({ type: 'text_input', text: query }));
          setTextInput('');
        }, 500);
      });
      return;
    }

    wsRef.current.send(JSON.stringify({ type: 'text_input', text: query }));
    setTextInput('');
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-6 py-4 bg-slate-950/80 border-b border-slate-800 backdrop-blur-md">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div className={`w-3.5 h-3.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
            {isSpeaking && (
              <span className="absolute -top-1 -left-1 w-5.5 h-5.5 rounded-full bg-orange-500/40 animate-ping" />
            )}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-slate-100 text-base">Blazzy Voice Agent</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/30 font-mono font-medium">
                Gemini Multimodal Live (PCM 16k/24k)
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {isConnected
                ? isSpeaking
                  ? 'Blazzy is speaking...'
                  : isRecording
                  ? 'Listening to microphone stream...'
                  : 'Ready'
                : 'Offline - Click Start Live Call to initiate bidirectional session'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs">
            <span className="text-slate-400">Voice:</span>
            <select
              value={activeVoice}
              onChange={(e) => setActiveVoice(e.target.value)}
              disabled={isConnected}
              className="bg-transparent text-slate-200 font-semibold focus:outline-none cursor-pointer"
            >
              <option value="Kore">Kore (Empathetic)</option>
              <option value="Puck">Puck (Fast/Upbeat)</option>
              <option value="Aoede">Aoede (Clear)</option>
              <option value="Fenrir">Fenrir (Authoritative)</option>
              <option value="Charon">Charon (Calm)</option>
            </select>
          </div>

          <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs">
            <span className="text-slate-400">Order:</span>
            <select
              value={activeOrderId}
              onChange={(e) => setActiveOrderId(e.target.value)}
              className="bg-transparent text-orange-400 font-mono font-bold focus:outline-none cursor-pointer"
            >
              {profile?.demo.sampleOrders.map((order) => (
                <option key={order.id} value={order.id}>
                  #{order.id} ({order.label})
                </option>
              ))}
            </select>
          </div>

          {isConnected ? (
            <button
              onClick={endSession}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-lg transition-all"
            >
              <FiPhoneOff className="text-sm" />
              <span>End Call</span>
            </button>
          ) : (
            <button
              onClick={startSession}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg transition-all"
            >
              <FiPhoneCall className="text-sm" />
              <span>Start Live Call</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Waveform + Tools HUD + Live Transcript */}
      <div className="flex-1 grid grid-cols-12 gap-4 p-6 overflow-hidden min-h-0 bg-slate-950/40">
        {/* Left Side: Real-Time Audio Visualizer & Dispatched Tools HUD (5 cols) */}
        <div className="col-span-5 flex flex-col space-y-4 overflow-hidden">
          {/* Audio Visualizer Card */}
          <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-xl relative flex flex-col items-center justify-center min-h-[160px]">
            <canvas ref={canvasRef} width={340} height={70} className="w-full h-16" />

            <div className="mt-3 flex items-center justify-between w-full text-xs text-slate-400">
              <div className="flex items-center space-x-2">
                <span className={`w-2 h-2 rounded-full ${isRecording ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                <span>Microphone (PCM 16k)</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`w-2 h-2 rounded-full ${isSpeaking ? 'bg-orange-400 animate-pulse' : 'bg-slate-600'}`} />
                <span>Model Output (PCM 24k)</span>
              </div>
            </div>

            {/* Barge-in Button */}
            {isSpeaking && (
              <button
                onClick={stopAllPlayback}
                className="mt-3 px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-medium transition-all"
              >
                Interrupt (Barge-In)
              </button>
            )}
          </div>

          {/* Real-Time Tool Calls Stream HUD */}
          <div className="flex-1 flex flex-col bg-slate-900/90 border border-slate-800 rounded-xl p-4 overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <FiZap className="text-orange-400" />
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Live Tool Dispatch Stream
                </span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                {activeTools.length} Dispatched
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 mt-3 pr-1">
              {activeTools.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 text-xs py-8">
                  <FiLayers className="text-2xl mb-2 opacity-40" />
                  <span>No mid-conversation tools triggered yet.</span>
                  <span className="text-[11px] text-slate-600 mt-1">
                    Ask Blazzy to check an order or refund to see live execution!
                  </span>
                </div>
              ) : (
                activeTools.map((tool) => (
                  <div
                    key={tool.id}
                    className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono transition-all hover:border-slate-700"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            tool.status === 'completed'
                              ? 'bg-emerald-400'
                              : tool.status === 'running'
                              ? 'bg-amber-400 animate-ping'
                              : 'bg-red-400'
                          }`}
                        />
                        <span className="font-bold text-orange-400">{tool.toolName}</span>
                      </div>
                      <span className="text-[10px] text-slate-500">
                        {tool.timestamp.toLocaleTimeString()}
                      </span>
                    </div>

                    {tool.args && (
                      <div className="mt-1.5 text-[11px] text-slate-400 bg-slate-900/80 p-1.5 rounded border border-slate-800/60 overflow-x-auto">
                        <span className="text-slate-500 font-sans text-[10px]">ARGS: </span>
                        {JSON.stringify(tool.args)}
                      </div>
                    )}

                    {tool.result != null && (
                      <div className="mt-1.5 text-[11px] text-emerald-300 bg-emerald-950/20 p-1.5 rounded border border-emerald-900/40 overflow-x-auto max-h-24">
                        <span className="text-emerald-500 font-sans text-[10px]">RESULT: </span>
                        {typeof tool.result === 'object'
                          ? JSON.stringify(tool.result, null, 2)
                          : String(tool.result)}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Conversation Transcript & Interactive Simulation Bar (7 cols) */}
        <div className="col-span-7 flex flex-col bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden">
          {/* Quick Scenario Buttons */}
          <div className="p-3 bg-slate-950/60 border-b border-slate-800 flex items-center space-x-2 overflow-x-auto text-xs">
            <span className="text-[11px] text-slate-500 whitespace-nowrap font-medium">Quick Scenarios:</span>
            {profile?.demo.samplePrompts.map((prompt) => (
              <button
                key={prompt.label}
                onClick={() => handleSendText(prompt.text)}
                className={`px-2.5 py-1 rounded-md whitespace-nowrap transition-all border ${
                  prompt.tone === 'warning'
                    ? 'bg-amber-950/30 hover:bg-amber-900/40 text-amber-300 border-amber-800/40'
                    : prompt.tone === 'danger'
                    ? 'bg-red-950/30 hover:bg-red-900/40 text-red-300 border-red-800/40'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                }`}
              >
                {prompt.label}
              </button>
            ))}
          </div>

          {/* Transcript Feed */}
          <div ref={chatScrollRef} className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-950/20">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.role === 'user'
                    ? 'items-end'
                    : msg.role === 'model'
                    ? 'items-start'
                    : 'items-center'
                }`}
              >
                {msg.role === 'system' ? (
                  <div className="px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-400 text-xs text-center max-w-lg">
                    {msg.text}
                  </div>
                ) : (
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed shadow-md ${
                      msg.role === 'user'
                        ? 'bg-emerald-600 text-white rounded-br-none'
                        : 'bg-slate-800 text-slate-100 border border-slate-700 rounded-bl-none'
                    }`}
                  >
                    <div className="flex items-center space-x-1.5 mb-1 opacity-70 text-[10px] font-semibold">
                      {msg.role === 'user' ? (
                        <>
                          <FiUser />
                          <span>Customer (Voice)</span>
                        </>
                      ) : (
                        <>
                          <RiRobot2Line className="text-orange-400" />
                          <span className="text-orange-300">Blazzy Voice AI</span>
                        </>
                      )}
                      <span>• {msg.timestamp.toLocaleTimeString()}</span>
                    </div>
                    <div>{msg.text}</div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Live Audio / Text Input Bar */}
          <div className="p-3 bg-slate-950/90 border-t border-slate-800 flex items-center space-x-2">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
              placeholder="Speak to your mic or type customer voice query..."
              className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-orange-500 placeholder-slate-500"
            />
            <button
              onClick={() => handleSendText()}
              className="p-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-semibold transition-all shadow-md"
            >
              <FiSend />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
