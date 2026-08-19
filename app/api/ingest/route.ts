import { embedMany } from "ai";
import { extractText } from "unpdf";
import { db } from "@/lib/supabase";
import { chunkPages } from "@/lib/chunk";
import { EMBEDDING_MODEL } from "@/lib/config";

export const maxDuration = 300;

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return Response.json({ error: "Send a PDF as `file`." }, { status: 400 });
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  const { totalPages, text } = await extractText(buffer);
  const pages = Array.isArray(text) ? text : [text];

  const chunks = chunkPages(pages);
  if (chunks.length === 0) {
    return Response.json(
      {
        error:
          "No text found. This is probably a scanned PDF — it needs OCR before it can be indexed.",
      },
      { status: 422 }
    );
  }

  // One request per batch keeps us under provider input limits on big filings.
  // TODO(you): a 900-page record will still be slow and will block the request.
  // Moving this to a background job is a good second project.
  const embeddings: number[][] = [];
  const BATCH = 96;
  for (let i = 0; i < chunks.length; i += BATCH) {
    const { embeddings: batch } = await embedMany({
      model: EMBEDDING_MODEL,
      values: chunks.slice(i, i + BATCH).map((c) => c.content),
    });
    embeddings.push(...batch);
  }

  const supabase = db();
  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .insert({ title: file.name.replace(/\.pdf$/i, ""), page_count: totalPages })
    .select()
    .single();
  if (docErr) return Response.json({ error: docErr.message }, { status: 500 });

  const { error: rowsErr } = await supabase.from("chunks").insert(
    chunks.map((c, i) => ({
      document_id: doc.id,
      ordinal: c.ordinal,
      page: c.page,
      content: c.content,
      embedding: embeddings[i],
    }))
  );
  if (rowsErr) return Response.json({ error: rowsErr.message }, { status: 500 });

  return Response.json({
    title: doc.title,
    pages: totalPages,
    chunks: chunks.length,
  });
}
