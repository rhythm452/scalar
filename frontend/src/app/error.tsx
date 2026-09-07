"use client";

import { SegmentErrorBoundary } from "@/components/shell/segment-error";

export default function GlobalError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <SegmentErrorBoundary {...props} />;
}
