import Link from "next/link";
import { db } from "@/lib/supabase";

// The owner's view of what JD actually did, newest first. Always live.
export const dynamic = "force-dynamic";

type Doc = { title: string; page_count: number; created_at: string };
type Query = {
  id: number;
  created_at: string;
  question: string;
  refused: boolean;
  admitted: number;
  top_score: number | null;
  floor: number;
  answer: string | null;
  rating: number | null;
};

type Event =
  | { kind: "upload"; at: string; doc: Doc }
  | { kind: "question"; at: string; q: Query };

const pacific = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function when(iso: string) {
  return pacific.format(new Date(iso));
}

function outcome(q: Query): { label: string; tone: string; detail: string } {
  if (q.answer?.startsWith("[FAILED]")) {
    return {
      label: "Failed",
      tone: "text-accent",
      detail: q.answer.replace("[FAILED] ", ""),
    };
  }
  if (q.refused) {
    return {
      label: "Not in sources",
      tone: "text-refuse",
      detail: "Nothing in JD's documents matched well enough, so it declined to answer.",
    };
  }
  if (!q.answer) {
    return {
      label: "No answer",
      tone: "text-accent",
      detail:
        "Found passages but no answer was saved — the reply broke partway (on Oct 3 this was the Anthropic account running out of credit).",
    };
  }
  return { label: "Answered", tone: "text-live", detail: q.answer };
}

export default async function ActivityPage() {
  const supabase = db();
  const [{ data: docs }, { data: queries }] = await Promise.all([
    supabase.from("documents").select("title, page_count, created_at").limit(1000),
    supabase
      .from("queries")
      .select("id, created_at, question, refused, admitted, top_score, floor, answer, rating")
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const { data: files } = await supabase.storage.from("feedback").list("", { limit: 100, sortBy: { column: "name", order: "desc" } });
  const wishes: { at: string; picks: string[]; note: string }[] = [];
  for (const f of files ?? []) {
    const { data } = await supabase.storage.from("feedback").download(f.name);
    if (data) {
      try { wishes.push(JSON.parse(await data.text())); } catch {}
    }
  }

  const d = (docs ?? []) as Doc[];
  const q = (queries ?? []) as Query[];

  const events: Event[] = [
    ...d.map((doc) => ({ kind: "upload" as const, at: doc.created_at, doc })),
    ...q.map((row) => ({ kind: "question" as const, at: row.created_at, q: row })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  const answered = q.filter((r) => outcome(r).label === "Answered").length;
  const broken = q.filter((r) => ["Failed", "No answer"].includes(outcome(r).label)).length;
  const last = events[0]?.at;

  const STATS = [
    { label: "Last activity", value: last ? when(last) : "—" },
    { label: "Questions", value: String(q.length) },
    { label: "Answered", value: String(answered) },
    { label: "Broke", value: String(broken), alarm: broken > 0 },
    { label: "Documents", value: String(d.length) },
  ];

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-10 px-5 py-8 sm:px-8">
      <header className="flex items-baseline justify-between gap-4 border-b border-rule pb-4">
        <div className="flex items-baseline gap-3">
          <h1 className="font-mono text-base tracking-[0.28em] text-ink">ACTIVITY</h1>
          <span className="readout text-faint">JD's uploads and questions · Pacific time</span>
        </div>
        <Link
          href="/"
          className="readout border border-rule px-3 py-2 text-dim transition-colors hover:border-accent hover:text-accent"
        >
          ← Ask
        </Link>
      </header>

      <section className="grid grid-cols-2 gap-px sm:grid-cols-5">
        {STATS.map((s) => (
          <div key={s.label} className="flex flex-col gap-1 bg-sunk px-3 py-3">
            <span className="readout text-faint">{s.label}</span>
            <span className={`readout-num ${s.alarm ? "text-accent" : "text-ink"}`}>
              {s.value}
            </span>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="readout">What JD asked for</h2>
        {wishes.length === 0 ? (
          <p className="t-detail text-faint">No answer yet. JD sees the question when he opens Leviathan.</p>
        ) : (
          <ul className="flex flex-col gap-px">
            {wishes.map((w) => (
              <li key={w.at} className="grid grid-cols-[8.5rem_1fr] gap-4 bg-panel px-4 py-3">
                <span className="readout-num text-faint">{when(w.at)}</span>
                <div className="flex min-w-0 flex-col gap-1">
                  {w.picks.map((p) => (
                    <span key={p} className="t-detail text-accent">· {p}</span>
                  ))}
                  {w.note && <p className="t-detail break-words text-ink">&ldquo;{w.note}&rdquo;</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="readout">Timeline</h2>
        {events.length === 0 && (
          <p className="t-detail text-faint">Nothing yet. Uploads and questions appear here.</p>
        )}
        <ol className="flex flex-col gap-px">
          {events.map((e) =>
            e.kind === "upload" ? (
              <li
                key={`d-${e.at}`}
                className="grid grid-cols-[8.5rem_1fr] gap-4 bg-panel px-4 py-3"
              >
                <span className="readout-num text-faint">{when(e.at)}</span>
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="readout text-dim">Uploaded</span>
                  <span className="t-detail break-words text-ink">
                    {e.doc.title}{" "}
                    <span className="text-faint">
                      · {e.doc.page_count} page{e.doc.page_count === 1 ? "" : "s"}
                    </span>
                  </span>
                </div>
              </li>
            ) : (
              <QuestionRow key={`q-${e.q.id}`} q={e.q} />
            )
          )}
        </ol>
      </section>
    </main>
  );
}

function QuestionRow({ q }: { q: Query }) {
  const o = outcome(q);
  return (
    <li className="grid grid-cols-[8.5rem_1fr] gap-4 bg-panel px-4 py-3">
      <span className="readout-num text-faint">{when(q.created_at)}</span>
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className={`readout ${o.tone}`}>{o.label}</span>
          <span className="readout text-faint">
            {q.admitted} passage{q.admitted === 1 ? "" : "s"} used
            {q.top_score != null && ` · best match ${q.top_score.toFixed(2)} (floor ${q.floor})`}
            {q.rating === 1 && " · rated good"}
            {q.rating === -1 && " · rated bad"}
          </span>
        </div>
        <p className="t-detail break-words text-ink">{q.question}</p>
        <details className="group">
          <summary className="readout cursor-pointer text-dim hover:text-accent">
            What JD got back
          </summary>
          <p className="t-detail mt-2 whitespace-pre-wrap break-words border-l-2 border-rule pl-3 text-dim">
            {o.detail}
          </p>
        </details>
      </div>
    </li>
  );
}
