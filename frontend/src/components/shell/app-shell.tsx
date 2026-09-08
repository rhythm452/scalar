"use client";

import { useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import AppLayout from "@cloudscape-design/components/app-layout";
import Badge from "@cloudscape-design/components/badge";
import BreadcrumbGroup from "@cloudscape-design/components/breadcrumb-group";
import Flashbar from "@cloudscape-design/components/flashbar";
import Input from "@cloudscape-design/components/input";
import SideNavigation, { type SideNavigationProps } from "@cloudscape-design/components/side-navigation";
import SplitPanel from "@cloudscape-design/components/split-panel";
import TopNavigation, { type TopNavigationProps } from "@cloudscape-design/components/top-navigation";
import { useLogout } from "@/hooks/use-logout";
import { useSession } from "@/hooks/use-session";
import { useTheme } from "@/hooks/use-theme";
import { buildThemeMenuGroup, handleThemeMenuItemClick } from "@/components/shell/theme-toggle";
import { BreadcrumbsProvider, useBreadcrumbsValue } from "@/components/shell/breadcrumbs-context";
import { FlashbarProvider, useFlashbar } from "@/components/shell/flashbar-context";
import { NotificationsPanel } from "@/components/shell/notifications-panel";
import { SplitPanelProvider, useSplitPanelValue } from "@/components/shell/split-panel-context";
import { ConsoleFooter } from "@/components/shell/console-footer";
import { SideNavFooterLinks } from "@/components/shell/side-nav-footer-links";
import { DEFAULT_AUTHENTICATED_PATH } from "@/lib/constants";

// UI-PARITY §1 sections: grouped to match the real console's nav taxonomy (Global
// Resolver / VPC Resolver / Domains / IP-based routing / Traffic flow). Only Hosted
// zones has a real destination -- every other leaf routes to the Coming Soon pattern
// (docs/ROADMAP.md; Phase 6 introduced the pattern, this phase extends its coverage).
const NAV_ITEMS: SideNavigationProps.Item[] = [
  { type: "link", text: "Dashboard", href: DEFAULT_AUTHENTICATED_PATH },
  { type: "link", text: "Hosted zones", href: "/route53/hostedzones" },
  { type: "link", text: "Health checks", href: "/route53/healthchecks" },
  { type: "link", text: "Profiles", href: "/route53/profiles" },
  {
    type: "expandable-link-group",
    text: "Global Resolver",
    href: "#global-resolver",
    items: [
      {
        type: "link",
        text: "Global resolvers",
        href: "/route53/comingsoon/global-resolvers",
        info: <Badge color="blue">New</Badge>,
      },
      {
        type: "link",
        text: "Shared DNS views",
        href: "/route53/comingsoon/shared-views",
        info: <Badge color="blue">New</Badge>,
      },
    ],
  },
  {
    type: "expandable-link-group",
    text: "VPC Resolver",
    href: "#vpc-resolver",
    items: [
      { type: "link", text: "VPCs", href: "/route53/comingsoon/vpcs" },
      { type: "link", text: "Inbound endpoints", href: "/route53/comingsoon/inbound-endpoints" },
      { type: "link", text: "Outbound endpoints", href: "/route53/comingsoon/outbound-endpoints" },
      { type: "link", text: "Rules", href: "/route53/comingsoon/rules" },
      { type: "link", text: "Query logging", href: "/route53/comingsoon/query-logging" },
      { type: "link", text: "Outposts", href: "/route53/comingsoon/outposts" },
    ],
  },
  {
    type: "expandable-link-group",
    text: "Domains",
    href: "#domains",
    items: [
      { type: "link", text: "Registered domains", href: "/route53/domains" },
      { type: "link", text: "Requests", href: "/route53/comingsoon/domain-requests" },
    ],
  },
  {
    type: "expandable-link-group",
    text: "IP-based routing",
    href: "#ip-based-routing",
    items: [{ type: "link", text: "CIDR collections", href: "/route53/comingsoon/cidr-collections" }],
  },
  {
    type: "expandable-link-group",
    text: "Traffic flow",
    href: "#traffic-flow",
    items: [
      { type: "link", text: "Traffic policies", href: "/route53/trafficpolicies" },
      { type: "link", text: "Policy records", href: "/route53/comingsoon/policy-records" },
    ],
  },
  { type: "divider" },
  {
    type: "link",
    text: "DNS Firewall",
    href: "https://aws.amazon.com/route53/dns-firewall/",
    external: true,
  },
  {
    type: "link",
    text: "Application Recovery Controller",
    href: "https://aws.amazon.com/route53/application-recovery-controller/",
    external: true,
  },
];

const TOP_NAV_ID = "r53-top-navigation";

function AppShellContent({ children }: { children: ReactNode }) {
  const [navigationOpen, setNavigationOpen] = useState(true);
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const logout = useLogout();
  const theme = useTheme();
  const breadcrumbItems = useBreadcrumbsValue();
  const { items: flashItems, unreadCount, markNotificationsSeen } = useFlashbar();
  const [activeDrawerId, setActiveDrawerId] = useState<string | null>(null);
  const splitPanel = useSplitPanelValue();
  const [splitPanelPreferences, setSplitPanelPreferences] = useState<{ position: "side" | "bottom" }>({
    position: "side",
  });

  const user = session?.user;

  // The account menu carries both identity (sign-out) and theme controls -- the real
  // console has no separate top-level "Theme" nav item (UI-PARITY chrome-parity pass).
  const identityUtility: TopNavigationProps.MenuDropdownUtility = {
    type: "menu-dropdown",
    text: user?.display_name ?? user?.username ?? "Account",
    description: user?.aws_account_id,
    iconName: "user-profile",
    items: [buildThemeMenuGroup(theme), { id: "sign-out", text: "Sign out", iconName: "sign-out" }],
    onItemClick: ({ detail }) => {
      if (handleThemeMenuItemClick(theme, detail.id)) return;
      if (detail.id === "sign-out") logout.mutate();
    },
  };

  const goTo = (href: string) => {
    router.push(href);
  };

  return (
    <>
      <div id={TOP_NAV_ID}>
        <TopNavigation
          identity={{
            title: "Route 53",
            href: DEFAULT_AUTHENTICATED_PATH,
            onFollow: (event) => {
              event.preventDefault();
              goTo(DEFAULT_AUTHENTICATED_PATH);
            },
          }}
          search={
            // Non-functional stub: matches the real console's search-box placement
            // in the chrome, but wires to nothing yet (UI-PARITY chrome-parity pass).
            <Input type="search" placeholder="Search" value="" readOnly ariaLabel="Search" />
          }
          utilities={[
            {
              type: "button",
              iconName: "script",
              text: "CloudShell",
              ariaLabel: "CloudShell",
              disableTextCollapse: true,
              href: "/route53/comingsoon/cloudshell",
              onFollow: (event) => {
                event.preventDefault();
                goTo("/route53/comingsoon/cloudshell");
              },
            },
            {
              type: "button",
              iconName: "notification",
              ariaLabel:
                unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications",
              // TopNavigation's utility badge is boolean-only (a dot, no count) --
              // the unread count travels in the aria label and the panel itself
              // rather than a custom badge overlay.
              badge: unreadCount > 0,
              onClick: () => {
                markNotificationsSeen();
                setActiveDrawerId("notifications");
              },
            },
            {
              type: "button",
              iconName: "status-info",
              ariaLabel: "Help",
              href: "/route53/comingsoon/help",
              onFollow: (event) => {
                event.preventDefault();
                goTo("/route53/comingsoon/help");
              },
            },
            identityUtility,
          ]}
        />
      </div>
      <AppLayout
        headerSelector={`#${TOP_NAV_ID}`}
        navigationOpen={navigationOpen}
        onNavigationChange={({ detail }) => setNavigationOpen(detail.open)}
        toolsHide
        navigation={
          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
              <SideNavigation
                header={{ text: "Route 53", href: DEFAULT_AUTHENTICATED_PATH }}
                activeHref={pathname}
                items={NAV_ITEMS}
                onFollow={(event) => {
                  if (event.detail.external) return;
                  event.preventDefault();
                  if (event.detail.href.startsWith("#")) return;
                  goTo(event.detail.href);
                }}
              />
            </div>
            <SideNavFooterLinks />
          </div>
        }
        breadcrumbs={
          <BreadcrumbGroup
            items={breadcrumbItems}
            onFollow={(event) => {
              event.preventDefault();
              goTo(event.detail.href);
            }}
          />
        }
        notifications={flashItems.length > 0 ? <Flashbar items={flashItems} /> : undefined}
        drawers={[
          {
            id: "notifications",
            content: <NotificationsPanel />,
            ariaLabels: { drawerName: "Notifications", closeButton: "Close notifications panel" },
            badge: unreadCount > 0,
          },
        ]}
        activeDrawerId={activeDrawerId}
        onDrawerChange={({ detail }) => setActiveDrawerId(detail.activeDrawerId)}
        content={children}
        splitPanel={
          splitPanel.panel ? (
            // UI-PARITY §1 "Edit drawer": record edit renders as a SplitPanel matching
            // the console's edit drawer, position side, width ~400 (Cloudscape default).
            <SplitPanel header={splitPanel.panel.header} closeBehavior="hide" hidePreferencesButton>
              {splitPanel.panel.content}
            </SplitPanel>
          ) : undefined
        }
        splitPanelOpen={splitPanel.open}
        onSplitPanelToggle={({ detail }) => splitPanel.setOpen(detail.open)}
        splitPanelPreferences={splitPanelPreferences}
        onSplitPanelPreferencesChange={({ detail }) => setSplitPanelPreferences(detail)}
      />
      <ConsoleFooter />
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <BreadcrumbsProvider>
      <FlashbarProvider>
        <SplitPanelProvider>
          <AppShellContent>{children}</AppShellContent>
        </SplitPanelProvider>
      </FlashbarProvider>
    </BreadcrumbsProvider>
  );
}
