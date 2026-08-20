import { generateObject } from "ai";
import { z } from "zod";
import { db } from "@/lib/supabase";
import { VERIFIER_MODEL } from "@/lib/config";

export const maxDuration = 120;

/**
 * The second opinion.
 *
 * Deliberately NOT given the original question. The check is narrow — "is this
 * text supported by this evidence?" — and knowing what was asked would let the
 * verifier reason about what the answer was *trying* to say instead of what it
 * actually said. Withholding the question is what makes this a second opinion
 * rather than an echo.
 */
const SYSTEM = `You are auditing whether an answer is supported by the passages it was given.

You did not write the answer and have no stake in it. Be skeptical.

Break the answer into its individual factual claims. For each one:
- "supported"    — a passage establishes it. Quote the exact sentence that does.
- "unsupported"  — nothing in the passages establishes it.
- "contradicted" — a passage says otherwise. Quote it.

The rule that matters most: a claim can be perfectly TRUE IN THE WORLD and still
be "unsupported" here. You are not checking whether the answer is correct. You
are checking whether these passages prove it. If you find yourself using your own
knowledge of law or fact to justify a claim, that claim is unsupported.

Ignore style, hedging, tone, and formatting. Ignore the bracketed citation
markers themselves — judge the substance they are attached to. Do not treat a
direct quotation as supported unless the quoted words actually appear.`;

const Verdict = z.object({
  claims: z
    .array(
      z.object({
        claim: z.string().describe("The factual claim, quoted or closely paraphrased from the answer."),
        verdict: z.enum(["supported", "unsupported", "contradicted"]),
        evidence: z
          .string()
          .describe(
            "If supported or contradicted: the exact sentence from the passages. If unsupported: what is missing."
          ),
      })
    )
    .describe("One entry per factual claim, in the order they appear."),
  note: z.string().describe("One sentence on the answer as a whole."),
});

export async function POST(req: Request) {
  const { queryId } = (await req.json()) as { queryId?: number };
  if (typeof queryId !== "number") {
    return Response.json({ error: "queryId required." }, { status: 400 });
  }

  const supabase = db();

  // Don't pay to verify the same answer twice.
  const { data: existing } = await supabase
    .from("verifications")
    .select("*")
    .eq("query_id", queryId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) return Response.json(existing);

  const { data: query, error: qErr } = await supabase
    .from("queries")
    .select("answer, refused, passage_ids")
    .eq("id", queryId)
    .single();
  if (qErr || !query) {
    return Response.json({ error: "No such query." }, { status: 404 });
  }
  if (query.refused || !query.answer) {
    return Response.json({ error: "Nothing to verify." }, { status: 409 });
  }

  const { data: passages } = await supabase
    .from("chunks")
    .select("id, page, content")
    .in("id", query.passage_ids);

  // Numbering must match what the answerer saw, or the citations won't line up.
  const order = new Map<number, number>(
    (query.passage_ids as number[]).map((id, i) => [id, i + 1])
  );
  const context = (passages ?? [])
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    .map((p) => `[${order.get(p.id)}] page ${p.page}\n${p.content}`)
    .join("\n\n---\n\n");

  let object: z.infer<typeof Verdict>;
  try {
    ({ object } = await generateObject({
      model: VERIFIER_MODEL,
      schema: Verdict,
      system: SYSTEM,
      prompt: `PASSAGES\n\n${context}\n\nANSWER TO AUDIT\n\n${query.answer}`,
    }));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ error: `Verification failed. ${message}` }, { status: 502 });
  }

  const supported = object.claims.filter((c) => c.verdict === "supported").length;
  const unsupported = object.claims.filter((c) => c.verdict === "unsupported").length;
  const contradicted = object.claims.filter((c) => c.verdict === "contradicted").length;

  const { data: saved, error: sErr } = await supabase
    .from("verifications")
    .insert({
      query_id: queryId,
      model: "claude-opus-5",
      agrees: unsupported === 0 && contradicted === 0,
      supported,
      unsupported,
      contradicted,
      claims: object.claims,
      note: object.note,
    })
    .select()
    .single();
  if (sErr) return Response.json({ error: sErr.message }, { status: 500 });

  return Response.json(saved);
}
