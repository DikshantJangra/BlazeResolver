"use client";

import React, { useState } from "react";

export default function VideoSection() {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <section className="ds-container py-ds-10">
      <div className="flex flex-col items-center text-center">
        <h2 className="ds-text-heading1 text-ds-primary max-w-[820px]">
          Customize your BlazeResolver
        </h2>
        <p className="ds-text-body text-ds-description max-w-[620px] mt-ds-3">
          Watch how you can customize resolution workflows, triage tools, and
          agent presets in real time.
        </p>
      </div>

      <div className="mt-ds-8 rounded-2xl border border-ds-border-default bg-ds-surface-3 overflow-hidden demo-video-frame relative group">
        <div className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden">
          {/* Poster Image */}
          <img
            src="/images/demo-poster.jpg"
            alt="BlazeResolver interactive demo overview"
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-90"
          />

          {/* Dark gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />

          {/* Centered Big Play Button */}
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            aria-label="Play demo video"
            className="absolute z-20 demo-video-bigplay flex items-center justify-center cursor-pointer text-white"
          >
            {isPlaying ? (
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="ml-1"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Bottom Glass Control Bar */}
          <div className="absolute bottom-3 left-3 right-3 z-20 flex items-center justify-between px-4 py-2.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-white/90 text-xs">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className="cursor-pointer hover:text-white"
              >
                {isPlaying ? "❚❚" : "▶"}
              </button>
              <span className="font-mono text-[11px] text-white/60">
                {isPlaying ? "0:14 / 1:42" : "0:00 / 1:42"}
              </span>
            </div>

            {/* Scrubber bar */}
            <div className="flex-1 mx-4 h-1.5 rounded-full bg-white/20 overflow-hidden cursor-pointer relative">
              <div
                className="h-full bg-[#FF6B00] rounded-full transition-all duration-300"
                style={{ width: isPlaying ? "28%" : "0%" }}
              />
            </div>

            <div className="flex items-center gap-3">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/10 uppercase tracking-wider text-white/80">
                HD 1080p
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
