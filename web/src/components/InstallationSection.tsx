"use client";

import React, { useState } from "react";

export default function InstallationSection() {
  const [quickCopied, setQuickCopied] = useState(false);
  const [sourceCopied, setSourceCopied] = useState(false);

  const copyQuick = async () => {
    try {
      await navigator.clipboard.writeText("npx blazeresolver demo --restaurant");
      setQuickCopied(true);
      setTimeout(() => setQuickCopied(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const copySource = async () => {
    try {
      await navigator.clipboard.writeText("git clone https://github.com/DikshantJangra/BlazeResolver");
      setSourceCopied(true);
      setTimeout(() => setSourceCopied(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <section id="products" className="relative z-10 ds-container flex flex-col items-center text-center scroll-mt-[100px] pt-ds-11 pb-ds-13" style={({"minHeight":"min(60vh, 720px)","opacity":"0","filter":"blur(10px)","transform":"translateY(40px)"}) as React.CSSProperties}><h2 className="ds-text-heading1 text-ds-primary">Join the DSH plugin ecosystem</h2><p className="ds-text-body text-ds-description max-w-[652px] mt-ds-5">BlazeResolver remains in developer preview and is still being tested by developers building agent harnesses. Its core plugins and APIs will continue to evolve. We look forward to exploring the limits of intelligence with developers worldwide using open-source infrastructure that is reusable and composable.</p><div className="flex flex-wrap items-center justify-center gap-ds-4 mt-ds-6"><a className="ds-btn-primary ds-btn-m" href="https://github.com/DikshantJangra/BlazeResolver" target="_blank" rel="noopener noreferrer"><svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path></svg>View on GitHub</a><a className="ds-btn-secondary ds-btn-m" href="https://github.com/DikshantJangra/BlazeResolver#readme" target="_blank" rel="noopener noreferrer"><svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M11.2426 4.75493V6.15532H4.75819V4.75493H11.2426Z" fill="currentColor"></path><path d="M9.40858 7.79498V9.19537H4.75819V7.79498H9.40858Z" fill="currentColor"></path><path d="M9.23437 0.590332C10.1936 0.590332 10.9696 0.589649 11.5889 0.656739C12.2212 0.725273 12.773 0.871816 13.2539 1.22119C13.5339 1.42469 13.7809 1.67064 13.9844 1.95068C14.3336 2.43146 14.4793 2.98356 14.5478 3.61572C14.6149 4.23495 14.6143 5.0112 14.6143 5.97022V10.0308C14.6143 10.9899 14.6149 11.766 14.5478 12.3853C14.4793 13.0174 14.3336 13.5696 13.9844 14.0503C13.7809 14.3303 13.534 14.5773 13.2539 14.7808C12.7731 15.1299 12.221 15.2757 11.5889 15.3442C10.9696 15.4113 10.1935 15.4106 9.23437 15.4106H6.76562C5.80648 15.4106 5.03039 15.4113 4.41113 15.3442C3.77896 15.2757 3.22686 15.13 2.74609 14.7808C2.46607 14.5773 2.22009 14.3303 2.0166 14.0503C1.66728 13.5695 1.52069 13.0175 1.45214 12.3853C1.38505 11.766 1.38574 10.9899 1.38574 10.0308V5.97022C1.38574 5.01121 1.38509 4.23495 1.45214 3.61572C1.52067 2.98356 1.6674 2.43146 2.0166 1.95068C2.21996 1.67084 2.46627 1.42458 2.74609 1.22119C3.22689 0.871868 3.7789 0.725286 4.41113 0.656739C5.03039 0.589646 5.80648 0.590332 6.76562 0.590332H9.23437ZM6.76562 1.99072C5.77546 1.99072 5.08883 1.99133 4.5625 2.04834C4.04951 2.10393 3.77179 2.20603 3.56933 2.35303C3.40814 2.47018 3.26556 2.61271 3.14843 2.77393C3.00154 2.97638 2.89931 3.25426 2.84375 3.76709C2.78678 4.2934 2.78613 4.98022 2.78613 5.97022V10.0308C2.78613 11.0208 2.78676 11.7076 2.84375 12.2339C2.89934 12.7467 3.00149 13.0246 3.14843 13.2271C3.2656 13.3883 3.40809 13.5308 3.56933 13.6479C3.7718 13.7949 4.04949 13.897 4.5625 13.9526C5.08883 14.0096 5.77545 14.0103 6.76562 14.0103H9.23437C10.2245 14.0103 10.9112 14.0096 11.4375 13.9526C11.9504 13.8971 12.2282 13.7949 12.4307 13.6479C12.5919 13.5308 12.7344 13.3882 12.8516 13.2271C12.9985 13.0246 13.1007 12.7467 13.1562 12.2339C13.2132 11.7076 13.2139 11.0208 13.2139 10.0308V5.97022C13.2139 4.9802 13.2132 4.2934 13.1562 3.76709C13.1007 3.25411 12.9985 2.9764 12.8516 2.77393C12.7344 2.61266 12.5919 2.47021 12.4307 2.35303C12.2282 2.20604 11.9505 2.10392 11.4375 2.04834C10.9111 1.99135 10.2245 1.99072 9.23437 1.99072H6.76562Z" fill="currentColor"></path></svg>Developer docs</a><a className="ds-btn-secondary ds-btn-m" href="https://github.com/DikshantJangra/BlazeResolver" target="_blank" rel="noopener noreferrer"><svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 1.5L13.5 4.5V11.5L8 14.5L2.5 11.5V4.5L8 1.5Z" stroke="currentColor" strokeWidth="1.2"></path><path d="M2.8 4.7L8 7.6L13.2 4.7M8 7.6V14.1" stroke="currentColor" strokeWidth="1.2"></path></svg>Community plugins</a></div></section>
  );
}
