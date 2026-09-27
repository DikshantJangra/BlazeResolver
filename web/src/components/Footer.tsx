"use client";

import React from "react";
import { FaGithub, FaComments, FaBook } from "react-icons/fa6";
import Link from "next/link";

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
            <span className="font-bold text-sm text-fg font-ds-display">
              Blaze<span className="text-brand">Resolver</span>
            </span>
          </div>

          <div className="hidden sm:block h-3.5 w-px bg-fg/10" />

          <div className="flex items-center gap-4 text-xs text-fg/60">
            <a
              href="https://github.com/DikshantJangra/BlazeResolver"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-fg transition-colors"
            >
              <FaGithub className="w-3.5 h-3.5" />
              <span>GitHub</span>
            </a>
            <a
              href="https://github.com/DikshantJangra/BlazeResolver/discussions"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-fg transition-colors"
            >
              <FaComments className="w-3.5 h-3.5" />
              <span>Community</span>
            </a>
            <Link
              href="/docs"
              className="flex items-center gap-1.5 hover:text-fg transition-colors"
            >
              <FaBook className="w-3.5 h-3.5" />
              <span>Documentation</span>
            </Link>
          </div>
        </div>

        {/* Center: Copyright */}
        <p className="ds-text-caption text-ds-description text-center text-xs">
          Open source · Apache-2.0 · © 2026 BlazeResolver
        </p>

        {/* Right: Policy Links */}
        <nav
          aria-label="Policies and statements"
          className="flex items-center gap-3 text-xs"
        >
          <Link
            className="text-fg/60 transition-colors hover:text-fg whitespace-nowrap"
            href="/docs/concepts/security"
          >
            Safe Use Policy
          </Link>
          <span aria-hidden="true" className="text-fg/30">
            ·
          </span>
          <Link
            className="text-fg/60 transition-colors hover:text-fg whitespace-nowrap"
            href="/docs/concepts/security#privacy"
          >
            Data Statement
          </Link>
        </nav>
      </div>
    </footer>
  );
}
