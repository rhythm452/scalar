"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface SplitPanelState {
  header: string;
  content: ReactNode;
}

interface SplitPanelContextValue {
  panel: SplitPanelState | null;
  open: boolean;
  setPanel: (panel: SplitPanelState | null) => void;
  setOpen: (open: boolean) => void;
}

const SplitPanelContext = createContext<SplitPanelContextValue | null>(null);

export function SplitPanelProvider({ children }: { children: ReactNode }) {
  const [panel, setPanel] = useState<SplitPanelState | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <SplitPanelContext.Provider value={{ panel, open, setPanel, setOpen }}>
      {children}
    </SplitPanelContext.Provider>
  );
}

export function useSplitPanelValue(): SplitPanelContextValue {
  const context = useContext(SplitPanelContext);
  if (!context) {
    throw new Error("useSplitPanelValue must be used within SplitPanelProvider");
  }
  return context;
}

// UI-PARITY §1 "Edit drawer": a record-edit page sets the SplitPanel content and
// opens it; unmounting (navigating away) clears it so other pages start closed.
// Callers must pass a `panel` memoized with `useMemo` (stable across renders unless
// its real inputs change) -- a fresh object every render would re-fire the effect
// on every commit, since content deliberately isn't structurally compared.
export function useSetSplitPanel(panel: SplitPanelState | null): void {
  const context = useContext(SplitPanelContext);
  if (!context) {
    throw new Error("useSetSplitPanel must be used within SplitPanelProvider");
  }
  const { setPanel, setOpen } = context;
  useEffect(() => {
    setPanel(panel);
    setOpen(panel !== null);
    return () => {
      setPanel(null);
      setOpen(false);
    };
    // Re-run whenever the panel's identity changes; setPanel/setOpen are stable
    // context setters so omitting them avoids a spurious re-run loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel]);
}
