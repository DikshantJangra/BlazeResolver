"use client";

import React, { useState } from "react";
import { FaPlay, FaPause, FaVolumeHigh, FaPhone, FaShieldHalved } from "react-icons/fa6";

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

      <div className="mt-ds-8 rounded-2xl border border-ds-border-default bg-[#0d1017] overflow-hidden demo-video-frame relative group shadow-2xl">
        <div className="relative w-full aspect-video flex flex-col justify-between p-6 sm:p-8">
          {/* Top telemetry bar */}
          <div className="flex items-center justify-between z-10">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono bg-white/[0.06] border border-white/10 text-white/90">
                <span className="w-2 h-2 rounded-full bg-[#28c840] animate-ping" />
                <span>LIVE VOICE CALL #BE-9821</span>
              </span>
              <span className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono bg-[#0055FF]/20 text-[#8da4ff] border border-[#0055FF]/30">
                <FaPhone className="w-2.5 h-2.5" /> Twilio SIP Trunk
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full text-[11px] font-mono bg-[#FF6B00]/20 text-[#FF6B00] border border-[#FF6B00]/30 flex items-center gap-1.5">
                <FaShieldHalved className="w-3 h-3" /> Policy Guard: Safe
              </span>
            </div>
          </div>

          {/* Centered Audio Waveform & Transcript Simulation */}
          <div className="flex flex-col items-center justify-center my-auto z-10 gap-5 max-w-[680px] mx-auto text-center">
            {/* Animated Audio Spectrum Bars */}
            <div className="flex items-end justify-center gap-1.5 h-16 w-full max-w-[320px]">
              {[
                "h-4", "h-8", "h-14", "h-10", "h-6", "h-16", "h-12", "h-7",
                "h-14", "h-11", "h-16", "h-8", "h-12", "h-5", "h-9", "h-14",
                "h-6", "h-11", "h-4"
              ].map((hClass, i) => (
                <div
                  key={i}
                  className={`w-1.5 rounded-full transition-all duration-300 ${
                    isPlaying
                      ? "bg-gradient-to-t from-[#FF6B00] to-[#0055FF] animate-pulse"
                      : "bg-white/20"
                  } ${isPlaying ? hClass : "h-3"}`}
                  style={{
                    animationDelay: `${(i % 5) * 0.12}s`,
                    animationDuration: "0.8s",
                  }}
                />
              ))}
            </div>

            {/* Live Conversation Text Stream */}
            <div className="flex flex-col gap-2 font-mono text-sm max-w-[580px]">
              <p className="text-white/60 text-xs">
                <span className="text-[#0055FF] font-semibold">Caller:</span>{" "}
                &quot;My order from Burger Bistro arrived 45 mins late and the food was cold.&quot;
              </p>
              <p className="text-white text-sm font-sans font-medium">
                <span className="text-[#FF6B00] font-semibold font-mono">BlazeResolver:</span>{" "}
                &quot;I completely understand and apologize. I&apos;ve checked the driver delay, refunded your full $28.50 order immediately, and added $5 to your BlazeEats credit.&quot;
              </p>
            </div>
          </div>

          {/* Big Centered Play Trigger Button */}
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            aria-label="Toggle Voice Simulation"
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 demo-video-bigplay flex items-center justify-center cursor-pointer text-white shadow-2xl"
          >
            {isPlaying ? (
              <FaPause className="w-6 h-6" />
            ) : (
              <FaPlay className="w-6 h-6 ml-1" />
            )}
          </button>

          {/* Bottom Glass Control Bar */}
          <div className="z-10 flex items-center justify-between px-4 py-2.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-white/90 text-xs">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className="cursor-pointer hover:text-white"
              >
                {isPlaying ? <FaPause className="w-3 h-3" /> : <FaPlay className="w-3 h-3" />}
              </button>
              <span className="font-mono text-[11px] text-white/60">
                {isPlaying ? "0:18 / 1:42" : "0:00 / 1:42"}
              </span>
            </div>

            {/* Scrubber bar */}
            <div className="flex-1 mx-4 h-1.5 rounded-full bg-white/20 overflow-hidden cursor-pointer relative">
              <div
                className="h-full bg-gradient-to-r from-[#FF6B00] to-[#0055FF] rounded-full transition-all duration-300"
                style={{ width: isPlaying ? "35%" : "0%" }}
              />
            </div>

            <div className="flex items-center gap-3">
              <FaVolumeHigh className="w-3.5 h-3.5 text-white/60" />
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/10 uppercase tracking-wider text-white/80">
                HD Audio
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
