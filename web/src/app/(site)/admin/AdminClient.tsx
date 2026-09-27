"use client";

import React from "react";
import { AdminSupportDesk } from "blazeresolver/react";

export default function AdminClient() {
  const endpoint = process.env.NEXT_PUBLIC_BLAZE_ENDPOINT || "";
  const apiBaseUrl = endpoint.replace(/\/api\/blaze\/?$/, "");

  return (
    <div className="w-full flex-1 flex flex-col h-screen min-h-screen">
      <AdminSupportDesk apiBaseUrl={apiBaseUrl} />
    </div>
  );
}
