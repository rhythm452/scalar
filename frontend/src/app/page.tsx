import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./_marketing.css";
import { Benefits } from "./_marketing-components/Benefits";
import { CustomerStories } from "./_marketing-components/CustomerStories";
import { FeedbackBanner } from "./_marketing-components/FeedbackBanner";
import { Footer } from "./_marketing-components/Footer";
import { Hero } from "./_marketing-components/Hero";
import { HowItWorks } from "./_marketing-components/HowItWorks";
import { MainNav } from "./_marketing-components/MainNav";
import { ReadMoreTile } from "./_marketing-components/ReadMoreTile";
import { TopUtilityBar } from "./_marketing-components/TopUtilityBar";
import { TwoTileGrid } from "./_marketing-components/TwoTileGrid";
import { UseCases } from "./_marketing-components/UseCases";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Amazon Route 53 - DNS service (marketing clone)",
  description:
    "Standalone visual clone of the Route 53 marketing page. Unrelated to the console app.",
};

// This is the public root ("/"). The console app lives at /route53 behind the
// session-cookie auth guard (src/proxy/auth-guard.ts); this page is the one
// path that guard now allows through unauthenticated. `marketing-root` scopes
// the isolated font/reset from _marketing.css -- the root layout above this
// page only sets a body background/text color and loads Cloudscape's
// normalize reset (see globals.css), both harmless here since every element
// on this page sets its own colors explicitly.
export default function RootMarketingPage() {
  return (
    <div className={`marketing-root ${inter.className}`}>
      <main id="top" className="bg-white">
        <TopUtilityBar />
        <MainNav />
        <Hero />
        <Benefits />
        <HowItWorks />
        <UseCases />
        <CustomerStories />
        <TwoTileGrid />
        <ReadMoreTile />
        <FeedbackBanner />
        <Footer />
      </main>
    </div>
  );
}
