"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { FaGithub, FaStar } from "react-icons/fa6";
import { IoMenuOutline, IoCloseOutline } from "react-icons/io5";

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
      <header className="fixed top-0 left-0 right-0 z-50 mx-auto w-full px-4 sm:px-8 py-3 transition-all duration-300">
        <div
          className={`mx-auto max-w-[1240px] flex items-center justify-between px-4 sm:px-6 py-2.5 rounded-full transition-all duration-300 ${
            isScrolled
              ? "bg-[#101114]/80 backdrop-blur-xl border border-white/[0.08] shadow-lg shadow-black/20"
              : "bg-transparent border border-transparent"
          }`}
        >
          {/* Brand Logo */}
          <a href="/" className="flex items-center gap-3 group">
            <div className="relative w-8 h-8 rounded-lg overflow-hidden shrink-0 border border-white/10 group-hover:scale-105 transition-transform">
              <Image
                src="/blazyy.png"
                alt="BlazeResolver Mascot"
                fill
                sizes="32px"
                className="object-contain"
                priority
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xl tracking-tight text-white font-ds-display">
                Blaze<span className="text-[#FF6B00]">Resolver</span>
              </span>
              <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-medium tracking-wide uppercase bg-white/10 text-white/90 border border-white/10">
                Harness
              </span>
            </div>
          </a>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-neutral-300">
            <a
              href="#architecture"
              className="hover:text-white transition-colors"
            >
              Architecture
            </a>
            <a
              href="#traceability"
              className="hover:text-white transition-colors"
            >
              Traceability
            </a>
            <a
              href="#plugins"
              className="hover:text-white transition-colors"
            >
              Plugins
            </a>
            <a
              href="#quickstart"
              className="hover:text-white transition-colors"
            >
              Quickstart
            </a>
            <a
              href="https://github.com/DikshantJangra/BlazeResolver#readme"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              Docs
            </a>
          </nav>

          {/* Right Action Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <a
              href="https://github.com/DikshantJangra/BlazeResolver"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium text-white bg-white/10 hover:bg-white/15 border border-white/10 transition-all hover:scale-102"
            >
              <FaGithub className="text-sm" />
              <span>Star</span>
              <span className="flex items-center gap-1 text-[11px] text-neutral-400 pl-1 border-l border-white/10">
                <FaStar className="text-[10px] text-amber-400" />
                <span>Open Source</span>
              </span>
            </a>
            <div className="flex items-center rounded-full p-0.5 border border-white/10 bg-black/40 text-xs">
              <span className="px-2.5 py-1 rounded-full text-neutral-400 cursor-not-allowed">
                ZH
              </span>
              <span className="px-2.5 py-1 rounded-full bg-white/15 text-white font-medium shadow-sm">
                EN
              </span>
            </div>
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            aria-label="Toggle mobile menu"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden flex items-center justify-center w-10 h-10 rounded-full text-neutral-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            {mobileMenuOpen ? (
              <IoCloseOutline className="text-2xl" />
            ) : (
              <IoMenuOutline className="text-2xl" />
            )}
          </button>
        </div>
      </header>

      {/* Mobile Drawer Menu */}
      <div
        className={`fixed inset-0 z-40 bg-[#0a0b0d]/95 backdrop-blur-2xl flex flex-col pt-24 px-6 pb-8 transition-all duration-300 md:hidden ${
          mobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex flex-col gap-4 text-lg font-medium text-neutral-200">
          <a
            href="#architecture"
            onClick={() => setMobileMenuOpen(false)}
            className="py-3 border-b border-white/10 hover:text-[#FF6B00] transition-colors"
          >
            Architecture
          </a>
          <a
            href="#traceability"
            onClick={() => setMobileMenuOpen(false)}
            className="py-3 border-b border-white/10 hover:text-[#FF6B00] transition-colors"
          >
            Traceability & Trajectory
          </a>
          <a
            href="#plugins"
            onClick={() => setMobileMenuOpen(false)}
            className="py-3 border-b border-white/10 hover:text-[#FF6B00] transition-colors"
          >
            Extensible Plugins
          </a>
          <a
            href="#quickstart"
            onClick={() => setMobileMenuOpen(false)}
            className="py-3 border-b border-white/10 hover:text-[#FF6B00] transition-colors"
          >
            Quickstart Installation
          </a>
          <a
            href="https://github.com/DikshantJangra/BlazeResolver#readme"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setMobileMenuOpen(false)}
            className="py-3 border-b border-white/10 hover:text-[#FF6B00] transition-colors"
          >
            Documentation
          </a>
        </div>

        <div className="mt-auto pt-6 flex flex-col gap-4">
          <a
            href="https://github.com/DikshantJangra/BlazeResolver"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-full text-sm font-semibold text-white bg-[#FF6B00] hover:bg-[#e05e00] transition-colors shadow-none"
          >
            <FaGithub className="text-base" />
            <span>GitHub Repository</span>
          </a>
          <div className="flex justify-center items-center rounded-full p-1 border border-white/10 bg-black/40 text-xs w-fit mx-auto">
            <span className="px-3 py-1 rounded-full text-neutral-400">ZH</span>
            <span className="px-3 py-1 rounded-full bg-white/20 text-white font-medium">EN</span>
          </div>
        </div>
      </div>
    </>
  );
}
