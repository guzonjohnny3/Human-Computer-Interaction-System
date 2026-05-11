"use client";

import type { SVGProps } from "react";

const base: SVGProps<SVGSVGElement> = {
  xmlns: "http://www.w3.org/2000/svg",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export function IconBadge(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <circle cx="12" cy="12" r="2" />
      <path d="M8 17h8" />
    </svg>
  );
}

export function IconUser(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4 20c1.5-3.5 4.7-5 8-5s6.5 1.5 8 5" />
    </svg>
  );
}

export function IconMail(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}

export function IconLock(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      <circle cx="12" cy="15.5" r="1.3" />
    </svg>
  );
}

export function IconShield(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3 4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export function IconKey(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="8" cy="14" r="3.5" />
      <path d="M10.5 12 21 1.5l-3 3 1 1-2 2 1 1-2.5 2.5" />
    </svg>
  );
}

export function IconBroom(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M14 4l6 6" />
      <path d="M13 5 5 13l6 6 8-8Z" />
      <path d="M5 13 2 22l9-3" />
      <path d="M9 17l-2 2" />
    </svg>
  );
}

export function IconChevron(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export function CsuccCrest(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 80 80"
      role="img"
      aria-label="CSUCC crest"
      {...props}
    >
      <defs>
        <linearGradient id="csucc-crest-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a52a2f" />
          <stop offset="100%" stopColor="#4d1015" />
        </linearGradient>
        <linearGradient id="csucc-crest-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fde26b" />
          <stop offset="100%" stopColor="#c98e0e" />
        </linearGradient>
      </defs>
      <path
        d="M40 4 6 16v22c0 18 16 32 34 38 18-6 34-20 34-38V16Z"
        fill="url(#csucc-crest-bg)"
        stroke="url(#csucc-crest-gold)"
        strokeWidth="2.5"
      />
      <text
        x="40"
        y="34"
        textAnchor="middle"
        fill="url(#csucc-crest-gold)"
        fontFamily="ui-serif, Georgia, serif"
        fontWeight="700"
        fontSize="14"
        letterSpacing="2"
      >
        CSUCC
      </text>
      <path
        d="M18 44h44M18 50h44M18 56h44"
        stroke="url(#csucc-crest-gold)"
        strokeWidth="1.4"
        opacity="0.55"
      />
      <circle cx="40" cy="64" r="3.5" fill="url(#csucc-crest-gold)" />
    </svg>
  );
}
