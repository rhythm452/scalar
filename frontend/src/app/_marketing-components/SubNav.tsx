"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

const tabs = ["Overview", "Features", "Pricing", "Resources", "FAQs"];

export function SubNav() {
  const [active, setActive] = useState("Overview");

  return (
    <div className="relative z-20 mx-auto max-w-[1280px] px-4 sm:px-6">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-2 rounded-2xl bg-white px-6 py-4 shadow-lg shadow-black/5">
        <span className="text-base font-semibold text-text">Amazon Route 53</span>
        <div className="flex flex-wrap items-center gap-6 text-sm font-medium text-text-muted">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActive(tab)}
              className={`flex items-center gap-1 border-b-2 pb-1 transition-colors ${
                active === tab
                  ? "border-navy text-navy"
                  : "border-transparent hover:text-navy"
              }`}
            >
              {tab}
              {tab === "Features" && <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
