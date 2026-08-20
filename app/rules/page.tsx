import Link from "next/link";
import { db } from "@/lib/supabase";
import {
  SIMILARITY_FLOOR,
  RETRIEVE_COUNT,
  CHUNK_SIZE,
  CHUNK_OVERLAP,
} from "@/lib/config";

// Always read live — a cached accuracy page is worse than none.
export const dynamic = "force-dynamic";

type QueryRow = {
  refused: boolean;
  top_score: number | null;
  rating: number | null;
};
type VerRow = {
  agrees: boolean;
  supported: number;
  unsupported: number;
  contradicted: number;
};

function pct(n: number, d: number) {
  return d === 0 ? "—" : `${Math.round((n / d) * 100)}%`;
}

export default async function RulesPage() {
  const supabase = db();
  const [{ data: queries }, { data: vers }] = await Promise.all([
    supabase.from("queries").select("refused, top_score, rating").limit(5000),
    supabase
      .from("verifications")
      .select("agrees, supported, unsupported, contradicted")
      .limit(5000),
  ]);

  const q = (queries ?? []) as QueryRow[];
  const v = (vers ?? []) as VerRow[];

  const asked = q.length;
  const refused = q.filter((r) => r.refused).length;
  const answered = asked - refused;
  const good = q.filter((r) => r.rating === 1).length;
  const bad = q.filter((r) => r.rating === -1).length;

  const checked = v.length;
  const agreed = v.filter((r) => r.agrees).length;
  const claims = v.reduce((n, r) => n + r.supported + r.unsupported + r.contradicted, 0);
  const unsourced = v.reduce((n, r) => n + r.unsupported + r.contradicted, 0);

  // Ten buckets of 0.1. Where answers land versus where refusals land is the
  // evidence for whether the floor sits in the right place.
  const buckets = Array.from({ length: 10 }, (_, i) => ({
    from: i / 10,
    answered: 0,
    refused: 0,
  }));
  for (const r of q) {
    if (r.top_score == null) continue;
    const i = Math.min(9, Math.max(0, Math.floor(r.top_score * 10)));
    if (r.refused) buckets[i].refused++;
    else buckets[i].answered++;
  }
  const tallest = Math.max(1, ...buckets.map((b) => b.answered + b.refused));

  const STATS = [
    { label: "Questions asked", value: String(asked) },
    { label: "Refused", value: `${refused}  ·  ${pct(refused, asked)}` },
    { label: "Answered", value: String(answered) },
    { label: "Second pass agreed", value: `${agreed}/${checked}  ·  ${pct(agreed, checked)}` },
    { label: "Claims checked", value: String(claims) },
    {
      label: "Claims unsourced",
      value: `${unsourced}  ·  ${pct(unsourced, claims)}`,
      alarm: unsourced > 0,
    },
    { label: "Rated good", value: String(good) },
    { label: "Rated bad", value: String(bad), alarm: bad > 0 },
  ];

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-10 px-5 py-8 sm:px-8">
      <header className="flex items-baseline justify-between gap-4 border-b border-rule pb-4">
        <div className="flex items-baseline gap-3">
          <h1 className="font-mono text-base tracking-[0.28em] text-ink">RULES</h1>
          <span className="readout text-faint">and the evidence</span>
        </div>
        <Link
          href="/"
          className="readout border border-rule px-3 py-2 text-dim transition-colors hover:border-accent hover:text-accent"
        >
          ← Ask
        </Link>
      </header>

      {/* ---- the contract ---- */}
      <section className="flex flex-col gap-4">
        <h2 className="readout">What it promises</h2>
        <ul className="flex flex-col gap-3">
          {[
            "It answers only from documents you have added. Nothing comes from the model's own knowledge.",
            "Every factual claim carries a citation to the passage it came from.",
            `Passages scoring below ${SIMILARITY_FLOOR} similarity are discarded before the model is called — it never sees them, so it cannot answer from them.`,
            "If nothing clears that floor, the model is never asked the question at all. The refusal is written by code, not by the model choosing to be honest.",
            "Every answer is then re-read by a second, more capable model that is never shown the original question — only the passages and the answer.",
          ].map((rule, i) => (
            <li key={i} className="grid grid-cols-[1.5rem_1fr] gap-3">
              <span className="readout-num text-accent">{String(i + 1).padStart(2, "0")}</span>
              <span className="t-detail text-ink">{rule}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ---- settings ---- */}
      <section className="flex flex-col gap-3">
        <h2 className="readout">Current settings</h2>
        <div className="grid grid-cols-2 gap-px sm:grid-cols-4">
          {[
            ["Floor", String(SIMILARITY_FLOOR)],
            ["Retrieved", String(RETRIEVE_COUNT)],
            ["Chunk", `${CHUNK_SIZE}c`],
            ["Overlap", `${CHUNK_OVERLAP}c`],
          ].map(([k, val]) => (
            <div key={k} className="flex flex-col gap-1 bg-sunk px-3 py-3">
              <span className="readout text-faint">{k}</span>
              <span className="readout-num text-ink">{val}</span>
            </div>
          ))}
        </div>
        <p className="t-detail text-dim">
          All four live in <span className="font-mono text-accent">lib/config.ts</span>. The
          floor is the one worth your own tuning — the chart below is the evidence.
        </p>
      </section>

      {/* ---- accuracy ---- */}
      <section className="flex flex-col gap-3">
        <h2 className="readout">Accuracy so far</h2>
        <div className="grid grid-cols-2 gap-px sm:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="flex flex-col gap-1 bg-sunk px-3 py-3">
              <span className="readout text-faint">{s.label}</span>
              <span className={`readout-num ${s.alarm ? "text-refuse" : "text-ink"}`}>
                {s.value}
              </span>
            </div>
          ))}
        </div>
        {checked === 0 && (
          <p className="t-detail text-faint">
            No answers verified yet. Ask something and the second pass runs automatically.
          </p>
        )}
      </section>

      {/* ---- floor evidence ---- */}
      <section className="flex flex-col gap-3">
        <h2 className="readout">Where the floor should sit</h2>
        <p className="t-detail text-dim">
          Best match per question, bucketed. If refusals cluster left of your floor and
          answers cluster right of it, the floor is in the right place. Overlap in the
          middle is where you are guessing.
        </p>
        <div className="flex flex-col gap-px">
          {buckets.map((b) => {
            const total = b.answered + b.refused;
            const isFloor =
              SIMILARITY_FLOOR >= b.from && SIMILARITY_FLOOR < b.from + 0.1;
            return (
              <div
                key={b.from}
                className={`grid grid-cols-[3.5rem_1fr_2.5rem] items-center gap-3 px-3 py-1.5 ${
                  isFloor ? "bg-accent/10" : ""
                }`}
              >
                <span
                  className={`readout-num ${isFloor ? "text-accent" : "text-faint"}`}
                >
                  {b.from.toFixed(1)}
                </span>
                <span className="flex h-3 items-stretch gap-px">
                  {b.answered > 0 && (
                    <span
                      className="bg-accent"
                      style={{ width: `${(b.answered / tallest) * 100}%` }}
                      title={`${b.answered} answered`}
                    />
                  )}
                  {b.refused > 0 && (
                    <span
                      className="bg-refuse"
                      style={{ width: `${(b.refused / tallest) * 100}%` }}
                      title={`${b.refused} refused`}
                    />
                  )}
                </span>
                <span className="readout-num text-right text-dim">{total || ""}</span>
              </div>
            );
          })}
        </div>
        <div className="flex gap-5">
          <span className="readout flex items-center gap-2 text-accent">
            <span className="inline-block h-2 w-3 bg-current" /> Answered
          </span>
          <span className="readout flex items-center gap-2 text-refuse">
            <span className="inline-block h-2 w-3 bg-current" /> Refused
          </span>
        </div>
      </section>

      <p className="t-detail border-t border-rule pt-4 text-faint">
        Every question and answer is stored so these numbers exist. Nothing here leaves
        your database.
      </p>
    </main>
  );
}
