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
  Project Settings → API. Use the `service_role` key, not `anon`.
- `ANTHROPIC_API_KEY` — console.anthropic.com → API keys. Does the reasoning.
- `OPENAI_API_KEY` — platform.openai.com → API keys. Does the embeddings only,
  and embeddings are cheap: indexing a full casebook costs cents.

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

## The second pass

Every answer is re-read by a **different, more capable model** that decides,
claim by claim, whether the passages actually support it.

The design decision that matters is what the verifier is **not** shown: the
original question. The check is narrow — *is this text supported by this
evidence?* — and knowing what was asked would let it reason about what the
answer was *trying* to say instead of what it said. Withholding the question is
what makes it a second opinion rather than an echo.

The load-bearing instruction in its prompt is this: **a claim can be perfectly
true in the world and still be unsupported here.** That is the failure mode that
actually threatens a lawyer — a real doctrine, correctly stated, cited to a case
that never mentioned it.

It works. Tested against a planted answer with three known defects, it passed
the sourced claim, flagged a genuine citation to *Zippo* (real law, absent from
those passages) as unsupported, and caught a fabricated fact the passages
contradict.

Verification runs on `claude-opus-5` while answers run on `claude-sonnet-5`.
Costs very little — the verifier's output is a few hundred tokens — and its
mistakes aren't correlated with the answerer's, which is the entire point of
asking twice.

## Accuracy tracking — `/rules`

Every question is logged with the numbers behind it before the answer exists, so
a question that crashes mid-answer still leaves a trace. You can rate answers
good or bad. `/rules` then shows:

- What the system promises, in plain language
- The live settings from `lib/config.ts`
- How often the second pass agreed, and how many claims came back unsourced
- **A histogram of best-match score, answered versus refused** — this is how you
  set `SIMILARITY_FLOOR` from evidence instead of from my guess. If refusals
  cluster below your floor and answers above it, the floor is right. Overlap in
  the middle is where you're guessing.

Logging never breaks an answer. If the database write fails it logs to console
and the reader still gets their response.

### The failure mode to remember

When retrieval misses, it looks exactly like "not in my documents." A **no**
from this app means *not found*, never *not there*. For something you're sure
exists, ask again in different words before believing it.

---

## Yours to build

Roughly in order of difficulty. Each one teaches something specific.

- [x] ~~Show scores while you tune.~~ Done — `/rules` has the histogram. Ask
      thirty real questions, then move the floor to where the evidence points.
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

Upgrades worth knowing about: `text-embedding-3-large` is a one-word change in
`lib/config.ts` and measurably better on dense legal text — but it returns 3072
numbers, so `vector(1536)` in the migration has to change to match and every
document has to be re-embedded. Voyage and Cohere both make embedding models
tuned specifically for retrieval that beat OpenAI's; swapping to one means
adding their provider package alongside the two already here.

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
app/api/ask/     retrieve → refuse or answer, streamed, logged
app/api/verify/  the second pass — never shown the question
app/api/rate/    thumbs up / down
app/rules/       the promises, the settings, and the evidence
middleware.ts    the shared-passphrase gate (covers the API routes too)
lib/config.ts    every tunable number, in one file
lib/chunk.ts     the splitter
lib/retrieve.ts  search and the confidence floor
lib/log.ts       question bookkeeping
components/      Console · Trace · Sources · Verdict · VoiceButton · Unlock
supabase/        two migrations — run both, in order
```

Voice uses the browser's built-in Web Speech API: no key, no cost, Chrome and
Edge only.
