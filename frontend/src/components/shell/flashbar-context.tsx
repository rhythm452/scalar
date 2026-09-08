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

export type ActivityAction = "Created" | "Updated" | "Deleted";
export type ActivityResourceType = "Hosted zone" | "Record";

// Structured metadata describing the mutation outcome being announced. Passed on
// the same addFlash call that raises the toast -- the context appends the
// activity entry itself, so mutations never call a second function (ADR-021).
export interface ActivityInput {
  action: ActivityAction;
  resourceType: ActivityResourceType;
  resourceName: string;
  changeId?: string;
  changeStatus?: string;
}

export interface ActivityEntry extends ActivityInput {
  id: string;
  timestamp: string;
  outcome: "success" | "error";
}

interface FlashInput {
  type: FlashType;
  header?: string;
  content: ReactNode;
  activity?: ActivityInput;
}

interface FlashbarContextValue {
  items: FlashbarProps.MessageDefinition[];
  addFlash: (flash: FlashInput) => void;
  activities: ActivityEntry[];
  unreadCount: number;
  markNotificationsSeen: () => void;
}

const FlashbarContext = createContext<FlashbarContextValue | null>(null);

// UI-PARITY §4.1: success auto-dismisses after 8s, errors persist until dismissed.
const SUCCESS_AUTO_DISMISS_MS = 8_000;

// Session-scoped activity feed: in-memory only (React state, no persistence), so a
// hard reload starts empty. Capped so a long session can't grow it unbounded.
const MAX_ACTIVITIES = 50;

export function FlashbarProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<FlashbarProps.MessageDefinition[]>([]);
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const nextId = useRef(0);

  const dismiss = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const markNotificationsSeen = useCallback(() => {
    setUnreadCount(0);
  }, []);

  const addFlash = useCallback(
    ({ type, header, content, activity }: FlashInput) => {
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
      if (activity) {
        const entry: ActivityEntry = {
          ...activity,
          id: `activity-${nextId.current}`,
          timestamp: new Date().toISOString(),
          outcome: type === "success" ? "success" : "error",
        };
        setActivities((current) => [entry, ...current].slice(0, MAX_ACTIVITIES));
        setUnreadCount((current) => current + 1);
      }
      if (type === "success") {
        setTimeout(() => dismiss(id), SUCCESS_AUTO_DISMISS_MS);
      }
    },
    [dismiss],
  );

  const value = useMemo(
    () => ({ items, addFlash, activities, unreadCount, markNotificationsSeen }),
    [items, addFlash, activities, unreadCount, markNotificationsSeen],
  );

  return <FlashbarContext.Provider value={value}>{children}</FlashbarContext.Provider>;
}

export function useFlashbar(): FlashbarContextValue {
  const context = useContext(FlashbarContext);
  if (!context) {
    throw new Error("useFlashbar must be used within FlashbarProvider");
  }
  return context;
}
