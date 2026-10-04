import { embedMany, generateText } from "ai";
import { retrieve, asContext } from "@/lib/retrieve";
import { ANSWER_MODEL } from "@/lib/config";
import { db } from "@/lib/supabase";
import { chunkPages } from "@/lib/chunk";
import { EMBEDDING_MODEL } from "@/lib/config";
import { GEOPOLITICS_TITLE, geopoliticsPages } from "@/lib/fixes/geopolitics-readable";

// One-time repair of JD's table document. Idempotent: replaces that one
// document's passages with the rebuilt text, and does nothing on a rerun.
// Remove after it has run.
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// JD's real question, run against the live index after the rebuild.
async function check() {
  const q = "Which nations would Zurozen consider friendly?";
  const r = await retrieve(q);
  const { text } = await generateText({
    model: ANSWER_MODEL,
    system: "Answer only from the passages. Cite each claim like [1]. If they don't answer it, say: Not in the provided sources.",
    prompt: `PASSAGES\n\n${asContext(r.passages)}\n\nQUESTION\n\n${q}`,
  });
  return {
    top: r.passages.slice(0, 3).map((p) => ({ score: Number(p.similarity.toFixed(2)), start: p.content.slice(0, 60) })),
    answer: text,
  };
}

export async function GET() {
  const supabase = db();
  const { data: doc } = await supabase
    .from("documents").select("id").eq("title", GEOPOLITICS_TITLE).single();
  if (!doc) return Response.json({ ok: false, error: "document not found" }, { status: 404 });

  const { data: probe } = await supabase
    .from("chunks").select("id").eq("document_id", doc.id).like("content", "How Zurozen sees%").limit(1);
  if (probe && probe.length) return Response.json({ ok: true, note: "already rebuilt", check: await check() });

  const chunks = chunkPages(geopoliticsPages());
  const { embeddings } = await embedMany({ model: EMBEDDING_MODEL, values: chunks.map((c) => c.content) });

  const { error: delErr } = await supabase.from("chunks").delete().eq("document_id", doc.id);
  if (delErr) return Response.json({ ok: false, error: delErr.message }, { status: 500 });
  const { error } = await supabase.from("chunks").insert(
    chunks.map((c, i) => ({ document_id: doc.id, ordinal: c.ordinal, page: 1, content: c.content, embedding: embeddings[i] }))
  );
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true, passages: chunks.length, check: await check() });
}
