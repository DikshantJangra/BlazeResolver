"use client";

import React, { useState } from "react";
import { FaCopy, FaCheck, FaPuzzlePiece, FaCode, FaShieldHalved } from "react-icons/fa6";
import { LuWorkflow, LuCpu } from "react-icons/lu";

export default function CustomizationSection() {
  const [activeTab, setActiveTab] = useState<"adapter" | "policies" | "voice">("adapter");
  const [copied, setCopied] = useState(false);

  const snippets = {
    adapter: `import { createResolutionHarness } from "@blazeresolver/core";
import { orderBillingPlugin } from "./plugins/orderBilling";
import { postgresAdapter } from "./adapters/db";

// Instantiate harness with LangGraph kernel
export const harness = createResolutionHarness({
  triage: {
    model: "claude-3-5-sonnet-latest",
    categories: ["billing", "order_status", "refund", "escalation"],
    urgencyThreshold: 0.85,
  },
  plugins: [orderBillingPlugin],
  storage: postgresAdapter({ connectionString: process.env.DATABASE_URL }),
});

// Mount directly to Express or Next.js route
export async function POST(req: Request) {
  const { ticketId, query, channel } = await req.json();
  const resolution = await harness.resolve({ ticketId, query, channel });
  return Response.json(resolution);
}`,
    policies: `import { definePolicy } from "@blazeresolver/guardrails";

// Deterministic financial guardrail
export const refundPolicy = definePolicy({
  name: "max-refund-limit",
  validate: async ({ state, amount }) => {
    if (amount > 50.0) {
      return {
        allowed: false,
        action: "TRIGGER_HUMAN_ESCALATION",
        reason: "Refund exceeds automated threshold ($50.00)",
      };
    }
    return { allowed: true };
  },
});`,
    voice: `import { createVoiceHarness } from "@blazeresolver/voice";

// Real-time bidirectional WebRTC voice streaming
export const voiceStream = createVoiceHarness({
  vad: { aggressiveness: 3 },
  stt: "deepgram-nova-2",
  tts: "elevenlabs-multilingual",
  onUtterance: async (text, session) => {
    const nextTurn = await session.step(text);
    return nextTurn.audioStream;
  },
});`,
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(snippets[activeTab]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  return (
    <section id="plugins" className="relative py-24 border-t border-white/[0.06] bg-[#0d0e12]">
      <div className="mx-auto max-w-[1240px] px-4 sm:px-8">
        {/* Section Header */}
        <div className="flex flex-col items-center text-center gap-4 max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-medium uppercase tracking-wider text-white/90 bg-white/[0.08] border border-white/10">
            Developer Extensibility
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight font-ds-display">
            Drop-in Adapter Architecture
          </h2>

          <p className="text-base sm:text-lg text-neutral-400 leading-relaxed max-w-2xl">
            Integrate BlazeResolver into any existing backend in less than 20 lines of code.
            Configure policy guardrails, add custom database lookups, and connect voice pipelines with zero lock-in.
          </p>
        </div>

        {/* Code Showcase Container */}
        <div className="rounded-2xl border border-white/15 bg-[#12141a] shadow-2xl overflow-hidden">
          {/* Tabs Bar */}
          <div className="flex flex-wrap items-center justify-between border-b border-white/10 px-4 py-3 bg-[#15171f]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("adapter")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono font-medium transition-colors cursor-pointer ${
                  activeTab === "adapter"
                    ? "bg-[#FF6B00]/20 text-[#FF6B00] border border-[#FF6B00]/30"
                    : "text-neutral-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <FaCode className="text-xs" />
                <span>harness.ts</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("policies")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono font-medium transition-colors cursor-pointer ${
                  activeTab === "policies"
                    ? "bg-[#0055FF]/20 text-[#6ea1ff] border border-[#0055FF]/30"
                    : "text-neutral-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <FaShieldHalved className="text-xs" />
                <span>policies.ts</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("voice")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono font-medium transition-colors cursor-pointer ${
                  activeTab === "voice"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "text-neutral-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <FaPuzzlePiece className="text-xs" />
                <span>voiceAdapter.ts</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-mono text-neutral-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <FaCheck className="text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <FaCopy className="text-neutral-400" />
                  <span>Copy code</span>
                </>
              )}
            </button>
          </div>

          {/* Code Editor Body */}
          <div className="p-6 font-mono text-xs sm:text-sm leading-relaxed overflow-x-auto bg-[#0f1015]">
            <pre className="text-neutral-200">
              <code>{snippets[activeTab]}</code>
            </pre>
          </div>

          {/* Footer Highlights */}
          <div className="px-6 py-4 bg-[#14151b] border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-neutral-400">
            <span>Framework Support: Express • Next.js • Fastify • NestJS</span>
            <span className="text-[#FF6B00]">Typed LangGraph StateMachine</span>
          </div>
        </div>
      </div>
    </section>
  );
}
