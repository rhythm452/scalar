import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { FlashbarProvider, useFlashbar } from "@/components/shell/flashbar-context";

function setup() {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <FlashbarProvider>{children}</FlashbarProvider>
  );
  return renderHook(() => useFlashbar(), { wrapper });
}

describe("flashbar context activity log", () => {
  it("logs a notification entry from the same call that raises the flash", () => {
    const { result } = setup();

    act(() => {
      result.current.addFlash({
        type: "success",
        content: "Record created: www.example.com. A (Change C123, status PENDING).",
        activity: {
          action: "Created",
          resourceType: "Record",
          resourceName: "www.example.com. A",
          changeId: "C123",
          changeStatus: "PENDING",
        },
      });
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.activities).toHaveLength(1);
    expect(result.current.activities[0]).toMatchObject({
      action: "Created",
      resourceType: "Record",
      resourceName: "www.example.com. A",
      changeId: "C123",
      changeStatus: "PENDING",
      outcome: "success",
    });
    expect(result.current.unreadCount).toBe(1);
  });

  it("marks error outcomes and clears the badge when the panel is opened", () => {
    const { result } = setup();

    act(() => {
      result.current.addFlash({
        type: "error",
        content: "Record not created.",
        activity: { action: "Created", resourceType: "Record", resourceName: "x.example.com." },
      });
    });

    expect(result.current.activities[0]?.outcome).toBe("error");
    expect(result.current.unreadCount).toBe(1);

    act(() => {
      result.current.markNotificationsSeen();
    });
    expect(result.current.unreadCount).toBe(0);
    expect(result.current.activities).toHaveLength(1);
  });

  it("caps the log at 50 most recent entries", () => {
    const { result } = setup();

    act(() => {
      for (let i = 0; i < 55; i += 1) {
        result.current.addFlash({
          type: "success",
          content: `Hosted zone created: zone${i}.example.com.`,
          activity: {
            action: "Created",
            resourceType: "Hosted zone",
            resourceName: `zone${i}.example.com.`,
          },
        });
      }
    });

    expect(result.current.activities).toHaveLength(50);
    expect(result.current.activities[0]?.resourceName).toBe("zone54.example.com.");
  });

  it("starts empty on a fresh provider (session-scoped, no persistence)", () => {
    const { result } = setup();
    expect(result.current.activities).toHaveLength(0);
    expect(result.current.unreadCount).toBe(0);
  });
});
