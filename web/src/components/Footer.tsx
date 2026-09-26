"use client";

import React from "react";
import { FaGithub, FaComments, FaBook } from "react-icons/fa6";

export default function Footer() {
  return (
    <footer className="ds-container pb-ds-8 pt-ds-6">
      <div className="w-full h-px bg-ds-border-subtle mb-ds-6" />
      <div className="flex flex-col md:flex-row items-center justify-between gap-ds-5">
        {/* Left: Brand & Community Links */}
        <div className="flex flex-wrap items-center gap-ds-5">
          <div className="flex items-center gap-2">
            <img
              src="/blazyy.png"
              alt="BlazeResolver"
              className="w-5 h-5 rounded object-contain"
            />
            <span className="font-bold text-sm text-white font-ds-display">
              Blaze<span className="text-[#FF6B00]">Resolver</span>
            </span>
          </div>

          <div className="hidden sm:block h-3.5 w-px bg-white/10" />

          <div className="flex items-center gap-4 text-xs text-white/60">
            <a
              href="https://github.com/DikshantJangra/BlazeResolver"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-white transition-colors"
            >
              <FaGithub className="w-3.5 h-3.5" />
              <span>GitHub</span>
            </a>
            <a
              href="https://github.com/DikshantJangra/BlazeResolver/discussions"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-white transition-colors"
            >
              <FaComments className="w-3.5 h-3.5" />
              <span>Community</span>
            </a>
            <a
              href="https://github.com/DikshantJangra/BlazeResolver#readme"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-white transition-colors"
            >
              <FaBook className="w-3.5 h-3.5" />
              <span>Documentation</span>
            </a>
          </div>
        </div>

        {/* Center: Copyright */}
        <p className="ds-text-caption text-ds-description text-center text-xs">
          Open source · MIT · © 2026 BlazeResolver. All rights reserved.
        </p>

        {/* Right: Policy Links */}
        <nav
          aria-label="Policies and statements"
          className="flex items-center gap-3 text-xs"
        >
          <a
            className="text-white/60 transition-colors hover:text-white whitespace-nowrap"
            href="https://github.com/DikshantJangra/BlazeResolver#readme"
            target="_blank"
            rel="noopener noreferrer"
          >
            Safe Use Policy
          </a>
          <span aria-hidden="true" className="text-white/30">
            ·
          </span>
          <a
            className="text-white/60 transition-colors hover:text-white whitespace-nowrap"
            href="https://github.com/DikshantJangra/BlazeResolver#readme"
            target="_blank"
            rel="noopener noreferrer"
          >
            Data Statement
          </a>
        </nav>
      </div>
    </footer>
  );
}
