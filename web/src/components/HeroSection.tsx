"use client";

import React, { useState } from "react";
import {
  FaGithub,
  FaBook,
  FaDiagramProject,
  FaShieldHalved,
  FaCopy,
  FaCheck,
  FaCode,
  FaTerminal,
} from "react-icons/fa6";
import { SiNpm, SiPnpm, SiBun } from "react-icons/si";
import Link from "next/link";

type InstallTab = "npm" | "pnpm" | "bun" | "widget";

const WIDGET_TAG =
  '<script src="https://cdn.jsdelivr.net/npm/blazeresolver@latest/widget/widget.js" data-endpoint="/api/blaze"></script>';

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
      /** Not verified end to end yet: shown, but can't be selected or copied. */
      comingSoon?: boolean;
    }
  > = {
    npm: {
      label: "npx",
      icon: <SiNpm className="w-3.5 h-3.5 text-[#e05d44]" />,
      command: "npx blazeresolver@latest init",
      rendered: (
        <>
          <span className="text-fg/60">npx </span>
          <span className="text-fg font-medium">blazeresolver@latest init</span>
        </>
      ),
    },
    pnpm: {
      label: "pnpm",
      icon: <SiPnpm className="w-3 h-3 text-[#f69220]" />,
      command: "pnpm dlx blazeresolver@latest init",
      rendered: (
        <>
          <span className="text-fg/60">pnpm dlx </span>
          <span className="text-fg font-medium">blazeresolver@latest init</span>
        </>
      ),
    },
    bun: {
      label: "bun",
      icon: <SiBun className="w-3 h-3 text-cream" />,
      command: "bunx blazeresolver@latest init",
      rendered: (
        <>
          <span className="text-fg/60">bunx </span>
          <span className="text-fg font-medium">blazeresolver@latest init</span>
        </>
      ),
      // init installs with npm, pnpm or yarn only; bun projects aren't supported yet.
      comingSoon: true,
    },
    widget: {
      label: "widget",
      icon: <FaCode className="w-3.5 h-3.5 text-brand-soft" />,
      command: WIDGET_TAG,
      rendered: (
        <>
          <span className="text-fg/60">&lt;script src=</span>
          <span className="text-brand-soft font-medium">
            &quot;https://cdn.jsdelivr.net/npm/blazeresolver@latest/widget/widget.js&quot;
          </span>
          <span className="text-fg/60"> data-endpoint=</span>
          <span className="text-fg font-medium">&quot;/api/blaze&quot;</span>
          <span className="text-fg/60">&gt;&lt;/script&gt;</span>
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
          <h2 className="hero-brand-title text-fg tracking-wider inline-block">
            BlazeResolver <span className="text-brand">Harness</span>
          </h2>

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-fg/[0.04] border border-fg/[0.1] backdrop-blur-xl shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-[#28c840] animate-pulse" />
            <span className="font-mono text-[11px] sm:text-xs font-normal text-fg/75 tracking-normal">
              Open source · Runs on your GitHub Actions
            </span>
          </div>
        </div>

        {/* ── B · Message ──────────────────────────────────────────── */}
        <div className="mt-8 flex flex-col items-center gap-5">
          <h1 className="hero-main-headline font-ds-display text-fg max-w-[980px]">
            It doesn&apos;t just chat.{" "}
            <span className="bg-gradient-to-r from-brand via-brand-soft to-brand-light bg-clip-text text-transparent">
              It resolves.
            </span>
          </h1>

          {/* The feature triplet is a caption to the paragraph, so it sits one step
              tighter (16px) than the headline-to-paragraph gap (20px) above it. */}
          <div className="flex flex-col items-center gap-4 max-w-[720px]">
            <p className="text-base sm:text-lg md:text-xl text-fg/80 leading-relaxed font-normal">
              BlazeResolver turns customer bug reports into tested pull requests. A widget
              in your app files each report as a GitHub issue, and a workflow in your own
              repo finds the cause, writes the fix, runs your tests and opens a PR.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs sm:text-sm font-mono text-fg/45">
              <span>No server to host</span>
              <span className="text-fg/20">•</span>
              <span>Any AI provider</span>
              <span className="text-fg/20">•</span>
              <span>A human merges every fix</span>
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
            <Link
              className="ds-btn-secondary ds-btn-m basis-[calc(50%-0.625rem)] sm:basis-auto flex items-center justify-center gap-2.5 px-6 py-3 text-sm font-medium transition-all"
              href="/docs"
            >
              <FaBook className="w-4 h-4" />
              <span>Docs</span>
            </Link>
            <a
              className="ds-btn-secondary ds-btn-m basis-[calc(50%-0.625rem)] sm:basis-auto flex items-center justify-center gap-2.5 px-6 py-3 text-sm font-medium transition-all"
              href="#how-it-works"
            >
              <FaDiagramProject className="w-4 h-4" />
              <span>How it works</span>
            </a>
            <a
              className="ds-btn-secondary ds-btn-m basis-[calc(50%-0.625rem)] sm:basis-auto flex items-center justify-center gap-2.5 px-6 py-3 text-sm font-medium transition-all"
              href="#safety"
            >
              <FaShieldHalved className="w-4 h-4" />
              <span>Safety</span>
            </a>
          </div>

          {/* Interactive Install Terminal Component */}
          <div className="w-full text-left">
            <div className="rounded-2xl border border-fg/[0.12] bg-surface/90 backdrop-blur-2xl overflow-hidden shadow-2xl transition-all duration-300 hover:border-fg/20">
              {/* Top Bar: Selector Tabs + Status */}
              <div className="flex items-center justify-between px-4 sm:px-5 py-1.5 border-b border-fg/[0.08] bg-fg/[0.015]">
                {/*
                  No negative margin here: the unlayered v3 Preflight in globals.css
                  (`button {padding:0}`) outranks the layered `px-2.5` below, so each tab
                  button currently has zero horizontal padding and its icon already sits
                  on the row's padding edge — level with the `$` prompt. If that cascade
                  conflict is ever resolved, `px-2.5` revives and this row needs `-ml-2.5`
                  restored to keep the two left edges aligned.
                */}
                <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar">
                  {(["npm", "pnpm", "bun", "widget"] as InstallTab[]).map((tab) => {
                    const isActive = activeTab === tab;
                    const soon = tabConfigs[tab].comingSoon;
                    return (
                      <button
                        key={tab}
                        type="button"
                        disabled={soon}
                        aria-disabled={soon}
                        title={soon ? "Coming soon" : undefined}
                        onClick={() => !soon && setActiveTab(tab)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded-md transition-all outline-none ${
                          soon
                            ? "text-fg/25 cursor-not-allowed"
                            : isActive
                              ? "bg-fg/10 text-fg font-medium cursor-pointer"
                              : "text-fg/40 hover:text-fg/80 hover:bg-fg/[0.03] cursor-pointer"
                        }`}
                      >
                        <span className={soon ? "opacity-40 grayscale" : undefined}>{tabConfigs[tab].icon}</span>
                        <span>{tabConfigs[tab].label}</span>
                        {soon && (
                          <span className="ml-0.5 px-1.5 py-px rounded-full border border-fg/10 bg-fg/[0.04] text-[9px] uppercase tracking-wider text-fg/45">
                            Soon
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Status Tag */}
                <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono text-fg/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#28c840]" />
                  <span>Apache-2.0</span>
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
                className="relative flex items-center justify-between gap-3 px-4 sm:px-5 py-4 cursor-pointer group hover:bg-fg/[0.02] transition-colors"
              >
                {/* Terminal Prompt + Command */}
                <div className="flex items-center gap-3 font-mono text-xs sm:text-sm overflow-x-auto no-scrollbar pr-2 select-all">
                  <div className="flex items-center gap-1.5 select-none text-brand">
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
                        ? "bg-emerald-500/15 border-emerald-500/30 text-ok"
                        : "bg-fg/[0.06] hover:bg-fg/[0.12] border-fg/10 text-fg/70 hover:text-fg"
                    }`}
                  >
                    {copied ? (
                      <>
                        <FaCheck className="w-3.5 h-3.5 text-ok" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <FaCopy className="w-3.5 h-3.5 text-fg/60 group-hover:text-fg" />
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
