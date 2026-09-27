"use client";

import React from "react";
import { asset } from "@/lib/site";
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
        "Customers report bugs right in your app. BlazeResolver captures the page URL and recent browser errors, which they can leave out. Unsent drafts are saved.",
      tag: "Widget · ~14 KB",
      accentColor: ACCENT.brand,
      icon: <FaComments className="w-4 h-4" />,
    },
    {
      title: "Triage",
      description:
        "Your backend route screens reports for prompt injection. AI files valid bugs as GitHub issues, and repeat reports add context to the existing issue.",
      tag: "Your /api/blaze route",
      accentColor: ACCENT.blue,
      icon: <FaFilter className="w-4 h-4" />,
    },
    {
      title: "Fix",
      description:
        "A new issue starts a GitHub Actions workflow. It maps your code, finds the cause, and tries a fix, running your tests and build with up to three attempts.",
      tag: "GitHub Actions",
      accentColor: ACCENT.ok,
      icon: <FaGears className="w-4 h-4" />,
    },
    {
      title: "Review",
      description:
        "Review a pull request with the fix, root cause, and test results. It closes the issue when merged; customers who shared an email get a fix update.",
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
        <img
          src={asset("/blazyy.png")}
          alt="BlazeResolver"
          width={160}
          height={160}
          className="h-40 w-40 object-contain"
        />
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
        <div className="mb-7 flex flex-col gap-5 border-b border-fg/[0.08] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-brand/40 animate-ping" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand" />
              </span>
              <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-fg/55">
                Automated fix workflow
              </span>
            </div>
            <h3 className="mt-2 flex items-center gap-2 text-xl font-semibold tracking-tight text-fg sm:text-2xl">
              Report
              <FaArrowRight aria-hidden="true" className="h-3.5 w-3.5 text-brand" />
              <span className="text-fg/55">pull request</span>
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-fg/[0.08] bg-fg/[0.025] px-3.5 py-2.5 font-mono text-[11px] text-fg/55 sm:mb-0.5">
            <span className="inline-flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              AI writes the fix
            </span>
            <FaArrowRight aria-hidden="true" className="hidden h-3 w-3 text-fg/25 sm:block" />
            <span className="inline-flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-soft" />
              Your tests prove it
            </span>
            <FaArrowRight aria-hidden="true" className="hidden h-3 w-3 text-fg/25 sm:block" />
            <span className="inline-flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-soft" />
              You merge it
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {stages.map((stage, idx) => (
            <div
              key={stage.title}
              className="group relative flex flex-col justify-between rounded-2xl border border-fg/[0.08] bg-surface/70 p-6 shadow-lg backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-fg/20 hover:bg-surface-hover"
            >
              <div>
                <div className="mb-3.5 flex items-center gap-3">
                  <div
                    className="flex shrink-0 items-center justify-center rounded-xl border p-2.5"
                    style={{
                      backgroundColor: tint(stage.accentColor, 8),
                      borderColor: tint(stage.accentColor, 19),
                      color: stage.accentColor,
                    }}
                  >
                    {stage.icon}
                  </div>
                  <h3 className="text-base font-bold tracking-tight text-fg">
                    {stage.title}
                  </h3>
                  <span className="ml-auto font-mono text-xs tabular-nums text-fg/35">
                    0{idx + 1}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-fg/65">
                  {stage.description}
                </p>
              </div>

              <div
                className="mt-5 flex items-center justify-between border-t border-fg/[0.06] pt-3.5 font-mono text-[11px] font-medium"
                style={{ color: stage.accentColor }}
              >
                <span>{stage.tag}</span>
              </div>
              {idx < stages.length - 1 && (
                <FaArrowRight
                  aria-hidden="true"
                  className="absolute -right-4 top-1/2 z-10 hidden h-4 w-4 -translate-y-1/2 text-fg/35 transition-colors group-hover:text-brand lg:block"
                />
              )}
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
