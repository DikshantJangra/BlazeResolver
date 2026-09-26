"use client";

import React, { useState } from "react";

export default function StickyShowcase() {
  const [activeSlide, setActiveSlide] = useState(0);

  return (
    <section className="ds-container py-ds-10">
      <div className="hidden md:block">
        <div>
          <span
            className="inline-flex items-center rounded-[8px] p-[1px]"
            style={{
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.08) 35%, rgba(255,255,255,0.04) 65%, rgba(255,255,255,0.28) 100%)",
              boxShadow:
                "0 0 16px rgba(255,255,255,0.08), 0 0 32px rgba(255,255,255,0.04)",
            }}
          >
            <span className="px-[9px] pt-[6px] pb-[5px] rounded-[7px] bg-black/25 font-mono text-[12px] font-medium text-white/95 leading-none tracking-wider uppercase">
              Design approach
            </span>
          </span>
          <h2 className="ds-text-heading1 text-ds-primary mt-ds-4 mb-ds-9 max-w-[680px] whitespace-pre-line">
            Everything is a plugin.{"\n"}
            Every run is traceable.
          </h2>
        </div>

        <div className="grid grid-cols-[42fr_58fr] gap-ds-9 w-full items-start">
          {/* Left Column: Interactive Cards */}
          <div className="flex flex-col">
            {/* Card 0 */}
            <div
              onClick={() => setActiveSlide(0)}
              className="flex flex-col justify-center gap-ds-4 min-h-[30vh] py-[6vh] transition-all duration-300 cursor-pointer rounded-xl p-4 border border-transparent hover:border-white/10"
              style={{
                opacity: activeSlide === 0 ? 1 : 0.4,
                backgroundColor: activeSlide === 0 ? "rgba(255,255,255,0.02)" : "transparent",
              }}
            >
              <div className="flex items-center gap-ds-2">
                <div
                  className={`transition-colors duration-300 ${
                    activeSlide === 0 ? "text-ds-brand" : "text-ds-description"
                  }`}
                >
                  <svg
                    aria-hidden="true"
                    width="28"
                    height="28"
                    viewBox="0 0 28 28"
                    fill="none"
                  >
                    <path
                      d="M14 3L23.5 8.5V19.5L14 25L4.5 19.5V8.5L14 3Z"
                      stroke="currentColor"
                      strokeWidth="1.3"
                    />
                    <path
                      d="M5 9L14 14.2L23 9M14 14.2V24.4"
                      stroke="currentColor"
                      strokeWidth="1.3"
                    />
                  </svg>
                </div>
                <h3 className="ds-text-subtitle !text-[22px] !font-normal text-ds-primary">
                  Everything is a plugin
                </h3>
              </div>
              <p className="ds-text-body text-ds-description leading-[1.7]">
                BlazeResolver is built on{" "}
                <a
                  href="https://github.com/DikshantJangra/BlazeResolver"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ds-primary hover:text-ds-brand transition-colors underline underline-offset-4 decoration-1 decoration-dashed decoration-white/30"
                >
                  LangGraph
                </a>
                &apos;s plugin system. Plugins provide every agent capability, including models, tools, skills, sessions, sandboxes, storage, loops, scheduling, and the UI. LangGraph services and events let the plugins work together. Developers can select, swap, or extend any capability in configuration without changing the BlazeResolver source code.
              </p>
            </div>

            {/* Card 1 */}
            <div
              onClick={() => setActiveSlide(1)}
              className="flex flex-col justify-center gap-ds-4 min-h-[30vh] py-[6vh] transition-all duration-300 cursor-pointer rounded-xl p-4 border border-transparent hover:border-white/10"
              style={{
                opacity: activeSlide === 1 ? 1 : 0.4,
                backgroundColor: activeSlide === 1 ? "rgba(255,255,255,0.02)" : "transparent",
              }}
            >
              <div className="flex items-center gap-ds-2">
                <div
                  className={`transition-colors duration-300 ${
                    activeSlide === 1 ? "text-ds-brand" : "text-ds-description"
                  }`}
                >
                  <svg
                    aria-hidden="true"
                    width="28"
                    height="28"
                    viewBox="0 0 28 28"
                    fill="none"
                  >
                    <circle cx="14" cy="14" r="9.5" stroke="currentColor" strokeWidth="1.3" />
                    <path
                      d="M12 10.5L18 14L12 17.5V10.5Z"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <h3 className="ds-text-subtitle !text-[22px] !font-normal text-ds-primary">
                  Every run is traceable
                </h3>
              </div>
              <p className="ds-text-body text-ds-description leading-[1.7]">
                Everything the model sees is recorded in an append-only session log: system prompts, reasoning, tool calls and results, subagent scheduling, and every context injection. In the Trajectory view, you can inspect these records by source. Resume, fork, search, and replay all operate on the same event stream.
              </p>
            </div>

            {/* Card 2 */}
            <div
              onClick={() => setActiveSlide(2)}
              className="flex flex-col justify-center gap-ds-4 min-h-[30vh] py-[6vh] transition-all duration-300 cursor-pointer rounded-xl p-4 border border-transparent hover:border-white/10"
              style={{
                opacity: activeSlide === 2 ? 1 : 0.4,
                backgroundColor: activeSlide === 2 ? "rgba(255,255,255,0.02)" : "transparent",
              }}
            >
              <div className="flex items-center gap-ds-2">
                <div
                  className={`transition-colors duration-300 ${
                    activeSlide === 2 ? "text-ds-brand" : "text-ds-description"
                  }`}
                >
                  <svg
                    aria-hidden="true"
                    width="28"
                    height="28"
                    viewBox="0 0 28 28"
                    fill="none"
                  >
                    <rect x="4.5" y="4.5" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.3" />
                    <rect x="15.5" y="4.5" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.3" />
                    <rect x="4.5" y="15.5" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.3" />
                    <rect x="15.5" y="15.5" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.3" />
                  </svg>
                </div>
                <h3 className="ds-text-subtitle !text-[22px] !font-normal text-ds-primary">
                  Multiple runtime modes
                </h3>
              </div>
              <p className="ds-text-body text-ds-description leading-[1.7]">
                Standard mode includes the full toolset. Code mode uses model-generated code to orchestrate multiple rounds of tool calls. Minimal mode keeps only a shell tool and a file editor for benchmarking models in a minimal environment. Creator mode lets you inspect the current runtime, test LangGraph plugins in memory, and combine them into new modes.
              </p>
            </div>
          </div>

          {/* Right Column: Sticky Media Frame */}
          <div className="sticky top-[15vh]">
            <div className="grid min-w-0 max-w-[760px] aspect-[8/5] bg-ds-surface-3 border border-ds-border-default rounded-ds-media overflow-hidden shadow-2xl">
              {/* Slide 0: Feat Plugin Image */}
              <div
                className="col-start-1 row-start-1 min-w-0 transition-opacity duration-500"
                style={{
                  opacity: activeSlide === 0 ? 1 : 0,
                  pointerEvents: activeSlide === 0 ? "auto" : "none",
                }}
              >
                <div className="w-full h-full flex items-center justify-center overflow-hidden bg-[#101113]">
                  <img
                    src="/images/harness/feat-plugin.en.png"
                    alt="BlazeResolver settings showing installed plugins and status"
                    className="block w-full h-full object-contain"
                  />
                </div>
              </div>

              {/* Slide 1: Trajectory Image */}
              <div
                className="col-start-1 row-start-1 min-w-0 transition-opacity duration-500"
                style={{
                  opacity: activeSlide === 1 ? 1 : 0,
                  pointerEvents: activeSlide === 1 ? "auto" : "none",
                }}
              >
                <div className="w-full h-full flex items-center justify-center overflow-hidden bg-[#101113]">
                  <img
                    src="/images/harness/trajectory-real-view.en.png"
                    alt="Traceable real-time session log and trajectory view"
                    className="block w-full h-full object-contain"
                  />
                </div>
              </div>

              {/* Slide 2: Interactive Mode Picker */}
              <div
                className="col-start-1 row-start-1 min-w-0 transition-opacity duration-500"
                style={{
                  opacity: activeSlide === 2 ? 1 : 0,
                  pointerEvents: activeSlide === 2 ? "auto" : "none",
                }}
              >
                <div
                  role="img"
                  aria-label="The runtime mode picker listing Standard, Code, Minimal, and Creator modes"
                  className="w-full h-full flex flex-col justify-center font-ds-sans select-text bg-[#101113] p-6"
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-white/90 bg-white/10">
                        blaze-demo
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-white/90 bg-[#FF6B00]/20 border border-[#FF6B00]/30">
                        Creator mode
                      </span>
                    </div>

                    <div className="flex flex-col gap-2 p-3 rounded-xl bg-[#1e2024] border border-white/5">
                      <div className="text-xs text-white/50">Describe what you want to resolve</div>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-xs text-white/70">Support adapter: voice + refund gateway</span>
                        <span className="w-6 h-6 rounded-full bg-[#FF6B00] flex items-center justify-center text-white text-xs">
                          ↑
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <div className="p-2.5 rounded-lg bg-white/5 border border-white/5">
                        <div className="text-xs font-medium text-white">Standard mode</div>
                        <div className="text-[11px] text-white/50 mt-0.5">Triage, correlation & chat</div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-white/5 border border-white/5">
                        <div className="text-xs font-medium text-white">Voice mode</div>
                        <div className="text-[11px] text-white/50 mt-0.5">Real-time voice support</div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-white/5 border border-white/5">
                        <div className="text-xs font-medium text-white">Policy mode</div>
                        <div className="text-[11px] text-white/50 mt-0.5">Gated money & refund limits</div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-[#FF6B00]/10 border border-[#FF6B00]/30">
                        <div className="text-xs font-medium text-[#FF6B00]">Creator mode</div>
                        <div className="text-[11px] text-white/70 mt-0.5">Custom harness plugins</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="md:hidden flex flex-col gap-ds-8">
        <div>
          <span
            className="inline-flex items-center rounded-[8px] p-[1px]"
            style={{
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.08) 35%, rgba(255,255,255,0.04) 65%, rgba(255,255,255,0.28) 100%)",
            }}
          >
            <span className="px-[9px] pt-[6px] pb-[5px] rounded-[7px] bg-black/25 font-mono text-[12px] font-medium text-white/95 leading-none tracking-wider uppercase">
              Design approach
            </span>
          </span>
          <h2 className="ds-text-heading1 text-ds-primary mt-ds-4 mb-ds-6 whitespace-pre-line">
            Everything is a plugin.{"\n"}
            Every run is traceable.
          </h2>
        </div>

        {/* Item 1 */}
        <div className="flex flex-col gap-4">
          <h3 className="ds-text-subtitle !text-[20px] text-ds-primary">Everything is a plugin</h3>
          <p className="ds-text-body text-ds-description">
            Plugins provide every capability: models, tools, skills, sessions, sandboxes, storage, loops, scheduling, and UI.
          </p>
          <div className="aspect-[8/5] rounded-lg overflow-hidden border border-white/10 bg-[#101113]">
            <img src="/images/harness/feat-plugin.en.png" alt="Feature plugin" className="w-full h-full object-contain" />
          </div>
        </div>

        {/* Item 2 */}
        <div className="flex flex-col gap-4">
          <h3 className="ds-text-subtitle !text-[20px] text-ds-primary">Every run is traceable</h3>
          <p className="ds-text-body text-ds-description">
            Everything the model sees is recorded in an append-only session log: system prompts, tool calls, and results.
          </p>
          <div className="aspect-[8/5] rounded-lg overflow-hidden border border-white/10 bg-[#101113]">
            <img src="/images/harness/trajectory-real-view.en.png" alt="Trajectory view" className="w-full h-full object-contain" />
          </div>
        </div>
      </div>
    </section>
  );
}
