import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  type UIMessage,
} from "ai";
import { retrieve, asContext } from "@/lib/retrieve";
import { ANSWER_MODEL } from "@/lib/config";
import { logQuery, logAnswer } from "@/lib/log";
import type { LeviathanUIMessage } from "@/ai/types";

export const maxDuration = 60;

const SYSTEM = `You answer only from the passages provided in the user's message.

Rules, without exception:
- Every factual claim must be followed by a bracketed citation to the passage it came from, like [2].
- Quote the exact supporting sentence when the claim is specific.
- If the passages do not answer the question, reply with exactly: Not in the provided sources.
  Then say what search terms might find it. Do not answer partially.
- Never supply case law, holdings, dates, or citations from your own knowledge.
- Do not bridge gaps between passages with inference.
- If two passages conflict, show both quotes and say they conflict.`;

export async function POST(req: Request) {
  const { messages }: { messages: LeviathanUIMessage[] } = await req.json();

  const last = messages[messages.length - 1];
  const question = last?.parts
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join(" ")
    .trim();

  if (!question) return new Response("No question.", { status: 400 });

  const stream = createUIMessageStream<LeviathanUIMessage>({
    execute: async ({ writer }) => {
      writer.write({
        type: "data-trace",
        id: "trace",
        data: {
          corpusChunks: 0,
          candidates: 0,
          admitted: 0,
          floor: 0,
          stage: "searching",
        },
      });

      const r = await retrieve(question);
      const refused = r.passages.length === 0;
      const queryId = await logQuery(question, r, refused);

      if (queryId !== null) {
        writer.write({ type: "data-query", id: "query", data: { id: queryId } });
      }

      writer.write({
        type: "data-trace",
        id: "trace",
        data: {
          corpusChunks: r.corpusChunks,
          candidates: r.candidates.length,
          admitted: r.passages.length,
          floor: r.floor,
          stage: r.passages.length === 0 ? "refused" : "answering",
        },
      });

      writer.write({
        type: "data-sources",
        id: "sources",
        data: { passages: r.passages },
      });

      // Nothing cleared the floor. Refuse here, in code — don't ask the model
      // to be honest when we can simply not give it the opportunity to guess.
      if (refused) {
        const best = r.candidates[0];
        writer.write({
          type: "text-start",
          id: "refusal",
        });
        writer.write({
          type: "text-delta",
          id: "refusal",
          delta:
            `Not in the provided sources.\n\n` +
            `Searched ${r.corpusChunks} passages. ` +
            (best
              ? `The closest match scored ${best.similarity.toFixed(
                  2
                )}, below the ${r.floor} floor — ${best.title}, page ${best.page}.`
              : `Nothing came back at all — is anything ingested yet?`) +
            `\n\nTry naming the doctrine, the party, or a phrase you expect verbatim.`,
        });
        writer.write({ type: "text-end", id: "refusal" });
        if (queryId !== null) await logAnswer(queryId, "Not in the provided sources.");
        return;
      }

      const result = streamText({
        model: ANSWER_MODEL,
        system: SYSTEM,
        messages: [
          ...(await convertToModelMessages(messages.slice(0, -1) as UIMessage[])),
          {
            role: "user",
            content: `PASSAGES\n\n${asContext(r.passages)}\n\nQUESTION\n\n${question}`,
          },
        ],
      });

      // Without an onError here, a provider failure (no credit, bad key, rate
      // limit) reaches the browser as the useless string "An error occurred."
      writer.merge(
        result.toUIMessageStream({
          sendStart: false,
          onError: (e) => (e instanceof Error ? e.message : String(e)),
        })
      );

      // Awaiting the finished text keeps this function alive until generation
      // completes — on serverless, a fire-and-forget write here would often be
      // killed before it landed.
      if (queryId !== null) {
        try {
          await logAnswer(queryId, await result.text);
        } catch {
          /* the answer already reached the reader; bookkeeping can fail quietly */
        }
      }
    },
    onError: (e) => (e instanceof Error ? e.message : String(e)),
  });

  return createUIMessageStreamResponse({ stream });
}
