import { generateText } from "ai";
import { ANSWER_MODEL } from "@/lib/config";

// Public, ungated: proves the answer model is reachable and funded without
// exposing any documents. One tiny call per hit.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const r = await generateText({
      model: ANSWER_MODEL,
      prompt: "Reply with exactly: ok",
    });
    return Response.json({ ok: true, reply: r.text.trim().slice(0, 20) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ ok: false, error: msg.slice(0, 300) }, { status: 503 });
  }
}
