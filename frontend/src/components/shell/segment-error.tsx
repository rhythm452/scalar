"use client";

import { useEffect } from "react";
import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import ContentLayout from "@cloudscape-design/components/content-layout";

export function SegmentError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <ContentLayout>
      <Box padding={{ top: "l" }}>
        <Alert type="error" header="Something went wrong" action={<Button onClick={onRetry}>Retry</Button>}>
          {message}
        </Alert>
      </Box>
    </ContentLayout>
  );
}

// Shared by both app/error.tsx and route53/error.tsx: retry must reset both Next's
// own error boundary and TanStack's QueryErrorResetBoundary, or a retried query that
// failed before would immediately fail again from the still-poisoned cache entry.
export function SegmentErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { reset: resetQueries } = useQueryErrorResetBoundary();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <SegmentError
      message={error.message || "An unexpected error occurred."}
      onRetry={() => {
        resetQueries();
        reset();
      }}
    />
  );
}
