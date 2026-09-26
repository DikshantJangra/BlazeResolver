"use client";

import React, { useState, useEffect } from "react";

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
          style={{ maxWidth: "1280px", paddingLeft: "0px", paddingRight: "0px" }}
        >
          {/* Logo & Brand */}
          <a
            className="flex items-center gap-[10px] min-w-0"
            href="/"
          >
            <span className="shrink-0 inline-flex items-center gap-2.5">
              <img
                src="/blazyy.png"
                alt="BlazeResolver"
                className="w-8 h-8 rounded-lg object-contain shadow-md"
              />
              <span className="font-bold text-xl tracking-tight text-white font-ds-display">
                Blaze<span className="text-[#FF6B00]">Resolver</span>
              </span>
            </span>

            {/* Gradient border badge */}
            <span className="inline-flex items-start gap-[5px] min-w-0 ml-1">
              <span className="shrink-0 inline-flex">
                <span
                  className="inline-flex items-center rounded-[8px] p-[1px] min-w-0 max-w-full"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0.08) 35%, rgba(255,255,255,0.04) 65%, rgba(255,255,255,0.5) 100%)",
                    boxShadow:
                      "0 0 16px rgba(255,255,255,0.08), 0 0 32px rgba(255,255,255,0.04)",
                  }}
                >
                  <span className="min-w-0 truncate pt-[4px] pb-[3px] rounded-[7px] font-mono text-[11px] font-medium leading-none px-[9px] bg-black/25 text-white/95">
                    Harness
                  </span>
                </span>
              </span>
            </span>
          </a>

          {/* Desktop Right navigation */}
          <div className="hidden md:flex items-center gap-ds-4">
            <a
              href="https://github.com/DikshantJangra/BlazeResolver"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-white/70 hover:text-white transition-colors"
            >
              GitHub
            </a>
            <a
              href="https://github.com/DikshantJangra/BlazeResolver#readme"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-white/70 hover:text-white transition-colors"
            >
              Docs
            </a>
            <div className="ml-ds-1">
              <div className="ds-locale-toggle">
                <button type="button" className="ds-locale-toggle-item cursor-pointer">
                  中文
                </button>
                <button
                  type="button"
                  className="ds-locale-toggle-item is-active cursor-pointer"
                >
                  EN
                </button>
              </div>
            </div>
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            aria-label="Open mobile menu"
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden flex items-center justify-center w-10 h-10 text-ds-primary cursor-pointer"
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

      {/* Mobile Drawer */}
      <div className={`ds-mobile-menu ${mobileMenuOpen ? "is-open" : ""}`}>
        <div className="ds-mobile-menu-header">
          <a className="flex items-center gap-2.5" href="/">
            <img src="/blazyy.png" alt="BlazeResolver" className="w-8 h-8 rounded-lg object-contain" />
            <span className="font-bold text-lg text-white font-ds-display">
              Blaze<span className="text-[#FF6B00]">Resolver</span>
            </span>
          </a>
          <button
            type="button"
            aria-label="Close mobile menu"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center justify-center w-10 h-10 text-ds-primary cursor-pointer"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <nav className="ds-mobile-menu-body">
          <a
            href="https://github.com/DikshantJangra/BlazeResolver"
            target="_blank"
            rel="noopener noreferrer"
            className="ds-mobile-menu-item"
          >
            GitHub
          </a>
          <a
            href="https://github.com/DikshantJangra/BlazeResolver#readme"
            target="_blank"
            rel="noopener noreferrer"
            className="ds-mobile-menu-item"
          >
            Developer docs
          </a>
          <a
            href="https://github.com/DikshantJangra/BlazeResolver"
            target="_blank"
            rel="noopener noreferrer"
            className="ds-mobile-menu-item"
          >
            Community plugins
          </a>
        </nav>
        <div className="flex py-ds-4 pl-ds-5">
          <div className="ds-locale-toggle">
            <button type="button" className="ds-locale-toggle-item">
              中文
            </button>
            <button type="button" className="ds-locale-toggle-item is-active">
              EN
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
