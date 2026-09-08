"use client";

import { useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import AppLayout from "@cloudscape-design/components/app-layout";
import BreadcrumbGroup from "@cloudscape-design/components/breadcrumb-group";
import Flashbar from "@cloudscape-design/components/flashbar";
import SideNavigation, { type SideNavigationProps } from "@cloudscape-design/components/side-navigation";
import TopNavigation, { type TopNavigationProps } from "@cloudscape-design/components/top-navigation";
import { useLogout } from "@/hooks/use-logout";
import { useSession } from "@/hooks/use-session";
import { useTheme } from "@/hooks/use-theme";
import { buildThemeUtility } from "@/components/shell/theme-toggle";
import { BreadcrumbsProvider, useBreadcrumbsValue } from "@/components/shell/breadcrumbs-context";
import { FlashbarProvider, useFlashbar } from "@/components/shell/flashbar-context";
import { DEFAULT_AUTHENTICATED_PATH } from "@/lib/constants";

// UI-PARITY §1 sections: Hosted zones, Health checks, Traffic policies, Resolver,
// Profiles, Domains. Only Hosted zones has a real destination until Phase 4/6 land --
// the rest 404 via app/not-found.tsx until then, which is expected this phase.
const NAV_ITEMS: SideNavigationProps.Item[] = [
  { type: "link", text: "Hosted zones", href: "/route53/hostedzones" },
  { type: "link", text: "Health checks", href: "/route53/healthchecks" },
  { type: "link", text: "Traffic policies", href: "/route53/trafficpolicies" },
  { type: "link", text: "Resolver", href: "/route53/resolver" },
  { type: "link", text: "Profiles", href: "/route53/profiles" },
  { type: "link", text: "Domains", href: "/route53/domains" },
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
  const { items: flashItems } = useFlashbar();

  const user = session?.user;
  const identityUtility: TopNavigationProps.MenuDropdownUtility = {
    type: "menu-dropdown",
    text: user?.display_name ?? user?.username ?? "Account",
    description: user?.aws_account_id,
    iconName: "user-profile",
    items: [{ id: "sign-out", text: "Sign out", iconName: "sign-out" }],
    onItemClick: () => logout.mutate(),
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
          utilities={[identityUtility, buildThemeUtility(theme)]}
        />
      </div>
      <AppLayout
        headerSelector={`#${TOP_NAV_ID}`}
        navigationOpen={navigationOpen}
        onNavigationChange={({ detail }) => setNavigationOpen(detail.open)}
        toolsHide
        navigation={
          <SideNavigation
            header={{ text: "Route 53", href: DEFAULT_AUTHENTICATED_PATH }}
            activeHref={pathname}
            items={NAV_ITEMS}
            onFollow={(event) => {
              if (event.detail.external) return;
              event.preventDefault();
              goTo(event.detail.href);
            }}
          />
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
        content={children}
      />
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <BreadcrumbsProvider>
      <FlashbarProvider>
        <AppShellContent>{children}</AppShellContent>
      </FlashbarProvider>
    </BreadcrumbsProvider>
  );
}
