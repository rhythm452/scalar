"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { FlashbarProps } from "@cloudscape-design/components/flashbar";

type FlashType = NonNullable<FlashbarProps.MessageDefinition["type"]>;

interface FlashInput {
  type: FlashType;
  header?: string;
  content: ReactNode;
}

interface FlashbarContextValue {
  items: FlashbarProps.MessageDefinition[];
  addFlash: (flash: FlashInput) => void;
}

const FlashbarContext = createContext<FlashbarContextValue | null>(null);

// UI-PARITY §4.1: success auto-dismisses after 8s, errors persist until dismissed.
const SUCCESS_AUTO_DISMISS_MS = 8_000;

export function FlashbarProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<FlashbarProps.MessageDefinition[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const addFlash = useCallback(
    ({ type, header, content }: FlashInput) => {
      const id = `flash-${(nextId.current += 1)}`;
      setItems((current) => [
        ...current,
        {
          id,
          type,
          header,
          content,
          dismissible: true,
          onDismiss: () => dismiss(id),
        },
      ]);
      if (type === "success") {
        setTimeout(() => dismiss(id), SUCCESS_AUTO_DISMISS_MS);
      }
    },
    [dismiss],
  );

  const value = useMemo(() => ({ items, addFlash }), [items, addFlash]);

  return <FlashbarContext.Provider value={value}>{children}</FlashbarContext.Provider>;
}

export function useFlashbar(): FlashbarContextValue {
  const context = useContext(FlashbarContext);
  if (!context) {
    throw new Error("useFlashbar must be used within FlashbarProvider");
  }
  return context;
}
