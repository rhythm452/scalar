import Link from "next/link";
import { SubNav } from "./SubNav";

export function Hero() {
  return (
    <div className="bg-gradient-to-b from-hero-from to-hero-to">
      <div className="-mb-10 pt-6 sm:pt-8">
        <SubNav />
      </div>

      <div className="mx-auto max-w-[1280px] px-6 pb-20 pt-20 sm:pt-24">
        <nav className="mb-6 text-xs text-text-muted" aria-label="Breadcrumb">
          <a href="#" className="hover:underline">
            Products
          </a>{" "}
          <span className="mx-1">&gt;</span>
          <a href="#" className="hover:underline">
            Networking and Content Delivery
          </a>{" "}
          <span className="mx-1">&gt;</span>
          <span>Amazon Route 53</span>
        </nav>

        <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-navy sm:text-5xl">
          Amazon Route 53 - DNS service
        </h1>
        <p className="mt-4 max-w-xl text-lg text-text-muted">
          A reliable and cost-effective way to route end users to Internet applications
        </p>

        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            href="/login"
            className="rounded bg-navy px-6 py-3 text-sm font-semibold text-white hover:bg-navy-soft"
          >
            Get started with Route 53
          </Link>
          <button className="rounded border border-navy px-6 py-3 text-sm font-semibold text-navy hover:bg-white">
            Connect with an expert
          </button>
        </div>
      </div>
    </div>
  );
}
