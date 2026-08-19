import { embed } from "ai";
import { db } from "./supabase";
import { EMBEDDING_MODEL, RETRIEVE_COUNT, SIMILARITY_FLOOR } from "./config";

export type Passage = {
  id: number;
  title: string;
  page: number;
  content: string;
  similarity: number;
};

export type Retrieval = {
  corpusChunks: number;
  candidates: Passage[];   // everything the search returned
  passages: Passage[];     // only what cleared SIMILARITY_FLOOR — the model sees these
  floor: number;
};

/**
 * Turn a question into a vector, find the nearest passages, and split them at
 * the confidence floor. Everything below the floor is discarded here and never
 * reaches the model — that discard is what makes the universe closed.
 */
export async function retrieve(question: string): Promise<Retrieval> {
  const supabase = db();

  const { count } = await supabase
    .from("chunks")
    .select("*", { count: "exact", head: true });

  const { embedding } = await embed({
    model: EMBEDDING_MODEL,
    value: question,
  });

  const { data, error } = await supabase.rpc("match_chunks", {
    query_embedding: embedding,
    match_count: RETRIEVE_COUNT,
  });
  if (error) throw new Error(`Retrieval failed: ${error.message}`);

  const candidates = (data ?? []) as Passage[];

  return {
    corpusChunks: count ?? 0,
    candidates,
    passages: candidates.filter((p) => p.similarity >= SIMILARITY_FLOOR),
    floor: SIMILARITY_FLOOR,
  };
}

/** The passages, formatted for the model. Numbering here is what it cites by. */
export function asContext(passages: Passage[]): string {
  return passages
    .map(
      (p, i) =>
        `[${i + 1}] ${p.title}, page ${p.page}\n${p.content}`
    )
    .join("\n\n---\n\n");
}
