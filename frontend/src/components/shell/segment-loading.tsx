"use client";

import Box from "@cloudscape-design/components/box";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Spinner from "@cloudscape-design/components/spinner";

export function SegmentLoading() {
  return (
    <ContentLayout>
      <Box textAlign="center" padding={{ top: "xxxl" }}>
        <Spinner size="large" />
      </Box>
    </ContentLayout>
  );
}
