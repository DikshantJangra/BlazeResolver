"use client";

import React from "react";
import {
  FaBrain,
  FaGears,
  FaFilter,
  FaNetworkWired,
  FaScaleBalanced,
  FaHeadset,
  FaArrowRight,
  FaCodeBranch,
  FaPlug,
  FaLock,
} from "react-icons/fa6";

export default function ArchitectureFlow() {
  const harnessStages = [
    {
      step: "STAGE 01",
      badge: "Zero-Trust",
      title: "Triage Harness",
      subtitle: "Intent & Security Boundary",
      description:
        "Defends against prompt injection and adversarial attacks. Classifies customer intent, urgency, and velocity while extracting structured entities (Order ID, SKU, User ID).",
      tag: "Inbound Shield",
      accentColor: "#FF6B00",
      icon: <FaFilter className="w-4 h-4" />,
    },
    {
      step: "STAGE 02",
      badge: "Telemetry Guard",
      title: "Correlate Harness",
      subtitle: "Operational Telemetry",
      description:
        "The differentiator. Ingests issues into a sliding buffer, correlates against live operational telemetry (APIs, logs, GPS), and emits 1 systemic incident instead of N duplicate tickets.",
      tag: "The Differentiator",
      accentColor: "#0055FF",
      icon: <FaNetworkWired className="w-4 h-4" />,
    },
    {
      step: "STAGE 03",
      badge: "Money-Safe",
      title: "Resolve Harness",
      subtitle: "Policy-Gated Mutations",
      description:
        "Enforces deterministic money-gate limits. Auto-resolves claims under policy threshold (≤ $35.00) and routes high-value disputes to the HITL supervisor approval queue.",
      tag: "Financial Gate",
      accentColor: "#28c840",
      icon: <FaScaleBalanced className="w-4 h-4" />,
    },
    {
      step: "STAGE 04",
      badge: "Real-Time",
      title: "Respond Harness",
      subtitle: "Voice & Omnichannel Delivery",
      description:
        "Performs quality review and empathetic tone adaptation. Delivers ultra-low latency real-time voice (Gemini Live/Twilio) and dispatches immutable audit trajectories to your CRM.",
      tag: "Omnichannel Loop",
      accentColor: "#FF8533",
      icon: <FaHeadset className="w-4 h-4" />,
    },
  ];

  return (
    <section
      id="architecture"
      className="relative z-10 ds-container py-24 sm:py-32 scroll-mt-20"
    >
      {/* Header with Agent = Model + Harness formula */}
      <div className="max-w-[880px] mx-auto flex flex-col items-center gap-6 text-center">
        {/* Formula Badge */}
        <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 border border-white/12 bg-white/[0.04] backdrop-blur-xl shadow-sm">
          <span className="flex items-center gap-1.5 font-mono text-xs font-semibold text-white/90">
            <FaBrain className="text-[#FF6B00] w-3 h-3" />
            Model (Intent)
          </span>
          <span className="text-white/30 font-mono text-xs">+</span>
          <span className="flex items-center gap-1.5 font-mono text-xs font-semibold text-white/90">
            <FaGears className="text-[#0055FF] w-3 h-3" />
            Harness (Execution)
          </span>
          <span className="text-white/30 font-mono text-xs">=</span>
          <span className="font-mono text-xs font-bold text-[#FF6B00] uppercase tracking-wider">
            Autonomous Resolution
          </span>
        </div>

        {/* Main Title */}
        <h2 className="text-3xl sm:text-5xl md:text-6xl font-bold font-ds-display text-white tracking-tight leading-[1.15]">
          <span className="font-bold text-white font-ds-display">
            Blaze<span className="text-[#FF6B00]">Resolver</span>{" "}
          </span>
          <span className="ds-font-harness text-ds-brand !text-[32px] sm:!text-[46px] md:!text-[56px] inline-block align-middle -translate-y-[0.06em]">
            Harness
          </span>
          <br />
          <span className="text-white/85 text-2xl sm:text-4xl md:text-5xl font-medium">
            closes customer support issues in real-world environments
          </span>
        </h2>

        {/* Contextual Description */}
        <div className="max-w-[760px] flex flex-col gap-3 text-ds-description">
          <p className="text-base sm:text-lg text-white/80 leading-relaxed font-normal">
            <strong className="text-white font-semibold">
              The model interprets customer language; the harness carries out
              safe operational action.
            </strong>{" "}
            Chatbots alone hallucinate database changes, offer empty apologies,
            and spam support desks with disconnected tickets.
          </p>
          <p className="text-sm sm:text-base text-white/60 leading-relaxed">
            The BlazeResolver Harness connects to your product&apos;s real
            operational telemetry, enforces hard financial spending boundaries,
            and resolves tickets with deterministic, idempotent tool execution.
          </p>
        </div>
      </div>

      {/* 4 Stage Cards Grid (Exact matching card style) */}
      <div className="mt-16 sm:mt-20">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-[#FF6B00] animate-pulse" />
            <span className="font-mono text-xs font-semibold text-white/90 uppercase tracking-widest">
              End-to-End Resolution Harness Flow
            </span>
          </div>
          <span className="font-mono text-xs text-white/40">
            LLM decides intent • Deterministic code executes mutations
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {harnessStages.map((stage, idx) => (
            <div
              key={idx}
              className="group rounded-2xl border border-white/[0.08] bg-[#0c0d12]/70 backdrop-blur-xl p-6 flex flex-col justify-between transition-all duration-300 hover:border-white/20 hover:bg-[#11131a] hover:-translate-y-1 shadow-lg"
            >
              <div>
                {/* Card Header with Step, Badge, and Icon */}
                <div className="flex items-center justify-between mb-4">
                  <span className="font-mono text-[11px] font-bold text-white/40 tracking-wider">
                    {stage.step}
                  </span>
                  <span
                    className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium border"
                    style={{
                      backgroundColor: `${stage.accentColor}15`,
                      borderColor: `${stage.accentColor}30`,
                      color: stage.accentColor,
                    }}
                  >
                    {stage.badge}
                  </span>
                </div>

                <div className="flex items-center gap-3 mb-3.5">
                  <div
                    className="p-2.5 rounded-xl border flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: `${stage.accentColor}15`,
                      borderColor: `${stage.accentColor}30`,
                      color: stage.accentColor,
                    }}
                  >
                    {stage.icon}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white tracking-tight">
                      {stage.title}
                    </h3>
                    <span className="font-mono text-[11px] text-white/40 block">
                      {stage.subtitle}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-white/65 leading-relaxed mt-2">
                  {stage.description}
                </p>
              </div>

              <div
                className="mt-5 pt-3.5 border-t border-white/[0.06] font-mono text-[11px] font-medium flex items-center justify-between"
                style={{ color: stage.accentColor }}
              >
                <span>{stage.tag}</span>
                {idx < 3 && (
                  <FaArrowRight className="hidden lg:block text-white/20 group-hover:text-white/60 transition-colors" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3 Foundational Pillars of the Harness (Exact matching card style) */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Pillar 1 */}
        <div className="group rounded-2xl border border-white/[0.08] bg-[#0c0d12]/70 backdrop-blur-xl p-6 flex flex-col justify-between transition-all duration-300 hover:border-white/20 hover:bg-[#11131a] hover:-translate-y-1 shadow-lg">
          <div>
            <div className="flex items-center gap-3 mb-3.5">
              <div className="p-2.5 rounded-xl bg-[#FF6B00]/10 border border-[#FF6B00]/25 text-[#FF6B00]">
                <FaCodeBranch className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-white tracking-tight">
                LangGraph State Engine
              </h3>
            </div>
            <p className="text-xs text-white/65 leading-relaxed">
              Deterministic graph execution kernel. Coordinates multi-step
              triage, correlation, tool planning, and verification passes with
              durable state checkpointing and automatic recovery.
            </p>
          </div>
          <div className="mt-5 pt-3.5 border-t border-white/[0.06] font-mono text-[11px] text-[#FF6B00] font-medium">
            Graph Node Orchestration
          </div>
        </div>

        {/* Pillar 2 */}
        <div className="group rounded-2xl border border-white/[0.08] bg-[#0c0d12]/70 backdrop-blur-xl p-6 flex flex-col justify-between transition-all duration-300 hover:border-white/20 hover:bg-[#11131a] hover:-translate-y-1 shadow-lg">
          <div>
            <div className="flex items-center gap-3 mb-3.5">
              <div className="p-2.5 rounded-xl bg-[#0055FF]/10 border border-[#0055FF]/25 text-[#0055FF]">
                <FaPlug className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-white tracking-tight">
                The 4-Adapter Contracts
              </h3>
            </div>
            <p className="text-xs text-white/65 leading-relaxed">
              Business-agnostic core contracts for{" "}
              <code className="text-white/90 bg-white/[0.06] px-1 py-0.5 rounded font-mono text-[11px]">
                OrderSource
              </code>
              ,{" "}
              <code className="text-white/90 bg-white/[0.06] px-1 py-0.5 rounded font-mono text-[11px]">
                RefundGateway
              </code>
              ,{" "}
              <code className="text-white/90 bg-white/[0.06] px-1 py-0.5 rounded font-mono text-[11px]">
                TicketSink
              </code>
              , and{" "}
              <code className="text-white/90 bg-white/[0.06] px-1 py-0.5 rounded font-mono text-[11px]">
                AvailabilityControl
              </code>
              . Drop into SaaS, E-Commerce, or On-Demand Apps.
            </p>
          </div>
          <div className="mt-5 pt-3.5 border-t border-white/[0.06] font-mono text-[11px] text-[#0055FF] font-medium">
            Universal Domain Interfaces
          </div>
        </div>

        {/* Pillar 3 */}
        <div className="group rounded-2xl border border-white/[0.08] bg-[#0c0d12]/70 backdrop-blur-xl p-6 flex flex-col justify-between transition-all duration-300 hover:border-white/20 hover:bg-[#11131a] hover:-translate-y-1 shadow-lg">
          <div>
            <div className="flex items-center gap-3 mb-3.5">
              <div className="p-2.5 rounded-xl bg-[#28c840]/10 border border-[#28c840]/25 text-[#28c840]">
                <FaLock className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Money-Gate & Guardrails
              </h3>
            </div>
            <p className="text-xs text-white/65 leading-relaxed">
              Deterministic financial limits enforce strict auto-refund
              ceilings. High-value claims route directly to human supervisor
              queues with one-click review and complete audit trails.
            </p>
          </div>
          <div className="mt-5 pt-3.5 border-t border-white/[0.06] font-mono text-[11px] text-[#28c840] font-medium">
            Audited Idempotent Execution
          </div>
        </div>
      </div>
    </section>
  );
}
