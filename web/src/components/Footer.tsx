"use client";

import React from "react";
import Image from "next/image";
import { FaGithub, FaXTwitter, FaDiscord, FaArrowUp } from "react-icons/fa6";

export default function Footer() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="relative border-t border-white/[0.08] bg-[#090a0d] pt-16 pb-12 text-sm text-neutral-400">
      <div className="mx-auto max-w-[1240px] px-4 sm:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-white/[0.06]">
          {/* Brand Info */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <a href="/" className="flex items-center gap-3">
              <div className="relative w-8 h-8 rounded-lg overflow-hidden shrink-0 border border-white/10">
                <Image
                  src="/blazyy.png"
                  alt="BlazeResolver Mascot"
                  fill
                  sizes="32px"
                  className="object-contain"
                />
              </div>
              <span className="font-bold text-xl tracking-tight text-white font-ds-display">
                Blaze<span className="text-[#FF6B00]">Resolver</span>
              </span>
            </a>
            <p className="text-sm text-neutral-400 max-w-sm leading-relaxed">
              Open-source, adapter-based customer support resolution harness.
              Empowering autonomous agents with intelligent triage, deep correlation, and policy-guarded actions.
            </p>
            <div className="flex items-center gap-3 mt-2">
              <a
                href="https://github.com/DikshantJangra/BlazeResolver"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
                className="w-9 h-9 rounded-full bg-white/[0.05] hover:bg-white/10 border border-white/10 flex items-center justify-center text-white transition-colors"
              >
                <FaGithub className="text-base" />
              </a>
              <a
                href="https://x.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="X Twitter"
                className="w-9 h-9 rounded-full bg-white/[0.05] hover:bg-white/10 border border-white/10 flex items-center justify-center text-white transition-colors"
              >
                <FaXTwitter className="text-base" />
              </a>
              <a
                href="https://discord.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Discord"
                className="w-9 h-9 rounded-full bg-white/[0.05] hover:bg-white/10 border border-white/10 flex items-center justify-center text-white transition-colors"
              >
                <FaDiscord className="text-base" />
              </a>
            </div>
          </div>

          {/* Column 1: Harness Core */}
          <div className="flex flex-col gap-3">
            <div className="font-semibold text-white text-xs uppercase tracking-wider font-mono">
              Harness Core
            </div>
            <a href="#architecture" className="hover:text-white transition-colors">
              Triage Stage
            </a>
            <a href="#architecture" className="hover:text-white transition-colors">
              Correlate Engine
            </a>
            <a href="#architecture" className="hover:text-white transition-colors">
              Policy Guardrails
            </a>
            <a href="#traceability" className="hover:text-white transition-colors">
              Session Trajectory
            </a>
          </div>

          {/* Column 2: Adapters */}
          <div className="flex flex-col gap-3">
            <div className="font-semibold text-white text-xs uppercase tracking-wider font-mono">
              Adapters
            </div>
            <a href="#plugins" className="hover:text-white transition-colors">
              Express / Next.js
            </a>
            <a href="#plugins" className="hover:text-white transition-colors">
              WebRTC Voice
            </a>
            <a href="#plugins" className="hover:text-white transition-colors">
              PostgreSQL Storage
            </a>
            <a href="#plugins" className="hover:text-white transition-colors">
              CRM Sync (Zendesk)
            </a>
          </div>

          {/* Column 3: Resources */}
          <div className="flex flex-col gap-3">
            <div className="font-semibold text-white text-xs uppercase tracking-wider font-mono">
              Resources
            </div>
            <a
              href="https://github.com/DikshantJangra/BlazeResolver#readme"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              Documentation
            </a>
            <a
              href="https://github.com/DikshantJangra/BlazeResolver"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              GitHub Repository
            </a>
            <a
              href="#quickstart"
              className="hover:text-white transition-colors"
            >
              Quickstart Guide
            </a>
            <a
              href="https://langchain-ai.github.io/langgraph/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              LangGraph Core
            </a>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-500">
          <div>
            &copy; {new Date().getFullYear()} BlazeResolver. Open source under MIT License.
          </div>

          <div className="flex items-center gap-6">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>All Systems Operational</span>
            </span>
            <button
              type="button"
              onClick={scrollToTop}
              className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer"
            >
              <span>Back to top</span>
              <FaArrowUp className="text-[10px]" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
