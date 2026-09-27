import React from 'react';

export function BlazzyIcon({
  className = 'w-5 h-5',
  alt = 'BlazeResolver',
  src = '/blazyy.svg'
}: {
  className?: string;
  color?: string;
  alt?: string;
  src?: string;
}) {
  return (
    <img
      src={src}
      alt={alt}
      className={`inline-block select-none shrink-0 object-contain ${className}`}
      draggable={false}
    />
  );
}

export function BlazzyBadge({ text = 'Blazzy AI', src }: { text?: string; src?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-orange-50 text-orange-800 text-[11px] font-bold border border-orange-200 shadow-xs select-none">
      <BlazzyIcon src={src} className="w-3.5 h-3.5" />
      <span>{text}</span>
    </span>
  );
}
