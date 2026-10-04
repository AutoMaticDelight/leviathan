import { db } from "@/lib/supabase";

// What the reader wants next. Stored as small JSON files so no schema change
// is needed; read back on /activity.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const picks = Array.isArray(body?.picks) ? body.picks.map(String).slice(0, 10) : [];
  const note = typeof body?.note === "string" ? body.note.slice(0, 2000) : "";
  if (picks.length === 0 && !note.trim()) {
    return Response.json({ error: "Pick something or write a note." }, { status: 400 });
  }
  const supabase = db();
  await supabase.storage.createBucket("feedback", { public: false }).catch(() => {});
  const at = new Date().toISOString();
  const { error } = await supabase.storage
    .from("feedback")
    .upload(`${at}.json`, JSON.stringify({ at, picks, note }), { contentType: "application/json" });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
