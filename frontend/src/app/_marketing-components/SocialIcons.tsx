// lucide-react dropped brand-specific glyphs (X/Twitter, Facebook, LinkedIn,
// Instagram, Twitch, YouTube) over trademark concerns, so these are plain
// hand-rolled SVGs -- generic enough to represent "a link to this platform"
// without reproducing any brand's actual logo artwork.
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function XIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 4l16 16M20 4L4 20" />
    </svg>
  );
}

export function FacebookIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M14 9h3V6h-3c-1.7 0-3 1.3-3 3v2H9v3h2v6h3v-6h3l1-3h-4V9c0-.6.4-1 1-1z" />
    </svg>
  );
}

export function LinkedInIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="9" width="4" height="10" />
      <circle cx="5" cy="5" r="1.6" />
      <path d="M11 19v-6a3 3 0 0 1 6 0v6M11 9v10" />
    </svg>
  );
}

export function InstagramIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17" cy="7" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function TwitchIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M5 4h15v10l-4 4h-4l-3 3v-3H5z" />
      <path d="M13 8v4M17 8v4" />
    </svg>
  );
}

export function YoutubeIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="6" width="18" height="12" rx="3" />
      <path d="M11 9.5l4 2.5-4 2.5z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function PodcastIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="10" r="3" />
      <path d="M9 13.5C7.5 15 7.5 18 9 20M15 13.5c1.5 1.5 1.5 4.5 0 6" />
      <path d="M12 13v8" />
    </svg>
  );
}
