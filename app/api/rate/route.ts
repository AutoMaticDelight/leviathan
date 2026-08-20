import { db } from "@/lib/supabase";

/** Thumbs up / down on an answer. Feeds the floor evidence on /rules. */
export async function POST(req: Request) {
  const { queryId, rating } = (await req.json()) as {
    queryId?: number;
    rating?: number;
  };
  if (typeof queryId !== "number" || ![1, -1, 0].includes(rating ?? NaN)) {
    return Response.json(
      { error: "queryId and rating (1, -1, 0) required." },
      { status: 400 }
    );
  }

  const { error } = await db()
    .from("queries")
    .update({ rating: rating === 0 ? null : rating })
    .eq("id", queryId);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true });
}
