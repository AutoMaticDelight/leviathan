"use client";

type TraceData = {
  corpusChunks: number;
  candidates: number;
  admitted: number;
  floor: number;
  stage: "searching" | "ranking" | "answering" | "refused";
};

const LABEL: Record<TraceData["stage"], string> = {
  searching: "Searching",
  ranking: "Ranking",
  answering: "Drafting",
  refused: "No match",
};

/**
 * The retrieval, narrated. This is the whole personality of the app: you can
 * see it think, so you know what it did and did not read.
 *
 * `active` is false once the request has finished or failed. A stage that says
 * "Searching" forever is worse than an error — it looks like it's still working.
 */
export default function Trace({
  data,
  active,
  answered,
}: {
  data: TraceData;
  /** false once the request has finished or failed */
  active: boolean;
  /** true if any answer text actually arrived */
  answered: boolean;
}) {
  const inFlight = data.stage === "searching" || data.stage === "answering";
  const done = inFlight && !active && answered;
  const halted = inFlight && !active && !answered;

  const label = done ? "Answered" : halted ? "Halted" : LABEL[data.stage];
  const tone = halted
    ? "text-refuse"
    : done
      ? "text-accent"
      : data.stage === "refused"
        ? "text-refuse"
        : inFlight
          ? "text-live"
          : "text-dim";

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-l-2 border-rule py-2 pl-4">
      <span className={`flex items-center gap-2 readout ${tone}`}>
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full bg-current ${
            inFlight && active ? "live-dot" : ""
          }`}
        />
        {label}
      </span>

      {data.corpusChunks > 0 && (
        <span className="readout tabular-nums">
          {data.corpusChunks.toLocaleString()} passages
        </span>
      )}
      {data.candidates > 0 && (
        <span className="readout tabular-nums">
          {data.candidates} candidates
        </span>
      )}
      {data.corpusChunks > 0 && (
        <span className="readout tabular-nums">
          <span className={data.admitted > 0 ? "text-accent" : "text-refuse"}>
            {data.admitted} admitted
          </span>
          <span className="text-faint"> · floor {data.floor}</span>
        </span>
      )}
    </div>
  );
}
