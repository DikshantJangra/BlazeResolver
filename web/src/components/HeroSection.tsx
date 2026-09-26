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
    // Bottom padding intentionally exceeds top padding: the fixed header occupies the
    // top edge, so optical centering sits slightly above the geometric centre.
    <section className="flex flex-col items-center justify-center w-full min-h-[88svh] pt-[clamp(5rem,7vw,7rem)] pb-[clamp(6rem,9vw,8rem)]">
      {/*
        Spacing is owned by the three block wrappers below rather than by per-child
        `mb-*`, so the whole vertical rhythm reads from one place:
          A Identity  →  gap-4  (16px)
          ·  mt-8     →  32px   opens the message block
          B Message   →  gap-5  (20px) / inner gap-4 (16px)
          ·  mt-14    →  56px   the major break into the action block
          C Action    →  gap-8  (32px) keeps the terminal bound to the CTAs
      */}
      <div className="w-full max-w-[1120px] mx-auto px-6 flex flex-col items-center text-center">
        {/* ── A · Identity ─────────────────────────────────────────── */}
        <div className="flex flex-col items-center gap-4">
          <h2 className="hero-brand-title text-white tracking-wider inline-block">
            BlazeResolver <span className="text-[#FF6B00]">Harness</span>
          </h2>

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.1] backdrop-blur-xl shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-[#28c840] animate-pulse" />
            <span className="font-mono text-[11px] sm:text-xs font-normal text-white/75 tracking-normal">
              Open-Source Customer Service Resolution Harness
            </span>
          </div>
        </div>

        {/* ── B · Message ──────────────────────────────────────────── */}
        <div className="mt-8 flex flex-col items-center gap-5">
          <h1 className="hero-main-headline font-ds-display text-white max-w-[980px]">
            It doesn&apos;t just chat.{" "}
            <span className="bg-gradient-to-r from-[#FF6B00] via-[#FF8533] to-[#FFA066] bg-clip-text text-transparent">
              It resolves.
            </span>
          </h1>

          {/* The feature triplet is a caption to the paragraph, so it sits one step
              tighter (16px) than the headline-to-paragraph gap (20px) above it. */}
          <div className="flex flex-col items-center gap-4 max-w-[720px]">
            <p className="text-base sm:text-lg md:text-xl text-white/80 leading-relaxed font-normal">
              BlazeResolver is an open-source, business-agnostic AI resolution harness.
              Drop it into any product&apos;s support flow to triage inquiries, correlate operational telemetry,
              and autonomously close out customer issues across voice and chat.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs sm:text-sm font-mono text-white/45">
              <span>LLMs decide intent</span>
              <span className="text-white/20">•</span>
              <span>Deterministic mutations</span>
              <span className="text-white/20">•</span>
              <span>Policy-gated actions</span>
            </div>
          </div>
        </div>

        {/* ── C · Action ───────────────────────────────────────────────
            Shares the 680px measure with the paragraph above, so the copy,
            the buttons and the terminal all resolve to one vertical edge. */}
        <div className="mt-14 w-full max-w-[800px] flex flex-col items-center gap-8">
          {/*
            Layout never switches `display` across breakpoints: the stale Tailwind v3
            block in globals.css defines a plain `.grid` AFTER v4's `@media .sm\:flex`,
            so a `grid → sm:flex` switch can never take effect. Staying on flex and
            varying only `flex-basis` (a class with no v3 counterpart) sidesteps that.
            2-up below `sm`, single 781px row above it.
          */}
          <div className="w-full flex flex-wrap justify-center gap-5">
            {/* `sm:mr-2` widens the gap after the primary only — the one spacing
                cue that marks it as primary without altering its styling. */}
            <a
              className="ds-btn-primary ds-btn-m basis-[calc(50%-0.625rem)] sm:basis-auto flex items-center justify-center gap-2.5 px-6 py-3 text-sm font-medium transition-all sm:mr-2"
              href="https://github.com/DikshantJangra/BlazeResolver"
              target="_blank"
              rel="noopener noreferrer"
            >
              <FaGithub className="w-4 h-4" />
              <span>View on GitHub</span>
            </a>
            <a
              className="ds-btn-secondary ds-btn-m basis-[calc(50%-0.625rem)] sm:basis-auto flex items-center justify-center gap-2.5 px-6 py-3 text-sm font-medium transition-all"
              href="https://github.com/DikshantJangra/BlazeResolver#readme"
              target="_blank"
              rel="noopener noreferrer"
            >
              <FaBook className="w-4 h-4" />
              <span>Developer Docs</span>
            </a>
            <a
              className="ds-btn-secondary ds-btn-m basis-[calc(50%-0.625rem)] sm:basis-auto flex items-center justify-center gap-2.5 px-6 py-3 text-sm font-medium transition-all"
              href="#architecture"
            >
              <FaPuzzlePiece className="w-4 h-4" />
              <span>4-Adapter Harness</span>
            </a>
            <a
              className="ds-btn-secondary ds-btn-m basis-[calc(50%-0.625rem)] sm:basis-auto flex items-center justify-center gap-2.5 px-6 py-3 text-sm font-medium transition-all"
              href="#voice-demo"
            >
              <FaHeadset className="w-4 h-4" />
              <span>Live Voice Demo</span>
            </a>
          </div>

          {/* Interactive Install & Clone Terminal Component */}
          <div className="w-full text-left">
            <div className="rounded-2xl border border-white/[0.12] bg-[#0c0d12]/90 backdrop-blur-2xl overflow-hidden shadow-2xl transition-all duration-300 hover:border-white/20">
              {/* Top Bar: Selector Tabs + Status */}
              <div className="flex items-center justify-between px-4 sm:px-5 py-1.5 border-b border-white/[0.08] bg-white/[0.015]">
                {/*
                  No negative margin here: the unlayered v3 Preflight in globals.css
                  (`button {padding:0}`) outranks the layered `px-2.5` below, so each tab
                  button currently has zero horizontal padding and its icon already sits
                  on the row's padding edge — level with the `$` prompt. If that cascade
                  conflict is ever resolved, `px-2.5` revives and this row needs `-ml-2.5`
                  restored to keep the two left edges aligned.
                */}
                <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar">
                  {(["npm", "pnpm", "bun", "git"] as InstallTab[]).map((tab) => {
                    const isActive = activeTab === tab;
                    return (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setActiveTab(tab)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded-md transition-all cursor-pointer outline-none ${
                          isActive
                            ? "bg-white/10 text-white font-medium"
                            : "text-white/40 hover:text-white/80 hover:bg-white/[0.03]"
                        }`}
                      >
                        {tabConfigs[tab].icon}
                        <span>{tabConfigs[tab].label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Status Tag */}
                <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono text-white/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#28c840]" />
                  <span>v0.1.0</span>
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
                className="relative flex items-center justify-between gap-3 px-4 sm:px-5 py-4 cursor-pointer group hover:bg-white/[0.02] transition-colors"
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
      </div>
    </section>
  );
}
