import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authEdge } from "@/lib/auth-edge";

const protectedRoutes = ["/account", "/company", "/admin"];
const adminRoutes = ["/admin"];

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = protectedRoutes.some((route) =>
    pathname.startsWith(route),
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  const session = await authEdge();

  if (!session?.user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const userType = (session.user as any).type as string;
  const isAdmin = adminRoutes.some((route) => pathname.startsWith(route));

  if (isAdmin && !["MODERATOR", "EDITOR", "SUPER", "ROOT"].includes(userType)) {
    return NextResponse.redirect(new URL("/account", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|login|register).*)"],
};
