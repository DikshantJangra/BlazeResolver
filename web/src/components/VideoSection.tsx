"use client";

import React, { useState, useEffect } from "react";
import {
  FaPlay,
  FaPause,
  FaBolt,
  FaCircleCheck,
  FaRotateRight,
  FaComments,
  FaCircleDot,
  FaGears,
  FaCodePullRequest,
  FaGithub,
} from "react-icons/fa6";
import { ACCENT, tint } from "./theme";

const STEPS = [
  {
    time: "00:00",
    label: "Customer, in your app",
    icon: <FaComments className="w-3 h-3" />,
    accent: ACCENT.info,
    text: "\"Applying my coupon at checkout shows a blank page.\"",
    detail: "Page: /checkout · Console: TypeError: Cannot read properties of undefined (reading 'total')",
  },
  {
    time: "00:04",
    label: "Issue #42 opened",
    icon: <FaCircleDot className="w-3 h-3" />,
    accent: ACCENT.brandSoft,
    text: "[bug] Coupon code crashes checkout",
    detail: "Triage: bug · severity high · steps to reproduce, expected vs actual · label blazeresolver",
  },
  {
    time: "00:05",
    label: "GitHub Actions: BlazeResolver",
    icon: <FaGears className="w-3 h-3" />,
    accent: ACCENT.brand,
    text: "Mapped the codebase, traced it to applyDiscount() in cart.js",
    detail: "Attempt 1: tests failed · Attempt 2: tests and build passing",
  },
  {
    time: "04:12",
    label: "Pull request #43 opened",
    icon: <FaCodePullRequest className="w-3 h-3" />,
    accent: ACCENT.ok,
    text: "fix: Coupon code crashes checkout",
    detail: "Root cause, evidence and test output attached · Closes #42 · waiting for your review",
  },
];

export default function VideoSection() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setStep((prev) => (prev < STEPS.length - 1 ? prev + 1 : 0));
      }, 2200);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  const shown = isPlaying ? step : STEPS.length - 1;

  return (
    <section id="demo" className="relative z-10 ds-container py-20 sm:py-28 scroll-mt-24">
      <div className="flex flex-col items-center text-center max-w-[820px] mx-auto">
        <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-fg/[0.05] border border-fg/10 backdrop-blur-xl mb-4">
          <FaBolt className="w-3 h-3 text-brand" />
          <span className="font-mono text-xs font-semibold text-fg/90 uppercase tracking-wider">
            Watch it run
          </span>
        </span>
        <h2 className="text-3xl sm:text-5xl font-bold font-ds-display text-fg tracking-tight leading-[1.15]">
          One report, start to pull request
        </h2>
        <p className="mt-4 text-base sm:text-lg text-fg/70 leading-relaxed max-w-[680px]">
          A customer hits a bug and says so in one sentence. Minutes later
          there&apos;s a tested fix in your pull requests. Nobody had to
          reproduce it first.
        </p>
      </div>

      <div className="mt-12 rounded-2xl border border-fg/[0.12] bg-surface overflow-hidden shadow-2xl relative group max-w-[960px] mx-auto">
        {/* Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-fg/[0.08] bg-fg/[0.02]">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono bg-fg/[0.06] border border-fg/10 text-fg/90">
              <span className={`w-2 h-2 rounded-full ${isPlaying ? "bg-brand animate-ping" : "bg-fg/40"}`} />
              <span className="font-semibold">acme/shop</span>
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono bg-fg/[0.06] text-fg/80 border border-fg/10">
              <FaGithub className="w-3 h-3" /> issues → actions → pulls
            </span>
          </div>
          <span className="text-xs font-mono text-fg/50">
            Elapsed: <strong className="text-fg font-semibold">{STEPS[shown].time}</strong>
          </span>
        </div>

        {/* Timeline */}
        <div className="p-6 sm:p-10 flex flex-col items-center justify-between min-h-[380px] gap-8">
          <div className="w-full max-w-[680px] flex flex-col gap-3">
            {STEPS.map((s, i) => {
              const active = isPlaying && i === step;
              const reached = i <= shown;
              return (
                <div
                  key={s.label}
                  className={`p-4 rounded-2xl border text-left transition-all duration-300 ${
                    active ? "shadow-lg" : "border-fg/[0.06] bg-fg/[0.02]"
                  } ${reached ? "opacity-100" : "opacity-35"}`}
                  style={active ? { backgroundColor: tint(s.accent, 8), borderColor: tint(s.accent, 33) } : undefined}
                >
                  <div className="flex items-center justify-between mb-1.5 gap-3">
                    <span className="font-mono text-xs font-semibold flex items-center gap-1.5" style={{ color: s.accent }}>
                      {s.icon} {s.label}
                    </span>
                    <span className="font-mono text-[10px] text-fg/40 shrink-0">{s.time}</span>
                  </div>
                  <p className="text-sm text-fg/90 leading-relaxed font-sans">{s.text}</p>
                  <p className="mt-1 text-[11px] text-fg/45 font-mono leading-relaxed">{s.detail}</p>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className={`flex items-center gap-2.5 px-6 py-2.5 rounded-xl font-ds-sans font-medium text-sm transition-all cursor-pointer ${
                isPlaying
                  ? "bg-fg/10 text-fg border border-fg/20 hover:bg-fg/15"
                  : "bg-[#FF6B00] text-white hover:bg-[#e05e00] shadow-md"
              }`}
            >
              {isPlaying ? (
                <>
                  <FaPause className="w-3.5 h-3.5" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <FaPlay className="w-3.5 h-3.5" />
                  <span>Play the run</span>
                </>
              )}
            </button>

            {isPlaying && (
              <button
                type="button"
                onClick={() => setStep(0)}
                aria-label="Restart the run"
                className="p-2.5 rounded-xl bg-fg/[0.05] hover:bg-fg/10 text-fg/60 hover:text-fg border border-fg/10 transition-colors cursor-pointer"
              >
                <FaRotateRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-fg/[0.08] bg-fg/[0.02] text-xs font-mono text-fg/60 gap-3">
          <div className="flex items-center gap-3">
            <span className="text-fg/80 font-medium">Status:</span>
            <span className={isPlaying ? "text-ok font-semibold" : "text-fg/40"}>
              {isPlaying ? STEPS[step].label : "Ready · press Play the run"}
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-fg/40">
            <FaCircleCheck className="w-3.5 h-3.5 text-ok" />
            <span>A human merges it</span>
          </div>
        </div>
      </div>
    </section>
  );
}
