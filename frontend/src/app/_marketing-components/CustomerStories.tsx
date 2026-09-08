"use client";

import { useEffect, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";

interface Story {
  id: string;
  brand: string;
  brandClassName: string;
  headline: string;
  image: string;
}

// Real customer names/logos (Capital One, Netflix, McDonald's) are trademarked
// and are deliberately not reproduced here -- see the build report.
const stories: Story[] = [
  {
    id: "meridian",
    brand: "MERIDIAN",
    brandClassName: "text-white",
    headline: "Meridian Bank improves cloud resilience with Amazon Route 53",
    image:
      "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1600&q=70",
  },
  {
    id: "streamwave",
    brand: "streamwave",
    brandClassName: "text-red-500 italic",
    headline: "StreamWave improved application resiliency with Amazon Route 53",
    image:
      "https://images.unsplash.com/photo-1461151304267-38535e780c79?auto=format&fit=crop&w=1600&q=70",
  },
  {
    id: "quickbite",
    brand: "QuickBite",
    brandClassName: "text-yellow-400",
    headline: "QuickBite manages global traffic routing with Amazon Route 53",
    image:
      "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1600&q=70",
  },
];

export function CustomerStories() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % stories.length), 6000);
    return () => clearInterval(id);
  }, []);

  const story = stories[index]!;

  return (
    <section className="relative h-[480px] overflow-hidden bg-ink text-white sm:h-[520px]">
      {stories.map((s, i) => (
        <div
          key={s.id}
          className="absolute inset-0 bg-cover bg-center transition-opacity duration-700"
          style={{
            backgroundImage: `linear-gradient(to top, rgb(11 21 33 / 0.9), rgb(11 21 33 / 0.25)), url(${s.image})`,
            opacity: i === index ? 1 : 0,
          }}
          aria-hidden={i !== index}
        />
      ))}

      <div className="relative mx-auto flex h-full max-w-[1280px] flex-col justify-end px-6 pb-16">
        <div key={story.id} className="marketing-fade max-w-xl">
          <div className={`mb-4 text-2xl font-bold tracking-wide ${story.brandClassName}`}>
            {story.brand}
          </div>
          <h3 className="mb-4 text-3xl font-bold leading-tight sm:text-4xl">{story.headline}</h3>
          <a href="#" className="inline-flex items-center gap-2 font-medium hover:underline">
            Watch the video
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>

      <div className="absolute bottom-6 right-6 flex items-center gap-3">
        <button
          aria-label="Previous story"
          onClick={() => setIndex((i) => (i - 1 + stories.length) % stories.length)}
          className="rounded-full border border-white/40 p-2 hover:bg-white/10"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex gap-2">
          {stories.map((s, i) => (
            <button
              key={s.id}
              aria-label={`Go to ${s.brand} story`}
              onClick={() => setIndex(i)}
              className={`h-2 w-2 rounded-full transition-colors ${
                i === index ? "bg-white" : "bg-white/40"
              }`}
            />
          ))}
        </div>
        <button
          aria-label="Next story"
          onClick={() => setIndex((i) => (i + 1) % stories.length)}
          className="rounded-full border border-white/40 p-2 hover:bg-white/10"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}
