"use client";

import React from "react";
import { ActivityTimeline } from "blazeresolver/react";

export default function TimelineClient() {
  const endpoint = process.env.NEXT_PUBLIC_BLAZE_ENDPOINT || "";
  const apiBaseUrl = endpoint.replace(/\/api\/blaze\/?$/, "");

  return (
    <div className="w-full flex-1 flex flex-col h-screen min-h-screen">
      <ActivityTimeline apiBaseUrl={apiBaseUrl} />
    </div>
  );
}
