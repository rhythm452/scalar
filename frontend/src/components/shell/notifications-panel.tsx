"use client";

import Box from "@cloudscape-design/components/box";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import StatusIndicator, { type StatusIndicatorProps } from "@cloudscape-design/components/status-indicator";
import { useFlashbar, type ActivityEntry } from "@/components/shell/flashbar-context";
import { formatRelativeDate } from "@/lib/format-date";

// Rendered inside AppLayout's native drawers slot (see AppShell): a right-edge
// slide-in, the same mechanism the real console uses for this panel. Native drawer
// chrome supplies the close control, so this file only owns the list content.
// No "Notification center" link: this clone has no notification-history page and
// the dashboard has no Notifications section, so there is nowhere to route it.
function ActivityRow({ entry }: { entry: ActivityEntry }) {
  const statusType: StatusIndicatorProps.Type =
    entry.outcome === "success" ? "success" : "error";
  return (
    <Box padding={{ vertical: "s" }}>
      <SpaceBetween size="xxs">
        <StatusIndicator type={statusType}>
          {entry.action} {entry.resourceType.toLowerCase()}
        </StatusIndicator>
        <Box variant="strong">{entry.resourceName}</Box>
        {entry.changeId ? (
          <Box variant="small" color="text-body-secondary">
            Change {entry.changeId}
            {entry.changeStatus ? `, status ${entry.changeStatus}` : ""}
          </Box>
        ) : null}
        <Box variant="small" color="text-body-secondary">
          {formatRelativeDate(entry.timestamp)}
        </Box>
      </SpaceBetween>
    </Box>
  );
}

export function NotificationsPanel() {
  const { activities } = useFlashbar();

  return (
    <SpaceBetween size="m">
      <Header variant="h2">Notifications</Header>
      {activities.length === 0 ? (
        <Box textAlign="center" color="inherit">
          <SpaceBetween size="xs">
            <Box variant="strong">No notifications</Box>
            <Box variant="p" color="text-body-secondary">
              Actions you take in this session will appear here.
            </Box>
          </SpaceBetween>
        </Box>
      ) : (
        <SpaceBetween size="xs">
          {activities.map((entry) => (
            <ActivityRow key={entry.id} entry={entry} />
          ))}
        </SpaceBetween>
      )}
    </SpaceBetween>
  );
}
