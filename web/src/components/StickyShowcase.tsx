"use client";

import React, { useState } from "react";
import {
  FaPlug,
  FaRoute,
  FaLayerGroup,
  FaCheckCircle,
  FaTerminal,
  FaPhoneVolume,
  FaShieldHalved,
  FaClock,
} from "react-icons/fa6";

export default function StickyShowcase() {
  const [activeSlide, setActiveSlide] = useState(0);

  return (
    <section className="ds-container py-ds-10">
      <div className="hidden md:block">
        <div>
          <span
            className="inline-flex items-center rounded-[8px] p-[1px]"
            style={{
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.08) 35%, rgba(255,255,255,0.04) 65%, rgba(255,255,255,0.28) 100%)",
              boxShadow:
                "0 0 16px rgba(255,255,255,0.08), 0 0 32px rgba(255,255,255,0.04)",
            }}
          >
            <span className="px-[9px] pt-[6px] pb-[5px] rounded-[7px] bg-black/25 font-mono text-[12px] font-medium text-white/95 leading-none tracking-wider uppercase">
              Design approach
            </span>
          </span>
          <h2 className="ds-text-heading1 text-ds-primary mt-ds-4 mb-ds-9 max-w-[680px] whitespace-pre-line">
            Everything is a plugin.{"\n"}
            Every run is traceable.
          </h2>
        </div>

        <div className="grid grid-cols-[42fr_58fr] gap-ds-9 w-full items-start">
          {/* Left Column: Interactive Cards */}
          <div className="flex flex-col">
            {/* Card 0 */}
            <div
              onClick={() => setActiveSlide(0)}
              className="flex flex-col justify-center gap-ds-4 min-h-[30vh] py-[6vh] transition-all duration-300 cursor-pointer rounded-xl p-4 border border-transparent hover:border-white/10"
              style={{
                opacity: activeSlide === 0 ? 1 : 0.4,
                backgroundColor:
                  activeSlide === 0 ? "rgba(255,255,255,0.02)" : "transparent",
              }}
            >
              <div className="flex items-center gap-ds-2">
                <div
                  className={`transition-colors duration-300 ${
                    activeSlide === 0 ? "text-ds-brand" : "text-ds-description"
                  }`}
                >
                  <FaPlug className="w-5 h-5" />
                </div>
                <h3 className="ds-text-subtitle !text-[22px] !font-normal text-ds-primary">
                  Everything is a plugin
                </h3>
              </div>
              <p className="ds-text-body text-ds-description leading-[1.7]">
                BlazeResolver is built on an extensible plugin system. Plugins
                provide every resolution capability: customer triage, telemetry
                correlation, voice telephony, refund gateways, policy guards,
                and session storage. Adapters let your systems work seamlessly
                together without modifying core code.
              </p>
            </div>

            {/* Card 1 */}
            <div
              onClick={() => setActiveSlide(1)}
              className="flex flex-col justify-center gap-ds-4 min-h-[30vh] py-[6vh] transition-all duration-300 cursor-pointer rounded-xl p-4 border border-transparent hover:border-white/10"
              style={{
                opacity: activeSlide === 1 ? 1 : 0.4,
                backgroundColor:
                  activeSlide === 1 ? "rgba(255,255,255,0.02)" : "transparent",
              }}
            >
              <div className="flex items-center gap-ds-2">
                <div
                  className={`transition-colors duration-300 ${
                    activeSlide === 1 ? "text-ds-brand" : "text-ds-description"
                  }`}
                >
                  <FaRoute className="w-5 h-5" />
                </div>
                <h3 className="ds-text-subtitle !text-[22px] !font-normal text-ds-primary">
                  Every run is traceable
                </h3>
              </div>
              <p className="ds-text-body text-ds-description leading-[1.7]">
                Everything the model executes is recorded in an immutable session
                log: incoming caller intent, operational telemetry queries,
                policy guard evaluations, refund amounts, and audio responses.
                Inspect full audit trajectories end-to-end.
              </p>
            </div>

            {/* Card 2 */}
            <div
              onClick={() => setActiveSlide(2)}
              className="flex flex-col justify-center gap-ds-4 min-h-[30vh] py-[6vh] transition-all duration-300 cursor-pointer rounded-xl p-4 border border-transparent hover:border-white/10"
              style={{
                opacity: activeSlide === 2 ? 1 : 0.4,
                backgroundColor:
                  activeSlide === 2 ? "rgba(255,255,255,0.02)" : "transparent",
              }}
            >
              <div className="flex items-center gap-ds-2">
                <div
                  className={`transition-colors duration-300 ${
                    activeSlide === 2 ? "text-ds-brand" : "text-ds-description"
                  }`}
                >
                  <FaLayerGroup className="w-5 h-5" />
                </div>
                <h3 className="ds-text-subtitle !text-[22px] !font-normal text-ds-primary">
                  Multiple runtime modes
                </h3>
              </div>
              <p className="ds-text-body text-ds-description leading-[1.7]">
                Standard mode handles autonomous triage and omnichannel chat.
                Voice mode streams low-latency real-time voice resolution. Policy
                mode enforces financial refund and voucher approval gates.
                Creator mode lets you compose custom plugins and test flows in
                memory.
              </p>
            </div>
          </div>

          {/* Right Column: Sticky Media Frame */}
          <div className="sticky top-[15vh]">
            <div className="grid min-w-0 max-w-[760px] aspect-[8/5] bg-ds-surface-3 border border-ds-border-default rounded-ds-media overflow-hidden shadow-2xl">
              {/* Slide 0: Plugin & Adapter Hub (Pure Code & UI) */}
              <div
                className="col-start-1 row-start-1 min-w-0 transition-opacity duration-500"
                style={{
                  opacity: activeSlide === 0 ? 1 : 0,
                  pointerEvents: activeSlide === 0 ? "auto" : "none",
                }}
              >
                <div className="w-full h-full flex flex-col justify-between overflow-hidden bg-[#101113] p-5 font-mono text-xs">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#28c840] animate-pulse" />
                      <span className="font-semibold text-white">
                        BlazeResolver Plugin Hub
                      </span>
                    </div>
                    <span className="text-[11px] text-white/50">
                      4 active adapters
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 my-auto">
                    <div className="p-3 rounded-lg bg-white/[0.03] border border-white/10 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white flex items-center gap-1.5">
                          <FaPlug className="text-[#FF6B00]" /> BlazeEats Adapter
                        </span>
                        <FaCheckCircle className="text-[#28c840] w-3 h-3" />
                      </div>
                      <span className="text-[10px] text-white/60">
                        Order & kitchen telemetry stream
                      </span>
                      <span className="text-[9px] text-[#28c840] font-mono">
                        v1.2.0 • Active • 8ms
                      </span>
                    </div>

                    <div className="p-3 rounded-lg bg-white/[0.03] border border-white/10 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white flex items-center gap-1.5">
                          <FaPhoneVolume className="text-[#0055FF]" /> Twilio Voice
                        </span>
                        <FaCheckCircle className="text-[#28c840] w-3 h-3" />
                      </div>
                      <span className="text-[10px] text-white/60">
                        Bidirectional WebSocket audio
                      </span>
                      <span className="text-[9px] text-[#28c840] font-mono">
                        Connected • 18ms latency
                      </span>
                    </div>

                    <div className="p-3 rounded-lg bg-white/[0.03] border border-white/10 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white flex items-center gap-1.5">
                          <FaShieldHalved className="text-[#FF6B00]" /> Policy Guard
                        </span>
                        <FaCheckCircle className="text-[#28c840] w-3 h-3" />
                      </div>
                      <span className="text-[10px] text-white/60">
                        Max refund threshold: $35.00
                      </span>
                      <span className="text-[9px] text-white/50 font-mono">
                        Rule gated • Enforced
                      </span>
                    </div>

                    <div className="p-3 rounded-lg bg-white/[0.03] border border-white/10 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white flex items-center gap-1.5">
                          <FaTerminal className="text-[#0055FF]" /> SQLite Event Log
                        </span>
                        <FaCheckCircle className="text-[#28c840] w-3 h-3" />
                      </div>
                      <span className="text-[10px] text-white/60">
                        Append-only audit trail
                      </span>
                      <span className="text-[9px] text-[#28c840] font-mono">
                        Local • Synchronized
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[10px] text-white/40">
                    <span>Engine: LangGraph Kernel</span>
                    <span className="text-[#FF6B00]">All systems operational</span>
                  </div>
                </div>
              </div>

              {/* Slide 1: Real-time Trajectory View (Pure Code & UI) */}
              <div
                className="col-start-1 row-start-1 min-w-0 transition-opacity duration-500"
                style={{
                  opacity: activeSlide === 1 ? 1 : 0,
                  pointerEvents: activeSlide === 1 ? "auto" : "none",
                }}
              >
                <div className="w-full h-full flex flex-col justify-between overflow-hidden bg-[#101113] p-5 font-mono text-xs">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                    <div className="flex items-center gap-2">
                      <FaClock className="text-[#FF6B00] w-3.5 h-3.5" />
                      <span className="font-semibold text-white">
                        Trajectory Stream #BZ-8491
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-[#28c840]/20 text-[#28c840]">
                      RESOLVED
                    </span>
                  </div>

                  <div className="flex flex-col gap-2 my-auto">
                    <div className="flex items-start gap-2.5 text-[11px] p-1.5 rounded bg-white/[0.02]">
                      <span className="text-white/40 shrink-0 font-mono">00:01.2</span>
                      <span className="text-[#0055FF] font-semibold shrink-0">
                        [INCOMING]
                      </span>
                      <span className="text-white/80">
                        Caller order #9821: &quot;My order is 45m late&quot;
                      </span>
                    </div>

                    <div className="flex items-start gap-2.5 text-[11px] p-1.5 rounded bg-white/[0.02]">
                      <span className="text-white/40 shrink-0 font-mono">00:02.1</span>
                      <span className="text-[#FF6B00] font-semibold shrink-0">
                        [CORRELATE]
                      </span>
                      <span className="text-white/80">
                        Driver delayed by traffic • Food cold confirmed
                      </span>
                    </div>

                    <div className="flex items-start gap-2.5 text-[11px] p-1.5 rounded bg-white/[0.02]">
                      <span className="text-white/40 shrink-0 font-mono">00:03.4</span>
                      <span className="text-[#28c840] font-semibold shrink-0">
                        [POLICY_OK]
                      </span>
                      <span className="text-white/80">
                        Refund $24.50 + $5 credit approved within $35 limit
                      </span>
                    </div>

                    <div className="flex items-start gap-2.5 text-[11px] p-1.5 rounded bg-white/[0.02]">
                      <span className="text-white/40 shrink-0 font-mono">00:04.8</span>
                      <span className="text-white font-semibold shrink-0">
                        [VOICE_OUT]
                      </span>
                      <span className="text-white/80">
                        Spoke resolution & SMS confirmation dispatched
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[10px] text-white/40">
                    <span>Resolution time: 4.8s</span>
                    <span className="text-[#28c840]">Customer CSAT: 100%</span>
                  </div>
                </div>
              </div>

              {/* Slide 2: Interactive Mode Picker */}
              <div
                className="col-start-1 row-start-1 min-w-0 transition-opacity duration-500"
                style={{
                  opacity: activeSlide === 2 ? 1 : 0,
                  pointerEvents: activeSlide === 2 ? "auto" : "none",
                }}
              >
                <div
                  role="img"
                  aria-label="The runtime mode picker listing Standard, Voice, Policy, and Creator modes"
                  className="w-full h-full flex flex-col justify-center font-ds-sans select-text bg-[#101113] p-6"
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-white/90 bg-white/10">
                        blaze-demo
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-white/90 bg-[#FF6B00]/20 border border-[#FF6B00]/30">
                        Creator mode
                      </span>
                    </div>

                    <div className="flex flex-col gap-2 p-3 rounded-xl bg-[#1e2024] border border-white/5">
                      <div className="text-xs text-white/50">
                        Describe what you want to resolve
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-xs text-white/70">
                          Support adapter: voice + refund gateway
                        </span>
                        <span className="w-6 h-6 rounded-full bg-[#FF6B00] flex items-center justify-center text-white text-xs">
                          ↑
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <div className="p-2.5 rounded-lg bg-white/5 border border-white/5">
                        <div className="text-xs font-medium text-white">
                          Standard mode
                        </div>
                        <div className="text-[11px] text-white/50 mt-0.5">
                          Triage, correlation & chat
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-white/5 border border-white/5">
                        <div className="text-xs font-medium text-white">
                          Voice mode
                        </div>
                        <div className="text-[11px] text-white/50 mt-0.5">
                          Real-time voice support
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-white/5 border border-white/5">
                        <div className="text-xs font-medium text-white">
                          Policy mode
                        </div>
                        <div className="text-[11px] text-white/50 mt-0.5">
                          Gated money & refund limits
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-[#FF6B00]/10 border border-[#FF6B00]/30">
                        <div className="text-xs font-medium text-[#FF6B00]">
                          Creator mode
                        </div>
                        <div className="text-[11px] text-white/70 mt-0.5">
                          Custom harness plugins
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="md:hidden flex flex-col gap-ds-8">
        <div>
          <span
            className="inline-flex items-center rounded-[8px] p-[1px]"
            style={{
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.08) 35%, rgba(255,255,255,0.04) 65%, rgba(255,255,255,0.28) 100%)",
            }}
          >
            <span className="px-[9px] pt-[6px] pb-[5px] rounded-[7px] bg-black/25 font-mono text-[12px] font-medium text-white/95 leading-none tracking-wider uppercase">
              Design approach
            </span>
          </span>
          <h2 className="ds-text-heading1 text-ds-primary mt-ds-4 mb-ds-6 whitespace-pre-line">
            Everything is a plugin.{"\n"}
            Every run is traceable.
          </h2>
        </div>

        {/* Item 1 */}
        <div className="flex flex-col gap-4">
          <h3 className="ds-text-subtitle !text-[20px] text-ds-primary">
            Everything is a plugin
          </h3>
          <p className="ds-text-body text-ds-description">
            Plugins provide every resolution capability: triage, correlation,
            voice telephony, refund gateways, and session storage.
          </p>
        </div>

        {/* Item 2 */}
        <div className="flex flex-col gap-4">
          <h3 className="ds-text-subtitle !text-[20px] text-ds-primary">
            Every run is traceable
          </h3>
          <p className="ds-text-body text-ds-description">
            Everything the model executes is recorded in an immutable session
            log: incoming caller intent, policy evaluations, and refund amounts.
          </p>
        </div>
      </div>
    </section>
  );
}
