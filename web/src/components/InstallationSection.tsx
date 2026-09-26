"use client";

import React from "react";
import { FaGithub, FaBook, FaTerminal } from "react-icons/fa6";

export default function InstallationSection() {
  return (
    <section
      id="get-started"
      className="relative z-10 ds-container flex flex-col items-center text-center scroll-mt-[100px] pt-ds-11 pb-ds-13"
      style={{ minHeight: "min(40vh, 500px)" }}
    >
      <h2 className="ds-text-heading1 text-ds-primary">
        Deploy BlazeResolver to Your Support Stack
      </h2>
      <p className="ds-text-body text-ds-description max-w-[680px] mt-ds-5 text-[16px] leading-[1.65]">
        Drop BlazeResolver into any product flow — whether e-commerce, SaaS,
        on-demand delivery, or fintech. Connect the 4 typed adapters to your
        database, payment gateway, and ticketing tools, and let the harness
        autonomously resolve customer issues end-to-end.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-ds-4 mt-ds-6">
        <a
          className="ds-btn-primary ds-btn-m flex items-center gap-2"
          href="https://github.com/DikshantJangra/BlazeResolver"
          target="_blank"
          rel="noopener noreferrer"
        >
          <FaGithub className="w-4 h-4" />
          <span>View on GitHub</span>
        </a>
        <a
          className="ds-btn-secondary ds-btn-m flex items-center gap-2"
          href="https://github.com/DikshantJangra/BlazeResolver#readme"
          target="_blank"
          rel="noopener noreferrer"
        >
          <FaBook className="w-4 h-4" />
          <span>Documentation</span>
        </a>
        <a
          className="ds-btn-secondary ds-btn-m flex items-center gap-2"
          href="https://www.npmjs.com/package/@blazeresolver/harness"
          target="_blank"
          rel="noopener noreferrer"
        >
          <FaTerminal className="w-4 h-4" />
          <span>npm package</span>
        </a>
      </div>
    </section>
  );
}
