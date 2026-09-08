"use client";

import { useState, type ReactNode } from "react";
import { Minus, Plus } from "lucide-react";

export interface AccordionRow {
  id: string;
  title: string;
  body: ReactNode;
}

export function Accordion({
  rows,
  defaultOpenId,
}: {
  rows: AccordionRow[];
  defaultOpenId?: string;
}) {
  const [openIds, setOpenIds] = useState<Set<string>>(
    () => new Set(defaultOpenId ? [defaultOpenId] : []),
  );

  function toggle(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <div className="divide-y divide-border border-t border-border">
      {rows.map((row) => {
        const open = openIds.has(row.id);
        return (
          <div key={row.id}>
            <button
              onClick={() => toggle(row.id)}
              aria-expanded={open}
              className="flex w-full items-start justify-between gap-6 py-6 text-left"
            >
              <span className="text-lg font-medium text-text">{row.title}</span>
              <span className="mt-1 shrink-0 text-navy">
                {open ? <Minus className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
              </span>
            </button>
            {open && (
              <div className="marketing-fade pb-6 pr-10 text-sm leading-relaxed text-text-muted">
                {row.body}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
