"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { SegmentLoading } from "@/components/shell/segment-loading";

// AppLayout measures the real viewport (ResizeObserver/matchMedia) on its first
// client render, which can never match an SSR pass that has no window -- that
// produced a genuine hydration mismatch (verified via a real browser: React's dev
// overlay flagged AppShellContent's internal <main> className). Disabling SSR for
// the shell entirely (rather than papering over it with suppressHydrationWarning
// on every affected internal element) is the standard fix for Cloudscape + Next.js.
const AppShell = dynamic(() => import("@/components/shell/app-shell").then((mod) => mod.AppShell), {
  ssr: false,
  loading: () => <SegmentLoading />,
});

export default function Route53Layout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
