import { NextResponse, type NextRequest } from "next/server";
import { GATE_COOKIE, gateToken, safeEqual } from "@/lib/gate";

/**
 * Runs before every request. Anything without a valid gate cookie gets sent to
 * /unlock — including the API routes, which is the part that actually matters:
 * without this, anyone could POST straight to /api/ask and skip the interface.
 */
export async function middleware(req: NextRequest) {
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
  // Everything except the unlock screen, its own endpoint, and static assets.
  matcher: ["/((?!unlock|api/unlock|_next/static|_next/image|favicon.ico).*)"],
};
