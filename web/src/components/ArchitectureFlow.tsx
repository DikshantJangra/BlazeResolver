"use client";

import React from "react";
import {
  FaComments,
  FaGithub,
  FaCodePullRequest,
  FaFilter,
  FaGears,
  FaArrowRight,
  FaServer,
  FaKey,
  FaLock,
} from "react-icons/fa6";
import { ACCENT, tint } from "./theme";

export default function ArchitectureFlow() {
  const stages = [
    {
      title: "Report",
      description:
        "A small widget in your app. The customer describes what broke; the page address and recent JavaScript errors come along (they can untick that). Unsent drafts are kept.",
      tag: "Widget · ~14 KB",
      accentColor: ACCENT.brand,
      icon: <FaComments className="w-4 h-4" />,
    },
    {
      title: "Triage",
      description:
        "One route in your own backend screens for prompt injection, has AI triage the report, and files real bugs as GitHub issues. The same bug reported again becomes a comment, not a new issue.",
      tag: "Your /api/blaze route",
      accentColor: ACCENT.blue,
      icon: <FaFilter className="w-4 h-4" />,
    },
    {
      title: "Fix",
      description:
        "The new issue starts a workflow in your repo. On GitHub's runner it maps your codebase, finds the root cause, patches it, and runs your tests and build, retrying up to three times.",
      tag: "GitHub Actions",
      accentColor: ACCENT.ok,
      icon: <FaGears className="w-4 h-4" />,
    },
    {
      title: "Review",
      description:
        "A pull request with the root cause, the evidence and the test output, closing the issue. You review and merge. Customers who left an email hear it's fixed.",
      tag: "Pull request",
      accentColor: ACCENT.brandSoft,
      icon: <FaCodePullRequest className="w-4 h-4" />,
    },
  ];

  const pillars = [
    {
      title: "No server to host",
      description:
        "GitHub Actions does the fixing. The only running piece is one route inside the app you already deploy. Nothing to sign up for, nothing hosted by us.",
      tag: "GitHub-native",
      accentColor: ACCENT.brand,
      icon: <FaServer className="w-4 h-4" />,
    },
    {
      title: "Any AI provider",
      description:
        "Paste a key from Anthropic, OpenAI, Gemini, Groq, NVIDIA and more: 26 providers, recognized from the key itself. Add several and they fail over to each other.",
      tag: "API_KEYS=…",
      accentColor: ACCENT.blue,
      icon: <FaKey className="w-4 h-4" />,
    },
    {
      title: "Your repo, your keys",
      description:
        "Keys live in your repo's secrets and code runs on your runner. Reports go to your GitHub and your AI provider, nowhere else.",
      tag: "Self-contained",
      accentColor: ACCENT.ok,
      icon: <FaLock className="w-4 h-4" />,
    },
  ];

  return (
    <section
      id="how-it-works"
      className="relative z-10 ds-container py-24 sm:py-32 scroll-mt-20"
    >
      <div className="max-w-[880px] mx-auto flex flex-col items-center gap-6 text-center">
        {/* Formula Badge */}
        <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 border border-fg/12 bg-fg/[0.04] backdrop-blur-xl shadow-sm">
          <span className="flex items-center gap-1.5 font-mono text-xs font-semibold text-fg/90">
            <FaComments className="text-brand w-3 h-3" />
            Bug report
          </span>
          <span className="text-fg/30 font-mono text-xs">+</span>
          <span className="flex items-center gap-1.5 font-mono text-xs font-semibold text-fg/90">
            <FaGithub className="text-fg w-3 h-3" />
            GitHub Actions
          </span>
          <span className="text-fg/30 font-mono text-xs">=</span>
          <span className="font-mono text-xs font-bold text-brand uppercase tracking-wider">
            Reviewed PR
          </span>
        </div>

        <h2
          className="text-2xl sm:text-4xl md:text-5xl font-bold font-ds-display text-fg tracking-tight max-w-[840px]"
          style={{
            fontSize: "clamp(1.75rem, 3.8vw, 3.25rem)",
            lineHeight: 1.2,
            letterSpacing: "-0.025em",
          }}
        >
          From &quot;it&apos;s broken&quot; to a tested pull request
        </h2>

        <div className="max-w-[760px] flex flex-col gap-3 text-ds-description">
          <p className="text-base sm:text-lg text-fg/80 leading-relaxed font-normal">
            <strong className="text-fg font-semibold">
              Bug reports usually die in a support inbox.
            </strong>{" "}
            Someone has to reproduce them, find the code, and write a ticket
            nobody picks up.
          </p>
          <p className="text-sm sm:text-base text-fg/60 leading-relaxed">
            BlazeResolver takes a report straight to your repo: an issue with
            the details, then a fix proven by your own tests, waiting for your
            review.
          </p>
        </div>
      </div>

      {/* 4 Stage Cards */}
      <div className="mt-16 sm:mt-20">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-[#FF6B00] animate-pulse" />
            <span className="font-mono text-xs font-semibold text-fg/90 uppercase tracking-widest">
              Report to pull request
            </span>
          </div>
          <span className="font-mono text-xs text-fg/40">
            AI writes the fix • Your tests prove it • You merge it
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {stages.map((stage, idx) => (
            <div
              key={stage.title}
              className="group rounded-2xl border border-fg/[0.08] bg-surface/70 backdrop-blur-xl p-6 flex flex-col justify-between transition-all duration-300 hover:border-fg/20 hover:bg-surface-hover hover:-translate-y-1 shadow-lg"
            >
              <div>
                <div className="flex items-center gap-3 mb-3.5">
                  <div
                    className="p-2.5 rounded-xl border flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: tint(stage.accentColor, 8),
                      borderColor: tint(stage.accentColor, 19),
                      color: stage.accentColor,
                    }}
                  >
                    {stage.icon}
                  </div>
                  <h3 className="text-base font-bold text-fg tracking-tight">
                    <span className="font-mono text-xs text-fg/40 mr-2">0{idx + 1}</span>
                    {stage.title}
                  </h3>
                </div>

                <p className="text-xs text-fg/65 leading-relaxed">
                  {stage.description}
                </p>
              </div>

              <div
                className="mt-5 pt-3.5 border-t border-fg/[0.06] font-mono text-[11px] font-medium flex items-center justify-between"
                style={{ color: stage.accentColor }}
              >
                <span>{stage.tag}</span>
                {idx < stages.length - 1 && (
                  <FaArrowRight className="hidden lg:block text-fg/20 group-hover:text-fg/60 transition-colors" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3 Pillars */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-5">
        {pillars.map((pillar) => (
          <div
            key={pillar.title}
            className="group rounded-2xl border border-fg/[0.08] bg-surface/70 backdrop-blur-xl p-6 flex flex-col justify-between transition-all duration-300 hover:border-fg/20 hover:bg-surface-hover hover:-translate-y-1 shadow-lg"
          >
            <div>
              <div className="flex items-center gap-3 mb-3.5">
                <div
                  className="p-2.5 rounded-xl border"
                  style={{
                    backgroundColor: tint(pillar.accentColor, 10),
                    borderColor: tint(pillar.accentColor, 25),
                    color: pillar.accentColor,
                  }}
                >
                  {pillar.icon}
                </div>
                <h3 className="text-base font-bold text-fg tracking-tight">
                  {pillar.title}
                </h3>
              </div>
              <p className="text-xs text-fg/65 leading-relaxed">
                {pillar.description}
              </p>
            </div>
            <div
              className="mt-5 pt-3.5 border-t border-fg/[0.06] font-mono text-[11px] font-medium"
              style={{ color: pillar.accentColor }}
            >
              {pillar.tag}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
