import Box from "@cloudscape-design/components/box";
import Link from "@cloudscape-design/components/link";
import SpaceBetween from "@cloudscape-design/components/space-between";

// UI-PARITY chrome-parity pass: dark navy bar matching the real console's footer.
// The CloudShell/Agent Toolkit row lives once, pinned to the side navigation
// (SideNavFooterLinks) rather than duplicated here -- in the real console both sit at
// the bottom-left of the viewport because the side nav itself is flush to that edge.
export function ConsoleFooter() {
  return (
    <Box padding={{ vertical: "s", horizontal: "l" }} className="r53-console-footer">
      <SpaceBetween direction="horizontal" size="l" alignItems="center">
        <Box fontSize="body-s" color="inherit">
          © 2026, Amazon Web Services, Inc. or its affiliates.
        </Box>
        <Box float="right">
          <SpaceBetween direction="horizontal" size="l">
            <Link color="inverted" href="https://aws.amazon.com/privacy/" external>
              Privacy
            </Link>
            <Link color="inverted" href="https://aws.amazon.com/terms/" external>
              Terms
            </Link>
            <Link color="inverted" href="https://aws.amazon.com/legal/cookies/" external>
              Cookie preferences
            </Link>
          </SpaceBetween>
        </Box>
      </SpaceBetween>
    </Box>
  );
}
