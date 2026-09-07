"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { BreadcrumbGroupProps } from "@cloudscape-design/components/breadcrumb-group";

type BreadcrumbItem = BreadcrumbGroupProps.Item;

interface BreadcrumbsContextValue {
  items: BreadcrumbItem[];
  setItems: (items: BreadcrumbItem[]) => void;
}

const BreadcrumbsContext = createContext<BreadcrumbsContextValue | null>(null);

const DEFAULT_ITEMS: BreadcrumbItem[] = [{ text: "Route 53", href: "/route53" }];

export function BreadcrumbsProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<BreadcrumbItem[]>(DEFAULT_ITEMS);

  return (
    <BreadcrumbsContext.Provider value={{ items, setItems }}>{children}</BreadcrumbsContext.Provider>
  );
}

export function useBreadcrumbsValue(): BreadcrumbItem[] {
  const context = useContext(BreadcrumbsContext);
  if (!context) {
    throw new Error("useBreadcrumbsValue must be used within BreadcrumbsProvider");
  }
  return context.items;
}

// Chosen over a pathname-keyed lookup table: a zone-detail breadcrumb (Phase 4) needs
// the zone's name, which only the page itself (with query data) can supply.
export function useSetBreadcrumbs(items: BreadcrumbItem[]): void {
  const context = useContext(BreadcrumbsContext);
  if (!context) {
    throw new Error("useSetBreadcrumbs must be used within BreadcrumbsProvider");
  }
  const key = JSON.stringify(items);
  const { setItems } = context;
  useEffect(() => {
    setItems(items);
    // `key` (a stable stringified snapshot) is the real dependency; `items`/`setItems`
    // are re-created every render by the caller and would loop otherwise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
