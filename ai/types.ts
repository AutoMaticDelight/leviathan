import type { UIMessage } from "ai";

/** A passage as the browser sees it. */
export type SourcePassage = {
  id: number;
  title: string;
  page: number;
  content: string;
  similarity: number;
};

/**
 * Custom message type. The `trace` and `sources` data parts are what let the
 * interface narrate retrieval instead of showing a spinner.
 */
export type LeviathanUIMessage = UIMessage<
  never,
  {
    trace: {
      corpusChunks: number;
      candidates: number;
      admitted: number;
      floor: number;
      stage: "searching" | "ranking" | "answering" | "refused";
    };
    sources: { passages: SourcePassage[] };
  }
>;
