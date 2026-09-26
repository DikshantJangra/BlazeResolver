"use client";

import React, { useState } from "react";
import {
  FaGithub,
  FaBook,
  FaPuzzlePiece,
  FaHeadset,
  FaCopy,
  FaCheck,
  FaGitAlt,
  FaTerminal,
} from "react-icons/fa6";
import { SiNpm, SiPnpm, SiBun } from "react-icons/si";

type InstallTab = "npm" | "pnpm" | "bun" | "git";

export default function HeroSection() {
  const [activeTab, setActiveTab] = useState<InstallTab>("npm");
  const [copied, setCopied] = useState(false);

  const tabConfigs: Record<
    InstallTab,
    {
      label: string;
      icon: React.ReactNode;
      command: string;
      rendered: React.ReactNode;
    }
  > = {
    npm: {
      label: "npm",
      icon: <SiNpm className="w-3.5 h-3.5 text-[#e05d44]" />,
      command: "npm install @blazeresolver/harness",
      rendered: (
        <>
          <span className="text-white/60">npm install </span>
          <span className="text-white font-medium">@blazeresolver/harness</span>
        </>
      ),
    },
    pnpm: {
      label: "pnpm",
      icon: <SiPnpm className="w-3 h-3 text-[#f69220]" />,
      command: "pnpm add @blazeresolver/harness",
      rendered: (
        <>
          <span className="text-white/60">pnpm add </span>
          <span className="text-white font-medium">@blazeresolver/harness</span>
        </>
      ),
    },
    bun: {
      label: "bun",
      icon: <SiBun className="w-3 h-3 text-[#fbf0df]" />,
      command: "bun add @blazeresolver/harness",
      rendered: (
        <>
          <span className="text-white/60">bun add </span>
          <span className="text-white font-medium">@blazeresolver/harness</span>
        </>
      ),
    },
    git: {
      label: "git clone",
      icon: <FaGitAlt className="w-3.5 h-3.5 text-[#f05032]" />,
      command: "git clone https://github.com/DikshantJangra/BlazeResolver.git",
      rendered: (
        <>
          <span className="text-white/60">git clone </span>
          <span className="text-[#FF8533] font-medium">
            https://github.com/DikshantJangra/BlazeResolver.git
          </span>
        </>
      ),
    },
  };

  const handleCopy = async () => {
    const textToCopy = tabConfigs[activeTab].command;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Clipboard copy failed:", e);
    }
  };

  return (
    <section className="relative flex flex-col items-center justify-center w-full min-h-[96vh] pt-32 sm:pt-40 md:pt-44 pb-20 sm:pb-28 overflow-hidden">
      {/* Ambient background glow & radial gradients */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[550px] rounded-full blur-[180px] opacity-25 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at center, #FF6B00 0%, #0055FF 50%, transparent 75%)",
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))]" />
      </div>

      {/* Main Centered Content */}
      <div className="relative z-10 ds-container flex flex-col items-center text-center max-w-[960px] mx-auto px-4 sm:px-6">
        {/* Badge */}
        <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.12] backdrop-blur-xl mb-6 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-[#28c840] animate-pulse" />
          <span className="font-mono text-xs font-medium text-white/90 tracking-wide">
            Open-Source Customer Service Resolution Harness
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-5xl sm:text-7xl md:text-8xl lg:text-[86px] font-extrabold font-ds-display text-white tracking-[-0.035em] leading-[1.04] mb-8">
          It doesn&apos;t just chat.{" "}
          <span className="bg-gradient-to-r from-[#FF6B00] via-[#FF8533] to-[#FFA066] bg-clip-text text-transparent">
            It resolves.
          </span>
        </h1>

        {/* Descriptions with comfortable breathing space */}
        <div className="max-w-[740px] flex flex-col items-center gap-3.5 mb-10">
          <p className="text-base sm:text-lg md:text-xl text-white/80 leading-relaxed font-normal">
            BlazeResolver is an open-source, business-agnostic AI resolution
            harness. Drop it into any product&apos;s support flow to triage
            inquiries, correlate operational telemetry, and autonomously close
            out customer issues across voice and chat.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs sm:text-sm font-mono text-white/45">
            <span>LLMs decide intent</span>
            <span className="text-white/20">•</span>
            <span>Deterministic mutations</span>
            <span className="text-white/20">•</span>
            <span>Policy-gated actions</span>
          </div>
        </div>

        {/* Action Buttons with clean margins and generous hit-areas */}
        <div className="flex flex-wrap items-center justify-center gap-3.5 sm:gap-4 mb-12">
          <a
            className="ds-btn-primary ds-btn-m flex items-center gap-2.5 px-6 py-3 text-sm font-medium transition-all"
            href="https://github.com/DikshantJangra/BlazeResolver"
            target="_blank"
            rel="noopener noreferrer"
          >
            <FaGithub className="w-4 h-4" />
            <span>View on GitHub</span>
          </a>
          <a
            className="ds-btn-secondary ds-btn-m flex items-center gap-2.5 px-6 py-3 text-sm font-medium transition-all"
            href="https://github.com/DikshantJangra/BlazeResolver#readme"
            target="_blank"
            rel="noopener noreferrer"
          >
            <FaBook className="w-4 h-4" />
            <span>Developer Docs</span>
          </a>
          <a
            className="ds-btn-secondary ds-btn-m flex items-center gap-2.5 px-6 py-3 text-sm font-medium transition-all"
            href="#architecture"
          >
            <FaPuzzlePiece className="w-4 h-4" />
            <span>4-Adapter Harness</span>
          </a>
          <a
            className="ds-btn-secondary ds-btn-m flex items-center gap-2.5 px-6 py-3 text-sm font-medium transition-all"
            href="#voice-demo"
          >
            <FaHeadset className="w-4 h-4" />
            <span>Live Voice Demo</span>
          </a>
        </div>

        {/* Interactive Install & Clone Terminal Component */}
        <div className="w-full max-w-[640px] mx-auto text-left">
          <div className="rounded-2xl border border-white/[0.12] bg-[#0c0d12]/90 backdrop-blur-2xl overflow-hidden shadow-2xl transition-all duration-300 hover:border-white/20">
            {/* Top Bar: Selector Tabs + Source / License Tag */}
            <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 border-b border-white/[0.08] bg-white/[0.02]">
              {/* Package Manager & Git Tabs */}
              <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar">
                {(["npm", "pnpm", "bun", "git"] as InstallTab[]).map((tab) => {
                  const isActive = activeTab === tab;
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab)}
                      className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 text-xs font-mono rounded-lg transition-all cursor-pointer ${
                        isActive
                          ? "text-white bg-white/[0.12] border border-white/[0.15] font-semibold"
                          : "text-white/50 hover:text-white/80 hover:bg-white/[0.04] border border-transparent font-normal"
                      }`}
                    >
                      {tabConfigs[tab].icon}
                      <span>{tabConfigs[tab].label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Status / Quick info */}
              <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono text-white/40">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/80" />
                <span>v0.1.0-preview</span>
              </div>
            </div>

            {/* Code Command Row (Entire bar is interactive + Click to copy) */}
            <div
              onClick={handleCopy}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  handleCopy();
                }
              }}
              title="Click anywhere to copy"
              className="relative flex items-center justify-between gap-3 px-4 sm:px-5 py-4 sm:py-4.5 cursor-pointer group hover:bg-white/[0.02] transition-colors"
            >
              {/* Terminal Prompt + Command */}
              <div className="flex items-center gap-3 font-mono text-xs sm:text-sm overflow-x-auto no-scrollbar pr-2 select-all">
                <div className="flex items-center gap-1.5 select-none text-[#FF6B00]">
                  <FaTerminal className="w-3 h-3 opacity-70" />
                  <span className="font-bold">$</span>
                </div>
                <div className="whitespace-nowrap">
                  {tabConfigs[activeTab].rendered}
                </div>
              </div>

              {/* Copy Button */}
              <div className="shrink-0 flex items-center">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopy();
                  }}
                  aria-label="Copy command"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer border ${
                    copied
                      ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                      : "bg-white/[0.06] hover:bg-white/[0.12] border-white/10 text-white/70 hover:text-white"
                  }`}
                >
                  {copied ? (
                    <>
                      <FaCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <FaCopy className="w-3.5 h-3.5 text-white/60 group-hover:text-white" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
