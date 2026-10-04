import { embedMany } from "ai";
import { extractText } from "unpdf";
import mammoth from "mammoth";
import { db } from "@/lib/supabase";
import { chunkPages } from "@/lib/chunk";
import { restructureTables } from "@/lib/structure";
import { EMBEDDING_MODEL } from "@/lib/config";

export const maxDuration = 300;

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return Response.json({ error: "Send a file as `file`." }, { status: 400 });
  }

  // PDF, Word, Markdown and plain text are all accepted — world notes live in
  // whatever format the writer uses.
  const name = file.name;
  const ext = (name.match(/\.([a-z0-9]+)$/i)?.[1] ?? "").toLowerCase();
  const buffer = new Uint8Array(await file.arrayBuffer());
  let pages: string[];
  let totalPages: number;
  let contentType = file.type || "application/octet-stream";
  try {
    if (ext === "pdf" || file.type === "application/pdf") {
      const extracted = await extractText(buffer);
      totalPages = extracted.totalPages;
      pages = await restructureTables(
        buffer,
        Array.isArray(extracted.text) ? extracted.text : [extracted.text]
      );
      contentType = "application/pdf";
    } else if (ext === "docx") {
      const { value } = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
      pages = textPages(value);
      totalPages = pages.length;
    } else if (["txt", "md", "markdown", "text"].includes(ext) || file.type.startsWith("text/")) {
      pages = textPages(new TextDecoder().decode(buffer));
      totalPages = pages.length;
    } else {
      return Response.json(
        { error: `Can't read .${ext || "this"} files yet. Use PDF, Word (.docx), Markdown or plain text. For Google Docs: File → Download → .docx.` },
        { status: 415 }
      );
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ error: `Couldn't read ${name}. ${message}` }, { status: 422 });
  }

  const chunks = chunkPages(pages);
  if (chunks.length === 0) {
    return Response.json(
      {
        error:
          "No text found. If this is a scanned PDF it needs OCR first; otherwise check the file isn't empty.",
      },
      { status: 422 }
    );
  }

  // One request per batch keeps us under provider input limits on big filings.
  // TODO(you): a 900-page record will still be slow and will block the request.
  // Moving this to a background job is a good second project.
  const embeddings: number[][] = [];
  const BATCH = 96;
  try {
    for (let i = 0; i < chunks.length; i += BATCH) {
      const { embeddings: batch } = await embedMany({
        model: EMBEDDING_MODEL,
        values: chunks.slice(i, i + BATCH).map((c) => c.content),
      });
      embeddings.push(...batch);
    }
  } catch (e) {
    // Provider failures are the most common thing to go wrong here — no
    // credit, bad key, rate limit. Say which, in JSON, so the interface can
    // show it instead of choking on an HTML error page.
    const message = e instanceof Error ? e.message : String(e);
    return Response.json(
      { error: `Embedding failed. ${message}` },
      { status: 502 }
    );
  }

  const supabase = db();
  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .insert({ title: name.replace(/\.[a-z0-9]+$/i, ""), page_count: totalPages })
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

  // Keep the original so the document can be re-processed when ingestion
  // improves. A failure here never fails the upload.
  await supabase.storage.createBucket("originals", { public: false }).catch(() => {});
  const { error: storeErr } = await supabase.storage
    .from("originals")
    .upload(`${doc.id}.${ext || "bin"}`, buffer, { contentType, upsert: true });
  if (storeErr) console.error("original not stored:", storeErr.message);

  return Response.json({
    title: doc.title,
    pages: totalPages,
    chunks: chunks.length,
  });
}

/**
 * Split non-PDF text into citeable "pages" of about 3,000 characters, breaking
 * at blank lines so headings stay with their sections.
 */
function textPages(text: string): string[] {
  const paras = text.replace(/\r\n/g, "\n").split(/\n{2,}/);
  const pages: string[] = [];
  let cur = "";
  for (const p of paras) {
    if (cur && cur.length + p.length > 3000) {
      pages.push(cur);
      cur = "";
    }
    cur += (cur ? "\n\n" : "") + p;
  }
  if (cur.trim()) pages.push(cur);
  return pages;
}
