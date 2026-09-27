import React from 'react';

export function BlazzyIcon({
  className = 'w-5 h-5',
  alt = 'Blazzy'
}: {
  className?: string;
  color?: string;
  alt?: string;
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block select-none shrink-0 ${className}`}
      role="img"
      aria-label={alt}
    >
      <circle cx="24" cy="24" r="22" fill="#FFF7ED" stroke="#FF7A00" strokeWidth="2.5" />
      {/* Headset band */}
      <path
        d="M12 24C12 17.3726 17.3726 12 24 12C30.6274 12 36 17.3726 36 24"
        stroke="#FF7A00"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* Left headphone */}
      <rect x="9" y="20" width="5" height="10" rx="2.5" fill="#FF7A00" />
      {/* Right headphone */}
      <rect x="34" y="20" width="5" height="10" rx="2.5" fill="#FF7A00" />
      {/* Headset microphone */}
      <path
        d="M36 27C36 32 30 35 27 35"
        stroke="#FF7A00"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="26" cy="35" r="2" fill="#FF7A00" />
      {/* Face Eyes */}
      <circle cx="19" cy="23" r="2.5" fill="#EA580C" />
      <circle cx="29" cy="23" r="2.5" fill="#EA580C" />
      <circle cx="20" cy="22" r="0.8" fill="#FFFFFF" />
      <circle cx="30" cy="22" r="0.8" fill="#FFFFFF" />
      {/* Smile */}
      <path
        d="M19 28C20.5 30.5 27.5 30.5 29 28"
        stroke="#EA580C"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function BlazzyBadge({ text = 'Blazzy AI' }: { text?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-orange-50 text-orange-800 text-[11px] font-bold border border-orange-200 shadow-xs select-none">
      <BlazzyIcon className="w-3.5 h-3.5" />
      <span>{text}</span>
    </span>
  );
}
