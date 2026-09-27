import React from 'react';

export function BlazzyIcon({ className = 'w-4 h-4', color = '#FF7A00' }: { className?: string; color?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Blazzy Mascot"
    >
      <path
        d="M12 2C6.477 2 2 6.477 2 12C2 17.523 6.477 22 12 22C17.523 22 22 17.523 22 12C22 6.477 17.523 2 12 2Z"
        fill={color}
        fillOpacity="0.15"
      />
      <path
        d="M12 4C7.582 4 4 7.582 4 12C4 16.418 7.582 20 12 20C16.418 20 20 16.418 20 12C20 7.582 16.418 4 12 4Z"
        stroke={color}
        strokeWidth="1.75"
      />
      <path
        d="M13 7L8 13H12L11 17L16 11H12L13 7Z"
        fill={color}
        stroke={color}
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BlazzyBadge({ text = 'Blazzy AI' }: { text?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-orange-50 text-orange-800 text-[11px] font-bold border border-orange-200 shadow-2xs">
      <BlazzyIcon className="w-3.5 h-3.5 shrink-0" color="#EA580C" />
      <span>{text}</span>
    </span>
  );
}
