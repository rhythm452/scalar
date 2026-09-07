import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@cloudscape-design/global-styles/index.css";
import "@/app/globals.css";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { Providers } from "@/app/providers";

export const metadata: Metadata = {
  title: "Route 53",
  description: "A Route 53 console clone.",
};

// No Cloudscape import here (docs/ARCHITECTURE.md §5) -- only the global CSS import
// and a raw blocking <script> that must run before hydration to avoid a theme flash.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* suppressHydrationWarning: THEME_INIT_SCRIPT mutates body's class list before
          hydration, on purpose, to avoid a theme flash -- React would otherwise warn
          that the server-rendered (class-less) body doesn't match the client. */}
      <body suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
