"use client";

import { SegmentErrorBoundary } from "@/components/shell/segment-error";

export default function Route53Error(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <SegmentErrorBoundary {...props} />;
}
