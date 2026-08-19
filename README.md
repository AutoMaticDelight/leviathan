# Leviathan

Closed-universe search over your own PDFs. It answers **only** from documents
you have added, cites the passage behind every claim, and refuses plainly when
it has nothing — instead of inventing something that reads correct.

It is deliberately unfinished. The pipeline works end to end; the interesting
decisions are still open, and they're marked `TODO(you)` in the code.

---

## Setup

**1. Supabase** — make a free project at [supabase.com](https://supabase.com).
Open the SQL editor, paste in all of `supabase/migrations/0001_init.sql`, run it.
That creates the tables and turns on `pgvector`, the extension that makes
similarity search possible.

**2. Keys** — copy `.env.local.example` to `.env.local` and fill in three values:

```bash
cp .env.local.example .env.local
```

- `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` — Supabase, under
  Project Settings → API.
- `AI_GATEWAY_API_KEY` — [Vercel AI Gateway](https://vercel.com/docs/ai-gateway).
  One key reaches every model; you can swap Claude for Gemini by editing a
  single string in `lib/config.ts`.

**3. Run it**

```bash
npm run dev
```

Open http://localhost:3000, click **+ Add PDF**, and ask it something.

**4. Deploy** — push to GitHub, import at vercel.com, paste the same three
environment variables in. You get a URL that works on your phone.

---

## How it works

Five steps. Understand these and you understand every "chat with your documents"
product on the market.

1. **Extract** — `app/api/ingest/route.ts` pulls the text out of the PDF, page
   by page, so citations can point at a real page number.
2. **Chunk** — `lib/chunk.ts` cuts each page into overlapping passages. Too big
   and citations get vague; too small and passages lose their meaning.
3. **Embed** — each passage becomes 1536 numbers describing what it *means*.
   Passages about the same idea end up near each other in that space, even when
   they share no words.
4. **Retrieve** — `lib/retrieve.ts` embeds your question the same way and asks
   Postgres for the nearest passages. Anything scoring below
   `SIMILARITY_FLOOR` is thrown away **here**, before the model exists.
5. **Answer** — the model sees the surviving passages and nothing else.

Step 4 is what makes the universe closed. The model isn't being trusted to be
honest — it is simply never given the chance to guess.

### The number that matters

`SIMILARITY_FLOOR` in `lib/config.ts`, currently `0.32`.

Too low and it answers from junk. Too high and it refuses things it genuinely
has. There is no correct value, only the one that suits your documents. Find it
by asking twenty questions you already know the answers to and watching the
scores in the source panel.

### The failure mode to remember

When retrieval misses, it looks exactly like "not in my documents." A **no**
from this app means *not found*, never *not there*. For something you're sure
exists, ask again in different words before believing it.

---

## Yours to build

Roughly in order of difficulty. Each one teaches something specific.

- [ ] **Show scores while you tune.** Log every similarity to the console, ask
      thirty real questions, then set the floor from evidence instead of my guess.
- [ ] **Highlight the quoted sentence** inside the source passage, not just the
      passage. Small change, large difference in how much you trust it.
- [ ] **Re-rank.** Retrieve twenty, then have a cheap model score each one for
      actual relevance and keep the best five. This is where you learn that
      retrieval quality — not model quality — is the whole game.
- [ ] **Query expansion.** Rewrite the question three ways, retrieve for each,
      merge. The direct fix for *not found* masquerading as *not there*.
- [ ] **A legal-aware chunker.** `lib/chunk.ts` doesn't know what a headnote,
      a numbered paragraph, a footnote, or a dissent is. Teaching it is the
      highest-value change in this repo.
- [ ] **Transcript mode.** Paste a Whisper transcript, run the cleanup prompt
      against it, get clean text plus core ideas. Small feature, immediately useful.
- [ ] **Collections.** One index per course, so Evidence questions don't retrieve
      Con Law passages.
- [ ] **Delete a document.** There is currently no way to remove one. You will
      want this within a week.
- [ ] **Background ingest.** A 900-page record blocks the request today.
- [ ] **Sign-in and RLS.** The database is wide open behind a server-only key.
      Fine for one person; not fine the moment anyone else has the URL.

Upgrades worth knowing about: `voyage/voyage-3.5` and `cohere/embed-v4.0` are
embedding models tuned for retrieval quality and generally beat the default on
dense legal text. Changing model means changing `vector(1536)` in the migration
to match — and re-embedding everything.

---

## Boundaries

- **Cloud.** Public case law and casebook material only. Confidential client
  files need a local build — a good next project, not this one.
- **Text PDFs only.** Scanned pages have no text layer; they need OCR first.
  The ingest route tells you when it hits one.
- **Verify every citation in Westlaw before it goes in a document.** This tool
  quotes what it was given. It cannot tell you the case is still good law.

---

## Layout

```
app/api/ingest/  extract → chunk → embed → store
app/api/ask/     retrieve → refuse or answer, streamed
lib/config.ts    every tunable number, in one file
lib/chunk.ts     the splitter
lib/retrieve.ts  search and the confidence floor
components/      Console (shell) · Trace (narration) · Sources · VoiceButton
supabase/        the migration — run once
```

Voice uses the browser's built-in Web Speech API: no key, no cost, Chrome and
Edge only.
