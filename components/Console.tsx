"use client";

import { useCallback, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { LeviathanUIMessage, SourcePassage } from "@/ai/types";
import Trace from "./Trace";
import Sources from "./Sources";
import VoiceButton from "./VoiceButton";

/** Paint [1] style citations in the accent colour so claims and sources link visually. */
function Cited({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\[\d+\])/g).map((piece, i) =>
        /^\[\d+\]$/.test(piece) ? (
          <span key={i} className="font-mono font-semibold text-accent">
            {piece}
          </span>
        ) : (
          <span key={i}>{piece}</span>
        )
      )}
    </>
  );
}

export default function Console() {
  const [input, setInput] = useState("");
  const [ingest, setIngest] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { messages, sendMessage, status, stop, error } =
    useChat<LeviathanUIMessage>({
      transport: new DefaultChatTransport({ api: "/api/ask" }),
    });

  const busy = status === "submitted" || status === "streaming";

  const upload = useCallback(async (file: File) => {
    setIngest(`Reading ${file.name}…`);
    const body = new FormData();
    body.append("file", file);
    try {
      const res = await fetch("/api/ingest", { method: "POST", body });
      // A crash upstream returns HTML, not JSON — don't let res.json() throw
      // and leave the message stuck on "Reading…" forever.
      const json = await res.json().catch(() => ({
        error: `Server returned ${res.status} with no detail. Check the terminal.`,
      }));
      setIngest(
        res.ok
          ? `${json.title} — ${json.pages} pages, ${json.chunks} passages indexed.`
          : `Failed: ${json.error}`
      );
    } catch {
      setIngest("Failed: could not reach the server.");
    }
  }, []);

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-8 px-5 py-8 sm:px-8">
      {/* masthead */}
      <header className="flex items-baseline justify-between gap-4 border-b border-rule pb-4">
        <div className="flex items-baseline gap-3">
          <h1 className="font-mono text-base tracking-[0.28em] text-ink">
            LEVIATHAN
          </h1>
          <span className="readout text-faint">closed universe</span>
        </div>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="readout border border-rule px-3 py-2 text-dim transition-colors hover:border-accent hover:text-accent"
          >
            + Add PDF
          </button>
        </div>
      </header>

      {ingest && (
        <p className="readout border-l-2 border-live pl-3 text-live">{ingest}</p>
      )}

      {/* transcript */}
      <div className="flex flex-1 flex-col gap-8">
        {messages.length === 0 && (
          <div className="flex flex-col gap-3 py-12">
            <p className="t-body text-dim">
              Ask a question. It answers only from the documents you have added,
              cites the passage every claim came from, and tells you plainly when
              it has nothing.
            </p>
            <p className="readout text-faint">
              Nothing here comes from the model&apos;s own memory.
            </p>
          </div>
        )}

        {messages.map((m, i) => {
          const isLast = i === messages.length - 1;
          const sources = m.parts.find((p) => p.type === "data-sources");
          const trace = m.parts.find((p) => p.type === "data-trace");
          const text = m.parts
            .filter((p) => p.type === "text")
            .map((p) => p.text)
            .join("");

          if (m.role === "user") {
            return (
              <p key={m.id} className="t-lead text-ink">
                <span className="mr-2 text-accent">›</span>
                {text}
              </p>
            );
          }

          return (
            <div key={m.id} className="flex flex-col gap-5">
              {trace && (
                <Trace
                  data={trace.data}
                  active={busy && isLast}
                  answered={text.length > 0}
                />
              )}
              {text && (
                <p className="whitespace-pre-wrap t-body text-ink">
                  <Cited text={text} />
                </p>
              )}
              {sources && (
                <Sources passages={sources.data.passages as SourcePassage[]} />
              )}
            </div>
          );
        })}

        {error && (
          <p className="readout border-l-2 border-refuse pl-3 text-refuse">
            {error.message}
          </p>
        )}
      </div>

      {/* input */}
      <form
        className="sticky bottom-0 flex gap-2 border-t border-rule bg-ground pb-2 pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!input.trim() || busy) return;
          sendMessage({ text: input });
          setInput("");
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask your sources…"
          className="h-12 min-w-0 flex-1 border border-rule bg-sunk px-3 t-body text-ink placeholder:text-faint focus:border-accent focus:outline-none"
        />
        <VoiceButton onTranscript={setInput} disabled={busy} />
        <button
          type={busy ? "button" : "submit"}
          onClick={busy ? stop : undefined}
          className="readout h-12 shrink-0 border border-accent px-5 text-accent transition-colors hover:bg-accent hover:text-ground"
        >
          {busy ? "Stop" : "Ask"}
        </button>
      </form>
    </main>
  );
}
