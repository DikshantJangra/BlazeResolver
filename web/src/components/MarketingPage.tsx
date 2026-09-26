"use client";

import React from "react";
import Header from "./Header";
import HeroSection from "./HeroSection";
import ArchitectureFlow from "./ArchitectureFlow";
import StickyShowcase from "./StickyShowcase";
import VideoSection from "./VideoSection";
import InstallationSection from "./InstallationSection";
import Footer from "./Footer";

export default function MarketingPage() {
  return (
    <div data-theme="dark" className="relative w-full bg-ds-page">
      <Header />
      <main className="relative flex flex-col w-full">
        <HeroSection />
        <ArchitectureFlow />
        <StickyShowcase />
        <VideoSection />
        <InstallationSection />
      </main>
      <Footer />
    </div>
  );
}
