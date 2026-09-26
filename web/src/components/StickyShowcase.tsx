"use client";

import React, { useState } from "react";
import Image from "next/image";
import { FaSliders, FaRoute, FaPuzzlePiece, FaCheck } from "react-icons/fa6";
import { LuWorkflow, LuLayers, LuSparkles, LuTerminal } from "react-icons/lu";

export default function StickyShowcase() {
  const [activeSlide, setActiveSlide] = useState(0);

  const slides = [
    {
      title: "Everything is a plugin",
      subtitle: "Modular agent capabilities",
      description:
        "BlazeResolver is architected around LangGraph's extensible plugin system. Capabilities like Triage, Correlate, Guardrails, and Voice synthesizers are registered as independent nodes. Swap LLM providers or plug in custom ERP databases without modifying the core orchestrator.",
      icon: <FaPuzzlePiece className="text-xl text-[#FF6B00]" />,
    },
    {
      title: "Every run is traceable",
      subtitle: "Append-only session logs & trajectory audit",
      description:
        "Every incoming ticket event, LLM reasoning chain, tool execution result, and guardrail check is permanently stored in an immutable trajectory log. Reconstruct entire support sessions, debug hallucination edges, and replay resolutions directly from the trace inspector.",
      icon: <FaRoute className="text-xl text-[#0055FF]" />,
    },
    {
      title: "Multiple runtime modes",
      subtitle: "Standard, Voice WebRTC, and Strict Guardrails",
      description:
        "Switch between operational modes on the fly: Standard mode runs full omnichannel support; Voice mode integrates ultra-low latency audio streaming; Strict Guardrail mode enforces deterministic financial approval gates on refunds and discounts.",
      icon: <FaSliders className="text-xl text-emerald-400" />,
    },
  ];

  return (
    <section id="traceability" className="relative py-24 border-t border-white/[0.06] bg-[#0c0d10]">
      <div className="mx-auto max-w-[1240px] px-4 sm:px-8">
        {/* Section Header */}
        <div className="mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-medium uppercase tracking-wider text-white/90 bg-white/[0.08] border border-white/10 mb-4">
            Design approach
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight font-ds-display">
            Everything is a plugin.
            <br />
            <span className="text-neutral-400">Every run is traceable.</span>
          </h2>
        </div>

        {/* Desktop 2-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[45fr_55fr] gap-12 items-start">
          {/* Left Column: Interactive Cards */}
          <div className="flex flex-col gap-6">
            {slides.map((slide, idx) => (
              <div
                key={idx}
                onClick={() => setActiveSlide(idx)}
                className={`p-6 sm:p-8 rounded-2xl border transition-all duration-300 cursor-pointer ${
                  activeSlide === idx
                    ? "bg-[#161820] border-[#FF6B00]/40 shadow-xl"
                    : "bg-[#121318]/50 border-white/[0.06] hover:border-white/15 opacity-60 hover:opacity-100"
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-white/[0.05] border border-white/10">
                    {slide.icon}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white font-ds-display">
                      {slide.title}
                    </h3>
                    <p className="text-xs text-[#FF6B00] font-mono">
                      {slide.subtitle}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-neutral-300 leading-relaxed pl-1">
                  {slide.description}
                </p>

                {/* Active indicator bar */}
                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-neutral-400">
                  <span className="font-mono">Slide 0{idx + 1} / 03</span>
                  {activeSlide === idx && (
                    <span className="flex items-center gap-1 text-[#FF6B00] font-medium">
                      <span>Active Preview</span>
                      <FaCheck className="text-xs" />
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Right Column: Sticky Visual Preview */}
          <div className="lg:sticky lg:top-28">
            <div className="rounded-2xl border border-white/15 bg-[#121318] p-3 shadow-2xl overflow-hidden aspect-[8/5] relative">
              {/* Slide 0: Plugin System */}
              <div
                className={`absolute inset-3 transition-opacity duration-500 rounded-xl overflow-hidden bg-black/60 flex items-center justify-center ${
                  activeSlide === 0 ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                }`}
              >
                <img
                  src="/images/harness/feat-plugin.en.png"
                  alt="BlazeResolver Plugin Architecture"
                  className="w-full h-full object-contain"
                />
              </div>

              {/* Slide 1: Trajectory Real View */}
              <div
                className={`absolute inset-3 transition-opacity duration-500 rounded-xl overflow-hidden bg-black/60 flex items-center justify-center ${
                  activeSlide === 1 ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                }`}
              >
                <img
                  src="/images/harness/trajectory-real-view.en.png"
                  alt="BlazeResolver Session Trajectory"
                  className="w-full h-full object-contain"
                />
              </div>

              {/* Slide 2: Mode Selector Card */}
              <div
                className={`absolute inset-3 transition-opacity duration-500 rounded-xl overflow-hidden bg-[#181a22] p-6 flex flex-col justify-between ${
                  activeSlide === 2 ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                }`}
              >
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#FF6B00]" />
                    <span className="font-mono text-sm font-bold text-white">Runtime Mode Engine</span>
                  </div>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/10 text-neutral-300">
                    config.mode
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-4">
                  <div className="p-3 rounded-lg bg-white/[0.04] border border-white/10 flex flex-col justify-between">
                    <div>
                      <div className="font-semibold text-white text-sm">Standard Agent</div>
                      <div className="text-xs text-neutral-400 mt-1">Full support loop with tools, CRM, and voice API.</div>
                    </div>
                    <span className="text-[11px] font-mono text-[#FF6B00] mt-2">Active Default</span>
                  </div>

                  <div className="p-3 rounded-lg bg-white/[0.04] border border-white/10 flex flex-col justify-between">
                    <div>
                      <div className="font-semibold text-white text-sm">Strict Money-Gate</div>
                      <div className="text-xs text-neutral-400 mt-1">Refunds &gt; $50 require dual human sign-off.</div>
                    </div>
                    <span className="text-[11px] font-mono text-neutral-400 mt-2">Policy Guardrail</span>
                  </div>

                  <div className="p-3 rounded-lg bg-white/[0.04] border border-white/10 flex flex-col justify-between">
                    <div>
                      <div className="font-semibold text-white text-sm">Voice WebRTC</div>
                      <div className="text-xs text-neutral-400 mt-1">Direct SIP trunking for low-latency phone triage.</div>
                    </div>
                    <span className="text-[11px] font-mono text-emerald-400 mt-2">Streaming Audio</span>
                  </div>

                  <div className="p-3 rounded-lg bg-white/[0.04] border border-white/10 flex flex-col justify-between">
                    <div>
                      <div className="font-semibold text-white text-sm">Simulator Mode</div>
                      <div className="text-xs text-neutral-400 mt-1">Replay historic tickets against new prompts.</div>
                    </div>
                    <span className="text-[11px] font-mono text-neutral-400 mt-2">Benchmark Eval</span>
                  </div>
                </div>

                <div className="text-[11px] font-mono text-neutral-400 border-t border-white/10 pt-3 flex justify-between">
                  <span>Target: LangGraph StateGraph</span>
                  <span className="text-emerald-400">All checks pass</span>
                </div>
              </div>
            </div>

            {/* Quick slide tabs below preview on mobile */}
            <div className="flex lg:hidden items-center justify-center gap-2 mt-4">
              {slides.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveSlide(idx)}
                  className={`w-3 h-3 rounded-full transition-all ${
                    activeSlide === idx ? "bg-[#FF6B00] w-8" : "bg-white/20"
                  }`}
                  aria-label={`Slide ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
