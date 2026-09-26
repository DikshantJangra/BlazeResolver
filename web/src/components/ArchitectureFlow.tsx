"use client";

import React from "react";

export default function ArchitectureFlow() {
  return (
    <section className="ds-container pt-ds-9 pb-ds-11">
      <div className="max-w-[820px] mx-auto flex flex-col items-center gap-ds-6 text-center">
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
            Agent = Model + Harness
          </span>
        </span>
        <h2 className="ds-text-heading1 text-ds-primary">
          <span className="font-bold text-white font-ds-display">
            Blaze<span className="text-[#FF6B00]">Resolver</span>{" "}
          </span>
          <span className="ds-font-harness text-ds-brand !text-[34px] md:!text-[50px] inline-block align-middle -translate-y-[0.08em]">
            Harness
          </span>
          <br />
          keeps agents working in real-world environments
        </h2>
        <div className="max-w-[760px] flex flex-col gap-1">
          <p className="ds-text-body text-ds-description leading-[1.75]">
            The model is the soul of an agent.
          </p>
          <p className="ds-text-body text-ds-description leading-[1.75]">
            A harness lets an agent understand its environment, use tools, and
            keep working in real-world settings.
          </p>
        </div>
      </div>

      <div className="mt-ds-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-ds-5">
          {/* Card 1 */}
          <div className="rounded-[12px] h-full relative group">
            <div className="bg-ds-surface-3 border border-ds-border-default rounded-ds-media p-ds-6 flex flex-col items-center text-center h-full transition-all duration-300 group-hover:border-white/20 group-hover:bg-ds-surface-2">
              <div className="text-ds-primary opacity-80 mb-ds-4 transition-transform duration-300 group-hover:scale-105">
                <svg
                  aria-hidden="true"
                  width="72"
                  height="72"
                  viewBox="0 0 72 72"
                  fill="none"
                >
                  <circle
                    cx="36"
                    cy="36"
                    r="4"
                    stroke="currentColor"
                    strokeWidth="1.2"
                  />
                  <circle cx="36" cy="36" r="1.5" fill="currentColor" />
                  <ellipse
                    cx="36"
                    cy="36"
                    rx="25"
                    ry="11"
                    stroke="currentColor"
                    strokeWidth="1"
                    opacity="0.7"
                    transform="rotate(90 36 36)"
                  />
                  <ellipse
                    cx="36"
                    cy="36"
                    rx="25"
                    ry="11"
                    stroke="currentColor"
                    strokeWidth="1"
                    opacity="0.7"
                    transform="rotate(30 36 36)"
                  />
                  <ellipse
                    cx="36"
                    cy="36"
                    rx="25"
                    ry="11"
                    stroke="currentColor"
                    strokeWidth="1"
                    opacity="0.7"
                    transform="rotate(150 36 36)"
                  />
                </svg>
              </div>
              <h3 className="ds-text-title text-ds-primary mb-ds-2">
                <a
                  href="https://github.com/DikshantJangra/BlazeResolver"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-dashed decoration-white/30 underline-offset-4 transition-colors hover:text-ds-brand"
                >
                  LangGraph kernel
                </a>
              </h3>
              <p className="ds-text-caption text-ds-description leading-[1.65]">
                The LangGraph kernel manages plugin mounting, unmounting, and
                dependencies. Agent capabilities live in the plugins.
              </p>
            </div>
          </div>

          {/* Card 2 */}
          <div className="rounded-[12px] h-full relative group">
            <div className="bg-ds-surface-3 border border-ds-border-default rounded-ds-media p-ds-6 flex flex-col items-center text-center h-full transition-all duration-300 group-hover:border-white/20 group-hover:bg-ds-surface-2">
              <div className="text-ds-primary opacity-80 mb-ds-4 transition-transform duration-300 group-hover:scale-105">
                <svg
                  aria-hidden="true"
                  width="72"
                  height="72"
                  viewBox="0 0 72 72"
                  fill="none"
                >
                  <defs>
                    <mask id="plugin-ring-mask">
                      <rect width="72" height="72" fill="white" />
                      <circle cx="36" cy="10" r="4.4" fill="black" />
                      <circle
                        cx="58.5166604983954"
                        cy="23"
                        r="4.4"
                        fill="black"
                      />
                      <circle
                        cx="58.51666049839541"
                        cy="49"
                        r="4.4"
                        fill="black"
                      />
                      <circle cx="36" cy="62" r="4.4" fill="black" />
                      <circle
                        cx="13.4833395016046"
                        cy="49"
                        r="4.4"
                        fill="black"
                      />
                      <circle
                        cx="13.483339501604597"
                        cy="23"
                        r="4.4"
                        fill="black"
                      />
                    </mask>
                  </defs>
                  <circle
                    cx="36"
                    cy="36"
                    r="17"
                    stroke="currentColor"
                    strokeWidth="0.9"
                    strokeDasharray="2 2.5"
                    opacity="0.5"
                  />
                  <circle
                    cx="36"
                    cy="36"
                    r="26"
                    stroke="currentColor"
                    strokeWidth="0.9"
                    opacity="0.7"
                    mask="url(#plugin-ring-mask)"
                  />
                  <circle
                    cx="36"
                    cy="36"
                    r="4.5"
                    stroke="currentColor"
                    strokeWidth="1.2"
                  />
                  <circle cx="36" cy="10" r="2.6" fill="currentColor" />
                  <circle
                    cx="58.5166604983954"
                    cy="23"
                    r="2.6"
                    fill="currentColor"
                  />
                  <circle
                    cx="58.51666049839541"
                    cy="49"
                    r="2.6"
                    fill="currentColor"
                  />
                  <circle cx="36" cy="62" r="2.6" fill="currentColor" />
                  <circle
                    cx="13.4833395016046"
                    cy="49"
                    r="2.6"
                    fill="currentColor"
                  />
                  <circle
                    cx="13.483339501604597"
                    cy="23"
                    r="2.6"
                    fill="currentColor"
                  />
                </svg>
              </div>
              <h3 className="ds-text-title text-ds-primary mb-ds-2">
                Capabilities as plugins
              </h3>
              <p className="ds-text-caption text-ds-description leading-[1.65]">
                Plugins provide every agent capability, including models, tools,
                skills, sessions, sandboxes, storage, loops, scheduling, and the
                UI. LangGraph services and events let the plugins work together.
              </p>
            </div>
          </div>

          {/* Card 3 */}
          <div className="rounded-[12px] h-full relative group">
            <div className="bg-ds-surface-3 border border-ds-border-default rounded-ds-media p-ds-6 flex flex-col items-center text-center h-full transition-all duration-300 group-hover:border-white/20 group-hover:bg-ds-surface-2">
              <div className="text-ds-primary opacity-80 mb-ds-4 transition-transform duration-300 group-hover:scale-105">
                <svg
                  aria-hidden="true"
                  width="72"
                  height="72"
                  viewBox="0 0 72 72"
                  fill="none"
                >
                  <rect
                    x="18"
                    y="22"
                    width="15"
                    height="15"
                    rx="3"
                    stroke="currentColor"
                    strokeWidth="1.1"
                    opacity="0.85"
                  />
                  <rect
                    x="18"
                    y="41"
                    width="15"
                    height="15"
                    rx="3"
                    stroke="currentColor"
                    strokeWidth="1.1"
                    opacity="0.85"
                  />
                  <rect
                    x="37"
                    y="41"
                    width="15"
                    height="15"
                    rx="3"
                    stroke="currentColor"
                    strokeWidth="1.1"
                    opacity="0.85"
                  />
                  <rect
                    x="37"
                    y="22"
                    width="15"
                    height="15"
                    rx="3"
                    stroke="currentColor"
                    strokeWidth="0.9"
                    strokeDasharray="2.5 2.5"
                    opacity="0.45"
                  />
                  <rect
                    x="47"
                    y="12"
                    width="15"
                    height="15"
                    rx="3"
                    stroke="currentColor"
                    strokeWidth="1.2"
                  />
                  <circle cx="54.5" cy="19.5" r="1.4" fill="currentColor" />
                </svg>
              </div>
              <h3 className="ds-text-title text-ds-primary mb-ds-2">
                Compose with configuration
              </h3>
              <p className="ds-text-caption text-ds-description leading-[1.65]">
                Developers can select, swap, or extend any capability in
                configuration without changing the BlazeResolver source code.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
