import { generateText } from "ai";
import { ANSWER_MODEL } from "./config";

/**
 * Plain PDF text extraction reads tables column-by-column and loses which
 * cell belongs to which row and column. A page made mostly of very short
 * lines is almost always a table or grid; those pages are re-read by the
 * model straight from the PDF and rewritten as one line per cell.
 * Prose pages (case reports, briefs) are left exactly as extracted.
 */
export function looksTabular(page: string): boolean {
  const lines = page.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 25) return false;
  const avg = lines.reduce((n, l) => n + l.length, 0) / lines.length;
  return avg < 28;
}

const prompt = (pages: number[]) => `Transcribe page(s) ${pages.join(", ")} of this PDF so that every table can be read line by line.

Rules:
- Copy the document's words exactly. Do not summarize, add facts, or drop any cell.
- Keep ordinary paragraphs as they are.
- For each table, first copy any legend or note that explains how to read it.
- Then write one block per table row, separated by a blank line. Start the block with the row's label, then one line per cell: "- <row label> / <column label>: <cell text>".
- If the document says what a row or column means (for example "each column is that nation's opinion of the row nation"), write each cell line in those terms instead, for example "- Zurozen's view of Lilris: <cell text>".
- Skip empty cells and diagonal "X" cells.

Output each page as a line "=== PAGE <n> ===" followed by its text. Output nothing else.`;

export async function restructureTables(pdf: Uint8Array, pages: string[]): Promise<string[]> {
  const targets = pages.flatMap((p, i) => (looksTabular(p) ? [i + 1] : []));
  if (targets.length === 0) return pages;

  try {
    const { text } = await generateText({
      model: ANSWER_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "file", data: pdf, mediaType: "application/pdf" },
            { type: "text", text: prompt(targets) },
          ],
        },
      ],
    });
    const out = [...pages];
    for (const part of text.split(/^=== PAGE (\d+) ===$/m).slice(1).reduce<[number, string][]>(
      (acc, v, i, arr) => (i % 2 === 0 ? [...acc, [Number(v), arr[i + 1] ?? ""]] : acc),
      []
    )) {
      const [n, body] = part;
      if (targets.includes(n) && body.trim().length > 40) out[n - 1] = body.trim();
    }
    return out;
  } catch (e) {
    // Never fail an upload over this; fall back to the plain extraction.
    console.error("restructureTables failed:", e instanceof Error ? e.message : e);
    return pages;
  }
}
