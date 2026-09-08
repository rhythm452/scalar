"use client";

import { useEffect, useState } from "react";
import type { CollectionPreferencesProps } from "@cloudscape-design/components/collection-preferences";

export interface TablePreferences {
  pageSize: number;
  wrapLines: boolean;
  contentDisplay: readonly CollectionPreferencesProps.ContentDisplayItem[];
}

// UI-PARITY §4.3: column preferences persist to localStorage per table id. Shared by
// every server-driven table (zones now; records reuses it from Phase 5 onward).
export function useTablePreferences(storageKey: string, defaults: TablePreferences) {
  const [preferences, setPreferences] = useState<TablePreferences>(defaults);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored) setPreferences({ ...defaults, ...JSON.parse(stored) });
    } catch {
      // Corrupt or unavailable storage (private browsing) -- fall back to defaults.
    }
    // Only read on mount for a given key; `defaults` is a fresh literal every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const update = (next: TablePreferences) => {
    setPreferences(next);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Ignore write failures (e.g. storage quota, private browsing).
    }
  };

  return [preferences, update] as const;
}
