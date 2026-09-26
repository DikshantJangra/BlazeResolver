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
  FaArrowsRotate,
  FaTriangleExclamation,
} from "react-icons/fa6";

export default function StickyShowcase() {
  const [activeSlide, setActiveSlide] = useState(0);
  const [approvedDispute, setApprovedDispute] = useState(false);
  const [rejectedDispute, setRejectedDispute] = useState(false);

  const slides = [
    {
      id: 0,
      badge: "Architecture",
      title: "Universal 4-Adapter Architecture",
      icon: <FaPlug className="w-4 h-4" />,
      accent: "#FF6B00",
      description:
        "BlazeResolver is completely business-agnostic. It connects to your product via four typed contracts: OrderSource (telemetry), RefundGateway (idempotent payouts), TicketSink (consolidated CRM tickets), and AvailabilityControl (feature/SKU 86ing).",
    },
    {
      id: 1,
      badge: "Correlate Engine",
      title: "The Correlate Engine: 1 Incident, Not N Tickets",
      icon: <FaRoute className="w-4 h-4" />,
      accent: "#0055FF",
      description:
        "When an operational bottleneck strikes, standard chatbots generate dozens of duplicate support tickets. BlazeResolver buffers inquiries, correlates live telemetry signals, and emits ONE root-cause incident while automatically resolving each affected customer.",
    },
    {
      id: 2,
      badge: "Policy Guard",
      title: "Money-Gate Policy & Human-in-the-Loop",
      icon: <FaShieldHalved className="w-4 h-4" />,
      accent: "#28c840",
      description:
        "LLMs should never execute unconstrained financial actions. BlazeResolver enforces hard spending limits: claims under policy limits (e.g. ≤ $35.00) auto-execute instantly with idempotency keys, while high-value claims route to the Supervisor HITL queue.",
    },
  ];

  return (
    <section id="features" className="relative z-10 ds-container py-20 sm:py-28">
      {/* Section Header */}
      <div className="mb-12 max-w-[760px]">
        <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.05] border border-white/10 backdrop-blur-xl mb-4">
          <FaBolt className="w-3 h-3 text-[#FF6B00]" />
          <span className="font-mono text-xs font-semibold text-white/90 uppercase tracking-wider">
            Core Architecture & Capabilities
          </span>
        </span>
        <h2 className="text-3xl sm:text-5xl font-bold font-ds-display text-white tracking-tight leading-[1.15]">
          Operational intelligence.{"\n"}
          Deterministic action.
        </h2>
        <p className="mt-4 text-base sm:text-lg text-white/70 leading-relaxed">
          Explore how BlazeResolver isolates intent classification from
          deterministic operational execution.
        </p>
      </div>

      {/* Desktop & Tablet Interactive Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Interactive Selector Cards */}
        <div className="lg:col-span-5 flex flex-col gap-3.5">
          {slides.map((slide) => {
            const isActive = activeSlide === slide.id;
            return (
              <div
                key={slide.id}
                onClick={() => setActiveSlide(slide.id)}
                className={`p-6 rounded-2xl border transition-all duration-300 cursor-pointer ${
                  isActive
                    ? "bg-[#10121a] border-white/20 shadow-xl"
                    : "bg-[#0c0d12]/40 border-white/[0.06] hover:bg-[#0c0d12]/80 hover:border-white/12 opacity-60 hover:opacity-90"
                }`}
              >
                <div className="flex items-center justify-between gap-3 mb-2.5">
                  <div className="flex items-center gap-3">
                    <div
                      className="p-2 rounded-xl transition-colors"
                      style={{
                        backgroundColor: isActive
                          ? `${slide.accent}20`
                          : "rgba(255,255,255,0.05)",
                        color: isActive ? slide.accent : "rgba(255,255,255,0.6)",
                        border: `1px solid ${
                          isActive
                            ? `${slide.accent}40`
                            : "rgba(255,255,255,0.08)"
                        }`,
                      }}
                    >
                      {slide.icon}
                    </div>
                    <span
                      className="font-mono text-xs font-semibold uppercase tracking-wider"
                      style={{
                        color: isActive ? slide.accent : "rgba(255,255,255,0.5)",
                      }}
                    >
                      {slide.badge}
                    </span>
                  </div>

                  {isActive && (
                    <span className="w-2 h-2 rounded-full bg-[#28c840] animate-pulse" />
                  )}
                </div>

                <h3 className="font-ds-sans font-bold text-lg sm:text-xl text-white tracking-tight mb-2">
                  {slide.title}
                </h3>
                <p className="text-xs sm:text-sm text-white/65 leading-relaxed font-normal">
                  {slide.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Right Column: Active Preview Frame (Rendered cleanly without overlap) */}
        <div className="lg:col-span-7 sticky top-24">
          {/* Top Tab Bar for direct quick switching */}
          <div className="flex items-center gap-2 mb-3 bg-white/[0.03] border border-white/[0.08] p-1 rounded-xl">
            {slides.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveSlide(s.id)}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-mono font-medium transition-all text-center cursor-pointer ${
                  activeSlide === s.id
                    ? "bg-white/10 text-white border border-white/15 font-semibold"
                    : "text-white/50 hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                {s.badge}
              </button>
            ))}
          </div>

          <div className="w-full bg-[#0c0d14] border border-white/[0.12] rounded-2xl overflow-hidden shadow-2xl p-6 min-h-[440px] flex flex-col justify-between">
            {/* Slide 0: Universal 4-Adapter Architecture */}
            {activeSlide === 0 && (
              <div className="w-full flex flex-col justify-between h-full gap-6">
                {/* Header */}
                <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.08]">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#28c840] animate-pulse" />
                    <span className="font-ds-sans font-semibold text-sm sm:text-base text-white">
                      4-Adapter Interface Hub
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-white/[0.05] border border-white/10 text-white/70">
                    4 active contracts bound
                  </span>
                </div>

                {/* 4 Adapter Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.08] flex flex-col gap-1.5 hover:border-white/20 transition-all">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-white flex items-center gap-2">
                        <FaDatabase className="text-[#FF6B00] w-3.5 h-3.5" />
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

                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.08] flex flex-col gap-1.5 hover:border-white/20 transition-all">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-white flex items-center gap-2">
                        <FaCreditCard className="text-[#0055FF] w-3.5 h-3.5" />
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

                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.08] flex flex-col gap-1.5 hover:border-white/20 transition-all">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-white flex items-center gap-2">
                        <FaTicket className="text-[#FF6B00] w-3.5 h-3.5" />
                        TicketSink
                      </span>
                      <FaCircleCheck className="text-[#28c840] w-3 h-3" />
                    </div>
                    <span className="text-[11px] text-white/60">
                      Consolidated root-cause CRM tickets
                    </span>
                    <span className="text-[10px] text-white/50 font-mono mt-0.5">
                      Linear / Zendesk / CRM • Clustered
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.08] flex flex-col gap-1.5 hover:border-white/20 transition-all">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-white flex items-center gap-2">
                        <FaToggleOn className="text-[#0055FF] w-3.5 h-3.5" />
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
                  <span className="flex items-center gap-1.5">
                    <FaArrowsRotate className="w-3 h-3 text-[#FF6B00] animate-spin" />
                    Engine: LangGraph Kernel
                  </span>
                  <span className="text-[#28c840] font-medium">
                    All adapters operational
                  </span>
                </div>
              </div>
            )}

            {/* Slide 1: The Correlate Engine */}
            {activeSlide === 1 && (
              <div className="w-full flex flex-col justify-between h-full gap-5">
                {/* Header */}
                <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.08]">
                  <div className="flex items-center gap-2.5">
                    <FaClock className="text-[#FF6B00] w-3.5 h-3.5" />
                    <span className="font-ds-sans font-semibold text-sm sm:text-base text-white">
                      Trajectory Stream #BZ-8491
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-[#28c840]/15 text-[#28c840] border border-[#28c840]/30">
                    SYSTEMIC RESOLVED
                  </span>
                </div>

                {/* Trajectory event list */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-start gap-2.5 text-xs p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                    <span className="text-white/40 font-mono text-[11px] shrink-0 mt-0.5">
                      00:01.2
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#0055FF]/15 text-[#8da4ff] shrink-0">
                      INBOUND
                    </span>
                    <span className="text-white/85 text-xs leading-relaxed">
                      Order #9821: &quot;Fulfillment delayed 45m, items arrived
                      defective&quot;
                    </span>
                  </div>

                  <div className="flex items-start gap-2.5 text-xs p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
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

                  <div className="flex items-start gap-2.5 text-xs p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
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

                  <div className="flex items-start gap-2.5 text-xs p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
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

                  <div className="flex items-start gap-2.5 text-xs p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
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
            )}

            {/* Slide 2: Money-Gate Policy & Supervisor HITL */}
            {activeSlide === 2 && (
              <div className="w-full flex flex-col justify-between h-full gap-5">
                {/* Header */}
                <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.08]">
                  <div className="flex items-center gap-2.5">
                    <FaShieldHalved className="text-[#28c840] w-4 h-4" />
                    <span className="font-ds-sans font-semibold text-sm sm:text-base text-white">
                      Policy Guard & Supervisor Queue
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-white/[0.05] border border-white/10 text-white/70">
                    Rule: Auto-Approve ≤ $35.00
                  </span>
                </div>

                {/* Claims list */}
                <div className="flex flex-col gap-2.5">
                  {/* Item 1: Auto approved */}
                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.08] flex items-center justify-between">
                    <div className="flex flex-col gap-0.5">
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
                  <div
                    className={`p-3.5 rounded-xl border transition-all ${
                      approvedDispute
                        ? "bg-[#28c840]/[0.06] border-[#28c840]/30"
                        : rejectedDispute
                        ? "bg-red-500/[0.06] border-red-500/30"
                        : "bg-[#FF6B00]/[0.05] border-[#FF6B00]/30"
                    } flex flex-col sm:flex-row sm:items-center justify-between gap-3`}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-white text-xs font-semibold font-ds-sans flex items-center gap-1.5">
                        <FaUserCheck className="text-[#FF6B00] w-3 h-3" />
                        Claim #9830 • $450.00 Enterprise Dispute
                      </span>
                      <span className="text-[11px] text-[#FF8533]/80">
                        {approvedDispute
                          ? "Approved by Supervisor • Stripe transfer initiated"
                          : rejectedDispute
                          ? "Dispute rejected by Supervisor"
                          : "Exceeds $35 threshold • Routing to Supervisor Queue"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {approvedDispute ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-[#28c840]/15 text-[#28c840] border border-[#28c840]/30">
                          APPROVED
                        </span>
                      ) : rejectedDispute ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-red-500/15 text-red-400 border border-red-500/30">
                          REJECTED
                        </span>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setApprovedDispute(true);
                              setRejectedDispute(false);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <FaCheck className="w-2.5 h-2.5 text-[#28c840]" />
                            <span>1-Click Approve</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRejectedDispute(true);
                              setApprovedDispute(false);
                            }}
                            aria-label="Reject dispute"
                            className="w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 flex items-center justify-center text-white/40 hover:text-white transition-colors cursor-pointer"
                          >
                            <FaXmark className="w-3 h-3" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Item 3: Adversarial rejected */}
                  <div className="p-3.5 rounded-xl bg-red-500/[0.04] border border-red-500/25 flex items-center justify-between">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-white text-xs font-semibold font-ds-sans flex items-center gap-1.5">
                        <FaTriangleExclamation className="text-red-400 w-3 h-3" />
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
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
