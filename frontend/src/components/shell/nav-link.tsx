"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import Button, { type ButtonProps } from "@cloudscape-design/components/button";

// Cloudscape's Button href does a real anchor navigation by default, which would
// drop the AppShell (and its React Query cache) on every internal link click.
// Every internal Button/link in Phase 4+ routes through this instead of ad hoc
// onFollow handlers (docs/ARCHITECTURE.md §5 keeps navigation client-side).
export function NavLink({
  href,
  children,
  variant = "inline-link",
}: {
  href: string;
  children: ReactNode;
  variant?: ButtonProps["variant"];
}) {
  const router = useRouter();
  return (
    <Button
      variant={variant}
      href={href}
      onFollow={(event) => {
        event.preventDefault();
        router.push(href);
      }}
    >
      {children}
    </Button>
  );
}
