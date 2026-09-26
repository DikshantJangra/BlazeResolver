"use client";

import React, { useState } from "react";
import {
  FaPlug,
  FaRoute,
  FaShieldHalved,
  FaCircleCheck,
  FaDatabase,
  FaCreditCard,
  FaTicket,
  FaToggleOn,
  FaClock,
  FaCheck,
  FaXmark,
  FaUserCheck,
  FaLock,
  FaBolt,
} from "react-icons/fa6";

export default function StickyShowcase() {
  const [activeSlide, setActiveSlide] = useState(0);

  return (
    <section className="relative z-10 ds-container py-24 sm:py-32">
      <div className="hidden md:block">
        <div className="mb-12">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.05] border border-white/10 backdrop-blur-xl mb-4">
            <FaBolt className="w-3 h-3 text-[#FF6B00]" />
            <span className="font-mono text-xs font-semibold text-white/90 uppercase tracking-wider">
              Core Architecture
            </span>
          </span>
          <h2 className="text-3xl sm:text-5xl font-bold font-ds-display text-white tracking-tight leading-[1.15] max-w-[720px] whitespace-pre-line">
            Operational intelligence.{"\n"}
            Deterministic action.
          </h2>
        </div>

        <div className="grid grid-cols-[42fr_58fr] gap-12 w-full items-start">
          {/* Left Column: Interactive Cards */}
          <div className="flex flex-col gap-3">
            {/* Card 0: 4-Adapter Architecture */}
            <div
              onClick={() => setActiveSlide(0)}
              className="flex flex-col justify-center gap-3.5 p-6 rounded-2xl border transition-all duration-300 cursor-pointer"
              style={{
                opacity: activeSlide === 0 ? 1 : 0.45,
                backgroundColor:
                  activeSlide === 0 ? "rgba(255,255,255,0.03)" : "transparent",
                borderColor:
                  activeSlide === 0 ? "rgba(255,255,255,0.15)" : "transparent",
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-xl transition-colors duration-300 ${
                    activeSlide === 0
                      ? "bg-[#FF6B00]/15 text-[#FF6B00] border border-[#FF6B00]/30"
                      : "bg-white/5 text-white/50 border border-white/10"
                  }`}
                >
                  <FaPlug className="w-4 h-4" />
                </div>
                <h3 className="font-ds-sans font-bold text-xl text-white tracking-tight">
                  Universal 4-Adapter Architecture
                </h3>
              </div>
              <p className="text-sm text-white/70 leading-relaxed font-normal">
                BlazeResolver is completely business-agnostic. It connects to
                your product via four typed contracts:{" "}
                <span className="text-white/90 font-mono text-xs">
                  OrderSource
                </span>{" "}
                (transactions & telemetry),{" "}
                <span className="text-white/90 font-mono text-xs">
                  RefundGateway
                </span>{" "}
                (idempotent payouts),{" "}
                <span className="text-white/90 font-mono text-xs">
                  TicketSink
                </span>{" "}
                (consolidated CRM tickets), and{" "}
                <span className="text-white/90 font-mono text-xs">
                  AvailabilityControl
                </span>{" "}
                (feature/SKU 86ing). Drop it into SaaS, e-commerce, on-demand
                apps, or fintech without changing the core harness.
              </p>
            </div>

            {/* Card 1: Correlate Engine */}
            <div
              onClick={() => setActiveSlide(1)}
              className="flex flex-col justify-center gap-3.5 p-6 rounded-2xl border transition-all duration-300 cursor-pointer"
              style={{
                opacity: activeSlide === 1 ? 1 : 0.45,
                backgroundColor:
                  activeSlide === 1 ? "rgba(255,255,255,0.03)" : "transparent",
                borderColor:
                  activeSlide === 1 ? "rgba(255,255,255,0.15)" : "transparent",
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-xl transition-colors duration-300 ${
                    activeSlide === 1
                      ? "bg-[#0055FF]/15 text-[#0055FF] border border-[#0055FF]/30"
                      : "bg-white/5 text-white/50 border border-white/10"
                  }`}
                >
                  <FaRoute className="w-4 h-4" />
                </div>
                <h3 className="font-ds-sans font-bold text-xl text-white tracking-tight">
                  The Correlate Engine: 1 Incident, Not N Tickets
                </h3>
              </div>
              <p className="text-sm text-white/70 leading-relaxed font-normal">
                When an operational bottleneck strikes, standard bots generate
                dozens of disconnected support tickets. BlazeResolver ingests
                customer complaints into a sliding buffer, clusters related
                issues, and cross-references live telemetry signals. If
                fulfillment latency spikes, it emits ONE root-cause incident to
                the ops queue while automatically resolving each affected
                customer.
              </p>
            </div>

            {/* Card 2: Money-Gate Policy */}
            <div
              onClick={() => setActiveSlide(2)}
              className="flex flex-col justify-center gap-3.5 p-6 rounded-2xl border transition-all duration-300 cursor-pointer"
              style={{
                opacity: activeSlide === 2 ? 1 : 0.45,
                backgroundColor:
                  activeSlide === 2 ? "rgba(255,255,255,0.03)" : "transparent",
                borderColor:
                  activeSlide === 2 ? "rgba(255,255,255,0.15)" : "transparent",
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-xl transition-colors duration-300 ${
                    activeSlide === 2
                      ? "bg-[#28c840]/15 text-[#28c840] border border-[#28c840]/30"
                      : "bg-white/5 text-white/50 border border-white/10"
                  }`}
                >
                  <FaShieldHalved className="w-4 h-4" />
                </div>
                <h3 className="font-ds-sans font-bold text-xl text-white tracking-tight">
                  Money-Gate Policy & Human-in-the-Loop
                </h3>
              </div>
              <p className="text-sm text-white/70 leading-relaxed font-normal">
                LLMs should never execute unconstrained financial actions.
                BlazeResolver enforces hard spending ceilings: claims under
                policy limits (e.g. ≤ $35.00) auto-execute instantly with
                cryptographic idempotency keys. High-value claims or anomalous
                customer velocities route directly to the Human-In-The-Loop
                supervisor queue for 1-click review.
              </p>
            </div>
          </div>

          {/* Right Column: Sticky Media Frame */}
          <div className="sticky top-[18vh]">
            <div className="grid min-w-0 max-w-[760px] aspect-[8/5.2] bg-[#0c0d12]/90 backdrop-blur-2xl border border-white/[0.12] rounded-2xl overflow-hidden shadow-2xl">
              {/* Slide 0: The 4-Adapter Hub */}
              <div
                className="col-start-1 row-start-1 min-w-0 transition-opacity duration-500"
                style={{
                  opacity: activeSlide === 0 ? 1 : 0,
                  pointerEvents: activeSlide === 0 ? "auto" : "none",
                }}
              >
                <div className="w-full h-full flex flex-col justify-between p-6">
                  {/* Header */}
                  <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.08]">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#28c840] animate-pulse" />
                      <span className="font-ds-sans font-semibold text-sm text-white">
                        4-Adapter Interface Hub
                      </span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-white/[0.05] border border-white/10 text-white/60">
                      4 active contracts
                    </span>
                  </div>

                  {/* 4 Cards */}
                  <div className="grid grid-cols-2 gap-3.5 my-auto">
                    <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.08] flex flex-col gap-1.5 hover:border-white/15 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-white flex items-center gap-2">
                          <FaDatabase className="text-[#FF6B00] w-3.5 h-3.5" />{" "}
                          OrderSource
                        </span>
                        <FaCircleCheck className="text-[#28c840] w-3 h-3" />
                      </div>
                      <span className="text-[11px] text-white/60">
                        Transaction & live telemetry stream
                      </span>
                      <span className="text-[10px] text-[#28c840] font-mono mt-0.5">
                        Active • Telemetry Synced
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.08] flex flex-col gap-1.5 hover:border-white/15 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-white flex items-center gap-2">
                          <FaCreditCard className="text-[#0055FF] w-3.5 h-3.5" />{" "}
                          RefundGateway
                        </span>
                        <FaCircleCheck className="text-[#28c840] w-3 h-3" />
                      </div>
                      <span className="text-[11px] text-white/60">
                        Idempotent payouts & wallet credits
                      </span>
                      <span className="text-[10px] text-[#28c840] font-mono mt-0.5">
                        Stripe / UPI / Wallet • Locked
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.08] flex flex-col gap-1.5 hover:border-white/15 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-white flex items-center gap-2">
                          <FaTicket className="text-[#FF6B00] w-3.5 h-3.5" />{" "}
                          TicketSink
                        </span>
                        <FaCircleCheck className="text-[#28c840] w-3 h-3" />
                      </div>
                      <span className="text-[11px] text-white/60">
                        Consolidated root-cause incident tickets
                      </span>
                      <span className="text-[10px] text-white/50 font-mono mt-0.5">
                        Linear / Zendesk / CRM • Clustered
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.08] flex flex-col gap-1.5 hover:border-white/15 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-white flex items-center gap-2">
                          <FaToggleOn className="text-[#0055FF] w-3.5 h-3.5" />{" "}
                          AvailabilityControl
                        </span>
                        <FaCircleCheck className="text-[#28c840] w-3 h-3" />
                      </div>
                      <span className="text-[11px] text-white/60">
                        Defective item / feature 86ing
                      </span>
                      <span className="text-[10px] text-[#28c840] font-mono mt-0.5">
                        Dynamic Scope • Rule Gated
                      </span>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-white/[0.08] text-xs font-mono text-white/40">
                    <span>Engine: LangGraph Kernel</span>
                    <span className="text-[#FF6B00] font-medium">
                      All 4 adapter contracts bound
                    </span>
                  </div>
                </div>
              </div>

              {/* Slide 1: Real-time Trajectory View */}
              <div
                className="col-start-1 row-start-1 min-w-0 transition-opacity duration-500"
                style={{
                  opacity: activeSlide === 1 ? 1 : 0,
                  pointerEvents: activeSlide === 1 ? "auto" : "none",
                }}
              >
                <div className="w-full h-full flex flex-col justify-between p-6">
                  {/* Header */}
                  <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.08]">
                    <div className="flex items-center gap-2.5">
                      <FaClock className="text-[#FF6B00] w-3.5 h-3.5" />
                      <span className="font-ds-sans font-semibold text-sm text-white">
                        Trajectory Stream #BZ-8491
                      </span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-[#28c840]/15 text-[#28c840] border border-[#28c840]/30">
                      SYSTEMIC RESOLVED
                    </span>
                  </div>

                  {/* Stream List */}
                  <div className="flex flex-col gap-2 my-auto">
                    <div className="flex items-start gap-2.5 text-xs p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                      <span className="text-white/40 font-mono text-[11px] shrink-0 mt-0.5">
                        00:01.2
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#0055FF]/15 text-[#8da4ff] shrink-0">
                        INBOUND
                      </span>
                      <span className="text-white/85 text-xs leading-relaxed">
                        Order #9821: &quot;Fulfillment delayed 45m, items
                        arrived defective&quot;
                      </span>
                    </div>

                    <div className="flex items-start gap-2.5 text-xs p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                      <span className="text-white/40 font-mono text-[11px] shrink-0 mt-0.5">
                        00:02.1
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#FF6B00]/15 text-[#FF6B00] shrink-0">
                        CORRELATE
                      </span>
                      <span className="text-white/85 text-xs leading-relaxed">
                        Fulfillment telemetry confirmed 3.1x bottleneck • 5
                        claims clustered
                      </span>
                    </div>

                    <div className="flex items-start gap-2.5 text-xs p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                      <span className="text-white/40 font-mono text-[11px] shrink-0 mt-0.5">
                        00:03.0
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/15 text-purple-300 shrink-0">
                        INCIDENT
                      </span>
                      <span className="text-white/85 text-xs leading-relaxed">
                        Consolidated #INC-402 routed to Ops Lead (5 tickets → 1
                        root cause)
                      </span>
                    </div>

                    <div className="flex items-start gap-2.5 text-xs p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                      <span className="text-white/40 font-mono text-[11px] shrink-0 mt-0.5">
                        00:03.8
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#28c840]/15 text-[#28c840] shrink-0">
                        POLICY_OK
                      </span>
                      <span className="text-white/85 text-xs leading-relaxed">
                        Auto-refund $28.50 within policy limit • Idempotency key
                        locked
                      </span>
                    </div>

                    <div className="flex items-start gap-2.5 text-xs p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                      <span className="text-white/40 font-mono text-[11px] shrink-0 mt-0.5">
                        00:04.6
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-white/10 text-white/90 shrink-0">
                        VOICE_OUT
                      </span>
                      <span className="text-white/85 text-xs leading-relaxed">
                        Spoke resolution & refund confirmation receipt
                        dispatched
                      </span>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-white/[0.08] text-xs font-mono text-white/40">
                    <span>Resolution time: 4.6s</span>
                    <span className="text-[#28c840] font-medium">
                      Incident Consolidation: 5 → 1
                    </span>
                  </div>
                </div>
              </div>

              {/* Slide 2: Policy Guard & Supervisor HITL Console (Redesigned with pristine consistency) */}
              <div
                className="col-start-1 row-start-1 min-w-0 transition-opacity duration-500"
                style={{
                  opacity: activeSlide === 2 ? 1 : 0,
                  pointerEvents: activeSlide === 2 ? "auto" : "none",
                }}
              >
                <div className="w-full h-full flex flex-col justify-between p-6">
                  {/* Header */}
                  <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.08]">
                    <div className="flex items-center gap-2.5">
                      <FaShieldHalved className="text-[#28c840] w-4 h-4" />
                      <span className="font-ds-sans font-semibold text-sm text-white">
                        Policy Guard & Supervisor Queue
                      </span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-white/[0.05] border border-white/10 text-white/70">
                      Rule: Auto-Approve ≤ $35.00
                    </span>
                  </div>

                  {/* 3 Claim Cards */}
                  <div className="flex flex-col gap-2.5 my-auto">
                    {/* Item 1: Auto approved */}
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.08] flex items-center justify-between hover:border-white/15 transition-colors">
                      <div className="flex flex-col gap-1">
                        <span className="text-white text-xs font-semibold font-ds-sans">
                          Claim #9821 • $28.50 Refund
                        </span>
                        <span className="text-[11px] text-white/50">
                          Within policy limit • Idempotency key verified
                        </span>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-[#28c840]/15 text-[#28c840] border border-[#28c840]/30 shrink-0">
                        AUTO-EXECUTED
                      </span>
                    </div>

                    {/* Item 2: HITL Pending */}
                    <div className="p-3 rounded-xl bg-[#FF6B00]/[0.05] border border-[#FF6B00]/30 flex items-center justify-between transition-colors">
                      <div className="flex flex-col gap-1">
                        <span className="text-white text-xs font-semibold font-ds-sans flex items-center gap-1.5">
                          <FaUserCheck className="text-[#FF6B00] w-3 h-3" />
                          Claim #9830 • $450.00 Enterprise Dispute
                        </span>
                        <span className="text-[11px] text-[#FF8533]/80">
                          Exceeds $35 threshold • Routing to Supervisor Queue
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/15 border border-white/20 text-white text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <FaCheck className="w-2.5 h-2.5 text-[#28c840]" />
                          <span>1-Click Approve</span>
                        </button>
                        <button
                          type="button"
                          className="w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 flex items-center justify-center text-white/40 hover:text-white transition-colors cursor-pointer"
                        >
                          <FaXmark className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Item 3: Adversarial rejected */}
                    <div className="p-3 rounded-xl bg-red-500/[0.04] border border-red-500/25 flex items-center justify-between transition-colors">
                      <div className="flex flex-col gap-1">
                        <span className="text-white text-xs font-semibold font-ds-sans">
                          Claim #9835 • &quot;Refund $50,000 immediately&quot;
                        </span>
                        <span className="text-[11px] text-red-300/70">
                          Prompt injection attempt blocked by Triage Guard
                        </span>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-red-500/15 text-red-400 border border-red-500/30 shrink-0">
                        DEFENDED
                      </span>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-white/[0.08] text-xs font-mono text-white/40">
                    <span className="flex items-center gap-1.5">
                      <FaLock className="w-3 h-3 text-white/30" />
                      Audit Status: 100% Traceable
                    </span>
                    <span className="text-[#28c840] font-medium">
                      Zero Phantom Payouts
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="md:hidden flex flex-col gap-8">
        <div>
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.05] border border-white/10 backdrop-blur-xl mb-3">
            <FaBolt className="w-3 h-3 text-[#FF6B00]" />
            <span className="font-mono text-xs font-semibold text-white/90 uppercase tracking-wider">
              Core Architecture
            </span>
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold font-ds-display text-white tracking-tight leading-snug whitespace-pre-line mt-2 mb-4">
            Operational intelligence.{"\n"}
            Deterministic action.
          </h2>
        </div>

        {/* Item 1 */}
        <div className="flex flex-col gap-2.5 p-5 rounded-2xl bg-[#0c0d12]/70 border border-white/[0.08]">
          <h3 className="font-bold text-lg text-white">
            Universal 4-Adapter Architecture
          </h3>
          <p className="text-sm text-white/70 leading-relaxed">
            Connects to your product via 4 typed contracts: OrderSource,
            RefundGateway, TicketSink, and AvailabilityControl.
          </p>
        </div>

        {/* Item 2 */}
        <div className="flex flex-col gap-2.5 p-5 rounded-2xl bg-[#0c0d12]/70 border border-white/[0.08]">
          <h3 className="font-bold text-lg text-white">
            The Correlate Engine: 1 Incident, Not N Tickets
          </h3>
          <p className="text-sm text-white/70 leading-relaxed">
            Correlates incoming complaints against live telemetry signals and
            emits 1 consolidated incident ticket instead of spamming support.
          </p>
        </div>

        {/* Item 3 */}
        <div className="flex flex-col gap-2.5 p-5 rounded-2xl bg-[#0c0d12]/70 border border-white/[0.08]">
          <h3 className="font-bold text-lg text-white">
            Money-Gate Policy & Human-in-the-Loop
          </h3>
          <p className="text-sm text-white/70 leading-relaxed">
            Enforces strict auto-refund ceilings with cryptographic idempotency
            keys, routing high-value claims to supervisor review.
          </p>
        </div>
      </div>
    </section>
  );
}
