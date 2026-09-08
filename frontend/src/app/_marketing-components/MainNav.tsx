"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Menu, Search, X } from "lucide-react";

const navItems = ["re:Invent", "Discover AWS", "Products", "Solutions", "Pricing", "Resources"];

export function MainNav() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="border-b border-border bg-white">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-6 py-3">
        <Link href="/" className="shrink-0 text-2xl font-bold italic tracking-tight text-navy">
          aws
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-text lg:flex">
          {navItems.map((item) => (
            <a key={item} href="#" className="flex items-center gap-1 hover:text-navy">
              {item}
              {["Products", "Solutions", "Resources"].includes(item) && (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-4 lg:flex">
          <button aria-label="Search" className="rounded p-2 text-text hover:bg-gray-100">
            <Search className="h-4 w-4" />
          </button>
          <a href="#" className="text-sm font-medium text-text hover:text-navy">
            Sign in to console
          </a>
          <button className="rounded bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-soft">
            Create account
          </button>
        </div>

        <button
          aria-label="Toggle menu"
          className="rounded p-2 text-navy lg:hidden"
          onClick={() => setMobileOpen((v) => !v)}
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="flex flex-col gap-3 border-t border-border px-6 py-4 text-sm font-medium text-text lg:hidden">
          {navItems.map((item) => (
            <a key={item} href="#" className="hover:text-navy">
              {item}
            </a>
          ))}
          <a href="#" className="hover:text-navy">
            Sign in to console
          </a>
          <button className="mt-2 w-full rounded bg-navy px-4 py-2 text-center text-white">
            Create account
          </button>
        </div>
      )}
    </div>
  );
}
