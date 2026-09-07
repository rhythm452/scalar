"use client";

import ColumnLayout from "@cloudscape-design/components/column-layout";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import Spinner from "@cloudscape-design/components/spinner";
import type { DashboardSummary } from "@/types/dashboard";

interface DashboardCardsProps {
  summary: DashboardSummary | undefined;
  isLoading: boolean;
}

// Pure presentational, kept separate from data-fetching for isolated component
// testing. Card titles per docs/UI-PARITY.md §2: "Hosted zones (N)", "Records (N)",
// "Health checks (0)", "Traffic policies (0)".
export function DashboardCards({ summary, isLoading }: DashboardCardsProps) {
  const cards: { label: string; count: number }[] = [
    { label: "Hosted zones", count: summary?.zones ?? 0 },
    { label: "Records", count: summary?.records ?? 0 },
    { label: "Health checks", count: summary?.health_checks ?? 0 },
    { label: "Traffic policies", count: summary?.traffic_policies ?? 0 },
  ];

  return (
    <ColumnLayout columns={4} borders="vertical">
      {cards.map((card) => (
        <Container
          key={card.label}
          header={
            <Header variant="h2">{isLoading ? <Spinner /> : `${card.label} (${card.count})`}</Header>
          }
        />
      ))}
    </ColumnLayout>
  );
}
