"use client";

import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { useRouter } from "next/navigation";
import { DEFAULT_AUTHENTICATED_PATH } from "@/lib/constants";

export function NotFoundContent() {
  const router = useRouter();

  return (
    <Box textAlign="center" padding={{ top: "xxxl" }}>
      <SpaceBetween size="m" alignItems="center">
        <Box variant="h1">Page not found</Box>
        <Box color="text-body-secondary">We can&apos;t find the page you&apos;re looking for.</Box>
        <Button onClick={() => router.push(DEFAULT_AUTHENTICATED_PATH)}>
          Go to Route 53 dashboard
        </Button>
      </SpaceBetween>
    </Box>
  );
}
