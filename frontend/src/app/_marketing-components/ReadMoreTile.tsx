import { ArrowRight } from "lucide-react";

export function ReadMoreTile() {
  return (
    <section className="mx-auto max-w-[1280px] px-6 pb-16">
      <a
        href="#"
        className="mesh-grid group relative flex min-h-[220px] flex-col justify-end overflow-hidden rounded-2xl p-8 text-white"
        style={{
          backgroundImage:
            "linear-gradient(135deg, var(--color-accent-blue-deep), var(--color-accent-blue-glow))",
        }}
      >
        <h3 className="mb-4 max-w-md text-2xl font-bold leading-snug">
          Read more about Amazon Route 53
        </h3>
        <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
      </a>
    </section>
  );
}
