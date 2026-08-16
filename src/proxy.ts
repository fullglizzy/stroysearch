import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authEdge } from "@/lib/auth-edge";
import type { SessionUser } from "@/types";

const ADMIN_TYPES = ["MODERATOR", "EDITOR", "SUPER", "ROOT"];

// Кабинет, соответствующий типу пользователя — туда редиректим из чужих разделов
function homeForType(type: string): string {
  if (type === "COMPANY") return "/company";
  if (ADMIN_TYPES.includes(type)) return "/admin";
  return "/account";
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const cabinet = pathname.split("/")[1];

  const isAccount = cabinet === "account";
  const isCompany = cabinet === "company";
  const isAdmin = cabinet === "admin";

  if (!isAccount && !isCompany && !isAdmin) {
    return NextResponse.next();
  }

  const session = await authEdge();

  if (!session?.user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const userType = (session.user as SessionUser).type;

  // Каждый кабинет доступен только своей роли:
  // /account — участникам, /company — компаниям, /admin — модераторам
  if (isAdmin) {
    if (!ADMIN_TYPES.includes(userType)) {
      return NextResponse.redirect(new URL(homeForType(userType), request.url));
    }
  } else if (isCompany) {
    if (userType !== "COMPANY") {
      return NextResponse.redirect(new URL(homeForType(userType), request.url));
    }
  } else if (isAccount) {
    if (userType !== "COMMON") {
      return NextResponse.redirect(new URL(homeForType(userType), request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|login|register).*)"],
};
