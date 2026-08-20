import { db } from "./supabase";
import type { Retrieval } from "./retrieve";

/**
 * Record the question and the numbers behind it, before the answer exists.
 *
 * Logging up front rather than at the end means a question that crashes
 * mid-answer still leaves a trace — those are the ones worth finding.
 */
export async function logQuery(
  question: string,
  r: Retrieval,
  refused: boolean
): Promise<number | null> {
  const { data, error } = await db()
    .from("queries")
    .insert({
      question,
      corpus_chunks: r.corpusChunks,
      candidates: r.candidates.length,
      admitted: r.passages.length,
      floor: r.floor,
      top_score: r.candidates[0]?.similarity ?? null,
      refused,
      passage_ids: r.passages.map((p) => p.id),
    })
    .select("id")
    .single();

  // Never let bookkeeping break an answer.
  if (error) {
    console.error("logQuery failed:", error.message);
    return null;
  }
  return data.id as number;
}

/** Attach the finished answer to a query row. */
export async function logAnswer(queryId: number, answer: string) {
  const { error } = await db().from("queries").update({ answer }).eq("id", queryId);
  if (error) console.error("logAnswer failed:", error.message);
}
