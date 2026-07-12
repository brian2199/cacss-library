import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const STAFF_ROUTE_PREFIXES = [
  "/dashboard",
  "/checkout",
  "/scan",
  "/imports",
  "/reports",
  "/labels",
  "/members",
  "/approvals",
];

export async function middleware(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  });
  const isLoggedIn = !!token;
  const role = token?.role as string | undefined;

  const { pathname } = req.nextUrl;

  const publicPaths = ["/", "/login"];
  const isPublicCatalog =
    pathname === "/catalog" ||
    (pathname.startsWith("/catalog/") && pathname.split("/").length === 3);
  const isPublic =
    publicPaths.includes(pathname) ||
    isPublicCatalog ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/_next");

  if (!isPublic && !isLoggedIn) {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  if (isLoggedIn && pathname === "/login") {
    const dest = role === "MEMBER" ? "/catalog" : "/dashboard";
    return NextResponse.redirect(new URL(dest, req.nextUrl.origin));
  }

  if (
    isLoggedIn &&
    role === "MEMBER" &&
    STAFF_ROUTE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  ) {
    return NextResponse.redirect(new URL("/account", req.nextUrl.origin));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
