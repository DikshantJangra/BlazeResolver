"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  HiOutlineFire,
  HiOutlineCheck,
  HiOutlineClipboard,
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
  FiExternalLink,
  FiCheckCircle,
  FiAlertTriangle,
  FiClock,
  FiCheck,
} from "react-icons/fi";
import { SiGithub } from "react-icons/si";

export default function MarketingPage() {
  const [heroTab, setHeroTab] = useState<"cli" | "npm" | "ecom">("cli");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    <div data-theme="dark" className="relative w-full bg-[#0b0c0e] min-h-screen text-[#e6e8ea]">
      {/* Background radial ambient glow */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-[20%] left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-gradient-to-b from-[#ff5722]/10 via-[#4d6bfe]/10 to-transparent blur-[120px] rounded-full" />
        <div className="absolute top-[40%] -right-[10%] w-[500px] h-[400px] bg-[#4d6bfe]/5 blur-[140px] rounded-full" />
      </div>

      {/* FIXED HEADER */}
      <header className="ds-header-wrapper">
        <div
          className={`ds-header-bar ${isScrolled ? "is-scrolled" : ""}`}
          style={{ maxWidth: "1280px", paddingLeft: "16px", paddingRight: "16px" }}
        >
          {/* Brand */}
          <a
            href="/"
            className="flex items-center gap-2.5 min-w-0 font-medium tracking-tight text-white hover:opacity-90 transition-opacity"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#ff5722] to-[#ff9800] flex items-center justify-center text-white shadow-sm">
              <HiOutlineFire className="w-5 h-5" />
            </div>
            <span className="font-semibold text-lg text-white font-ds-display">
              Blaze<span className="text-[#ff7849]">Resolver</span>
            </span>
            <span className="hidden sm:inline-flex items-center text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-white/10 text-white/80 border border-white/10">
              v1.0 Core
            </span>
          </a>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6 text-[14px] text-white/70">
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
              Fin vs Decagon
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

          {/* Action CTAs */}
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

            {/* Mobile menu button */}
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
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#ff5722] to-[#ff9800] flex items-center justify-center text-white">
              <HiOutlineFire className="w-5 h-5" />
            </div>
            <span className="font-semibold text-lg text-white font-ds-display">
              Blaze<span className="text-[#ff7849]">Resolver</span>
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
            Pipeline Architecture
          </a>
          <a
            href="#features"
            onClick={() => setMobileMenuOpen(false)}
            className="ds-mobile-menu-item"
          >
            Core Features
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
            Compared to Fin / Decagon
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
            className="ds-mobile-menu-item text-[#ff7849]"
          >
            View on GitHub →
          </a>
        </div>
      </div>

      {/* HERO SECTION */}
      <section className="relative z-10 pt-[130px] md:pt-[160px] pb-16 ds-container">
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.06] border border-white/10 text-[13px] font-medium text-white/90 mb-6 backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-[#ff5722] animate-pulse" />
            <span>Open-Source Autonomous Customer Support Resolution Harness</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight text-white leading-[1.12] mb-6 font-ds-display">
            Autonomous customer service that{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff7849] via-[#ffa726] to-[#4d6bfe]">
              actually resolves
            </span>
            .
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg md:text-xl text-white/70 max-w-2xl leading-relaxed mb-10 font-ds-sans">
            Triage complaints, correlate real-time operational telemetry, enforce policy-gated
            refunds, and talk over live voice. Like Intercom Fin or Decagon — but completely
            open-source, self-hosted, and adapter-driven.
          </p>

          {/* Interactive Hero Code Switcher */}
          <div className="w-full max-w-xl mx-auto mb-14 text-left">
            <div className="flex gap-1.5 ml-2 relative z-10">
              <button
                type="button"
                onClick={() => setHeroTab("cli")}
                className={`px-4 py-2 text-[13px] font-medium rounded-t-lg transition-all cursor-pointer border border-b-0 ${
                  heroTab === "cli"
                    ? "text-white bg-[#14171d] border-white/10 shadow-sm"
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
                    ? "text-white bg-[#14171d] border-white/10 shadow-sm"
                    : "text-white/50 hover:text-white/80 bg-transparent border-transparent"
                }`}
              >
                Install Package
              </button>
              <button
                type="button"
                onClick={() => setHeroTab("ecom")}
                className={`px-4 py-2 text-[13px] font-medium rounded-t-lg transition-all cursor-pointer border border-b-0 ${
                  heroTab === "ecom"
                    ? "text-white bg-[#14171d] border-white/10 shadow-sm"
                    : "text-white/50 hover:text-white/80 bg-transparent border-transparent"
                }`}
              >
                E-Commerce Profile
              </button>
            </div>

            <div className="rounded-xl border border-white/10 bg-[#14171d] overflow-hidden -mt-px shadow-2xl">
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
                <span className="select-none text-[#ff7849] mr-2">$</span>
                <span>{heroCodeMap[heroTab]}</span>
              </div>
            </div>
          </div>

          {/* REAL RESOLUTION TRACE PREVIEW CARD */}
          <div className="w-full max-w-4xl mx-auto rounded-2xl border border-white/10 bg-gradient-to-b from-[#141820] to-[#0f1117] p-5 sm:p-8 text-left shadow-2xl relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-white/10 gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-[#ff5722]/20 text-[#ff7849] border border-[#ff5722]/30 uppercase font-semibold">
                    Live Incident Trace #RES-9481
                  </span>
                  <span className="text-xs text-white/40 font-mono">Channel: Webhook + Voice</span>
                </div>
                <p className="text-sm text-white/90 mt-2 font-medium">
                  &ldquo;Biryani arrived 45m late and stone cold. Order #ord-8821. Want full refund
                  now.&rdquo;
                </p>
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
                    <FiCpu className="w-3.5 h-3.5 text-[#4d6bfe]" />
                  </div>
                  <div className="text-sm font-semibold text-white mb-1">Entity Extraction</div>
                  <p className="text-xs text-white/60 leading-relaxed">
                    Classified as <strong className="text-white">delivery_delay</strong> with HIGH
                    urgency. Extracted order <code className="text-[#ff7849]">#ord-8821</code> and claim{" "}
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
                    <FiActivity className="w-3.5 h-3.5 text-[#ff9800]" />
                  </div>
                  <div className="text-sm font-semibold text-white mb-1">Signal Source</div>
                  <p className="text-xs text-white/60 leading-relaxed">
                    KDS telemetry query confirmed <strong className="text-white">1.9x prep delay surge</strong>. 5
                    correlated reports clustered at Koramangala Hub.
                  </p>
                </div>
                <div className="mt-3 text-[11px] font-mono text-[#ff9800]">
                  Incident #INC-02 Active
                </div>
              </div>

              {/* Step 3 */}
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs text-white/50 mb-2 font-mono">
                    <span>03 / RESOLVE</span>
                    <FiShield className="w-3.5 h-3.5 text-[#ff5722]" />
                  </div>
                  <div className="text-sm font-semibold text-white mb-1">Money-Gate Policy</div>
                  <p className="text-xs text-white/60 leading-relaxed">
                    Amount &gt; ₹300 policy limit. Generated proposed action:{" "}
                    <strong className="text-white">Full refund (₹420) + 15% coupon</strong>.
                  </p>
                </div>
                <div className="mt-3 text-[11px] font-mono text-[#ff5722]">
                  HITL Review Attached
                </div>
              </div>

              {/* Step 4 */}
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs text-white/50 mb-2 font-mono">
                    <span>04 / RESPOND</span>
                    <FiMic className="w-3.5 h-3.5 text-[#28c840]" />
                  </div>
                  <div className="text-sm font-semibold text-white mb-1">Voice / Dispatch</div>
                  <p className="text-xs text-white/60 leading-relaxed">
                    1-Click approved by supervisor. Refund processed via gateway; Gemini Live spoken
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
          <span className="text-xs font-mono uppercase tracking-widest text-[#ff7849]">
            Architecture
          </span>
          <h2 className="text-3xl sm:text-4xl font-semibold text-white mt-3 mb-4 font-ds-display">
            The 4-Stage Resolution Pipeline
          </h2>
          <p className="text-white/60 text-base sm:text-lg leading-relaxed font-ds-sans">
            Generic, business-agnostic stages orchestrated with state machines and policy gates. Zero
            hallucinations, zero unsupported promises.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Stage 1 */}
          <div className="rounded-xl border border-white/10 bg-[#12151c] p-6 hover:border-white/20 transition-all">
            <div className="w-10 h-10 rounded-lg bg-[#4d6bfe]/10 border border-[#4d6bfe]/20 flex items-center justify-center text-[#4d6bfe] mb-5">
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
          <div className="rounded-xl border border-white/10 bg-[#12151c] p-6 hover:border-white/20 transition-all">
            <div className="w-10 h-10 rounded-lg bg-[#ff9800]/10 border border-[#ff9800]/20 flex items-center justify-center text-[#ff9800] mb-5">
              <FiActivity className="w-5 h-5" />
            </div>
            <span className="text-xs font-mono text-white/40">Stage 02</span>
            <h3 className="text-lg font-semibold text-white mt-1 mb-2 font-ds-display">
              Correlate Stage
            </h3>
            <p className="text-sm text-white/60 leading-relaxed">
              Cross-references ticket clusters with real physical signals (kitchen delays, warehouse
              dispatch lag, microservice 5xx spikes). Emits unified incident records.
            </p>
          </div>

          {/* Stage 3 */}
          <div className="rounded-xl border border-white/10 bg-[#12151c] p-6 hover:border-white/20 transition-all">
            <div className="w-10 h-10 rounded-lg bg-[#ff5722]/10 border border-[#ff5722]/20 flex items-center justify-center text-[#ff5722] mb-5">
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
          <div className="rounded-xl border border-white/10 bg-[#12151c] p-6 hover:border-white/20 transition-all">
            <div className="w-10 h-10 rounded-lg bg-[#28c840]/10 border border-[#28c840]/20 flex items-center justify-center text-[#28c840] mb-5">
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
          <span className="text-xs font-mono uppercase tracking-widest text-[#ff7849]">
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
                  ? "bg-[#141720] border-[#ff7849]/50 shadow-lg"
                  : "bg-[#101217] border-white/[0.06] hover:border-white/20"
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                    activeSlide === 0
                      ? "bg-[#ff5722] text-white"
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
                Plug into food delivery, electronics e-commerce, or SaaS. Specify your currency,
                spending limits, category rules, and telemetry sources in a single typed profile.
              </p>
            </div>

            {/* Card 1 */}
            <div
              ref={card1Ref}
              onClick={() => setActiveSlide(1)}
              className={`p-6 rounded-2xl border transition-all cursor-pointer ${
                activeSlide === 1
                  ? "bg-[#141720] border-[#ff7849]/50 shadow-lg"
                  : "bg-[#101217] border-white/[0.06] hover:border-white/20"
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                    activeSlide === 1
                      ? "bg-[#ff5722] text-white"
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
                  ? "bg-[#141720] border-[#ff7849]/50 shadow-lg"
                  : "bg-[#101217] border-white/[0.06] hover:border-white/20"
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                    activeSlide === 2
                      ? "bg-[#ff5722] text-white"
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
            <div className="aspect-[16/10] rounded-2xl border border-white/10 bg-[#12151c] p-6 shadow-2xl relative overflow-hidden flex flex-col justify-center">
              {/* Slide 0: Domain Profile Code */}
              <div
                className={`transition-opacity duration-500 absolute inset-6 flex flex-col ${
                  activeSlide === 0
                    ? "opacity-100 pointer-events-auto"
                    : "opacity-0 pointer-events-none"
                }`}
              >
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#ff5722]" />
                    <span className="text-xs font-mono text-white/60">
                      src/core/domain.ts — DomainProfile
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-[#28c840]">Type-safe contracts</span>
                </div>
                <pre className="mt-4 p-4 rounded-xl bg-[#0b0d12] border border-white/5 font-mono text-xs text-white/80 overflow-x-auto flex-1 leading-relaxed">
{`export const ECOMMERCE_PROFILE: DomainProfile = {
  id: "ecommerce-store",
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
  labels: {
    item: "product",
    resource: "warehouse",
    order: "order",
  },
};`}
                </pre>
              </div>

              {/* Slide 1: Telemetry Cluster */}
              <div
                className={`transition-opacity duration-500 absolute inset-6 flex flex-col ${
                  activeSlide === 1
                    ? "opacity-100 pointer-events-auto"
                    : "opacity-0 pointer-events-none"
                }`}
              >
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#ff9800]" />
                    <span className="text-xs font-mono text-white/60">
                      Telemetry Correlation Engine
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-[#ff9800]">5 Tickets Clustered</span>
                </div>
                <div className="mt-4 space-y-3 flex-1 flex flex-col justify-center">
                  <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-between">
                    <div>
                      <div className="text-xs text-white/50 font-mono">SIGNAL RATIO</div>
                      <div className="text-sm font-semibold text-white">
                        Dispatch Delay: 2.1x Baseline
                      </div>
                    </div>
                    <span className="text-xs text-[#ff5722] font-mono bg-[#ff5722]/10 px-2.5 py-1 rounded-full">
                      Bottleneck Detected
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-between">
                    <div>
                      <div className="text-xs text-white/50 font-mono">AUTOMATED ACTION</div>
                      <div className="text-sm font-semibold text-white">
                        AvailabilityControl.disableItem(&ldquo;dish-biryani-01&rdquo;)
                      </div>
                    </div>
                    <span className="text-xs text-[#28c840] font-mono bg-[#28c840]/10 px-2.5 py-1 rounded-full">
                      SKU Paused
                    </span>
                  </div>
                </div>
              </div>

              {/* Slide 2: Gemini Live Voice */}
              <div
                className={`transition-opacity duration-500 absolute inset-6 flex flex-col ${
                  activeSlide === 2
                    ? "opacity-100 pointer-events-auto"
                    : "opacity-0 pointer-events-none"
                }`}
              >
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#28c840]" />
                    <span className="text-xs font-mono text-white/60">
                      Gemini Multimodal Live API — PCM Stream
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-[#28c840]">WebSocket 24kHz</span>
                </div>
                <div className="mt-4 space-y-3 flex-1 flex flex-col justify-center">
                  <div className="p-3.5 rounded-xl bg-[#0b0d12] border border-white/10 font-mono text-xs">
                    <div className="text-white/40 mb-1">// Spoken stream to customer</div>
                    <div className="text-[#28c840]">
                      &ldquo;I see your biryani order #ord-8821 was delayed by 45 minutes due to a
                      kitchen bottleneck. I have credited ₹420 back to your card.&rdquo;
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between text-xs font-mono">
                    <span className="text-white/60">Tool called: process_refund</span>
                    <span className="text-[#28c840]">status: approved</span>
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
          <span className="text-xs font-mono uppercase tracking-widest text-[#ff7849]">
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
                <th className="py-4 px-6 font-semibold text-[#ff7849]">BLAZERESOLVER</th>
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
          <span className="text-xs font-mono uppercase tracking-widest text-[#ff7849]">
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
          <div className="p-6 rounded-xl border border-white/10 bg-[#12151c]">
            <div className="w-8 h-8 rounded-lg bg-[#4d6bfe]/10 flex items-center justify-center text-[#4d6bfe] mb-4">
              <FiDatabase className="w-4 h-4" />
            </div>
            <h3 className="text-base font-semibold text-white mb-2 font-mono">OrderSource</h3>
            <p className="text-xs text-white/60 leading-relaxed">
              Fetches order history, line items, recipient details, and payment receipts from your
              database or commerce API.
            </p>
          </div>

          <div className="p-6 rounded-xl border border-white/10 bg-[#12151c]">
            <div className="w-8 h-8 rounded-lg bg-[#28c840]/10 flex items-center justify-center text-[#28c840] mb-4">
              <FiShield className="w-4 h-4" />
            </div>
            <h3 className="text-base font-semibold text-white mb-2 font-mono">RefundGateway</h3>
            <p className="text-xs text-white/60 leading-relaxed">
              Issues refunds, credits, and vouchers idempotently with payment provider integration
              (Stripe, Razorpay, or internal ledger).
            </p>
          </div>

          <div className="p-6 rounded-xl border border-white/10 bg-[#12151c]">
            <div className="w-8 h-8 rounded-lg bg-[#ff9800]/10 flex items-center justify-center text-[#ff9800] mb-4">
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
          <span className="text-xs font-mono uppercase tracking-widest text-[#ff7849]">
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
          <div className="p-7 rounded-2xl border border-white/10 bg-[#141720] flex flex-col justify-between">
            <div>
              <span className="text-xs font-mono text-[#ff7849] uppercase">Option 01</span>
              <h3 className="text-xl font-semibold text-white mt-1 mb-2 font-ds-display">
                Try the Interactive CLI Demo
              </h3>
              <p className="text-sm text-white/60 leading-relaxed mb-6">
                Simulate cold food complaints, warehouse delays, money-gate triggers, and supervisor
                HITL approvals in terminal.
              </p>
            </div>
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#0b0c0e] border border-white/10 font-mono text-xs text-white">
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
          <div className="p-7 rounded-2xl border border-white/10 bg-[#141720] flex flex-col justify-between">
            <div>
              <span className="text-xs font-mono text-[#4d6bfe] uppercase">Option 02</span>
              <h3 className="text-xl font-semibold text-white mt-1 mb-2 font-ds-display">
                Install Core Engine
              </h3>
              <p className="text-sm text-white/60 leading-relaxed mb-6">
                Mount into your Node.js or Next.js backend. Connect custom adapters and run the
                triage-resolve pipeline.
              </p>
            </div>
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#0b0c0e] border border-white/10 font-mono text-xs text-white">
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
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[#ff5722] flex items-center justify-center text-white">
              <HiOutlineFire className="w-4 h-4" />
            </div>
            <span className="font-semibold text-white font-ds-display">BlazeResolver</span>
            <span>— Open-Source Autonomous Customer Service Harness</span>
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
