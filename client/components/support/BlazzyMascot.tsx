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
    <img
      src="/blazyy.svg"
      alt={alt}
      className={`inline-block object-contain select-none ${className}`}
      loading="eager"
    />
  );
}

export function BlazzyBadge({ text = 'Blazzy AI' }: { text?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-orange-50 text-orange-800 text-[11px] font-bold border border-orange-200 shadow-xs">
      <BlazzyIcon className="w-3.5 h-3.5 shrink-0" />
      <span>{text}</span>
    </span>
  );
}

