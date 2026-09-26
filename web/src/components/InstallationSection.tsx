"use client";

import React, { useState } from "react";
import { FaGithub, FaBook, FaTerminal, FaCheck, FaCopy, FaBolt } from "react-icons/fa6";

export default function InstallationSection() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText("npm install @blazeresolver/harness");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <section
      id="get-started"
      className="relative z-10 ds-container flex flex-col items-center text-center scroll-mt-24 py-20 sm:py-28"
    >
      <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.05] border border-white/10 backdrop-blur-xl mb-4">
        <FaBolt className="w-3 h-3 text-[#FF6B00]" />
        <span className="font-mono text-xs font-semibold text-white/90 uppercase tracking-wider">
          Production-Ready
        </span>
      </span>

      <h2 className="text-3xl sm:text-5xl font-bold font-ds-display text-white tracking-tight leading-[1.15] max-w-[820px]">
        Deploy BlazeResolver to Your Support Stack
      </h2>

      <p className="mt-4 text-base sm:text-lg text-white/70 leading-relaxed max-w-[680px]">
        Drop BlazeResolver into any product flow — whether e-commerce, SaaS,
        on-demand delivery, or fintech. Connect the 4 typed adapters to your
        database, payment gateway, and ticketing tools, and let the harness
        autonomously resolve customer issues end-to-end.
      </p>

      {/* Quick Install Snippet Box */}
      <div className="mt-8 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[#0c0d14] border border-white/[0.12] text-xs font-mono text-white/90 shadow-xl max-w-[420px] w-full justify-between">
        <div className="flex items-center gap-2 truncate">
          <span className="text-[#FF6B00] font-bold">$</span>
          <span className="truncate">npm install @blazeresolver/harness</span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy install command"
          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-white/60 hover:text-white transition-colors cursor-pointer shrink-0"
        >
          {copied ? (
            <FaCheck className="w-3.5 h-3.5 text-[#28c840]" />
          ) : (
            <FaCopy className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4 mt-8">
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
          <span>Documentation</span>
        </a>
        <a
          className="ds-btn-secondary ds-btn-m flex items-center gap-2.5 px-6 py-3 text-sm font-medium transition-all"
          href="https://www.npmjs.com/package/@blazeresolver/harness"
          target="_blank"
          rel="noopener noreferrer"
        >
          <FaTerminal className="w-4 h-4" />
          <span>npm package</span>
        </a>
      </div>
    </section>
  );
}
