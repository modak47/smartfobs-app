import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const productionOnlyInternalPaths = [
  "/app",
  "/dashboard",
  "/bank",
  "/smartfobs",
  "/api/bookkeeping",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProduction = process.env.VERCEL_ENV === "production";
  const isInternalPath = productionOnlyInternalPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  if (isProduction && isInternalPath) {
    return new NextResponse("Not found", { status: 404 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/app/:path*",
    "/dashboard/:path*",
    "/bank/:path*",
    "/smartfobs/:path*",
    "/api/bookkeeping/:path*",
  ],
};
