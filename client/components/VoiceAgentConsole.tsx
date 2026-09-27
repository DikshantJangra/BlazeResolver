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
import { BlazzyIcon } from './support/BlazzyMascot.js';

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
      text: '🎙️ Welcome to Blazzy Live Voice Assistant. Click "Start Live Call" or choose any scenario below to speak directly with the AI Voice engine.',
      timestamp: new Date()
    }
  ]);
  const [activeTools, setActiveTools] = useState<ToolCallEvent[]>([]);
  const [textInput, setTextInput] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);

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
          : 0.12;

        const effectiveHeight = Math.max(4, factor * height * 0.85);
        const x = i * (barWidth + 2);
        const y = (height - effectiveHeight) / 2;

        const gradient = ctx.createLinearGradient(0, y, 0, y + effectiveHeight);
        if (isSpeaking) {
          gradient.addColorStop(0, '#f97316');
          gradient.addColorStop(1, '#ea580c');
        } else if (isRecording) {
          gradient.addColorStop(0, '#10b981');
          gradient.addColorStop(1, '#059669');
        } else {
          gradient.addColorStop(0, '#cbd5e1');
          gradient.addColorStop(1, '#94a3b8');
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
        const pcm16 = new Int16Array(inputData.length);
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          sum += Math.abs(s);
        }

        const avg = sum / inputData.length;
        setAudioLevel(Math.min(1, avg * 5));

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
    <div className="flex flex-col h-full bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between px-5 py-3.5 bg-slate-50/90 border-b border-slate-200 gap-3">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center">
            <BlazzyIcon className="w-8 h-8 rounded-lg" />
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
                isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'
              }`}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-sm">Blazzy Voice Assistant</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200 font-mono font-bold">
                Gemini Live Voice • PCM 16k/24k
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              {isConnected
                ? isSpeaking
                  ? 'Blazzy is speaking...'
                  : isRecording
                  ? 'Listening to microphone stream...'
                  : 'Ready for input'
                : 'Offline • Connect to start bidirectional speech session'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs shadow-2xs">
            <span className="text-slate-500 text-[11px]">Voice:</span>
            <select
              value={activeVoice}
              onChange={(e) => setActiveVoice(e.target.value)}
              disabled={isConnected}
              className="bg-transparent text-slate-800 font-semibold focus:outline-none cursor-pointer text-xs"
            >
              <option value="Kore">Kore (Empathetic)</option>
              <option value="Puck">Puck (Fast/Upbeat)</option>
              <option value="Aoede">Aoede (Clear)</option>
              <option value="Fenrir">Fenrir (Authoritative)</option>
              <option value="Charon">Charon (Calm)</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs shadow-2xs">
            <span className="text-slate-500 text-[11px]">Order:</span>
            <select
              value={activeOrderId}
              onChange={(e) => setActiveOrderId(e.target.value)}
              className="bg-transparent text-orange-600 font-mono font-bold focus:outline-none cursor-pointer text-xs"
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
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-all shadow-xs"
            >
              <FiPhoneOff className="text-xs" />
              <span>End Call</span>
            </button>
          ) : (
            <button
              onClick={startSession}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-all shadow-xs"
            >
              <FiPhoneCall className="text-xs" />
              <span>Start Live Call</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Waveform + Tools HUD + Live Transcript */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 p-4 overflow-y-auto md:overflow-hidden min-h-0 bg-slate-50/50">
        {/* Left Side: Real-Time Audio Visualizer & Dispatched Tools HUD (5 cols) */}
        <div className="col-span-1 md:col-span-5 flex flex-col gap-3 min-h-[300px] overflow-hidden">
          {/* Audio Visualizer Card */}
          <div className="p-4 bg-white border border-slate-200 rounded-xl relative flex flex-col items-center justify-center min-h-[140px] shadow-2xs">
            <canvas ref={canvasRef} width={340} height={70} className="w-full h-14" />

            <div className="mt-2.5 flex items-center justify-between w-full text-[11px] text-slate-500 font-medium">
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${isRecording ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                <span>Microphone (PCM 16k)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${isSpeaking ? 'bg-orange-500 animate-pulse' : 'bg-slate-300'}`} />
                <span>Model Output (PCM 24k)</span>
              </div>
            </div>

            {/* Barge-in Button */}
            {isSpeaking && (
              <button
                onClick={stopAllPlayback}
                className="mt-2.5 px-3 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-medium transition-all shadow-2xs"
              >
                Interrupt (Barge-In)
              </button>
            )}
          </div>

          {/* Real-Time Tool Calls Stream HUD */}
          <div className="flex-1 flex flex-col bg-white border border-slate-200 rounded-xl p-3.5 overflow-hidden shadow-2xs min-h-[180px]">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-1.5">
                <FiZap className="text-orange-500" />
                <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">
                  Live Tool Execution Stream
                </span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono font-bold">
                {activeTools.length} Dispatched
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 mt-2.5 pr-1">
              {activeTools.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 text-xs py-6">
                  <FiLayers className="text-xl mb-1.5 text-slate-300" />
                  <span className="font-medium text-slate-600">No tools triggered yet</span>
                  <span className="text-[11px] text-slate-400 mt-0.5">
                    Ask BlazeResolver to look up your order or calculate refund!
                  </span>
                </div>
              ) : (
                activeTools.map((tool) => (
                  <div
                    key={tool.id}
                    className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono transition-all hover:border-slate-300"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            tool.status === 'completed'
                              ? 'bg-emerald-500'
                              : tool.status === 'running'
                              ? 'bg-amber-500 animate-ping'
                              : 'bg-red-500'
                          }`}
                        />
                        <span className="font-bold text-orange-700">{tool.toolName}</span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {tool.timestamp.toLocaleTimeString()}
                      </span>
                    </div>

                    {tool.args && (
                      <div className="mt-1 text-[10px] text-slate-600 bg-white p-1.5 rounded border border-slate-200 overflow-x-auto">
                        <span className="text-slate-400 font-sans text-[10px] font-semibold">ARGS: </span>
                        {JSON.stringify(tool.args)}
                      </div>
                    )}

                    {tool.result != null && (
                      <div className="mt-1 text-[10px] text-emerald-800 bg-emerald-50 p-1.5 rounded border border-emerald-200 overflow-x-auto max-h-20">
                        <span className="text-emerald-600 font-sans text-[10px] font-semibold">RESULT: </span>
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
        <div className="col-span-1 md:col-span-7 flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs min-h-[360px]">
          {/* Quick Scenario Buttons */}
          <div className="p-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2 overflow-x-auto text-xs">
            <span className="text-[11px] text-slate-500 whitespace-nowrap font-semibold">Scenarios:</span>
            {profile?.demo.samplePrompts.map((prompt) => (
              <button
                key={prompt.label}
                onClick={() => handleSendText(prompt.text)}
                className={`px-2.5 py-1 rounded-md whitespace-nowrap text-[11px] font-medium transition-all border ${
                  prompt.tone === 'warning'
                    ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200'
                    : prompt.tone === 'danger'
                    ? 'bg-red-50 hover:bg-red-100 text-red-900 border-red-200'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                {prompt.label}
              </button>
            ))}
          </div>

          {/* Transcript Feed */}
          <div ref={chatScrollRef} className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/40">
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
                  <div className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-[11px] text-center max-w-lg font-medium">
                    {msg.text}
                  </div>
                ) : (
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-xs ${
                      msg.role === 'user'
                        ? 'bg-emerald-600 text-white rounded-br-none'
                        : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 opacity-80 text-[10px] font-semibold">
                      {msg.role === 'user' ? (
                        <>
                          <FiUser />
                          <span>Customer Voice Input</span>
                        </>
                      ) : (
                        <>
                          <BlazzyIcon className="w-3.5 h-3.5" />
                          <span className="text-orange-700 font-bold">Blazzy Voice AI</span>
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
          <div className="p-2.5 bg-white border-t border-slate-200 flex items-center gap-2">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
              placeholder="Type message or speak through microphone..."
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-orange-500 focus:bg-white placeholder-slate-400 font-medium"
            />
            <button
              onClick={() => handleSendText()}
              className="p-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-semibold transition-all shadow-xs"
              title="Send speech text"
            >
              <FiSend className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

