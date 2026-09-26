"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import {
  HiOutlineClipboard,
  HiOutlineCheck,
  HiOutlineArrowRight,
  HiOutlineMenu,
  HiOutlineX,
} from "react-icons/hi";
import {
  FiCpu,
  FiActivity,
  FiShield,
  FiMic,
  FiLayers,
  FiDatabase,
  FiCheckCircle,
  FiAlertTriangle,
  FiCheck,
  FiCode,
  FiClock,
  FiTerminal,
  FiVolume2,
  FiSliders,
} from "react-icons/fi";
import { SiGithub } from "react-icons/si";

export default function MarketingPage() {
  const [heroTab, setHeroTab] = useState<"cli" | "npm" | "ecom">("cli");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profilePreviewType, setProfilePreviewType] = useState<"restaurant" | "ecommerce">("restaurant");

  const card0Ref = useRef<HTMLDivElement>(null);
  const card1Ref = useRef<HTMLDivElement>(null);
  const card2Ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const cards = [card0Ref.current, card1Ref.current, card2Ref.current];
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = cards.indexOf(entry.target as HTMLDivElement);
            if (idx !== -1) {
              setActiveSlide(idx);
            }
          }
        });
      },
      { threshold: 0.5 }
    );

    cards.forEach((card) => {
      if (card) observer.observe(card);
    });

    return () => observer.disconnect();
  }, []);

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (e) {
      console.error("Clipboard copy failed", e);
    }
  };

  const heroCodeMap = {
    cli: "npx blazeresolver demo --restaurant",
    npm: "npm install @blazeresolver/core",
    ecom: "npm run demo -- ecommerce",
  };

  return (
    <div data-theme="dark" className="relative w-full bg-[#0B0C0E] min-h-screen text-[#E6E8EA] font-ds-sans overflow-x-hidden">
      {/* Dynamic Ambient Glows extracted from Blazyy (Blaze Orange #FF6B00 + Cobalt Blue #0055FF) */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-[25%] left-1/2 -translate-x-1/2 w-[1000px] h-[550px] bg-gradient-to-b from-[#FF6B00]/15 via-[#0055FF]/10 to-transparent blur-[140px] rounded-full" />
        <div className="absolute top-[35%] -right-[15%] w-[600px] h-[500px] bg-[#0055FF]/10 blur-[160px] rounded-full" />
        <div className="absolute top-[65%] -left-[15%] w-[600px] h-[500px] bg-[#FF6B00]/10 blur-[160px] rounded-full" />
      </div>

      {/* FLOATING HEADER */}
      <header className="ds-header-wrapper">
        <div
          className={`ds-header-bar ${isScrolled ? "is-scrolled" : ""}`}
          style={{ maxWidth: "1280px", paddingLeft: "20px", paddingRight: "20px" }}
        >
          {/* Logo with Mascot */}
          <a
            href="/"
            className="flex items-center gap-3 min-w-0 font-medium tracking-tight text-white hover:opacity-95 transition-opacity"
          >
            <div className="relative w-9 h-9 rounded-lg overflow-hidden bg-[#181B22] border border-white/10 flex items-center justify-center p-0.5">
              <Image
                src="/blazyy.png"
                alt="Blazyy Mascot"
                width={36}
                height={36}
                className="w-full h-full object-contain"
                priority
              />
            </div>
            <div className="flex items-baseline gap-1.5 font-ds-display">
              <span className="font-bold text-xl text-white tracking-tight">
                Blaze<span className="text-[#FF6B00]">Resolver</span>
              </span>
              <span className="hidden sm:inline-block text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#0055FF]/20 text-[#60A5FA] border border-[#0055FF]/30 font-medium">
                Autonomous Support
              </span>
            </div>
          </a>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-7 text-[14px] text-white/75 font-medium">
            <a href="#pipeline" className="hover:text-white transition-colors">
              Pipeline
            </a>
            <a href="#features" className="hover:text-white transition-colors">
              Features
            </a>
            <a href="#adapters" className="hover:text-white transition-colors">
              Adapters
            </a>
            <a href="#comparison" className="hover:text-white transition-colors">
              Vs Fin / Decagon
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

          {/* Action CTA */}
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/DikshantJangra/BlazeResolver"
              target="_blank"
              rel="noopener noreferrer"
              className="ds-btn-secondary ds-btn-s text-white"
            >
              <SiGithub className="w-4 h-4" />
              <span>GitHub</span>
            </a>

            {/* Mobile menu trigger */}
            <button
              type="button"
              aria-label="Open mobile menu"
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden flex items-center justify-center w-9 h-9 text-white/80 hover:text-white"
            >
              <HiOutlineMenu className="w-6 h-6" />
            </button>
          </div>
        </div>
      </header>

      {/* MOBILE MENU DRAWER */}
      <div className={`ds-mobile-menu ${mobileMenuOpen ? "is-open" : ""}`}>
        <div className="ds-mobile-menu-header">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg overflow-hidden bg-[#181B22] border border-white/10 p-0.5">
              <Image
                src="/blazyy.png"
                alt="Blazyy Mascot"
                width={32}
                height={32}
                className="w-full h-full object-contain"
              />
            </div>
            <span className="font-bold text-lg text-white font-ds-display">
              Blaze<span className="text-[#FF6B00]">Resolver</span>
            </span>
          </div>
          <button
            type="button"
            aria-label="Close mobile menu"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center justify-center w-10 h-10 text-white"
          >
            <HiOutlineX className="w-6 h-6" />
          </button>
        </div>
        <div className="ds-mobile-menu-body">
          <a
            href="#pipeline"
            onClick={() => setMobileMenuOpen(false)}
            className="ds-mobile-menu-item"
          >
            Resolution Pipeline
          </a>
          <a
            href="#features"
            onClick={() => setMobileMenuOpen(false)}
            className="ds-mobile-menu-item"
          >
            Core Capabilities
          </a>
          <a
            href="#adapters"
            onClick={() => setMobileMenuOpen(false)}
            className="ds-mobile-menu-item"
          >
            Adapter System
          </a>
          <a
            href="#comparison"
            onClick={() => setMobileMenuOpen(false)}
            className="ds-mobile-menu-item"
          >
            Vs Closed SaaS (Fin/Decagon)
          </a>
          <a
            href="https://github.com/DikshantJangra/BlazeResolver#readme"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setMobileMenuOpen(false)}
            className="ds-mobile-menu-item"
          >
            Documentation
          </a>
          <a
            href="https://github.com/DikshantJangra/BlazeResolver"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setMobileMenuOpen(false)}
            className="ds-mobile-menu-item text-[#FF6B00]"
          >
            View on GitHub →
          </a>
        </div>
      </div>

      {/* HERO SECTION */}
      <section className="relative z-10 pt-[135px] md:pt-[165px] pb-16 ds-container">
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/[0.05] border border-white/10 text-[13px] font-medium text-white/90 mb-6 backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-[#FF6B00] animate-pulse" />
            <span>Open-Source Autonomous Customer Support Resolution Harness</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight text-white leading-[1.12] mb-6 font-ds-display">
            Autonomous customer service that{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF6B00] via-[#FFA000] to-[#0055FF]">
              actually resolves
            </span>
            .
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg md:text-xl text-white/70 max-w-2xl leading-relaxed mb-10 font-ds-sans">
            Drop into your stack. BlazeResolver handles triage, correlates operational telemetry,
            enforces money-gate refund policies, and talks via real-time voice. Like Intercom Fin or
            Decagon — but open-source, self-hosted, and adapter-driven.
          </p>

          {/* Interactive Code Switcher */}
          <div className="w-full max-w-xl mx-auto mb-14 text-left">
            <div className="flex gap-1.5 ml-2 relative z-10">
              <button
                type="button"
                onClick={() => setHeroTab("cli")}
                className={`px-4 py-2 text-[13px] font-medium rounded-t-lg transition-all cursor-pointer border border-b-0 ${
                  heroTab === "cli"
                    ? "text-white bg-[#14171E] border-white/10 shadow-sm"
                    : "text-white/50 hover:text-white/80 bg-transparent border-transparent"
                }`}
              >
                CLI Interactive Demo
              </button>
              <button
                type="button"
                onClick={() => setHeroTab("npm")}
                className={`px-4 py-2 text-[13px] font-medium rounded-t-lg transition-all cursor-pointer border border-b-0 ${
                  heroTab === "npm"
                    ? "text-white bg-[#14171E] border-white/10 shadow-sm"
                    : "text-white/50 hover:text-white/80 bg-transparent border-transparent"
                }`}
              >
                Core Package
              </button>
              <button
                type="button"
                onClick={() => setHeroTab("ecom")}
                className={`px-4 py-2 text-[13px] font-medium rounded-t-lg transition-all cursor-pointer border border-b-0 ${
                  heroTab === "ecom"
                    ? "text-white bg-[#14171E] border-white/10 shadow-sm"
                    : "text-white/50 hover:text-white/80 bg-transparent border-transparent"
                }`}
              >
                E-Commerce Profile
              </button>
            </div>

            <div className="rounded-xl border border-white/10 bg-[#14171E] overflow-hidden -mt-px shadow-2xl">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#101217]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
                  <span className="text-[12px] font-mono text-white/40 ml-2">bash</span>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(heroCodeMap[heroTab], "hero")}
                  className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition-colors cursor-pointer"
                >
                  {copiedKey === "hero" ? (
                    <>
                      <HiOutlineCheck className="w-3.5 h-3.5 text-[#28c840]" />
                      <span className="text-[#28c840]">Copied!</span>
                    </>
                  ) : (
                    <>
                      <HiOutlineClipboard className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <div className="p-4 sm:p-5 font-mono text-sm leading-relaxed text-white">
                <span className="select-none text-[#FF6B00] mr-2">$</span>
                <span>{heroCodeMap[heroTab]}</span>
              </div>
            </div>
          </div>

          {/* REAL RESOLUTION TRACE PREVIEW CARD WITH BLAZYY MASCOT */}
          <div className="w-full max-w-4xl mx-auto rounded-2xl border border-white/10 bg-gradient-to-b from-[#141822] to-[#0E1015] p-6 sm:p-8 text-left shadow-2xl relative overflow-hidden">
            {/* Blazyy Mascot Avatar floating header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-white/10 gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#1C202B] border border-white/10 p-1 shrink-0 flex items-center justify-center">
                  <Image
                    src="/blazyy.png"
                    alt="Blazyy Assistant"
                    width={48}
                    height={48}
                    className="w-full h-full object-contain"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-[#FF6B00]/20 text-[#FF6B00] border border-[#FF6B00]/30 uppercase font-semibold">
                      Blazyy Resolution Trace #RES-9481
                    </span>
                    <span className="text-xs text-white/40 font-mono">Inbound Voice Stream</span>
                  </div>
                  <p className="text-sm text-white/95 mt-1.5 font-medium">
                    &ldquo;My biryani arrived 45m late and stone cold. Order #ord-8821. Want full refund
                    now.&rdquo;
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#28c840]/10 text-[#28c840] border border-[#28c840]/20 text-xs font-medium">
                  <FiCheckCircle className="w-3.5 h-3.5" />
                  Resolved in 420ms
                </span>
              </div>
            </div>

            {/* Step-by-Step Resolution Trace Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
              {/* Step 1 */}
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs text-white/50 mb-2 font-mono">
                    <span>01 / TRIAGE</span>
                    <FiCpu className="w-3.5 h-3.5 text-[#0055FF]" />
                  </div>
                  <div className="text-sm font-semibold text-white mb-1">Entity Extraction</div>
                  <p className="text-xs text-white/60 leading-relaxed">
                    Classified as <strong className="text-white">delivery_delay</strong> with HIGH
                    urgency. Extracted order <code className="text-[#FF6B00]">#ord-8821</code> and claim{" "}
                    <code className="text-white">₹420</code>.
                  </p>
                </div>
                <div className="mt-3 text-[11px] font-mono text-[#28c840]">
                  Confidence: 99.2%
                </div>
              </div>

              {/* Step 2 */}
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs text-white/50 mb-2 font-mono">
                    <span>02 / CORRELATE</span>
                    <FiActivity className="w-3.5 h-3.5 text-[#FFA000]" />
                  </div>
                  <div className="text-sm font-semibold text-white mb-1">Signal Source</div>
                  <p className="text-xs text-white/60 leading-relaxed">
                    KDS telemetry confirmed <strong className="text-white">1.9x prep delay surge</strong>. 5
                    correlated reports clustered at Koramangala Hub.
                  </p>
                </div>
                <div className="mt-3 text-[11px] font-mono text-[#FFA000]">
                  Incident #INC-02 Active
                </div>
              </div>

              {/* Step 3 */}
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs text-white/50 mb-2 font-mono">
                    <span>03 / RESOLVE</span>
                    <FiShield className="w-3.5 h-3.5 text-[#FF6B00]" />
                  </div>
                  <div className="text-sm font-semibold text-white mb-1">Money-Gate Policy</div>
                  <p className="text-xs text-white/60 leading-relaxed">
                    Amount &gt; ₹300 policy limit. Generated proposed action:{" "}
                    <strong className="text-white">Full refund (₹420) + 15% voucher</strong>.
                  </p>
                </div>
                <div className="mt-3 text-[11px] font-mono text-[#FF6B00]">
                  1-Click HITL Attached
                </div>
              </div>

              {/* Step 4 */}
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs text-white/50 mb-2 font-mono">
                    <span>04 / RESPOND</span>
                    <FiMic className="w-3.5 h-3.5 text-[#0055FF]" />
                  </div>
                  <div className="text-sm font-semibold text-white mb-1">Voice / Dispatch</div>
                  <p className="text-xs text-white/60 leading-relaxed">
                    Supervisor approved. Refund triggered via gateway; Gemini Live spoken
                    confirmation &amp; SMS receipt dispatched.
                  </p>
                </div>
                <div className="mt-3 text-[11px] font-mono text-[#28c840]">
                  Dispatched in 320ms
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* THE 4-STAGE PIPELINE SECTION */}
      <section id="pipeline" className="py-24 border-t border-white/[0.06] ds-container">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <span className="text-xs font-mono uppercase tracking-widest text-[#FF6B00]">
            Architecture
          </span>
          <h2 className="text-3xl sm:text-4xl font-semibold text-white mt-3 mb-4 font-ds-display">
            The 4-Stage Resolution Pipeline
          </h2>
          <p className="text-white/60 text-base sm:text-lg leading-relaxed font-ds-sans">
            Generic, business-agnostic stages orchestrated with state machines and policy gates. Zero
            hallucinations, zero unsupported refund commitments.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Stage 1 */}
          <div className="rounded-xl border border-white/10 bg-[#12151D] p-6 hover:border-[#0055FF]/40 transition-all">
            <div className="w-10 h-10 rounded-lg bg-[#0055FF]/10 border border-[#0055FF]/20 flex items-center justify-center text-[#0055FF] mb-5">
              <FiCpu className="w-5 h-5" />
            </div>
            <span className="text-xs font-mono text-white/40">Stage 01</span>
            <h3 className="text-lg font-semibold text-white mt-1 mb-2 font-ds-display">
              Triage Stage
            </h3>
            <p className="text-sm text-white/60 leading-relaxed">
              Extracts intent, urgency, sentiment, item and resource IDs, and claim amounts using
              domain-driven classification. Never assumes food or e-commerce defaults.
            </p>
          </div>

          {/* Stage 2 */}
          <div className="rounded-xl border border-white/10 bg-[#12151D] p-6 hover:border-[#FFA000]/40 transition-all">
            <div className="w-10 h-10 rounded-lg bg-[#FFA000]/10 border border-[#FFA000]/20 flex items-center justify-center text-[#FFA000] mb-5">
              <FiActivity className="w-5 h-5" />
            </div>
            <span className="text-xs font-mono text-white/40">Stage 02</span>
            <h3 className="text-lg font-semibold text-white mt-1 mb-2 font-ds-display">
              Correlate Stage
            </h3>
            <p className="text-sm text-white/60 leading-relaxed">
              Cross-references ticket clusters with real physical signals (kitchen delays, warehouse
              dispatch lag, microservice error spikes). Emits unified incident records.
            </p>
          </div>

          {/* Stage 3 */}
          <div className="rounded-xl border border-white/10 bg-[#12151D] p-6 hover:border-[#FF6B00]/40 transition-all">
            <div className="w-10 h-10 rounded-lg bg-[#FF6B00]/10 border border-[#FF6B00]/20 flex items-center justify-center text-[#FF6B00] mb-5">
              <FiShield className="w-5 h-5" />
            </div>
            <span className="text-xs font-mono text-white/40">Stage 03</span>
            <h3 className="text-lg font-semibold text-white mt-1 mb-2 font-ds-display">
              Resolve Stage
            </h3>
            <p className="text-sm text-white/60 leading-relaxed">
              Applies money-gate policies. Routine amounts auto-refund idempotently; high-value
              claims attach an actionable proposed action for 1-click human supervisor approval.
            </p>
          </div>

          {/* Stage 4 */}
          <div className="rounded-xl border border-white/10 bg-[#12151D] p-6 hover:border-[#0055FF]/40 transition-all">
            <div className="w-10 h-10 rounded-lg bg-[#0055FF]/10 border border-[#0055FF]/20 flex items-center justify-center text-[#0055FF] mb-5">
              <FiMic className="w-5 h-5" />
            </div>
            <span className="text-xs font-mono text-white/40">Stage 04</span>
            <h3 className="text-lg font-semibold text-white mt-1 mb-2 font-ds-display">
              Respond Stage
            </h3>
            <p className="text-sm text-white/60 leading-relaxed">
              Dispatches empathetic responses via Gemini Live bidirectional audio, WebSockets, or
              inbound REST webhooks. Final guardrail blocks unauthorized commitments.
            </p>
          </div>
        </div>
      </section>

      {/* CORE FEATURES & STICKY SLIDES */}
      <section id="features" className="py-24 border-t border-white/[0.06] ds-container">
        <div className="max-w-3xl mb-16">
          <span className="text-xs font-mono uppercase tracking-widest text-[#FF6B00]">
            Capabilities
          </span>
          <h2 className="text-3xl sm:text-4xl font-semibold text-white mt-3 mb-4 font-ds-display">
            Built for production support operations
          </h2>
          <p className="text-white/60 text-base sm:text-lg leading-relaxed font-ds-sans">
            Engineered from real operational incidents, not generic prompt wrappers.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Left Cards */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            {/* Card 0 */}
            <div
              ref={card0Ref}
              onClick={() => setActiveSlide(0)}
              className={`p-6 rounded-2xl border transition-all cursor-pointer ${
                activeSlide === 0
                  ? "bg-[#141722] border-[#FF6B00]/60 shadow-lg"
                  : "bg-[#101217] border-white/[0.06] hover:border-white/20"
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                    activeSlide === 0
                      ? "bg-[#FF6B00] text-white"
                      : "bg-white/10 text-white/60"
                  }`}
                >
                  <FiLayers className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-semibold text-white font-ds-display">
                  Business-Agnostic Domain Profiles
                </h3>
              </div>
              <p className="text-sm text-white/60 leading-relaxed">
                Plug into restaurants, electronics e-commerce, or SaaS. Specify currency symbols,
                spending limits, category rules, and telemetry sources in a single typed profile.
              </p>
            </div>

            {/* Card 1 */}
            <div
              ref={card1Ref}
              onClick={() => setActiveSlide(1)}
              className={`p-6 rounded-2xl border transition-all cursor-pointer ${
                activeSlide === 1
                  ? "bg-[#141722] border-[#FF6B00]/60 shadow-lg"
                  : "bg-[#101217] border-white/[0.06] hover:border-white/20"
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                    activeSlide === 1
                      ? "bg-[#FF6B00] text-white"
                      : "bg-white/10 text-white/60"
                  }`}
                >
                  <FiActivity className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-semibold text-white font-ds-display">
                  Operational Telemetry &amp; SKU Control
                </h3>
              </div>
              <p className="text-sm text-white/60 leading-relaxed">
                Don&apos;t just apologize—resolve the root cause. Clustered complaints automatically
                trigger item availability controls, pausing defective products or delayed branches.
              </p>
            </div>

            {/* Card 2 */}
            <div
              ref={card2Ref}
              onClick={() => setActiveSlide(2)}
              className={`p-6 rounded-2xl border transition-all cursor-pointer ${
                activeSlide === 2
                  ? "bg-[#141722] border-[#FF6B00]/60 shadow-lg"
                  : "bg-[#101217] border-white/[0.06] hover:border-white/20"
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                    activeSlide === 2
                      ? "bg-[#FF6B00] text-white"
                      : "bg-white/10 text-white/60"
                  }`}
                >
                  <FiMic className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-semibold text-white font-ds-display">
                  Bidirectional Voice via Gemini Live
                </h3>
              </div>
              <p className="text-sm text-white/60 leading-relaxed">
                Real-time sub-second streaming audio over WebSockets. Voice tools invoke
                lookup_order, process_refund, and escalate_to_human directly during conversation.
              </p>
            </div>
          </div>

          {/* Right Sticky Preview Container */}
          <div className="lg:col-span-7 sticky top-28">
            <div className="aspect-[16/10] rounded-2xl border border-white/10 bg-[#12151E] p-6 shadow-2xl relative overflow-hidden flex flex-col justify-center">
              {/* Slide 0: Domain Profile Code Explorer */}
              <div
                className={`transition-opacity duration-500 absolute inset-6 flex flex-col ${
                  activeSlide === 0
                    ? "opacity-100 pointer-events-auto"
                    : "opacity-0 pointer-events-none"
                }`}
              >
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#FF6B00]" />
                    <span className="text-xs font-mono text-white/70">
                      src/core/domain.ts — DomainProfile Explorer
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setProfilePreviewType("restaurant")}
                      className={`text-[11px] font-mono px-2.5 py-0.5 rounded transition-colors ${
                        profilePreviewType === "restaurant"
                          ? "bg-[#FF6B00] text-white"
                          : "bg-white/10 text-white/50 hover:text-white"
                      }`}
                    >
                      Restaurant (₹)
                    </button>
                    <button
                      type="button"
                      onClick={() => setProfilePreviewType("ecommerce")}
                      className={`text-[11px] font-mono px-2.5 py-0.5 rounded transition-colors ${
                        profilePreviewType === "ecommerce"
                          ? "bg-[#0055FF] text-white"
                          : "bg-white/10 text-white/50 hover:text-white"
                      }`}
                    >
                      E-Commerce ($)
                    </button>
                  </div>
                </div>
                <pre className="mt-4 p-4 rounded-xl bg-[#090B0E] border border-white/5 font-mono text-xs text-white/85 overflow-x-auto flex-1 leading-relaxed">
{profilePreviewType === "restaurant"
  ? `export const RESTAURANT_PROFILE: DomainProfile = {
  id: "blazeeats-kitchen",
  businessType: "food_delivery",
  currency: { symbol: "₹", code: "INR" },
  limits: {
    maxAutoRefund: 300,
    maxVoucher: 100,
  },
  categories: [
    { id: "delivery_delay", autoApproveLimit: 250 },
    { id: "cold_food", autoApproveLimit: 300 },
  ],
  labels: { item: "dish", resource: "branch", order: "order" },
};`
  : `export const ECOMMERCE_PROFILE: DomainProfile = {
  id: "blazegear-store",
  businessType: "retail_goods",
  currency: { symbol: "$", code: "USD" },
  limits: {
    maxAutoRefund: 100,
    maxVoucher: 25,
  },
  categories: [
    { id: "damaged_goods", autoApproveLimit: 50 },
    { id: "shipping_delay", autoApproveLimit: 100 },
  ],
  labels: { item: "product", resource: "warehouse", order: "order" },
};`}
                </pre>
              </div>

              {/* Slide 1: Telemetry Cluster & Availability Control */}
              <div
                className={`transition-opacity duration-500 absolute inset-6 flex flex-col ${
                  activeSlide === 1
                    ? "opacity-100 pointer-events-auto"
                    : "opacity-0 pointer-events-none"
                }`}
              >
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#FFA000]" />
                    <span className="text-xs font-mono text-white/70">
                      Telemetry Correlation &amp; SKU Circuit-Breaker
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-[#FFA000]">5 Tickets Clustered</span>
                </div>
                <div className="mt-4 space-y-3 flex-1 flex flex-col justify-center">
                  <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-between">
                    <div>
                      <div className="text-xs text-white/50 font-mono">TELEMETRY SIGNAL SOURCE</div>
                      <div className="text-sm font-semibold text-white">
                        Dispatch Delay Ratio: 2.1x Baseline
                      </div>
                    </div>
                    <span className="text-xs text-[#FF6B00] font-mono bg-[#FF6B00]/15 px-2.5 py-1 rounded-full">
                      Bottleneck Verified
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-between">
                    <div>
                      <div className="text-xs text-white/50 font-mono">AUTOMATED CIRCUIT-BREAKER</div>
                      <div className="text-sm font-semibold text-white">
                        AvailabilityControl.disableItem(&ldquo;dish-biryani-01&rdquo;)
                      </div>
                    </div>
                    <span className="text-xs text-[#28c840] font-mono bg-[#28c840]/15 px-2.5 py-1 rounded-full">
                      SKU Paused
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-between">
                    <div>
                      <div className="text-xs text-white/50 font-mono">BATCH MITIGATION</div>
                      <div className="text-sm font-semibold text-white">
                        5 Pending orders compensated with ₹100 apology credit
                      </div>
                    </div>
                    <span className="text-xs text-[#0055FF] font-mono bg-[#0055FF]/15 px-2.5 py-1 rounded-full">
                      5 Dispatched
                    </span>
                  </div>
                </div>
              </div>

              {/* Slide 2: Gemini Live Voice Layer */}
              <div
                className={`transition-opacity duration-500 absolute inset-6 flex flex-col ${
                  activeSlide === 2
                    ? "opacity-100 pointer-events-auto"
                    : "opacity-0 pointer-events-none"
                }`}
              >
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#0055FF]" />
                    <span className="text-xs font-mono text-white/70">
                      Gemini Multimodal Live API — 24kHz Audio Stream
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-[#0055FF]">WebSocket Live</span>
                </div>
                <div className="mt-4 space-y-3 flex-1 flex flex-col justify-center">
                  <div className="p-3.5 rounded-xl bg-[#090B0E] border border-white/10 font-mono text-xs">
                    <div className="text-white/40 mb-1">// Real-time Audio Response from Blazyy</div>
                    <div className="text-[#0055FF]">
                      &ldquo;I reviewed your order #ord-8821. Because of kitchen delays, your biryani was
                      late. I have refunded ₹420 directly to your card.&rdquo;
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between text-xs font-mono">
                    <span className="text-white/60">Dispatched Tool: process_refund</span>
                    <span className="text-[#28c840]">status: approved (₹420)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* COMPARISON TABLE SECTION */}
      <section id="comparison" className="py-24 border-t border-white/[0.06] ds-container">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <span className="text-xs font-mono uppercase tracking-widest text-[#FF6B00]">
            Differentiation
          </span>
          <h2 className="text-3xl sm:text-4xl font-semibold text-white mt-3 mb-4 font-ds-display">
            How BlazeResolver Compares
          </h2>
          <p className="text-white/60 text-base sm:text-lg leading-relaxed font-ds-sans">
            Why teams choose an open-source, adapter-based harness over blackbox SaaS support bots.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-white/10 text-white/50 font-mono text-xs">
                <th className="py-4 px-6 font-medium">CAPABILITY</th>
                <th className="py-4 px-6 font-semibold text-[#FF6B00]">BLAZERESOLVER</th>
                <th className="py-4 px-6 font-medium text-white/70">INTERCOM FIN</th>
                <th className="py-4 px-6 font-medium text-white/70">DECAGON / SIERRA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06] text-white/80">
              <tr>
                <td className="py-4 px-6 font-medium text-white">License &amp; Ownership</td>
                <td className="py-4 px-6 text-[#28c840] font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <FiCheck className="w-4 h-4" /> Open-Source (MIT)
                  </span>
                </td>
                <td className="py-4 px-6 text-white/50">Proprietary SaaS ($0.99/res)</td>
                <td className="py-4 px-6 text-white/50">Enterprise Closed SaaS</td>
              </tr>
              <tr>
                <td className="py-4 px-6 font-medium text-white">Integration Model</td>
                <td className="py-4 px-6 text-[#28c840] font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <FiCheck className="w-4 h-4" /> Drop-in Typed Adapters
                  </span>
                </td>
                <td className="py-4 px-6 text-white/50">Intercom Ecosystem Lock-in</td>
                <td className="py-4 px-6 text-white/50">Custom Enterprise Services</td>
              </tr>
              <tr>
                <td className="py-4 px-6 font-medium text-white">Operational Telemetry</td>
                <td className="py-4 px-6 text-[#28c840] font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <FiCheck className="w-4 h-4" /> Real-Time SignalSource
                  </span>
                </td>
                <td className="py-4 px-6 text-white/50">KB Articles Only</td>
                <td className="py-4 px-6 text-white/50">API Webhooks Only</td>
              </tr>
              <tr>
                <td className="py-4 px-6 font-medium text-white">High-Value Money Gate</td>
                <td className="py-4 px-6 text-[#28c840] font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <FiCheck className="w-4 h-4" /> 1-Click Proposed Action HITL
                  </span>
                </td>
                <td className="py-4 px-6 text-white/50">Hand off to human queue</td>
                <td className="py-4 px-6 text-white/50">Configurable Guardrails</td>
              </tr>
              <tr>
                <td className="py-4 px-6 font-medium text-white">Bidirectional Live Voice</td>
                <td className="py-4 px-6 text-[#28c840] font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <FiCheck className="w-4 h-4" /> Gemini Live 24kHz Streaming
                  </span>
                </td>
                <td className="py-4 px-6 text-white/50">No Voice Layer</td>
                <td className="py-4 px-6 text-white/50">Enterprise Sierra Voice</td>
              </tr>
              <tr>
                <td className="py-4 px-6 font-medium text-white">Self-Hostable / On-Prem</td>
                <td className="py-4 px-6 text-[#28c840] font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <FiCheck className="w-4 h-4" /> Node.js / Docker
                  </span>
                </td>
                <td className="py-4 px-6 text-white/50">Cloud Only</td>
                <td className="py-4 px-6 text-white/50">Cloud Only</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ADAPTERS ARCHITECTURE SECTION */}
      <section id="adapters" className="py-24 border-t border-white/[0.06] ds-container">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <span className="text-xs font-mono uppercase tracking-widest text-[#FF6B00]">
            Extensibility
          </span>
          <h2 className="text-3xl sm:text-4xl font-semibold text-white mt-3 mb-4 font-ds-display">
            The 5 Standard Adapters
          </h2>
          <p className="text-white/60 text-base sm:text-lg leading-relaxed font-ds-sans">
            Implement simple TypeScript interfaces. BlazeResolver ships in-memory reference adapters
            out of the box.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-xl border border-white/10 bg-[#12151E]">
            <div className="w-8 h-8 rounded-lg bg-[#0055FF]/10 flex items-center justify-center text-[#0055FF] mb-4">
              <FiDatabase className="w-4 h-4" />
            </div>
            <h3 className="text-base font-semibold text-white mb-2 font-mono">OrderSource</h3>
            <p className="text-xs text-white/60 leading-relaxed">
              Fetches order history, line items, recipient details, and payment receipts from your
              database or commerce API.
            </p>
          </div>

          <div className="p-6 rounded-xl border border-white/10 bg-[#12151E]">
            <div className="w-8 h-8 rounded-lg bg-[#28c840]/10 flex items-center justify-center text-[#28c840] mb-4">
              <FiShield className="w-4 h-4" />
            </div>
            <h3 className="text-base font-semibold text-white mb-2 font-mono">RefundGateway</h3>
            <p className="text-xs text-white/60 leading-relaxed">
              Issues refunds, credits, and vouchers idempotently with payment provider integration
              (Stripe, Razorpay, or internal ledger).
            </p>
          </div>

          <div className="p-6 rounded-xl border border-white/10 bg-[#12151E]">
            <div className="w-8 h-8 rounded-lg bg-[#FFA000]/10 flex items-center justify-center text-[#FFA000] mb-4">
              <FiActivity className="w-4 h-4" />
            </div>
            <h3 className="text-base font-semibold text-white mb-2 font-mono">SignalSource</h3>
            <p className="text-xs text-white/60 leading-relaxed">
              Pulls live operational telemetry (KDS prep timing, warehouse dispatch stats, system
              error rates) to objectively substantiate customer claims.
            </p>
          </div>
        </div>
      </section>

      {/* QUICKSTART SECTION */}
      <section id="get-started" className="py-24 border-t border-white/[0.06] ds-container">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <span className="text-xs font-mono uppercase tracking-widest text-[#FF6B00]">
            Get Started
          </span>
          <h2 className="text-3xl sm:text-4xl font-semibold text-white mt-3 mb-4 font-ds-display">
            Ready to resolve in your stack?
          </h2>
          <p className="text-white/60 text-base sm:text-lg leading-relaxed font-ds-sans">
            Start with the interactive simulator or install the core package.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* Option 1 */}
          <div className="p-7 rounded-2xl border border-white/10 bg-[#141722] flex flex-col justify-between">
            <div>
              <span className="text-xs font-mono text-[#FF6B00] uppercase">Option 01</span>
              <h3 className="text-xl font-semibold text-white mt-1 mb-2 font-ds-display">
                Try the Interactive CLI Demo
              </h3>
              <p className="text-sm text-white/60 leading-relaxed mb-6">
                Simulate cold food complaints, warehouse delays, money-gate triggers, and supervisor
                HITL approvals in terminal.
              </p>
            </div>
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#090B0E] border border-white/10 font-mono text-xs text-white">
              <span>npx blazeresolver demo</span>
              <button
                type="button"
                onClick={() => copyToClipboard("npx blazeresolver demo", "opt1")}
                className="text-xs text-white/60 hover:text-white transition-colors cursor-pointer"
              >
                {copiedKey === "opt1" ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>

          {/* Option 2 */}
          <div className="p-7 rounded-2xl border border-white/10 bg-[#141722] flex flex-col justify-between">
            <div>
              <span className="text-xs font-mono text-[#0055FF] uppercase">Option 02</span>
              <h3 className="text-xl font-semibold text-white mt-1 mb-2 font-ds-display">
                Install Core Engine
              </h3>
              <p className="text-sm text-white/60 leading-relaxed mb-6">
                Mount into your Node.js or Next.js backend. Connect custom adapters and run the
                triage-resolve pipeline.
              </p>
            </div>
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#090B0E] border border-white/10 font-mono text-xs text-white">
              <span>npm install @blazeresolver/core</span>
              <button
                type="button"
                onClick={() => copyToClipboard("npm install @blazeresolver/core", "opt2")}
                className="text-xs text-white/60 hover:text-white transition-colors cursor-pointer"
              >
                {copiedKey === "opt2" ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-12 border-t border-white/[0.06] text-xs text-white/50 ds-container">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg overflow-hidden bg-[#181B22] border border-white/10 p-0.5">
              <Image
                src="/blazyy.png"
                alt="Blazyy Mascot"
                width={28}
                height={28}
                className="w-full h-full object-contain"
              />
            </div>
            <span className="font-semibold text-white font-ds-display">BlazeResolver</span>
            <span>— Open-Source Autonomous Customer Service Resolution Harness</span>
          </div>
          <div className="flex items-center gap-6">
            <a
              href="https://github.com/DikshantJangra/BlazeResolver"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              GitHub
            </a>
            <a
              href="https://github.com/DikshantJangra/BlazeResolver#readme"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              Documentation
            </a>
            <a
              href="https://github.com/DikshantJangra/BlazeResolver/blob/main/LICENSE"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              MIT License
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
