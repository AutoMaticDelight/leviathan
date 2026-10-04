"use client";

import { useEffect, useState } from "react";

const OPTIONS = [
  "Quick lookups during a session",
  "Catch contradictions between my notes",
  "A page per nation, faction and character",
  "A map of who's allied, trading or at war",
  "Spot gaps in my world (missing leaders, cut-off details)",
  "Help prepping sessions from my notes",
];

const KEY = "leviathan.wish.sent";

/** Asks the reader what would help their campaign most; answers land on /activity. */
export default function WishCard() {
  const [hidden, setHidden] = useState(true);
  const [picks, setPicks] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  useEffect(() => {
    try {
      setHidden(localStorage.getItem(KEY) === "1");
    } catch {
      setHidden(false);
    }
  }, []);

  if (hidden) return null;

  const toggle = (o: string) =>
    setPicks((p) => (p.includes(o) ? p.filter((x) => x !== o) : [...p, o]));

  async function send() {
    setState("sending");
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ picks, note }),
    }).catch(() => null);
    if (res?.ok) {
      setState("sent");
      try {
        localStorage.setItem(KEY, "1");
      } catch {}
    } else setState("error");
  }

  if (state === "sent") {
    return (
      <p className="readout border-l-2 border-live pl-3 text-live">
        Thanks — that goes straight to Bryan, and it shapes what gets built next.
      </p>
    );
  }

  return (
    <section className="flex flex-col gap-4 border border-rule bg-panel p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="readout text-accent">What would help your campaign most?</h2>
        <button
          type="button"
          onClick={() => setHidden(true)}
          className="readout text-faint hover:text-dim"
        >
          Later
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map((o) => {
          const on = picks.includes(o);
          return (
            <button
              key={o}
              type="button"
              onClick={() => toggle(o)}
              aria-pressed={on}
              className={`t-detail border px-3 py-2 text-left transition-colors ${
                on ? "border-accent text-accent" : "border-rule text-dim hover:border-dim"
              }`}
            >
              {o}
            </button>
          );
        })}
      </div>
      <label className="flex flex-col gap-2">
        <span className="readout text-faint">Anything else? What's annoying, what you wish it did</span>
        <textarea
          id="wish-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="border border-rule bg-sunk px-3 py-2 t-body text-ink focus:border-accent focus:outline-none"
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={state === "sending" || (picks.length === 0 && !note.trim())}
          onClick={send}
          className="readout border border-accent px-4 py-2 text-accent disabled:opacity-40"
        >
          {state === "sending" ? "Sending…" : "Send to Bryan"}
        </button>
        {state === "error" && <span className="readout text-refuse">Didn't send — try again.</span>}
      </div>
    </section>
  );
}
