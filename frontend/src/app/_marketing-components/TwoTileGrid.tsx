import { ArrowRight } from "lucide-react";

export function TwoTileGrid() {
  return (
    <section className="mx-auto max-w-[1280px] px-6 py-16">
      <div className="grid gap-6 md:grid-cols-2">
        <a
          href="#"
          className="mesh-grid group relative flex min-h-[260px] flex-col justify-between overflow-hidden rounded-2xl p-8 text-white"
          style={{
            backgroundImage:
              "linear-gradient(135deg, var(--color-accent-blue-deep), var(--color-accent-blue))",
          }}
        >
          <span className="text-xs font-semibold uppercase tracking-wide text-white/70">
            Getting started
          </span>
          <div>
            <h3 className="mb-4 text-2xl font-bold leading-snug">
              Secure your Amazon VPC DNS resolution with Amazon Route 53 Resolver DNS Firewall
            </h3>
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </div>
        </a>

        <a
          href="#"
          className="mesh-grid group relative flex min-h-[260px] flex-col justify-between overflow-hidden rounded-2xl p-8 text-white"
          style={{
            backgroundImage:
              "linear-gradient(135deg, var(--color-accent-red-deep), var(--color-accent-red))",
          }}
        >
          <span className="text-xs font-semibold uppercase tracking-wide text-white/70">
            Contact us
          </span>
          <div>
            <h3 className="mb-4 text-2xl font-bold leading-snug">Connect with an expert</h3>
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </div>
        </a>
      </div>
    </section>
  );
}
