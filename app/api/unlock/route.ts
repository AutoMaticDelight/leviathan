import { GATE_COOKIE, gateToken, safeEqual } from "@/lib/gate";

export async function POST(req: Request) {
  const passphrase = process.env.LEVIATHAN_PASSPHRASE;
  if (!passphrase) {
    return Response.json({ error: "No passphrase configured." }, { status: 500 });
  }

  const { attempt } = (await req.json()) as { attempt?: string };
  if (typeof attempt !== "string" || !safeEqual(attempt, passphrase)) {
    return Response.json({ error: "Not that one." }, { status: 401 });
  }

  const res = Response.json({ ok: true });
  res.headers.set(
    "Set-Cookie",
    [
      `${GATE_COOKIE}=${await gateToken(passphrase)}`,
      "Path=/",
      "HttpOnly",         // JavaScript can't read it, so a script injection can't steal it
      "SameSite=Lax",
      "Max-Age=31536000", // a year — nobody should type this twice a semester
      process.env.NODE_ENV === "production" ? "Secure" : "",
    ]
      .filter(Boolean)
      .join("; ")
  );
  return res;
}
