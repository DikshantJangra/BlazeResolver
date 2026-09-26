"use client";

import React from "react";

export default function VideoSection() {
  return (
    <section className="ds-container py-ds-10"><div className="flex flex-col items-center text-center" style={({"opacity":"0","transform":"translateY(20px)"}) as React.CSSProperties}><h2 className="ds-text-heading1 text-ds-primary max-w-[820px]">Customize your BlazeResolver</h2></div><div className="mt-ds-9 rounded-2xl border border-ds-border-default bg-ds-surface-3 overflow-hidden demo-video-frame" style={({"opacity":"0","transform":"translateY(24px)"}) as React.CSSProperties}><template data-dgst="NEXT_DYNAMIC_NO_SSR_CODE"></template><div className="w-full aspect-video bg-cover bg-center" style={({"backgroundImage":"url(/images/demo-poster.jpg)"}) as React.CSSProperties}></div></div></section>
  );
}
