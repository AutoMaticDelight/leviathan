import { NextResponse, type NextRequest } from "next/server";
import { GATE_COOKIE, gateToken, safeEqual } from "@/lib/gate";

/**
 * Runs before every request. Anything without a valid gate cookie gets sent to
 * /unlock — including the API routes, which is the part that actually matters:
 * without this, anyone could POST straight to /api/ask and skip the interface.
 */
// Bryan's own link to /activity, no passphrase: /activity?key=<owner token>.
// Only the SHA-256 of the token lives in the code.
const OWNER_KEY_SHA256 = "8218ee23531e03693bb8bb706911cfb869ee51b14b8c6d4a962fa86324738a8a";

async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function middleware(req: NextRequest) {
  if (req.nextUrl.pathname === "/activity") {
    const key = req.nextUrl.searchParams.get("key");
    if (key && (await sha256Hex(key)) === OWNER_KEY_SHA256) return NextResponse.next();
  }

  const passphrase = process.env.LEVIATHAN_PASSPHRASE;

  // No passphrase configured = no gate. Local development stays frictionless.
  if (!passphrase) return NextResponse.next();

  const cookie = req.cookies.get(GATE_COOKIE)?.value;
  if (cookie && safeEqual(cookie, await gateToken(passphrase))) {
    return NextResponse.next();
  }

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return Response.json({ error: "Locked." }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/unlock";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except the unlock screen, its own endpoint, the health check, and static assets.
  matcher: ["/((?!unlock|api/unlock|api/health|_next/static|_next/image|favicon.ico).*)"],
};
