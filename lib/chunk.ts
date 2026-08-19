import { CHUNK_SIZE, CHUNK_OVERLAP } from "./config";

export type Chunk = { ordinal: number; page: number; content: string };

/**
 * Split each page into overlapping windows, preferring to break at a paragraph
 * or sentence boundary so citations land on whole thoughts.
 *
 * This is the naive version on purpose. It knows nothing about headnotes,
 * numbered paragraphs, footnotes, or where an opinion stops and a dissent
 * begins — all of which matter in a case report.
 *
 * TODO(you): a legal-aware splitter is the single highest-value upgrade here.
 */
export function chunkPages(pages: string[]): Chunk[] {
  const chunks: Chunk[] = [];
  let ordinal = 0;

  pages.forEach((raw, i) => {
    const text = raw.replace(/\s+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim();
    if (!text) return;

    let cursor = 0;
    while (cursor < text.length) {
      let end = Math.min(cursor + CHUNK_SIZE, text.length);

      if (end < text.length) {
        const window = text.slice(cursor, end);
        const breakAt = Math.max(
          window.lastIndexOf("\n\n"),
          window.lastIndexOf(". "),
          window.lastIndexOf("; ")
        );
        // Only honour the break if it isn't uselessly early in the window.
        if (breakAt > CHUNK_SIZE * 0.5) end = cursor + breakAt + 1;
      }

      const content = text.slice(cursor, end).trim();
      if (content.length > 40) {
        chunks.push({ ordinal: ordinal++, page: i + 1, content });
      }

      if (end >= text.length) break;
      cursor = Math.max(end - CHUNK_OVERLAP, cursor + 1);
    }
  });

  return chunks;
}
