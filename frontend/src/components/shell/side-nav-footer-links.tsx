"use client";

import { useRouter } from "next/navigation";
import Box from "@cloudscape-design/components/box";
import Icon from "@cloudscape-design/components/icon";
import SpaceBetween from "@cloudscape-design/components/space-between";

// SideNavigation has no footer slot (checked interfaces.d.ts), so this is a small
// hand-built addition pinned below it (UI-PARITY chrome-parity pass, Part B.5) rather
// than fighting the component's own layout model with a fake nav item.
export function SideNavFooterLinks() {
  const router = useRouter();

  return (
    <Box padding="s">
      <div style={{ borderTop: "1px solid var(--color-border-divider-default-hjhwtd, #e9ebed)" }}>
        <Box padding={{ top: "s" }}>
          <SpaceBetween size="xs">
            <SpaceBetween direction="horizontal" size="xs" alignItems="center">
              <Icon name="script" size="small" />
              <span
                role="link"
                tabIndex={0}
                style={{ cursor: "pointer", fontSize: "var(--font-size-body-s, 12px)" }}
                onClick={() => router.push("/route53/comingsoon/cloudshell")}
                onKeyDown={(event) => {
                  if (event.key === "Enter") router.push("/route53/comingsoon/cloudshell");
                }}
                data-testid="side-nav-cloudshell"
              >
                CloudShell
              </span>
            </SpaceBetween>
            <SpaceBetween direction="horizontal" size="xs" alignItems="center">
              <Icon name="gen-ai" size="small" />
              <Box fontSize="body-s" data-testid="side-nav-agent-toolkit">
                Agent Toolkit for AWS
              </Box>
            </SpaceBetween>
          </SpaceBetween>
        </Box>
      </div>
    </Box>
  );
}
