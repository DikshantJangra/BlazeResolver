"use client";

import React, { useState } from "react";

export default function HeroSection() {
  const [heroTab, setHeroTab] = useState<"quickstart" | "source">("quickstart");
  const [heroCopied, setHeroCopied] = useState(false);

  const copyHero = async () => {
    const text =
      heroTab === "quickstart"
        ? "npx blazeresolver demo --restaurant"
        : "git clone https://github.com/DikshantJangra/BlazeResolver";
    try {
      await navigator.clipboard.writeText(text);
      setHeroCopied(true);
      setTimeout(() => setHeroCopied(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <section className="relative flex flex-col items-center justify-center w-full min-h-[92vh] pt-[140px] pb-ds-11 overflow-hidden">
      {/* Ambient background glow & radial gradient */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[750px] h-[750px] rounded-full blur-[160px] opacity-20"
          style={{
            background:
              "radial-gradient(circle, #FF6B00 0%, #0055FF 45%, transparent 70%)",
          }}
        />
      </div>

      {/* Hero Visual Orb (Screen mix-blend) centered behind content */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[2] hidden md:flex items-center justify-center pointer-events-none overflow-hidden opacity-35"
        style={{ mixBlendMode: "screen" }}
      >
        <div className="relative w-[650px] h-[650px] flex items-center justify-center">
          {/* Outer glowing aura */}
          <div className="absolute w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-[#FF6B00]/15 via-[#0055FF]/15 to-transparent blur-3xl animate-pulse" />

          {/* SVG Orbital Rings */}
          <svg
            className="w-full h-full text-white/30 animate-[spin_80s_linear_infinite]"
            viewBox="0 0 400 400"
            fill="none"
          >
            {/* Concentric rings */}
            <circle
              cx="200"
              cy="200"
              r="170"
              stroke="currentColor"
              strokeWidth="0.8"
              strokeDasharray="4 6"
              className="opacity-30"
            />
            <circle
              cx="200"
              cy="200"
              r="130"
              stroke="#FF6B00"
              strokeWidth="1"
              strokeDasharray="2 4"
              className="opacity-35"
            />
            <circle
              cx="200"
              cy="200"
              r="90"
              stroke="#0055FF"
              strokeWidth="1.2"
              className="opacity-45"
            />

            {/* Elliptical Orbits */}
            <ellipse
              cx="200"
              cy="200"
              rx="160"
              ry="70"
              stroke="currentColor"
              strokeWidth="1"
              className="opacity-30"
              transform="rotate(25 200 200)"
            />
            <ellipse
              cx="200"
              cy="200"
              rx="160"
              ry="70"
              stroke="currentColor"
              strokeWidth="1"
              className="opacity-30"
              transform="rotate(-35 200 200)"
            />

            {/* Orbiting Nodes */}
            <circle cx="200" cy="30" r="4.5" fill="#FF6B00" />
            <circle cx="370" cy="200" r="4" fill="#0055FF" />
            <circle cx="70" cy="200" r="3.5" fill="#ffffff" />
            <circle cx="200" cy="330" r="4.5" fill="#FF6B00" />
            <circle
              cx="200"
              cy="200"
              r="12"
              fill="#FF6B00"
              className="opacity-80"
            />
            <circle
              cx="200"
              cy="200"
              r="28"
              stroke="#FF6B00"
              strokeWidth="1.5"
              className="opacity-35"
            />
          </svg>
        </div>
      </div>

      {/* Main Centered Content */}
      <div className="relative z-10 ds-container flex flex-col items-center text-center max-w-[860px] mx-auto">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.06] border border-white/[0.1] backdrop-blur-md mb-ds-4">
          <span className="w-2 h-2 rounded-full bg-[#28c840] animate-pulse" />
          <p
            data-hero-preview-label="true"
            className="whitespace-nowrap font-ds-sans text-[13px] font-medium leading-none tracking-[-0.01em] text-white/90"
          >
            BlazeResolver developer preview
          </p>
        </div>

        {/* Headline */}
        <h1 className="ds-text-hero text-ds-primary !leading-[1.2] mb-ds-4">
          Everything is a plugin
        </h1>

        {/* Descriptions */}
        <div className="max-w-[680px] flex flex-col gap-ds-2 mb-ds-6">
          <p className="ds-text-body text-ds-description">
            BlazeResolver is now in developer preview for agent harness
            developers worldwide — source code included.
          </p>
          <p className="ds-text-body text-ds-description">
            Every capability is a plugin that can be swapped or recomposed:
            models, tools, skills, sessions, sandboxes, storage, loops,
            scheduling, and the UI.
          </p>
        </div>

        {/* 4 Liquid Buttons (Centered) */}
        <div className="flex flex-wrap items-center justify-center gap-3.5 mb-ds-8">
          <a
            className="ds-btn-primary ds-btn-m"
            href="https://github.com/DikshantJangra/BlazeResolver"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            View on GitHub
          </a>
          <a
            className="ds-btn-secondary ds-btn-m"
            href="https://github.com/DikshantJangra/BlazeResolver#readme"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
              <path
                d="M11.2426 4.75493V6.15532H4.75819V4.75493H11.2426Z"
                fill="currentColor"
              />
              <path
                d="M9.40858 7.79498V9.19537H4.75819V7.79498H9.40858Z"
                fill="currentColor"
              />
              <path
                d="M9.23437 0.590332C10.1936 0.590332 10.9696 0.589649 11.5889 0.656739C12.2212 0.725273 12.773 0.871816 13.2539 1.22119C13.5339 1.42469 13.7809 1.67064 13.9844 1.95068C14.3336 2.43146 14.4793 2.98356 14.5478 3.61572C14.6149 4.23495 14.6143 5.0112 14.6143 5.97022V10.0308C14.6143 10.9899 14.6149 11.766 14.5478 12.3853C14.4793 13.0174 14.3336 13.5696 13.9844 14.0503C13.7809 14.3303 13.534 14.5773 13.2539 14.7808C12.7731 15.1299 12.221 15.2757 11.5889 15.3442C10.9696 15.4113 10.1935 15.4106 9.23437 15.4106H6.76562C5.80648 15.4106 5.03039 15.4113 4.41113 15.3442C3.77896 15.2757 3.22686 15.13 2.74609 14.7808C2.46607 14.5773 2.22009 14.3303 2.0166 14.0503C1.66728 13.5695 1.52069 13.0175 1.45214 12.3853C1.38505 11.766 1.38574 10.9899 1.38574 10.0308V5.97022C1.38574 5.01121 1.38509 4.23495 1.45214 3.61572C1.52067 2.98356 1.6674 2.43146 2.0166 1.95068C2.21996 1.67084 2.46627 1.42458 2.74609 1.22119C3.22689 0.871868 3.7789 0.725286 4.41113 0.656739C5.03039 0.589646 5.80648 0.590332 6.76562 0.590332H9.23437ZM6.76562 1.99072C5.77546 1.99072 5.08883 1.99133 4.5625 2.04834C4.04951 2.10393 3.77179 2.20603 3.56933 2.35303C3.40814 2.47018 3.26556 2.61271 3.14843 2.77393C3.00154 2.97638 2.89931 3.25426 2.84375 3.76709C2.78678 4.2934 2.78613 4.98022 2.78613 5.97022V10.0308C2.78613 11.0208 2.78676 11.7076 2.84375 12.2339C2.89934 12.7467 3.00149 13.0246 3.14843 13.2271C3.2656 13.3883 3.40809 13.5308 3.56933 13.6479C3.7718 13.7949 4.04949 13.897 4.5625 13.9526C5.08883 14.0096 5.77545 14.0103 6.76562 14.0103H9.23437C10.2245 14.0103 10.9112 14.0096 11.4375 13.9526C11.9504 13.8971 12.2282 13.7949 12.4307 13.6479C12.5919 13.5308 12.7344 13.3882 12.8516 13.2271C12.9985 13.0246 13.1007 12.7467 13.1562 12.2339C13.2132 11.7076 13.2139 11.0208 13.2139 10.0308V5.97022C13.2139 4.9802 13.2132 4.2934 13.1562 3.76709C13.1007 3.25411 12.9985 2.9764 12.8516 2.77393C12.7344 2.61266 12.5919 2.47021 12.4307 2.35303C12.2282 2.20604 11.9505 2.10392 11.4375 2.04834C10.9111 1.99135 10.2245 1.99072 9.23437 1.99072H6.76562Z"
                fill="currentColor"
              />
            </svg>
            Developer docs
          </a>
          <a
            className="ds-btn-secondary ds-btn-m"
            href="https://github.com/DikshantJangra/BlazeResolver"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M8 1.5L13.5 4.5V11.5L8 14.5L2.5 11.5V4.5L8 1.5Z"
                stroke="currentColor"
                strokeWidth="1.2"
              />
              <path
                d="M2.8 4.7L8 7.6L13.2 4.7M8 7.6V14.1"
                stroke="currentColor"
                strokeWidth="1.2"
              />
            </svg>
            Community plugins
          </a>
          <a
            className="ds-btn-secondary ds-btn-m"
            href="https://github.com/DikshantJangra/BlazeResolver"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M8 3.25C6.75 2.25 4.8 1.95 2.25 2.25V12.75C4.8 12.45 6.75 12.75 8 13.75C9.25 12.75 11.2 12.45 13.75 12.75V2.25C11.2 1.95 9.25 2.25 8 3.25Z"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
              <path d="M8 3.25V13.75" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            LangGraph paper
          </a>
        </div>

        {/* Interactive Code Terminal (Centered directly below) */}
        <div className="flex flex-col w-full max-w-[620px] mx-auto text-left">
          {/* Tab buttons */}
          <div className="flex gap-ds-1 px-ds-1 ml-[6px]">
            <button
              type="button"
              onClick={() => setHeroTab("quickstart")}
              className={`px-ds-4 py-ds-2 text-[13px] font-medium transition-all cursor-pointer rounded-t-[8px] border border-b-0 ${
                heroTab === "quickstart"
                  ? "text-ds-primary bg-black/40 backdrop-blur-xl border-white/[0.12] shadow-sm"
                  : "text-ds-description hover:text-ds-primary bg-transparent border-transparent"
              }`}
            >
              Quick start
            </button>
            <button
              type="button"
              onClick={() => setHeroTab("source")}
              className={`px-ds-4 py-ds-2 text-[13px] font-medium transition-all cursor-pointer rounded-t-[8px] border border-b-0 ${
                heroTab === "source"
                  ? "text-ds-primary bg-black/40 backdrop-blur-xl border-white/[0.12] shadow-sm"
                  : "text-ds-description hover:text-ds-primary bg-transparent border-transparent"
              }`}
            >
              Install from source
            </button>
          </div>

          {/* Terminal Box */}
          <div className="rounded-ds-media border border-white/[0.12] bg-black/40 backdrop-blur-xl overflow-hidden -mt-[13px] shadow-2xl">
            <div className="flex items-center justify-between px-ds-4 py-ds-3 border-b border-ds-border-default bg-white/[0.02]">
              <div className="flex items-center gap-[7px]">
                <span className="w-[11px] h-[11px] rounded-full bg-[#ff5f57]" />
                <span className="w-[11px] h-[11px] rounded-full bg-[#febc2e]" />
                <span className="w-[11px] h-[11px] rounded-full bg-[#28c840]" />
              </div>
              <button
                type="button"
                onClick={copyHero}
                className="flex items-center gap-ds-2 text-ds-description text-[12px] cursor-pointer hover:text-ds-primary transition-colors"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                {heroCopied ? "Copied!" : "Copy"}
              </button>
            </div>

            <div className="p-ds-5 grid items-center">
              <pre
                className={`col-start-1 row-start-1 font-mono text-[14px] text-ds-primary leading-relaxed whitespace-pre-wrap ${
                  heroTab === "quickstart" ? "" : "invisible"
                }`}
              >
                <span className="select-none text-ds-brand">$ </span>
                npx blazeresolver demo --restaurant
              </pre>
              <pre
                className={`col-start-1 row-start-1 font-mono text-[14px] text-ds-primary leading-relaxed whitespace-pre-wrap ${
                  heroTab === "source" ? "" : "invisible"
                }`}
              >
                <span className="select-none text-ds-brand">$ </span>
                git clone https://github.com/DikshantJangra/BlazeResolver
              </pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
