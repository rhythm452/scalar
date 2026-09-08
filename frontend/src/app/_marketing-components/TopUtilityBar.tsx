import { ChevronDown, User } from "lucide-react";

const links = ["Contact us", "AWS Marketplace", "Support"];

export function TopUtilityBar() {
  return (
    <div className="bg-ink text-xs text-white/80">
      <div className="mx-auto flex max-w-[1280px] items-center justify-end gap-6 px-6 py-2">
        <button className="flex items-center gap-1 hover:text-white">
          English
          <ChevronDown className="h-3 w-3" />
        </button>
        {links.map((link) => (
          <a key={link} href="#" className="hidden hover:text-white sm:inline">
            {link}
          </a>
        ))}
        <button className="hidden items-center gap-1 hover:text-white md:flex">
          My account
          <ChevronDown className="h-3 w-3" />
        </button>
        <button aria-label="Account" className="rounded-full border border-white/30 p-1 hover:border-white">
          <User className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
