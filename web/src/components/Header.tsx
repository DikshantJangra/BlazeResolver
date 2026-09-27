"use client";

import { asset } from "@/lib/site";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { FaGithub } from "react-icons/fa6";
import ThemeToggle from "./ThemeToggle";
import { ACCENT, tint } from "./theme";

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <div className="ds-header-wrapper">
        <div
          className={`ds-header-bar ${isScrolled ? "is-scrolled" : ""}`}
          style={{
            maxWidth: "1280px",
            paddingLeft: "0px",
            paddingRight: "0px",
          }}
        >
          {/* Logo & Brand */}
          <Link className="flex items-center gap-[10px] min-w-0" href="/">
            <span className="shrink-0 inline-flex items-center gap-2.5">
              <img
                src={asset("/blazyy.svg")}
                alt="BlazeResolver"
                className="w-8 h-8 rounded-lg object-contain shadow-md"
              />
              <span className="font-bold text-xl tracking-tight text-fg font-ds-display">
                Blaze<span className="text-brand">Resolver</span>
              </span>
            </span>

            {/* Gradient border badge */}
            <span className="inline-flex items-start gap-[5px] min-w-0 ml-1">
              <span className="shrink-0 inline-flex">
                <span
                  className="inline-flex items-center rounded-[8px] p-[1px] min-w-0 max-w-full"
                  style={{
                    background:
                      `linear-gradient(135deg, ${tint(ACCENT.fg, 75)} 0%, ${tint(ACCENT.fg, 8)} 35%, ${tint(ACCENT.fg, 4)} 65%, ${tint(ACCENT.fg, 50)} 100%)`,
                    boxShadow:
                      `0 0 16px ${tint(ACCENT.fg, 8)}, 0 0 32px ${tint(ACCENT.fg, 4)}`,
                  }}
                >
                  <span className="min-w-0 truncate pt-[4px] pb-[3px] rounded-[7px] ds-font-harness text-xs tracking-wider leading-none px-[9px] bg-page/70 text-brand">
                    Harness
                  </span>
                </span>
              </span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-ds-5">
            <a
              href="#how-it-works"
              className="text-sm font-medium text-fg/70 hover:text-fg transition-colors"
            >
              How it works
            </a>
            <a
              href="#safety"
              className="text-sm font-medium text-fg/70 hover:text-fg transition-colors"
            >
              Safety
            </a>
            <a
              href="#get-started"
              className="text-sm font-medium text-fg/70 hover:text-fg transition-colors"
            >
              Get started
            </a>
            <Link
              href="/docs"
              className="text-sm font-medium text-fg/70 hover:text-fg transition-colors"
            >
              Docs
            </Link>
            <a
              href="https://github.com/DikshantJangra/BlazeResolver/discussions"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-fg/70 hover:text-fg transition-colors"
            >
              Community
            </a>
            <ThemeToggle className="ml-1" />
            <a
              href="https://github.com/DikshantJangra/BlazeResolver"
              target="_blank"
              rel="noopener noreferrer"
              className="ds-btn-secondary ds-btn-xs flex items-center gap-1.5"
            >
              <FaGithub className="w-3.5 h-3.5" />
              <span>GitHub</span>
            </a>
          </div>

          {/* Mobile: theme toggle + hamburger */}
          <div className="md:hidden flex items-center gap-1">
            <ThemeToggle />
            <button
              type="button"
              aria-label="Open mobile menu"
              onClick={() => setMobileMenuOpen(true)}
              className="flex items-center justify-center w-10 h-10 text-ds-primary cursor-pointer"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path
                  d="M3 6h18M3 12h18M3 18h18"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      <div className={`ds-mobile-menu ${mobileMenuOpen ? "is-open" : ""}`}>
        <div className="ds-mobile-menu-header">
          <Link
            className="flex items-center gap-2.5"
            href="/"
            onClick={() => setMobileMenuOpen(false)}
          >
            <img
              src={asset("/blazyy.svg")}
              alt="BlazeResolver"
              className="w-8 h-8 rounded-lg object-contain"
            />
            <span className="font-bold text-lg text-fg font-ds-display">
              Blaze<span className="text-brand">Resolver</span>
            </span>
          </Link>
          <button
            type="button"
            aria-label="Close mobile menu"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center justify-center w-10 h-10 text-ds-primary cursor-pointer"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M6 6l12 12M6 18L18 6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <nav className="ds-mobile-menu-body">
          <a
            href="#how-it-works"
            onClick={() => setMobileMenuOpen(false)}
            className="ds-mobile-menu-item"
          >
            How it works
          </a>
          <a
            href="#safety"
            onClick={() => setMobileMenuOpen(false)}
            className="ds-mobile-menu-item"
          >
            Safety
          </a>
          <a
            href="#get-started"
            onClick={() => setMobileMenuOpen(false)}
            className="ds-mobile-menu-item"
          >
            Get started
          </a>
          <Link
            href="/docs"
            className="ds-mobile-menu-item"
          >
            Documentation
          </Link>
          <a
            href="https://github.com/DikshantJangra/BlazeResolver/discussions"
            target="_blank"
            rel="noopener noreferrer"
            className="ds-mobile-menu-item"
          >
            Community Discussions
          </a>
          <a
            href="https://github.com/DikshantJangra/BlazeResolver"
            target="_blank"
            rel="noopener noreferrer"
            className="ds-mobile-menu-item text-brand"
          >
            View on GitHub
          </a>
        </nav>
      </div>
    </>
  );
}
