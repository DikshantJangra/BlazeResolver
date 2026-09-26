"use client";

import React from "react";
import { FaShieldHalved, FaArrowRight } from "react-icons/fa6";
import { LuWorkflow, LuCpu, LuLayers, LuSparkles } from "react-icons/lu";

export default function ArchitectureFlow() {
  const nodes = [
    {
      badge: "Stage 01 • Triage",
      title: "Intelligent Triage & Intent",
      description:
        "The LangGraph kernel ingests customer voice streams or text tickets. Intent categorization, urgency scoring, and sentiment analysis determine the optimal execution path without human intervention.",
      icon: (
        <svg aria-hidden="true" width="64" height="64" viewBox="0 0 72 72" fill="none" className="text-[#FF6B00]">
          <circle cx="36" cy="36" r="4" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="36" cy="36" r="1.5" fill="currentColor" />
          <ellipse cx="36" cy="36" rx="25" ry="11" stroke="currentColor" strokeWidth="1" opacity="0.7" transform="rotate(90 36 36)" />
          <ellipse cx="36" cy="36" rx="25" ry="11" stroke="currentColor" strokeWidth="1" opacity="0.7" transform="rotate(30 36 36)" />
          <ellipse cx="36" cy="36" rx="25" ry="11" stroke="currentColor" strokeWidth="1" opacity="0.7" transform="rotate(150 36 36)" />
        </svg>
      ),
      tag: "triage.ts",
    },
    {
      badge: "Stage 02 • Correlate",
      title: "Capabilities as Plugins",
      description:
        "Plugins query internal order databases, correlate Stripe payment receipts, fetch live delivery driver telemetry, and cross-reference inventory logs to establish undeniable ground truth.",
      icon: (
        <svg aria-hidden="true" width="64" height="64" viewBox="0 0 72 72" fill="none" className="text-[#0055FF]">
          <defs>
            <mask id="plugin-ring-mask">
              <rect width="72" height="72" fill="white" />
              <circle cx="36" cy="10" r="4.4" fill="black" />
              <circle cx="58.5" cy="23" r="4.4" fill="black" />
              <circle cx="58.5" cy="49" r="4.4" fill="black" />
              <circle cx="36" cy="62" r="4.4" fill="black" />
              <circle cx="13.5" cy="49" r="4.4" fill="black" />
              <circle cx="13.5" cy="23" r="4.4" fill="black" />
            </mask>
          </defs>
          <circle cx="36" cy="36" r="17" stroke="currentColor" strokeWidth="0.9" strokeDasharray="2 2.5" opacity="0.5" />
          <circle cx="36" cy="36" r="26" stroke="currentColor" strokeWidth="0.9" opacity="0.7" mask="url(#plugin-ring-mask)" />
          <circle cx="36" cy="36" r="4.5" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="36" cy="10" r="2.6" fill="currentColor" />
          <circle cx="58.5" cy="23" r="2.6" fill="currentColor" />
          <circle cx="58.5" cy="49" r="2.6" fill="currentColor" />
          <circle cx="36" cy="62" r="2.6" fill="currentColor" />
          <circle cx="13.5" cy="49" r="2.6" fill="currentColor" />
          <circle cx="13.5" cy="23" r="2.6" fill="currentColor" />
        </svg>
      ),
      tag: "orderBilling.ts",
    },
    {
      badge: "Stage 03 • Resolve",
      title: "Compose with Policy Guardrails",
      description:
        "Execute audited actions: issue refunds under $50, generate replacement orders, trigger restaurant notifications, or escalate to tier-2 human reps with a structured context brief.",
      icon: (
        <svg aria-hidden="true" width="64" height="64" viewBox="0 0 72 72" fill="none" className="text-emerald-400">
          <rect x="18" y="22" width="15" height="15" rx="3" stroke="currentColor" strokeWidth="1.1" opacity="0.85" />
          <rect x="18" y="41" width="15" height="15" rx="3" stroke="currentColor" strokeWidth="1.1" opacity="0.85" />
          <rect x="37" y="41" width="15" height="15" rx="3" stroke="currentColor" strokeWidth="1.1" opacity="0.85" />
          <rect x="37" y="22" width="15" height="15" rx="3" stroke="currentColor" strokeWidth="0.9" strokeDasharray="2.5 2.5" opacity="0.45" />
          <rect x="47" y="12" width="15" height="15" rx="3" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="54.5" cy="19.5" r="1.4" fill="currentColor" />
        </svg>
      ),
      tag: "policies.ts",
    },
  ];

  return (
    <section id="architecture" className="relative py-24 border-t border-white/[0.06]">
      <div className="mx-auto max-w-[1240px] px-4 sm:px-8">
        {/* Section Header */}
        <div className="flex flex-col items-center text-center gap-4 max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-medium uppercase tracking-wider text-white/90 bg-white/[0.08] border border-white/10">
            Agent = Model + Harness
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight font-ds-display">
            <span className="font-mono text-[#FF6B00] uppercase text-2xl sm:text-3xl block mb-1">
              Harness
            </span>
            keeps agents working in real-world environments
          </h2>

          <p className="text-base sm:text-lg text-neutral-400 leading-relaxed max-w-2xl">
            The model is the cognitive reasoning engine. The BlazeResolver harness provides the environment:
            schema enforcement, transactional tool calling, and guardrails to resolve customer inquiries safely.
          </p>
        </div>

        {/* 3 Connected Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {nodes.map((node, index) => (
            <div
              key={index}
              className="relative group flex flex-col justify-between p-8 rounded-2xl bg-[#14151a]/60 hover:bg-[#181a20]/80 border border-white/[0.08] hover:border-white/20 transition-all duration-300"
            >
              <div>
                {/* Icon & Badge */}
                <div className="flex items-center justify-between mb-8">
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 group-hover:scale-105 transition-transform">
                    {node.icon}
                  </div>
                  <span className="font-mono text-xs text-neutral-400 bg-black/40 px-2.5 py-1 rounded-md border border-white/5">
                    {node.tag}
                  </span>
                </div>

                <div className="text-xs font-mono font-medium text-[#FF6B00] mb-2">
                  {node.badge}
                </div>

                <h3 className="text-xl font-bold text-white mb-3 font-ds-display group-hover:text-white transition-colors">
                  {node.title}
                </h3>

                <p className="text-sm text-neutral-400 leading-relaxed">
                  {node.description}
                </p>
              </div>

              <div className="pt-6 mt-6 border-t border-white/5 flex items-center justify-between text-xs text-neutral-400">
                <span>LangGraph Kernel</span>
                <span className="text-[#FF6B00] group-hover:translate-x-1 transition-transform">
                  &rarr;
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
