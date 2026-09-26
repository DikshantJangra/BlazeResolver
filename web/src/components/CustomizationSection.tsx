"use client";

import React, { useState } from "react";

export default function CustomizationSection() {
  const [copiedQuick, setCopiedQuick] = useState(false);
  const [copiedSource, setCopiedSource] = useState(false);

  const copyText = async (text: string, type: "quick" | "source") => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === "quick") {
        setCopiedQuick(true);
        setTimeout(() => setCopiedQuick(false), 2000);
      } else {
        setCopiedSource(true);
        setTimeout(() => setCopiedSource(false), 2000);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <section className="ds-container py-ds-10">
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
            Get started
          </span>
        </span>
        <h2 className="ds-text-heading1 text-ds-primary mt-ds-4 mb-ds-9 max-w-[600px]">
          Try it now or install from source
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-ds-6 items-stretch">
        {/* Quick start card */}
        <div className="min-w-0 flex flex-col rounded-[12px] bg-ds-surface-3 border border-ds-border-default hover:border-white/20 transition-all duration-300">
          <div className="min-w-0 flex flex-col gap-ds-3 p-ds-7">
            <h3 className="ds-text-subtitle text-ds-primary">Quick start</h3>
            <p className="ds-text-body text-ds-description leading-[1.7]">
              Install Node.js, then launch the interactive demo Web UI with npx.
            </p>
            <div className="mt-ds-2 flex items-center justify-between gap-ds-3 rounded-[10px] border border-ds-border-default bg-ds-surface-1 px-ds-4 py-[14px] font-mono text-[14px] text-ds-primary">
              <code className="min-w-0 whitespace-pre-wrap break-all">
                <span className="select-none text-ds-brand">$ </span>
                npx blazeresolver demo --restaurant
              </code>
              <button
                type="button"
                onClick={() =>
                  copyText("npx blazeresolver demo --restaurant", "quick")
                }
                className="shrink-0 font-sans text-[12px] text-ds-description hover:text-ds-primary transition-colors cursor-pointer"
              >
                {copiedQuick ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        </div>

        {/* Install from source card */}
        <div className="min-w-0 flex flex-col rounded-[12px] bg-ds-surface-3 border border-ds-border-default hover:border-white/20 transition-all duration-300">
          <div className="min-w-0 flex flex-col gap-ds-3 p-ds-7">
            <h3 className="ds-text-subtitle text-ds-primary">
              Install from source
            </h3>
            <p className="ds-text-body text-ds-description leading-[1.7]">
              Clone the full source and follow the setup instructions in the
              repository.
            </p>
            <div className="mt-ds-2 flex items-center justify-between gap-ds-3 rounded-[10px] border border-ds-border-default bg-ds-surface-1 px-ds-4 py-[14px] font-mono text-[14px] text-ds-primary">
              <code className="min-w-0 whitespace-pre-wrap break-all">
                <span className="select-none text-ds-brand">$ </span>
                git clone https://github.com/DikshantJangra/BlazeResolver
              </code>
              <button
                type="button"
                onClick={() =>
                  copyText(
                    "git clone https://github.com/DikshantJangra/BlazeResolver",
                    "source",
                  )
                }
                className="shrink-0 font-sans text-[12px] text-ds-description hover:text-ds-primary transition-colors cursor-pointer"
              >
                {copiedSource ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
