"use client";

import { useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";

export function FeedbackBanner() {
  const [answered, setAnswered] = useState<"yes" | "no" | null>(null);

  return (
    <section className="mx-auto max-w-[1280px] px-6 pb-16">
      <div className="flex flex-col items-start justify-between gap-6 rounded-2xl bg-gradient-to-r from-hero-from to-white px-8 py-8 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-xl font-semibold text-navy">
            Did you find what you were looking for today?
          </h3>
          <p className="mt-1 text-sm text-text-muted">
            Let us know so we can improve the quality of the content on our pages
          </p>
        </div>

        {answered ? (
          <p className="text-sm font-medium text-navy">Thanks for your feedback!</p>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={() => setAnswered("yes")}
              className="flex items-center gap-2 rounded-full bg-navy px-5 py-2.5 text-sm font-medium text-white hover:bg-navy-soft"
            >
              Yes
              <ThumbsUp className="h-4 w-4" />
            </button>
            <button
              onClick={() => setAnswered("no")}
              className="flex items-center gap-2 rounded-full bg-navy px-5 py-2.5 text-sm font-medium text-white hover:bg-navy-soft"
            >
              No
              <ThumbsDown className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
