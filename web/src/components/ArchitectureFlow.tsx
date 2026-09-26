"use client";

import React from "react";
import {
  FaBrain,
  FaGears,
  FaShieldHalved,
  FaFilter,
  FaNetworkWired,
  FaScaleBalanced,
  FaHeadset,
  FaArrowRight,
  FaCircleCheck,
  FaCodeBranch,
  FaPlug,
  FaLock,
} from "react-icons/fa6";

export default function ArchitectureFlow() {
  const harnessStages = [
    {
      step: "01",
      title: "Triage Harness",
      subtitle: "Intent & Security Boundary",
      icon: <FaFilter className="text-[#FF6B00] w-4 h-4" />,
      tag: "Inbound Shield",
      details: [
        "Prompt injection & jailbreak defense",
        "Entity extraction (Order, Item, Branch)",
        "Urgency & sentiment scoring",
      ],
      badge: "Zero-Trust",
    },
    {
      step: "02",
      title: "Correlate Harness",
      subtitle: "Operational Telemetry",
      icon: <FaNetworkWired className="text-[#0055FF] w-4 h-4" />,
      tag: "The Differentiator",
      details: [
        "Live KDS kitchen timing verification",
        "Sliding 24h buffer incident clustering",
        "Emits 1 systemic ticket instead of N tickets",
      ],
      badge: "Telemetry Guard",
    },
    {
      step: "03",
      title: "Resolve Harness",
      subtitle: "Policy-Gated Mutations",
      icon: <FaScaleBalanced className="text-[#28c840] w-4 h-4" />,
      tag: "Financial Gate",
      details: [
        "Auto-refund threshold (≤ $35 / ₹300)",
        "HITL supervisor queue for high-value claims",
        "100% idempotent tool call execution",
      ],
      badge: "Money-Safe",
    },
    {
      step: "04",
      title: "Respond Harness",
      subtitle: "Voice & Chat Delivery",
      icon: <FaHeadset className="text-[#FF6B00] w-4 h-4" />,
      tag: "Omnichannel Loop",
      details: [
        "Empathetic contextual response pass",
        "Ultra-low latency audio streaming",
        "Audit trail & receipt dispatch to CRM",
      ],
      badge: "Real-Time",
    },
  ];

  return (
    <section
      id="architecture"
      className="ds-container pt-ds-9 pb-ds-11 scroll-mt-24"
    >
      {/* Header with Agent = Model + Harness formula */}
      <div className="max-w-[860px] mx-auto flex flex-col items-center gap-ds-5 text-center">
        {/* Formula Badge */}
        <div
          className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 border border-white/15 bg-white/[0.04] backdrop-blur-md"
          style={{
            boxShadow: "0 0 24px rgba(255, 107, 0, 0.08)",
          }}
        >
          <span className="flex items-center gap-1.5 font-mono text-xs font-semibold text-white/90">
            <FaBrain className="text-[#FF6B00] w-3 h-3" />
            Model (Intent)
          </span>
          <span className="text-white/40 font-mono text-xs">+</span>
          <span className="flex items-center gap-1.5 font-mono text-xs font-semibold text-white/90">
            <FaGears className="text-[#0055FF] w-3 h-3" />
            Harness (Execution)
          </span>
          <span className="text-white/40 font-mono text-xs">=</span>
          <span className="font-mono text-xs font-bold text-[#FF6B00] uppercase tracking-wider">
            Autonomous Resolution
          </span>
        </div>

        {/* Main Title */}
        <h2 className="ds-text-heading1 text-ds-primary tracking-tight">
          <span className="font-bold text-white font-ds-display">
            Blaze<span className="text-[#FF6B00]">Resolver</span>{" "}
          </span>
          <span className="ds-font-harness text-ds-brand !text-[34px] md:!text-[50px] inline-block align-middle -translate-y-[0.08em]">
            Harness
          </span>
          <br />
          keeps agents working in real-world environments
        </h2>

        {/* Contextual Description */}
        <div className="max-w-[740px] flex flex-col gap-2.5 text-ds-description">
          <p className="ds-text-body leading-[1.75]">
            <strong className="text-white">
              The model is the brain; the harness is the operational body.
            </strong>{" "}
            Foundation models excel at interpreting customer speech, but alone
            they hallucinate database writes and offer empty apologies.
          </p>
          <p className="ds-text-body text-white/70 leading-[1.75]">
            The BlazeResolver Harness connects the model to real operational
            data, enforces hard financial boundaries, and closes customer
            tickets with deterministic, auditable tool execution.
          </p>
        </div>
      </div>

      {/* Harness Architecture Pipeline Grid */}
      <div className="mt-ds-9">
        <div className="mb-ds-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#FF6B00] animate-pulse" />
            <span className="font-mono text-xs font-semibold text-white/80 uppercase tracking-wider">
              End-to-End Resolution Harness Flow
            </span>
          </div>
          <span className="font-mono text-[11px] text-white/50 hidden sm:inline-block">
            LLM decides intent • Deterministic code executes mutations
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-ds-4">
          {harnessStages.map((stage, idx) => (
            <div
              key={idx}
              className="relative group rounded-xl border border-white/10 bg-[#0d1017] p-5 flex flex-col justify-between transition-all duration-300 hover:border-white/20 hover:bg-[#121620]"
            >
              <div>
                {/* Header with step number and badge */}
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-xs font-bold text-white/40">
                    STAGE {stage.step}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-white/[0.06] text-white/70 border border-white/10">
                    {stage.badge}
                  </span>
                </div>

                {/* Title & Icon */}
                <div className="flex items-center gap-2.5 mb-1.5">
                  <div className="p-2 rounded-lg bg-white/[0.04] border border-white/10 shrink-0">
                    {stage.icon}
                  </div>
                  <h3 className="font-ds-sans font-bold text-base text-white">
                    {stage.title}
                  </h3>
                </div>
                <p className="font-mono text-[11px] text-[#FF6B00] mb-3">
                  {stage.subtitle}
                </p>

                {/* Details list */}
                <ul className="flex flex-col gap-2 pt-2 border-t border-white/[0.06]">
                  {stage.details.map((detail, dIdx) => (
                    <li
                      key={dIdx}
                      className="flex items-start gap-2 text-xs text-white/70 leading-relaxed font-sans"
                    >
                      <FaCircleCheck className="text-white/30 w-3 h-3 mt-0.5 shrink-0 group-hover:text-[#28c840] transition-colors" />
                      <span>{detail}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Tag at bottom */}
              <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px] font-mono text-white/50">
                <span>{stage.tag}</span>
                {idx < 3 && (
                  <FaArrowRight className="hidden lg:block text-white/20 group-hover:text-[#FF6B00] transition-colors" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3 Foundational Pillars of the Harness */}
      <div className="mt-ds-7 grid grid-cols-1 md:grid-cols-3 gap-ds-5">
        {/* Pillar 1 */}
        <div className="rounded-[12px] h-full relative group">
          <div className="bg-ds-surface-3 border border-ds-border-default rounded-ds-media p-ds-6 flex flex-col h-full transition-all duration-300 group-hover:border-white/20 group-hover:bg-ds-surface-2">
            <div className="flex items-center gap-3 mb-ds-3">
              <div className="p-2.5 rounded-lg bg-[#FF6B00]/10 border border-[#FF6B00]/25 text-[#FF6B00]">
                <FaCodeBranch className="w-5 h-5" />
              </div>
              <h3 className="ds-text-title text-ds-primary font-bold">
                LangGraph State Machine
              </h3>
            </div>
            <p className="ds-text-caption text-ds-description leading-[1.65] mb-3">
              Deterministic graph execution kernel. Coordinates multi-step
              triage, correlation, tool planning, and verification passes with
              durable state checkpointing and automatic recovery.
            </p>
            <div className="mt-auto pt-3 border-t border-white/[0.06] font-mono text-[11px] text-[#FF6B00]">
              Graph Node Orchestration
            </div>
          </div>
        </div>

        {/* Pillar 2 */}
        <div className="rounded-[12px] h-full relative group">
          <div className="bg-ds-surface-3 border border-ds-border-default rounded-ds-media p-ds-6 flex flex-col h-full transition-all duration-300 group-hover:border-white/20 group-hover:bg-ds-surface-2">
            <div className="flex items-center gap-3 mb-ds-3">
              <div className="p-2.5 rounded-lg bg-[#0055FF]/10 border border-[#0055FF]/25 text-[#0055FF]">
                <FaPlug className="w-5 h-5" />
              </div>
              <h3 className="ds-text-title text-ds-primary font-bold">
                The 4-Adapter Contracts
              </h3>
            </div>
            <p className="ds-text-caption text-ds-description leading-[1.65] mb-3">
              Business-agnostic core contracts for{" "}
              <code className="text-white/90 bg-white/[0.06] px-1 py-0.5 rounded">
                OrderSource
              </code>
              ,{" "}
              <code className="text-white/90 bg-white/[0.06] px-1 py-0.5 rounded">
                RefundGateway
              </code>
              ,{" "}
              <code className="text-white/90 bg-white/[0.06] px-1 py-0.5 rounded">
                TicketSink
              </code>
              , and{" "}
              <code className="text-white/90 bg-white/[0.06] px-1 py-0.5 rounded">
                MenuControl
              </code>
              . Swap implementations without touching core engine logic.
            </p>
            <div className="mt-auto pt-3 border-t border-white/[0.06] font-mono text-[11px] text-[#0055FF]">
              Pluggable Domain Interfaces
            </div>
          </div>
        </div>

        {/* Pillar 3 */}
        <div className="rounded-[12px] h-full relative group">
          <div className="bg-ds-surface-3 border border-ds-border-default rounded-ds-media p-ds-6 flex flex-col h-full transition-all duration-300 group-hover:border-white/20 group-hover:bg-ds-surface-2">
            <div className="flex items-center gap-3 mb-ds-3">
              <div className="p-2.5 rounded-lg bg-[#28c840]/10 border border-[#28c840]/25 text-[#28c840]">
                <FaLock className="w-5 h-5" />
              </div>
              <h3 className="ds-text-title text-ds-primary font-bold">
                Money-Gate & Guardrails
              </h3>
            </div>
            <p className="ds-text-caption text-ds-description leading-[1.65] mb-3">
              Deterministic financial limits enforce strict auto-refund
              ceilings. Claims exceeding thresholds route directly to human
              supervisor queues with one-click review and complete audit trails.
            </p>
            <div className="mt-auto pt-3 border-t border-white/[0.06] font-mono text-[11px] text-[#28c840]">
              Audited Idempotent Execution
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
