"use client";

import { useEffect, useState } from "react";

type Claim = {
  claim: string;
  verdict: "supported" | "unsupported" | "contradicted";
  evidence: string;
};

type Verification = {
  agrees: boolean;
  supported: number;
  unsupported: number;
  contradicted: number;
  claims: Claim[];
  note: string | null;
};

const TONE: Record<Claim["verdict"], string> = {
  supported: "text-accent",
  unsupported: "text-refuse",
  contradicted: "text-refuse",
};

/**
 * Runs a second model over the answer and reports whether every claim actually
 * appears in the passages. The verifier never sees the question — see
 * app/api/verify/route.ts for why that matters.
 */
export default function Verdict({
  queryId,
  ready,
}: {
  queryId: number;
  /** Don't audit a half-written answer. */
  ready: boolean;
}) {
  const [v, setV] = useState<Verification | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState<1 | -1 | null>(null);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ queryId }),
        });
        const json = await res.json().catch(() => ({ error: "Bad response." }));
        if (cancelled) return;
        if (res.ok) setV(json as Verification);
        else setError(json.error ?? "Could not verify.");
      } catch {
        if (!cancelled) setError("Could not reach the verifier.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [queryId, ready]);

  async function rate(next: 1 | -1) {
    const value = rating === next ? 0 : next;
    setRating(value === 0 ? null : (value as 1 | -1));
    await fetch("/api/rate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ queryId, rating: value }),
    }).catch(() => {});
  }

  if (!ready) return null;

  const total = v ? v.claims.length : 0;
  const bad = v ? v.unsupported + v.contradicted : 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {!v && !error && (
          <span className="readout flex items-center gap-2 text-live">
            <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-current" />
            Second pass
          </span>
        )}

        {error && <span className="readout text-refuse">Second pass failed</span>}

        {v && (
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className={`readout flex items-center gap-2 border-b border-dotted border-current transition-opacity hover:opacity-70 ${
              v.agrees ? "text-accent" : "text-refuse"
            }`}
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
            {v.agrees
              ? `Second pass agrees · ${v.supported}/${total} claims sourced`
              : `Second pass disputes ${bad} of ${total}`}
          </button>
        )}

        <span className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Good answer"
            aria-pressed={rating === 1}
            onClick={() => rate(1)}
            className={`readout px-2 py-1 transition-colors ${
              rating === 1 ? "text-accent" : "text-faint hover:text-dim"
            }`}
          >
            Good
          </button>
          <button
            type="button"
            aria-label="Bad answer"
            aria-pressed={rating === -1}
            onClick={() => rate(-1)}
            className={`readout px-2 py-1 transition-colors ${
              rating === -1 ? "text-refuse" : "text-faint hover:text-dim"
            }`}
          >
            Bad
          </button>
        </span>
      </div>

      {v && open && (
        <ol className="flex flex-col gap-px">
          {v.claims.map((c, i) => (
            <li key={i} className="flex flex-col gap-1 bg-sunk px-3 py-2">
              <span className={`readout ${TONE[c.verdict]}`}>{c.verdict}</span>
              <span className="t-detail text-ink">{c.claim}</span>
              <span className="t-detail text-dim">{c.evidence}</span>
            </li>
          ))}
          {v.note && <li className="t-detail px-3 py-2 text-faint">{v.note}</li>}
        </ol>
      )}
    </div>
  );
}
