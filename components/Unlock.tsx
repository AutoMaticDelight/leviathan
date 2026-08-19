"use client";

import { useState } from "react";

export default function Unlock() {
  const [attempt, setAttempt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 px-6">
      <div className="flex flex-col gap-3">
        <h1 className="font-mono text-base tracking-[0.28em] text-ink">
          LEVIATHAN
        </h1>
        <p className="t-detail text-dim">
          This instance is private. Enter the passphrase to continue.
        </p>
      </div>

      <form
        className="flex flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!attempt || busy) return;
          setBusy(true);
          setError(null);
          try {
            const res = await fetch("/api/unlock", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ attempt }),
            });
            if (res.ok) {
              window.location.href = "/";
              return;
            }
            const json = await res.json().catch(() => ({}));
            setError(json.error ?? "Could not unlock.");
          } catch {
            setError("Could not reach the server.");
          }
          setBusy(false);
        }}
      >
        <input
          type="password"
          autoFocus
          value={attempt}
          onChange={(e) => setAttempt(e.target.value)}
          placeholder="Passphrase"
          aria-label="Passphrase"
          className="h-12 border border-rule bg-sunk px-3 t-body text-ink placeholder:text-faint focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy || !attempt}
          className="readout h-12 border border-accent px-5 text-accent transition-colors hover:bg-accent hover:text-ground disabled:opacity-40"
        >
          {busy ? "Checking" : "Unlock"}
        </button>
      </form>

      {error && (
        <p className="readout border-l-2 border-refuse pl-3 text-refuse">
          {error}
        </p>
      )}
    </main>
  );
}
