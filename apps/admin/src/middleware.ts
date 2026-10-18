import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, canAccess, verifySession } from "@adonis/core/auth";

// Toate paginile cer autentificare, cu excepția login-ului și a calendarelor iCal exportate
// (Booking/Airbnb le citesc fără cont; linkul conține un token secret per cameră).
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Autentificați-vă." }, { status: 401 });
    const url = new URL("/login", req.url);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (!pathname.startsWith("/api/") && !canAccess(session.role, pathname)) {
    return NextResponse.redirect(new URL(session.role === "housekeeping" || session.role === "maintenance" ? "/curatenie" : "/", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|api/ical|_next/static|_next/image|brand|photos|favicon).*)"],
};
