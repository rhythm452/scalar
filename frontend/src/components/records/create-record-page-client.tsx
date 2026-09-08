"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Spinner from "@cloudscape-design/components/spinner";
import { useSetBreadcrumbs } from "@/components/shell/breadcrumbs-context";
import { NavLink } from "@/components/shell/nav-link";
import { useHostedZone } from "@/hooks/use-hosted-zone";
import { isApiError } from "@/lib/error";
import { QuickCreateRecordForm } from "@/components/records/quick-create-record-form";
import { RecordWizard } from "@/components/records/record-wizard";

// UI-PARITY §2 /route53/hostedzones/{id}/records/create: route with
// ?mode=quick|wizard, default quick.
export function CreateRecordPageClient({ zoneId }: { zoneId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data, isLoading, isError, error } = useHostedZone(zoneId);

  const mode = searchParams.get("mode") === "wizard" ? "wizard" : "quick";
  const setMode = (next: "quick" | "wizard") => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("mode", next);
    router.replace(`${pathname}?${params.toString()}`);
  };

  useSetBreadcrumbs([
    { text: "Route 53", href: "/route53" },
    { text: "Hosted zones", href: "/route53/hostedzones" },
    { text: data?.zone.name ?? zoneId, href: `/route53/hostedzones/${zoneId}` },
    { text: "Create record", href: pathname },
  ]);

  if (isLoading) {
    return (
      <ContentLayout>
        <Box textAlign="center" padding={{ top: "xxxl" }}>
          <Spinner size="large" />
        </Box>
      </ContentLayout>
    );
  }

  if (isError || !data) {
    return (
      <ContentLayout>
        <SpaceBetween size="m">
          <Alert type="error" header="Hosted zone not found">
            {isApiError(error) ? error.message : "This hosted zone could not be found."}
          </Alert>
          <NavLink href="/route53/hostedzones">Back to hosted zones</NavLink>
        </SpaceBetween>
      </ContentLayout>
    );
  }

  return (
    <ContentLayout
      header={<Header variant="h1">{mode === "wizard" ? "Create record" : "Quick create record"}</Header>}
    >
      {mode === "wizard" ? (
        <RecordWizard
          zoneId={zoneId}
          zoneName={data.zone.name}
          onSwitchToQuickCreate={() => setMode("quick")}
        />
      ) : (
        <QuickCreateRecordForm
          zoneId={zoneId}
          zoneName={data.zone.name}
          onSwitchToWizard={() => setMode("wizard")}
        />
      )}
    </ContentLayout>
  );
}
