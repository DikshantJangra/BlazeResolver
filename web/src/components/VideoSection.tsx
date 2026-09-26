"use client";

import React, { useState } from "react";
import { FaPlay, FaCheck, FaRotateRight } from "react-icons/fa6";
import { LuSparkles } from "react-icons/lu";

export default function VideoSection() {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <section className="relative py-24 border-t border-white/[0.06] overflow-hidden">
      <div className="mx-auto max-w-[1240px] px-4 sm:px-8">
        {/* Section Heading */}
        <div className="flex flex-col items-center text-center gap-4 max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-medium uppercase tracking-wider text-white/90 bg-white/[0.08] border border-white/10">
            Interactive Video Demo
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight font-ds-display">
            Watch BlazeResolver resolve tickets in real-time
          </h2>

          <p className="text-base sm:text-lg text-neutral-400 leading-relaxed max-w-2xl">
            See how an incoming customer refund request is classified, cross-referenced with delivery telemetry,
            and resolved with money-gate policy enforcement.
          </p>
        </div>

        {/* Video Frame */}
        <div className="relative mx-auto max-w-[1000px] rounded-2xl border border-white/15 bg-black/60 shadow-2xl overflow-hidden group">
          {/* Top Status Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-[#14151b]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-mono text-neutral-300">
                Live Resolution Stream • Case #BR-9481
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono text-neutral-400">
              <span>Model: Claude 3.5 Sonnet / GPT-4o</span>
              <span className="hidden sm:inline text-neutral-600">|</span>
              <span className="hidden sm:inline">Harness: BlazeResolver v0.4</span>
            </div>
          </div>

          {/* Media Player Container */}
          <div className="relative aspect-video w-full bg-[#0b0c10] flex items-center justify-center overflow-hidden">
            <img
              src="/images/demo-poster.jpg"
              alt="BlazeResolver Resolution Demo Poster"
              className="w-full h-full object-cover opacity-85 group-hover:opacity-95 transition-opacity"
            />

            {/* Glowing Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />

            {/* Play Button */}
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              aria-label="Play resolution demo video"
              className="relative z-10 w-20 h-20 rounded-full flex items-center justify-center bg-[#FF6B00] hover:bg-[#e05e00] text-white shadow-xl transition-all transform hover:scale-110 cursor-pointer"
            >
              <FaPlay className="text-2xl ml-1" />
            </button>

            {/* Resolution Step Overlay */}
            <div className="absolute bottom-6 left-6 right-6 flex flex-wrap items-center justify-between gap-4 pointer-events-none">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/70 backdrop-blur-md border border-white/10 text-xs font-mono text-neutral-200">
                <span className="text-[#FF6B00]">Step:</span>
                <span>orderBilling.refundItem()</span>
                <span className="text-emerald-400 flex items-center gap-1 ml-2">
                  <FaCheck className="text-[10px]" />
                  <span>Approved $18.50</span>
                </span>
              </div>

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/70 backdrop-blur-md border border-white/10 text-xs font-mono text-neutral-300">
                <span>Latency: 284ms</span>
                <span className="text-neutral-500">•</span>
                <span>Tone: Empathetic</span>
              </div>
            </div>
          </div>

          {/* Bottom Telemetry Bar */}
          <div className="px-6 py-4 bg-[#14151b] border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center font-mono">
            <div>
              <div className="text-xs text-neutral-400">Triage Classification</div>
              <div className="text-sm font-bold text-white mt-1">Delivery / Missing Item</div>
            </div>
            <div>
              <div className="text-xs text-neutral-400">Context Source</div>
              <div className="text-sm font-bold text-white mt-1">Postgres + Stripe API</div>
            </div>
            <div>
              <div className="text-xs text-neutral-400">Policy Gate</div>
              <div className="text-sm font-bold text-emerald-400 mt-1">Pass (&lt; $50 max)</div>
            </div>
            <div>
              <div className="text-xs text-neutral-400">Response Channel</div>
              <div className="text-sm font-bold text-[#FF6B00] mt-1">Voice Call + SMS</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
