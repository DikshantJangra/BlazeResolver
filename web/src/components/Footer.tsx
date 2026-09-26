"use client";

import React, { useState } from "react";

export default function Footer() {
  const [qrOpen, setQrOpen] = useState(false);

  return (
    <footer className="ds-container pb-ds-6">
      <div className="w-full h-px bg-ds-border-subtle" />
      <div className="flex flex-col items-center gap-ds-4 pt-ds-5 xl:grid xl:grid-cols-[1fr_auto_1fr] xl:items-center">
        {/* Left: Community QR */}
        <div className="flex items-center gap-ds-6 xl:justify-self-start">
          <div
            className="ds-qr-trigger relative"
            onMouseEnter={() => setQrOpen(true)}
            onMouseLeave={() => setQrOpen(false)}
          >
            <span className="flex items-center gap-ds-2 text-ds-secondary hover:text-ds-primary transition-colors cursor-pointer">
              <span className="w-5 h-5 flex items-center justify-center">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M6 1.6C2.688 1.6 0 3.752 0 6.4C0 7.912 0.864 9.248 2.224 10.128L1.6 12L3.6 10.8C4.312 11.048 5.096 11.2 5.928 11.2C5.714 10.694 5.603 10.15 5.6 9.6C5.6 6.952 8.104 4.8 11.2 4.8C11.352 4.8 11.504 4.8 11.648 4.824C10.832 2.952 8.624 1.6 6 1.6Z"
                    fill="currentColor"
                  />
                  <path
                    d="M11.2 5.6C8.552 5.6 6.4 7.392 6.4 9.6C6.4 11.808 8.552 13.6 11.2 13.6C11.736 13.6 12.248 13.536 12.728 13.4L14.4 14.4L13.904 12.904C15.16 12.176 16 10.968 16 9.6C16 7.392 13.848 5.6 11.2 5.6Z"
                    fill="currentColor"
                  />
                </svg>
              </span>
              <span className="ds-text-caption whitespace-nowrap">
                Community channel
              </span>
            </span>

            {/* QR Popup */}
            {qrOpen && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 z-50 mb-2">
                <div className="ds-glass-dropdown w-[180px] p-ds-3 flex flex-col items-center gap-ds-2">
                  <img
                    src="/images/qr-wechat.png"
                    alt="Community QR Code"
                    className="w-full aspect-square rounded-ds-media object-cover"
                  />
                  <span className="ds-text-xs text-ds-secondary text-center">
                    Scan to join
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center: Copyright */}
        <p className="ds-text-caption text-ds-description text-center">
          Open source · MIT · © 2026 BlazeResolver. All rights reserved.
        </p>

        {/* Right: Policies */}
        <nav
          aria-label="Policies and statements"
          className="flex flex-wrap items-center justify-center gap-x-ds-3 gap-y-ds-2 xl:justify-self-end"
        >
          <a
            className="ds-text-caption text-ds-primary transition-opacity hover:opacity-70 whitespace-nowrap"
            href="https://github.com/DikshantJangra/BlazeResolver#readme"
            target="_blank"
            rel="noopener noreferrer"
          >
            Safe Use Policy
          </a>
          <span
            aria-hidden="true"
            className="ds-text-caption text-ds-description"
          >
            ·
          </span>
          <a
            className="ds-text-caption text-ds-primary transition-opacity hover:opacity-70 whitespace-nowrap"
            href="https://github.com/DikshantJangra/BlazeResolver#readme"
            target="_blank"
            rel="noopener noreferrer"
          >
            Data Processing Statement
          </a>
        </nav>
      </div>
    </footer>
  );
}
