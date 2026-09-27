"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { BlazzySupportWidget } from "blazeresolver/react";
import { asset } from "@/lib/site";

export default function FloatingSupportWidget() {
  const pathname = usePathname();
  const endpoint = process.env.NEXT_PUBLIC_BLAZE_ENDPOINT || "";
  const apiBaseUrl = endpoint.replace(/\/api\/blaze\/?$/, "");

  // Don't show floating widget on dedicated timeline, customer or admin portals
  if (
    pathname?.startsWith("/timeline") ||
    pathname?.startsWith("/pulse") ||
    pathname?.startsWith("/customer") ||
    pathname?.startsWith("/admin")
  ) {
    return null;
  }

  return (
    <BlazzySupportWidget
      apiBaseUrl={apiBaseUrl}
      logoSrc={asset("/blazyy.svg")}
      title="BlazeResolver"
      subtitle="Autonomous AI resolution & support"
      defaultPosition="bottom-right"
    />
  );
}
