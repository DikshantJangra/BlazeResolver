"use client";

import React, { useState } from "react";
import { FaGithub, FaCopy, FaCheck, FaBook, FaCode, FaArrowRight, FaTerminal } from "react-icons/fa6";
import { LuSparkles, LuLayers } from "react-icons/lu";

export default function HeroSection() {
  const [activeTab, setActiveTab] = useState<"quickstart" | "source" | "docker">("quickstart");
  const [copied, setCopied] = useState(false);

  const commands = {
    quickstart: "npx blazeresolver demo --restaurant",
    source: "git clone https://github.com/DikshantJangra/BlazeResolver.git\ncd BlazeResolver && npm install",
    docker: "docker run -p 3000:3000 -e PORT=3000 blazeresolver/harness:latest",
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(commands[activeTab]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text", err);
    }
  };

  return (
    <section className="relative min-h-[90vh] flex items-center pt-28 pb-16 overflow-hidden">
      {/* Background radial gradient glow */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-[#FF6B00]/10 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 right-1/4 w-[400px] h-[300px] bg-[#0055FF]/8 rounded-full blur-[140px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-[1240px] px-4 sm:px-8 w-full grid grid-cols-1 lg:grid-cols-[58fr_42fr] gap-12 items-center">
        {/* Left Column: Headline & Value Prop */}
        <div className="flex flex-col gap-6 items-start">
          {/* Pill Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium text-neutral-200 bg-white/[0.06] border border-white/10 backdrop-blur-md shadow-sm">
            <span className="w-2 h-2 rounded-full bg-[#FF6B00] animate-pulse" />
            <span>BlazeResolver Developer Preview</span>
            <span className="text-neutral-500">•</span>
            <span className="text-neutral-400">Open Source</span>
          </div>

          {/* Main Title */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.15] font-ds-display">
            Everything is a plugin.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF6B00] via-[#FF8C33] to-[#FFB066]">
              Autonomous Support
            </span>{" "}
            Harness.
          </h1>

          {/* Description */}
          <div className="flex flex-col gap-3 text-base sm:text-lg text-neutral-400 max-w-[600px] leading-relaxed">
            <p>
              BlazeResolver is an open-source resolution harness for AI customer service agents.
              Triage tickets, correlate transactional logs & databases, and execute policy-bounded order actions end-to-end.
            </p>
            <p className="text-sm sm:text-base text-neutral-400">
              Every capability is an extensible plugin: intent triage, state routing, refund guardrails, voice synthesis, and CRM adapters.
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2 w-full sm:w-auto">
            <a
              href="https://github.com/DikshantJangra/BlazeResolver"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2.5 px-6 py-3 rounded-full text-sm font-semibold text-black bg-white hover:bg-neutral-200 transition-all hover:scale-102 shadow-none"
            >
              <FaGithub className="text-base" />
              <span>View on GitHub</span>
            </a>
            <a
              href="https://github.com/DikshantJangra/BlazeResolver#readme"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-full text-sm font-medium text-white bg-white/10 hover:bg-white/15 border border-white/10 transition-all hover:scale-102 backdrop-blur-md shadow-none"
            >
              <FaBook className="text-sm text-neutral-300" />
              <span>Developer Docs</span>
            </a>
            <a
              href="#architecture"
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-full text-sm font-medium text-white bg-white/10 hover:bg-white/15 border border-white/10 transition-all hover:scale-102 backdrop-blur-md shadow-none"
            >
              <LuLayers className="text-sm text-[#FF6B00]" />
              <span>Architecture</span>
            </a>
          </div>

          {/* Metric Highlights */}
          <div className="grid grid-cols-3 gap-6 pt-4 border-t border-white/10 w-full max-w-[500px]">
            <div>
              <div className="text-xl sm:text-2xl font-bold text-white font-mono">100%</div>
              <div className="text-xs text-neutral-400 mt-0.5">Self-Hostable</div>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold text-[#FF6B00] font-mono">&lt; 350ms</div>
              <div className="text-xs text-neutral-400 mt-0.5">Triage Latency</div>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold text-white font-mono">LangGraph</div>
              <div className="text-xs text-neutral-400 mt-0.5">State Machine</div>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Terminal Box */}
        <div className="flex flex-col gap-3 w-full">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 pl-2">
            <button
              type="button"
              onClick={() => setActiveTab("quickstart")}
              className={`px-4 py-2 text-xs font-mono font-medium rounded-t-lg transition-all border border-b-0 cursor-pointer ${
                activeTab === "quickstart"
                  ? "bg-[#16181d] text-white border-white/15 shadow-sm"
                  : "bg-transparent text-neutral-400 hover:text-white border-transparent"
              }`}
            >
              quick-start
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("source")}
              className={`px-4 py-2 text-xs font-mono font-medium rounded-t-lg transition-all border border-b-0 cursor-pointer ${
                activeTab === "source"
                  ? "bg-[#16181d] text-white border-white/15 shadow-sm"
                  : "bg-transparent text-neutral-400 hover:text-white border-transparent"
              }`}
            >
              from-source
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("docker")}
              className={`px-4 py-2 text-xs font-mono font-medium rounded-t-lg transition-all border border-b-0 cursor-pointer ${
                activeTab === "docker"
                  ? "bg-[#16181d] text-white border-white/15 shadow-sm"
                  : "bg-transparent text-neutral-400 hover:text-white border-transparent"
              }`}
            >
              docker
            </button>
          </div>

          {/* Terminal Window */}
          <div className="rounded-xl border border-white/15 bg-[#121318]/90 backdrop-blur-2xl shadow-2xl overflow-hidden -mt-2">
            {/* Window Title Bar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/[0.03]">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
                <span className="w-3 h-3 rounded-full bg-[#28c840]" />
                <span className="ml-2 text-xs font-mono text-neutral-400">bash — 80x24</span>
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono text-neutral-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Copy command"
              >
                {copied ? (
                  <>
                    <FaCheck className="text-emerald-400 text-xs" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <FaCopy className="text-neutral-400 text-xs" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            {/* Terminal Body */}
            <div className="p-6 font-mono text-sm leading-relaxed overflow-x-auto min-h-[160px] flex items-center">
              <pre className="text-neutral-200">
                <span className="text-[#FF6B00] select-none">$ </span>
                {commands[activeTab]}
              </pre>
            </div>

            {/* Terminal Footer status info */}
            <div className="px-6 py-2.5 bg-black/40 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-neutral-400">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>Runtime: Ready</span>
              </span>
              <span>Adapter: @blazeresolver/core</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
