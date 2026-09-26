"use client";

import React, { useState } from "react";
import { FaTerminal, FaGithub, FaCopy, FaCheck, FaArrowRight } from "react-icons/fa6";

export default function InstallationSection() {
  const [copiedQuick, setCopiedQuick] = useState(false);
  const [copiedSource, setCopiedSource] = useState(false);

  const copyQuick = async () => {
    try {
      await navigator.clipboard.writeText("npx blazeresolver demo --restaurant");
      setCopiedQuick(true);
      setTimeout(() => setCopiedQuick(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const copySource = async () => {
    try {
      await navigator.clipboard.writeText("git clone https://github.com/DikshantJangra/BlazeResolver.git");
      setCopiedSource(true);
      setTimeout(() => setCopiedSource(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <section id="quickstart" className="relative py-24 border-t border-white/[0.06]">
      <div className="mx-auto max-w-[1240px] px-4 sm:px-8">
        {/* Section Header */}
        <div className="flex flex-col items-center text-center gap-4 max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-medium uppercase tracking-wider text-white/90 bg-white/[0.08] border border-white/10">
            Installation & Setup
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight font-ds-display">
            Start resolving tickets in seconds
          </h2>

          <p className="text-base sm:text-lg text-neutral-400 leading-relaxed max-w-2xl">
            Run an interactive local restaurant delivery triage simulation or clone the full repository to deploy in production.
          </p>
        </div>

        {/* 2-Column Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Card 1: Quickstart CLI */}
          <div className="flex flex-col justify-between p-8 rounded-2xl bg-[#14151b]/80 border border-white/[0.08] hover:border-white/20 transition-all shadow-xl">
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="p-3 rounded-xl bg-[#FF6B00]/10 border border-[#FF6B00]/20 text-[#FF6B00]">
                  <FaTerminal className="text-xl" />
                </div>
                <span className="text-xs font-mono text-neutral-400 bg-white/5 px-2.5 py-1 rounded border border-white/5">
                  CLI Runner
                </span>
              </div>

              <h3 className="text-2xl font-bold text-white mb-2 font-ds-display">
                Quick start CLI
              </h3>
              <p className="text-sm text-neutral-400 mb-6 leading-relaxed">
                Launch an interactive terminal simulation of an AI support agent resolving refund disputes, delayed orders, and order modifications.
              </p>

              <div className="rounded-xl bg-[#0e0f14] border border-white/10 p-4 font-mono text-sm flex items-center justify-between gap-4">
                <code className="text-neutral-200 truncate">
                  <span className="text-[#FF6B00] select-none">$ </span>
                  npx blazeresolver demo --restaurant
                </code>
                <button
                  type="button"
                  onClick={copyQuick}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-neutral-300 hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                >
                  {copiedQuick ? (
                    <>
                      <FaCheck className="text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <FaCopy className="text-neutral-400" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-white/5 flex items-center justify-between text-xs text-neutral-400">
              <span>Zero config required</span>
              <span className="text-[#FF6B00]">Runs in Node.js 18+</span>
            </div>
          </div>

          {/* Card 2: Install from Source */}
          <div className="flex flex-col justify-between p-8 rounded-2xl bg-[#14151b]/80 border border-white/[0.08] hover:border-white/20 transition-all shadow-xl">
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="p-3 rounded-xl bg-[#0055FF]/10 border border-[#0055FF]/20 text-[#6ea1ff]">
                  <FaGithub className="text-xl" />
                </div>
                <span className="text-xs font-mono text-neutral-400 bg-white/5 px-2.5 py-1 rounded border border-white/5">
                  Source Code
                </span>
              </div>

              <h3 className="text-2xl font-bold text-white mb-2 font-ds-display">
                Install from source
              </h3>
              <p className="text-sm text-neutral-400 mb-6 leading-relaxed">
                Full source code access for customization: modify LangGraph state graphs, write proprietary guardrails, and build custom adapters.
              </p>

              <div className="rounded-xl bg-[#0e0f14] border border-white/10 p-4 font-mono text-sm flex items-center justify-between gap-4">
                <code className="text-neutral-200 truncate">
                  <span className="text-[#FF6B00] select-none">$ </span>
                  git clone https://github.com/DikshantJangra/BlazeResolver
                </code>
                <button
                  type="button"
                  onClick={copySource}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-neutral-300 hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                >
                  {copiedSource ? (
                    <>
                      <FaCheck className="text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <FaCopy className="text-neutral-400" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-white/5 flex items-center justify-between text-xs text-neutral-400">
              <span>TypeScript + LangGraph</span>
              <a
                href="https://github.com/DikshantJangra/BlazeResolver"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#FF6B00] hover:underline flex items-center gap-1"
              >
                <span>View Repository</span>
                <FaArrowRight className="text-[10px]" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
