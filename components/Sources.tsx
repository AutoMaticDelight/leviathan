"use client";

import { useState } from "react";
import type { SourcePassage } from "@/ai/types";

/**
 * The passages the model was actually shown, numbered to match its [n]
 * citations. If a claim has no number, nothing here supports it.
 */
export default function Sources({ passages }: { passages: SourcePassage[] }) {
  const [open, setOpen] = useState<number | null>(null);
  if (passages.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="readout">Shown to the model</div>
      <ol className="flex flex-col gap-px">
        {passages.map((p, i) => {
          const isOpen = open === i;
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-baseline gap-3 bg-sunk px-3 py-2 text-left transition-colors hover:bg-rule/40"
              >
                <span className="readout-num text-accent">
                  [{i + 1}]
                </span>
                <span className="min-w-0 flex-1 truncate t-detail text-ink">
                  {p.title}
                  <span className="text-faint"> · p.{p.page}</span>
                </span>
                <span className="readout-num text-dim">
                  {p.similarity.toFixed(2)}
                </span>
              </button>
              {isOpen && (
                <p className="whitespace-pre-wrap border-l-2 border-accent bg-sunk/60 px-4 py-3 t-detail text-dim">
                  {p.content}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
