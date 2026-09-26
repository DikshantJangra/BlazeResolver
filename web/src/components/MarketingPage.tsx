"use client";

import React from "react";
import Header from "./Header";
import HeroSection from "./HeroSection";
import ArchitectureFlow from "./ArchitectureFlow";
import StickyShowcase from "./StickyShowcase";
import VideoSection from "./VideoSection";
import CustomizationSection from "./CustomizationSection";
import InstallationSection from "./InstallationSection";
import Footer from "./Footer";

export default function MarketingPage() {
  return (
    <div data-theme="dark" className="relative min-h-screen w-full bg-[#0a0b0e] text-[#e6e8ea]">
      {/* Top Navbar */}
      <Header />

      {/* Main Content Sections */}
      <main className="relative flex flex-col w-full">
        {/* 1. Hero Section with Interactive Terminal */}
        <HeroSection />

        {/* 2. Architecture & 3-Stage Pipeline Flow */}
        <ArchitectureFlow />

        {/* 3. Sticky Aspect 8/5 Interactive Showcase */}
        <StickyShowcase />

        {/* 4. Interactive Video / Simulation Demo */}
        <VideoSection />

        {/* 5. Drop-in Adapter & Policy Customization */}
        <CustomizationSection />

        {/* 6. Quickstart & Installation Cards */}
        <InstallationSection />
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
