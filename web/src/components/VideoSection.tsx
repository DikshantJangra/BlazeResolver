"use client";

import React, { useState, useEffect } from "react";
import {
  FaPlay,
  FaPause,
  FaVolumeHigh,
  FaPhone,
  FaShieldHalved,
  FaBolt,
  FaCircleCheck,
  FaRotateRight,
} from "react-icons/fa6";

export default function VideoSection() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setStep((prev) => (prev < 3 ? prev + 1 : 0));
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  return (
    <section id="voice-demo" className="relative z-10 ds-container py-20 sm:py-28 scroll-mt-24">
      <div className="flex flex-col items-center text-center max-w-[820px] mx-auto">
        <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.05] border border-white/10 backdrop-blur-xl mb-4">
          <FaBolt className="w-3 h-3 text-[#FF6B00]" />
          <span className="font-mono text-xs font-semibold text-white/90 uppercase tracking-wider">
            Real-Time Voice Resolution Engine
          </span>
        </span>
        <h2 className="text-3xl sm:text-5xl font-bold font-ds-display text-white tracking-tight leading-[1.15]">
          Real-Time Voice Resolution in Action
        </h2>
        <p className="mt-4 text-base sm:text-lg text-white/70 leading-relaxed max-w-[680px]">
          Experience bidirectional conversational support powered by Gemini Live
          and Twilio WebSockets. Zero robotic pauses, live operational data
          queries, and policy-gated resolutions in under 5 seconds.
        </p>
      </div>

      <div className="mt-12 rounded-2xl border border-white/[0.12] bg-[#0b0d13] overflow-hidden shadow-2xl relative group max-w-[960px] mx-auto">
        {/* Top Cockpit Telemetry Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-white/[0.08] bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono bg-white/[0.06] border border-white/10 text-white/90">
              <span className={`w-2 h-2 rounded-full ${isPlaying ? "bg-[#28c840] animate-ping" : "bg-white/40"}`} />
              <span className="font-semibold">CALL #BZ-VOICE-9821</span>
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono bg-[#0055FF]/15 text-[#8da4ff] border border-[#0055FF]/30">
              <FaPhone className="w-2.5 h-2.5" /> Twilio • Gemini Live
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-full text-xs font-mono bg-[#28c840]/15 text-[#28c840] border border-[#28c840]/30 flex items-center gap-1.5">
              <FaShieldHalved className="w-3 h-3" /> Policy Guard: Active
            </span>
            <span className="text-xs font-mono text-white/50">
              Latency: <strong className="text-white font-semibold">280ms</strong>
            </span>
          </div>
        </div>

        {/* Interactive Audio Waveform & Conversation Cockpit */}
        <div className="p-6 sm:p-10 flex flex-col items-center justify-between min-h-[380px] gap-8">
          {/* Animated Audio Spectrum Bars */}
          <div className="flex items-center justify-center gap-1.5 h-16 w-full max-w-[360px] mx-auto">
            {[
              18, 32, 54, 42, 28, 64, 48, 30, 58, 44, 62, 36, 50, 24, 38, 56, 26, 46, 18,
            ].map((height, i) => (
              <div
                key={i}
                className={`w-1.5 rounded-full transition-all duration-300 ${
                  isPlaying
                    ? "bg-gradient-to-t from-[#FF6B00] via-[#FF8533] to-[#0055FF]"
                    : "bg-white/15"
                }`}
                style={{
                  height: isPlaying ? `${Math.max(12, height * (0.6 + 0.4 * Math.sin((i + step) * 0.8)))}px` : "8px",
                }}
              />
            ))}
          </div>

          {/* Step-by-Step Live Conversation Transcript */}
          <div className="w-full max-w-[640px] flex flex-col gap-3">
            {/* Caller Bubble */}
            <div className={`p-4 rounded-2xl border transition-all duration-300 ${
              isPlaying && (step === 0 || step === 1)
                ? "bg-[#0055FF]/10 border-[#0055FF]/30 shadow-lg"
                : "bg-white/[0.02] border-white/[0.06]"
            }`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono text-xs font-semibold text-[#8da4ff] flex items-center gap-1.5">
                  <FaPhone className="w-2.5 h-2.5" /> Caller (PSTN Audio In)
                </span>
                <span className="font-mono text-[10px] text-white/40">00:01.2</span>
              </div>
              <p className="text-sm text-white/90 leading-relaxed font-sans">
                &quot;Hi, my food delivery was delayed 45 minutes and the order arrived completely crushed and cold.&quot;
              </p>
            </div>

            {/* BlazeResolver Harness Bubble */}
            <div className={`p-4 rounded-2xl border transition-all duration-300 ${
              isPlaying && (step === 2 || step === 3)
                ? "bg-[#FF6B00]/10 border-[#FF6B00]/30 shadow-lg"
                : "bg-white/[0.02] border-white/[0.06]"
            }`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono text-xs font-semibold text-[#FF8533] flex items-center gap-1.5">
                  <FaBolt className="w-3 h-3 text-[#FF6B00]" /> BlazeResolver Voice Agent
                </span>
                <span className="font-mono text-[10px] text-[#28c840] font-semibold flex items-center gap-1">
                  <FaCircleCheck className="w-2.5 h-2.5" /> Telemetry Confirmed
                </span>
              </div>
              <p className="text-sm text-white leading-relaxed font-sans">
                &quot;I apologize for that experience! I verified our driver telemetry stream and confirmed the 45-minute delay. I&apos;ve processed an instant $28.50 refund to your original card and applied a $5.00 goodwill credit.&quot;
              </p>
            </div>
          </div>

          {/* Quick interactive trigger CTA */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className={`flex items-center gap-2.5 px-6 py-2.5 rounded-xl font-ds-sans font-medium text-sm transition-all cursor-pointer ${
                isPlaying
                  ? "bg-white/10 text-white border border-white/20 hover:bg-white/15"
                  : "bg-[#FF6B00] text-white hover:bg-[#e05e00] shadow-md"
              }`}
            >
              {isPlaying ? (
                <>
                  <FaPause className="w-3.5 h-3.5" />
                  <span>Pause Voice Simulation</span>
                </>
              ) : (
                <>
                  <FaPlay className="w-3.5 h-3.5" />
                  <span>Simulate Voice Agent Call</span>
                </>
              )}
            </button>

            {isPlaying && (
              <button
                type="button"
                onClick={() => setStep(0)}
                aria-label="Restart call simulation"
                className="p-2.5 rounded-xl bg-white/[0.05] hover:bg-white/10 text-white/60 hover:text-white border border-white/10 transition-colors cursor-pointer"
              >
                <FaRotateRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Bottom Glass Control Bar */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-white/[0.08] bg-white/[0.02] text-xs font-mono text-white/60">
          <div className="flex items-center gap-3">
            <span className="text-white/80 font-medium">Status:</span>
            <span className={isPlaying ? "text-[#28c840] font-semibold" : "text-white/40"}>
              {isPlaying ? "Streaming Bidirectional Voice • 24kHz Opus" : "Ready • Click Simulate to play"}
            </span>
          </div>
          <div className="flex items-center gap-2 text-white/40">
            <FaVolumeHigh className="w-3.5 h-3.5" />
            <span>Deterministic Payout Verified</span>
          </div>
        </div>
      </div>
    </section>
  );
}
